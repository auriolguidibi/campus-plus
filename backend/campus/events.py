from django.db.models import Count, Exists, OuterRef
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from accounts.models import User
from accounts.serializers import PublicUserSerializer
from social.views import process_image

from .models import Event, EventRsvp


class EventSerializer(serializers.ModelSerializer):
    organizer = PublicUserSerializer(read_only=True)
    image = serializers.SerializerMethodField()
    going_count = serializers.IntegerField(read_only=True)
    going = serializers.BooleanField(read_only=True)
    reminder = serializers.SerializerMethodField()
    is_past = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = ['id', 'title', 'description', 'category', 'starts_at', 'location', 'image', 'rules', 'organizer',
                  'going_count', 'going', 'reminder', 'is_past', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_image(self, e):
        return e.image.url if e.image else None

    def get_is_past(self, e):
        return e.starts_at < timezone.now()

    def get_reminder(self, e):
        return EventRsvp.objects.filter(event=e, user=self.context['request'].user, reminder=True).exists()


class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        u, p = self.request.user, self.request.query_params
        qs = Event.objects.select_related('organizer').annotate(
            going_count=Count('rsvps', distinct=True),
            going=Exists(EventRsvp.objects.filter(event=OuterRef('pk'), user=u)))
        if self.action != 'list':
            return qs
        now = timezone.now()
        if p.get('scope') == 'reminders':
            return qs.filter(rsvps__user=u, rsvps__reminder=True, starts_at__gte=now).order_by('starts_at')
        if p.get('when') == 'past':  # archive
            return qs.filter(starts_at__lt=now).order_by('-starts_at')
        return qs.filter(starts_at__gte=now).order_by('starts_at')

    def create(self, request, *args, **kwargs):
        if request.user.verification != User.Verification.VERIFIED:
            raise PermissionDenied('Seuls les comptes vérifiés peuvent organiser un événement.')
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if ser.validated_data['starts_at'] < timezone.now():
            return Response({'starts_at': 'La date doit être dans le futur.'}, status=400)
        f = request.FILES.get('image')
        ev = ser.save(organizer=request.user, **({'image': process_image(f)} if f else {}))
        EventRsvp.objects.create(event=ev, user=request.user)
        return Response(self.get_serializer(self.get_queryset().get(pk=ev.pk)).data, status=201)

    def _owned(self, request):
        ev = self.get_object()
        if ev.organizer_id != request.user.id:
            raise PermissionDenied()
        return ev

    def partial_update(self, request, *args, **kwargs):
        ev = self._owned(request)
        ser = self.get_serializer(ev, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        f = request.FILES.get('image')
        ser.save(**({'image': process_image(f)} if f else {}))
        return Response(self.get_serializer(self.get_queryset().get(pk=ev.pk)).data)

    def destroy(self, request, *args, **kwargs):
        self._owned(request).delete()
        return Response(status=204)

    @action(detail=True, methods=['post'])
    def rsvp(self, request, pk=None):
        ev = self.get_object()
        if ev.starts_at < timezone.now():
            return Response({'detail': 'Cet événement est terminé.'}, status=400)
        obj, created = EventRsvp.objects.get_or_create(event=ev, user=request.user)
        if not created:
            obj.delete()
        return Response({'going': created})

    @action(detail=True, methods=['post'])
    def reminder(self, request, pk=None):
        ev = self.get_object()
        if ev.starts_at < timezone.now():
            return Response({'detail': 'Cet événement est terminé.'}, status=400)
        obj, _ = EventRsvp.objects.get_or_create(event=ev, user=request.user)
        obj.reminder = not obj.reminder
        obj.reminded = False
        obj.save(update_fields=['reminder', 'reminded'])
        return Response({'reminder': obj.reminder})
