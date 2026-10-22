from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Block, Friendship, User
from .relations import blocked_ids, friend_ids, relation
from .serializers import PublicUserSerializer
from notifications.services import notify


class ProfileSerializer(PublicUserSerializer):
    relation = serializers.SerializerMethodField()
    friends_count = serializers.SerializerMethodField()
    posts_count = serializers.SerializerMethodField()

    cover = serializers.SerializerMethodField()

    class Meta(PublicUserSerializer.Meta):
        fields = PublicUserSerializer.Meta.fields + ['school', 'bio', 'cover', 'relation', 'friends_count', 'posts_count']

    def get_cover(self, u):
        return u.cover.url if u.cover else None

    def get_relation(self, u):
        return relation(self.context['request'].user, u)

    def get_friends_count(self, u):
        return len(friend_ids(u))

    def get_posts_count(self, u):
        return u.posts.filter(is_deleted=False, community__isnull=True).count()


def visible_user_or_404(request, **lookup):
    user = get_object_or_404(User, is_active=True, **lookup)
    if user.id in blocked_ids(request.user):
        return None
    return user


class UserSearchView(APIView):
    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])
        users = (User.objects.filter(is_active=True)
                 .filter(Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q))
                 .exclude(id__in=blocked_ids(request.user) | {request.user.id}).order_by('username')[:20])
        return Response(ProfileSerializer(users, many=True, context={'request': request}).data)


class UserDetailView(APIView):
    def get(self, request, username):
        user = visible_user_or_404(request, username__iexact=username)
        if user is None:
            return Response({'detail': 'Introuvable.'}, status=404)
        return Response(ProfileSerializer(user, context={'request': request}).data)


class FriendsView(APIView):
    def get(self, request):
        users = User.objects.filter(id__in=friend_ids(request.user)).order_by('username')
        return Response(PublicUserSerializer(users, many=True).data)


class FriendRequestsView(APIView):
    def get(self, request):
        rows = Friendship.objects.filter(addressee=request.user, status='pending').select_related('requester')
        return Response(PublicUserSerializer([r.requester for r in rows], many=True).data)


class FriendActionView(APIView):
    """POST request/accept/decline on a user id; DELETE removes an existing friend."""

    def post(self, request, action, user_id):
        other = visible_user_or_404(request, id=user_id)
        if other is None or other.id == request.user.id:
            return Response({'detail': 'Action impossible.'}, status=400)
        rel = relation(request.user, other)
        if action == 'request' and rel == 'none':
            Friendship.objects.create(requester=request.user, addressee=other)
            notify(other, 'friends', f"{request.user.first_name or request.user.username} t'a envoyé une demande d'ami.", '/amis', actor=request.user)
        elif (action == 'request' and rel == 'request_received') or (action == 'accept' and rel == 'request_received'):
            # (a mutual request also becomes a friendship)
            Friendship.objects.filter(requester=other, addressee=request.user).update(status='accepted')
            notify(other, 'friends', f"{request.user.first_name or request.user.username} a accepté ta demande d'ami.",
                   f'/u/{request.user.username}', actor=request.user)
        elif action == 'decline' and rel in ('request_received', 'request_sent'):  # decline or cancel
            Friendship.objects.filter(Q(requester=request.user, addressee=other) | Q(requester=other, addressee=request.user),
                                      status='pending').delete()
        else:
            return Response({'detail': 'Action impossible.'}, status=400)
        return Response({'relation': relation(request.user, other)})

    def delete(self, request, action, user_id):
        Friendship.objects.filter(Q(requester=request.user, addressee_id=user_id) | Q(requester_id=user_id, addressee=request.user),
                                  status='accepted').delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BlockView(APIView):
    def get(self, request):
        users = User.objects.filter(blocks_received__blocker=request.user)
        return Response(PublicUserSerializer(users, many=True).data)

    def post(self, request, user_id):
        other = get_object_or_404(User, id=user_id)
        if other.id == request.user.id:
            return Response({'detail': 'Action impossible.'}, status=400)
        Block.objects.get_or_create(blocker=request.user, blocked=other)
        Friendship.objects.filter(Q(requester=request.user, addressee=other) | Q(requester=other, addressee=request.user)).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, user_id):
        Block.objects.filter(blocker=request.user, blocked_id=user_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
