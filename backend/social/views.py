import io

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q
from PIL import Image, ImageOps
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from accounts.relations import blocked_ids, friend_ids
from accounts.serializers import PublicUserSerializer
from communities.models import Membership
from communities.views import STAFF
from notifications.services import notify

from .models import Comment, Favorite, Post, PostMedia, Reaction


class CommentSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'author', 'parent', 'text', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']


MAX_IMAGES = 4
MAX_UPLOAD = 8 * 1024 * 1024


def process_image(f):
    """Validate (real image, JPEG/PNG/WEBP, <= 8 Mo) and recompress to a bounded JPEG; strips EXIF/metadata."""
    if f.size > MAX_UPLOAD:
        raise serializers.ValidationError('Image trop lourde (8 Mo max).')
    try:
        img = Image.open(f)
        if img.format not in ('JPEG', 'PNG', 'WEBP'):
            raise ValueError
        img = ImageOps.exif_transpose(img).convert('RGB')
    except Exception:
        raise serializers.ValidationError('Fichier image invalide (JPEG, PNG ou WEBP).')
    img.thumbnail((1600, 1600))
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=82, optimize=True)
    return ContentFile(buf.getvalue(), name='photo.jpg')


class PostSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)
    reaction_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    reacted = serializers.BooleanField(read_only=True)
    favorited = serializers.BooleanField(read_only=True)
    media = serializers.SerializerMethodField()
    community_name = serializers.CharField(source='community.name', read_only=True, default=None)

    class Meta:
        model = Post
        fields = ['id', 'author', 'text', 'community', 'community_name', 'media', 'created_at', 'updated_at',
                  'reaction_count', 'comment_count', 'reacted', 'favorited']
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {'text': {'required': False, 'allow_blank': True}}

    def get_media(self, p):
        return [m.image.url for m in p.media.all()]


class PostViewSet(viewsets.ModelViewSet):
    serializer_class = PostSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        u = self.request.user
        p = self.request.query_params
        qs = (Post.objects.filter(is_deleted=False).exclude(author_id__in=blocked_ids(u))
              .select_related('author', 'community').prefetch_related('media')
              .annotate(reaction_count=Count('reactions', distinct=True),
                        comment_count=Count('comments', distinct=True),
                        reacted=Exists(Reaction.objects.filter(post=OuterRef('pk'), user=u)),
                        favorited=Exists(Favorite.objects.filter(post=OuterRef('pk'), user=u))))
        if self.action != 'list':
            return qs.order_by('-created_at', '-id')
        if p.get('community'):
            qs = qs.filter(community_id=p['community'])
        elif p.get('author'):
            qs = qs.filter(author__username__iexact=p['author'], community__isnull=True)
        elif p.get('scope') == 'campus':
            qs = qs.filter(community__isnull=True)
        elif p.get('scope') == 'favorites':
            qs = qs.filter(favorited=True)
        else:  # default feed: me + friends, plus communities I belong to
            mine = Membership.objects.filter(community=OuterRef('community'), user=u)
            qs = qs.filter(Q(community__isnull=True, author_id__in=friend_ids(u) | {u.id}) | Exists(mine))
        return qs.order_by('-created_at', '-id')

    def _can_moderate(self, post):
        if not post.community_id:
            return False
        return Membership.objects.filter(community_id=post.community_id, user=self.request.user,
                                         role__in=STAFF).exists()

    def create(self, request, *args, **kwargs):
        text = str(request.data.get('text', '')).strip()
        files = request.FILES.getlist('images')
        if not text and not files:
            return Response({'text': 'Ajoute du texte ou une photo.'}, status=400)
        if len(files) > MAX_IMAGES:
            return Response({'images': f'{MAX_IMAGES} photos maximum.'}, status=400)
        community = request.data.get('community') or None
        if community and not Membership.objects.filter(community_id=community, user=request.user).exists():
            raise PermissionDenied("Rejoins la communauté pour y publier.")
        images = [process_image(f) for f in files]  # validate everything before writing anything
        with transaction.atomic():
            post = Post.objects.create(author=request.user, text=text, community_id=community)
            for i, img in enumerate(images):
                PostMedia.objects.create(post=post, image=img, position=i)
        ser = self.get_serializer(self.get_queryset().get(pk=post.pk))
        return Response(ser.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        if serializer.instance.author_id != self.request.user.id:
            raise PermissionDenied('Vous ne pouvez modifier que vos publications.')
        serializer.save(community=serializer.instance.community)

    def perform_destroy(self, instance):
        u = self.request.user
        if instance.author_id != u.id and not u.is_staff and not self._can_moderate(instance):
            raise PermissionDenied('Vous ne pouvez supprimer que vos publications.')
        instance.is_deleted = True  # soft delete keeps history for moderation
        instance.save(update_fields=['is_deleted'])

    def _toggle(self, model, request, pk):
        post = self.get_object()
        obj, created = model.objects.get_or_create(post=post, user=request.user)
        if not created:
            obj.delete()
        elif model is Reaction:
            notify(post.author, 'social', f'{request.user.first_name or request.user.username} a aimé ta publication.',
                   '/', actor=request.user, key=f'react:{post.id}')
        return Response({'active': created})

    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        return self._toggle(Reaction, request, pk)

    @action(detail=True, methods=['post'])
    def favorite(self, request, pk=None):
        return self._toggle(Favorite, request, pk)

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        post = self.get_object()
        if request.method == 'GET':
            return Response(CommentSerializer(post.comments.select_related('author'), many=True).data)
        ser = CommentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        parent = ser.validated_data.get('parent')
        if parent and parent.post_id != post.id:
            return Response({'parent': 'Commentaire parent invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        cm = ser.save(post=post, author=request.user)
        who = request.user.first_name or request.user.username
        notify(post.author, 'social', f'{who} a commenté ta publication.', '/', actor=request.user, key=f'comment:{post.id}')
        if parent:
            notify(parent.author, 'social', f'{who} a répondu à ton commentaire.', '/', actor=request.user)
        return Response(ser.data, status=status.HTTP_201_CREATED)
