from django.db.models import Count, Q
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.models import User
from accounts.serializers import PublicUserSerializer
from notifications.services import notify

from .models import Community, Membership

MANAGERS = (Membership.Role.CREATOR, Membership.Role.ADMIN)
STAFF = MANAGERS + (Membership.Role.MODERATOR,)


class CommunitySerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Community
        fields = ['id', 'name', 'description', 'rules', 'category', 'created_at', 'member_count', 'my_role']
        read_only_fields = ['id', 'created_at']

    def get_my_role(self, c):
        m = self.context['request'].user.memberships.filter(community=c).first()
        return m.role if m else None


class CommunityViewSet(viewsets.ModelViewSet):
    serializer_class = CommunitySerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = Community.objects.annotate(member_count=Count('memberships')).order_by('-member_count', 'name')
        u = self.request.user
        p = self.request.query_params
        if p.get('scope') == 'mine':
            qs = qs.filter(memberships__user=u)
        elif p.get('scope') == 'discover':
            qs = qs.exclude(memberships__user=u)
        q = p.get('q', '').strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q))
        return qs

    def _role(self, community):
        m = Membership.objects.filter(community=community, user=self.request.user).first()
        return m.role if m else None

    def create(self, request, *args, **kwargs):
        if request.user.verification != User.Verification.VERIFIED:
            raise PermissionDenied('Seuls les comptes vérifiés peuvent créer une communauté.')
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        c = serializer.save(created_by=self.request.user)
        Membership.objects.create(community=c, user=self.request.user, role=Membership.Role.CREATOR)

    def perform_update(self, serializer):
        if self._role(serializer.instance) not in MANAGERS:
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if self._role(instance) != Membership.Role.CREATOR:
            raise PermissionDenied('Seul le créateur peut supprimer la communauté.')
        instance.delete()

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        c = self.get_object()
        Membership.objects.get_or_create(community=c, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        c = self.get_object()
        if self._role(c) == Membership.Role.CREATOR:
            return Response({'detail': 'Le créateur ne peut pas quitter sa communauté.'}, status=400)
        Membership.objects.filter(community=c, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        c = self.get_object()
        rows = c.memberships.select_related('user').order_by('joined_at')
        return Response([{**PublicUserSerializer(m.user).data, 'role': m.role} for m in rows])

    @action(detail=True, methods=['post'], url_path=r'members/(?P<user_id>\d+)/role')
    def set_role(self, request, pk=None, user_id=None):
        c = self.get_object()
        if self._role(c) not in MANAGERS:
            raise PermissionDenied()
        role = request.data.get('role')
        if role not in (Membership.Role.ADMIN, Membership.Role.MODERATOR, Membership.Role.MEMBER):
            return Response({'role': 'Rôle invalide.'}, status=400)
        m = Membership.objects.filter(community=c, user_id=user_id).first()
        if not m or m.role == Membership.Role.CREATOR:
            return Response({'detail': 'Membre introuvable ou protégé.'}, status=400)
        m.role = role
        m.save(update_fields=['role'])
        label = dict(Membership.Role.choices)[role]
        notify(m.user, 'groups', f'Tu es maintenant {label.lower()} de « {c.name} ».', f'/communautes/{c.id}', actor=request.user)
        return Response({'role': role})

    @action(detail=True, methods=['post'], url_path=r'members/(?P<user_id>\d+)/remove')
    def remove_member(self, request, pk=None, user_id=None):
        c = self.get_object()
        if self._role(c) not in STAFF:
            raise PermissionDenied()
        m = Membership.objects.filter(community=c, user_id=user_id).first()
        if not m or m.role in (Membership.Role.CREATOR, Membership.Role.ADMIN) and self._role(c) != Membership.Role.CREATOR:
            return Response({'detail': 'Action impossible.'}, status=400)
        if m.role == Membership.Role.CREATOR:
            return Response({'detail': 'Action impossible.'}, status=400)
        m.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
