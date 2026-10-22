from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.relations import blocked_ids, friend_ids
from accounts.serializers import PublicUserSerializer
from social.views import process_image

from .models import Story, StoryView


def story_dict(s, seen_ids):
    return {'id': s.id, 'url': s.image.url, 'caption': s.caption, 'visibility': s.visibility,
            'created_at': s.created_at, 'expires_at': s.expires_at, 'seen': s.id in seen_ids}


def visible_stories(user):
    """Active stories: mine, friends' (any visibility) and others' with visibility=everyone. Blocked users excluded."""
    friends = friend_ids(user)
    return (Story.objects.filter(expires_at__gt=timezone.now()).exclude(author_id__in=blocked_ids(user))
            .filter(Q(author=user) | Q(author_id__in=friends) | Q(visibility=Story.Visibility.EVERYONE))
            .select_related('author'))


class StoryListView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        stories = list(visible_stories(request.user))
        seen = set(StoryView.objects.filter(viewer=request.user, story__in=stories).values_list('story_id', flat=True))
        groups = {}
        for s in stories:
            g = groups.setdefault(s.author_id, {'author': PublicUserSerializer(s.author).data, 'stories': []})
            g['stories'].append(story_dict(s, seen))
        out = list(groups.values())
        for g in out:
            g['all_seen'] = all(x['seen'] for x in g['stories'])
        # mine first, then unseen, then seen
        out.sort(key=lambda g: (g['author']['id'] != request.user.id, g['all_seen']))
        return Response(out)

    def post(self, request):
        f = request.FILES.get('image')
        if not f:
            return Response({'image': 'Ajoute une photo.'}, status=400)
        vis = request.data.get('visibility', Story.Visibility.EVERYONE)
        if vis not in Story.Visibility.values:
            return Response({'visibility': 'Visibilité invalide.'}, status=400)
        s = Story.objects.create(author=request.user, image=process_image(f), caption=str(request.data.get('caption', ''))[:200],
                                 visibility=vis)
        return Response(story_dict(s, set()), status=201)


class StoryDetailView(APIView):
    def delete(self, request, pk):
        s = get_object_or_404(Story, pk=pk, author=request.user)
        s.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, pk):
        s = get_object_or_404(Story, pk=pk, author=request.user)
        vis = request.data.get('visibility')
        if vis not in Story.Visibility.values:
            return Response({'visibility': 'Visibilité invalide.'}, status=400)
        s.visibility = vis
        s.save(update_fields=['visibility'])
        return Response(story_dict(s, set()))


class StoryViewMark(APIView):
    def post(self, request, pk):
        s = get_object_or_404(visible_stories(request.user), pk=pk)
        if s.author_id != request.user.id:
            StoryView.objects.get_or_create(story=s, viewer=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class StoryViewers(APIView):
    def get(self, request, pk):
        s = get_object_or_404(Story, pk=pk, author=request.user)  # only the author sees viewers
        users = User.objects.filter(storyview__story=s).order_by('-storyview__seen_at')
        return Response(PublicUserSerializer(users, many=True).data)
