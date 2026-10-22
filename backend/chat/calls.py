import json
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from accounts.relations import blocked_ids
from accounts.serializers import PublicUserSerializer
from notifications.services import notify

from .models import Call, CallSignal, Message
from .views import my_conversation_or_404

RING_SECONDS = 45
MAX_PAYLOAD = 20_000  # bytes of JSON per signalling message


class SignalThrottle(UserRateThrottle):
    scope = 'call_signal'


def log_event(call, text):
    Message.objects.create(conversation=call.conversation, sender=call.caller, text=text, is_system=True)
    call.conversation.save(update_fields=['updated_at'])


def expire_if_unanswered(call):
    if call.status == Call.Status.RINGING and call.created_at < timezone.now() - timedelta(seconds=RING_SECONDS):
        call.status, call.ended_at = Call.Status.MISSED, timezone.now()
        call.save(update_fields=['status', 'ended_at'])
        log_event(call, f'Appel {call.get_kind_display().lower()} manqué')
    return call


def call_dict(call, me):
    other = call.callee if call.caller_id == me.id else call.caller
    return {'id': call.id, 'conversation': call.conversation_id, 'kind': call.kind, 'status': call.status,
            'incoming': call.callee_id == me.id, 'other': PublicUserSerializer(other).data,
            'created_at': call.created_at, 'answered_at': call.answered_at}


def participant_call(user, pk):
    call = get_object_or_404(Call.objects.select_related('conversation', 'caller', 'callee'), pk=pk)
    if user.id not in (call.caller_id, call.callee_id):
        from django.http import Http404
        raise Http404()
    return expire_if_unanswered(call)


class IceServersView(APIView):
    def get(self, request):
        servers = [{'urls': [u.strip() for u in settings.CALL_STUN_URLS if u.strip()]}]
        if settings.CALL_TURN_URL:
            servers.append({'urls': [settings.CALL_TURN_URL], 'username': settings.CALL_TURN_USERNAME,
                            'credential': settings.CALL_TURN_CREDENTIAL})
        return Response({'iceServers': servers})


class StartCallView(APIView):
    def post(self, request, pk):
        conv = my_conversation_or_404(request.user, pk)
        kind = request.data.get('kind')
        if kind not in Call.Kind.values:
            return Response({'kind': 'audio ou video.'}, status=400)
        other = conv.members.exclude(user=request.user).first().user
        if not other.is_active or other.id in blocked_ids(request.user):
            return Response({'detail': 'Appel impossible.'}, status=400)
        with transaction.atomic():
            both = [request.user, other]
            live = Call.objects.filter(status__in=[Call.Status.RINGING, Call.Status.ACTIVE]).filter(Q(caller__in=both) | Q(callee__in=both))
            for c in list(live):
                expire_if_unanswered(c)
            if live.filter(status__in=[Call.Status.RINGING, Call.Status.ACTIVE]).exists():
                return Response({'detail': "L'un de vous est déjà en appel."}, status=409)
            call = Call.objects.create(conversation=conv, caller=request.user, callee=other, kind=kind)
        who = request.user.first_name or request.user.username
        notify(other, 'messages', f'Appel {"vidéo" if kind == "video" else "audio"} de {who}', f'/messages/{conv.id}', actor=request.user,
               key=f'call:{call.id}')
        return Response(call_dict(call, request.user), status=201)


class IncomingCallView(APIView):
    def get(self, request):
        since = timezone.now() - timedelta(seconds=RING_SECONDS)
        for c in Call.objects.filter(callee=request.user, status=Call.Status.RINGING, created_at__lt=since):
            expire_if_unanswered(c)
        calls = (Call.objects.filter(callee=request.user, status=Call.Status.RINGING, created_at__gte=since)
                 .select_related('caller', 'callee', 'conversation').order_by('-created_at')[:1])
        return Response([call_dict(c, request.user) for c in calls])


class CallDetailView(APIView):
    def get(self, request, pk):
        return Response(call_dict(participant_call(request.user, pk), request.user))


class CallActionView(APIView):
    def post(self, request, pk, action):
        with transaction.atomic():
            call = participant_call(request.user, pk)
            call = Call.objects.select_for_update().get(pk=call.pk)
            me, now = request.user, timezone.now()
            S = Call.Status
            if action == 'answer' and call.callee_id == me.id and call.status == S.RINGING:
                call.status, call.answered_at = S.ACTIVE, now
            elif action == 'decline' and call.callee_id == me.id and call.status == S.RINGING:
                call.status, call.ended_at = S.DECLINED, now
                log_event(call, f'Appel {call.get_kind_display().lower()} refusé')
            elif action == 'end' and call.status == S.RINGING and call.caller_id == me.id:
                call.status, call.ended_at = S.MISSED, now  # caller hung up before an answer
                log_event(call, f'Appel {call.get_kind_display().lower()} manqué')
            elif action == 'end' and call.status == S.ACTIVE:
                call.status, call.ended_at = S.ENDED, now
                secs = int((now - call.answered_at).total_seconds())
                log_event(call, f'Appel {call.get_kind_display().lower()} terminé · {secs // 60} min {secs % 60:02d} s')
            elif action == 'end' and call.status in (S.ENDED, S.DECLINED, S.MISSED):
                pass  # idempotent hang-up
            else:
                return Response({'detail': 'Action impossible.'}, status=400)
            call.save()
            if call.status in (S.ENDED, S.DECLINED, S.MISSED):
                call.signals.all().delete()
        return Response(call_dict(call, request.user))


class SignalView(APIView):
    throttle_classes = [SignalThrottle]

    def post(self, request, pk):
        call = participant_call(request.user, pk)
        if call.status not in (Call.Status.RINGING, Call.Status.ACTIVE):
            return Response({'detail': 'Appel terminé.'}, status=400)
        typ, payload = request.data.get('type'), request.data.get('payload')
        if typ not in ('offer', 'answer', 'candidate') or payload is None or len(json.dumps(payload)) > MAX_PAYLOAD:
            return Response({'detail': 'Signal invalide.'}, status=400)
        s = CallSignal.objects.create(call=call, sender=request.user, type=typ, payload=payload)
        return Response({'id': s.id}, status=201)

    def get(self, request, pk):
        call = participant_call(request.user, pk)
        after = int(request.query_params.get('after', 0) or 0)
        rows = call.signals.filter(id__gt=after).exclude(sender=request.user).order_by('id')[:100]
        return Response({'status': call.status,
                         'signals': [{'id': r.id, 'type': r.type, 'payload': r.payload} for r in rows]})
