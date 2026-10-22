from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CATEGORIES, Notification, NotificationPreference
from .services import event_reminders


def item(n):
    return {'id': n.id, 'category': n.category, 'text': n.text, 'link': n.link, 'created_at': n.created_at,
            'read': n.read_at is not None}


class NotificationListView(APIView):
    def get(self, request):
        event_reminders(request.user)
        qs = Notification.objects.filter(user=request.user)
        if request.query_params.get('unread') == '1':
            qs = qs.filter(read_at__isnull=True)
        pg = PageNumberPagination()
        pg.page_size = 20
        page = pg.paginate_queryset(qs, request)
        return pg.get_paginated_response([item(n) for n in page])


class UnreadCountView(APIView):
    def get(self, request):
        event_reminders(request.user)
        return Response({'unread': Notification.objects.filter(user=request.user, read_at__isnull=True).count()})


class MarkReadView(APIView):
    def post(self, request, pk):
        n = get_object_or_404(Notification, pk=pk, user=request.user)  # only your own
        if n.read_at is None:
            n.read_at = timezone.now()
            n.save(update_fields=['read_at'])
        return Response(item(n))


class ReadAllView(APIView):
    def post(self, request):
        Notification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=204)


class PreferencesView(APIView):
    def get(self, request):
        off = set(NotificationPreference.objects.filter(user=request.user, enabled=False).values_list('category', flat=True))
        return Response([{'category': c, 'label': l, 'enabled': c not in off, 'locked': c == 'system'} for c, l in CATEGORIES])

    def put(self, request):
        valid = {c for c, _ in CATEGORIES if c != 'system'}
        for cat, enabled in (request.data or {}).items():
            if cat in valid and isinstance(enabled, bool):
                NotificationPreference.objects.update_or_create(user=request.user, category=cat, defaults={'enabled': enabled})
        return self.get(request)
