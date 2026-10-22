from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.relations import blocked_ids
from accounts.serializers import PublicUserSerializer
from market.models import Listing
from notifications.services import mark_read_by_key

from .models import Conversation, ConversationMember, Message
from .services import get_or_create_conversation, post_message


MAX_VOICE_BYTES = 4 * 1024 * 1024
MAX_VOICE_SECONDS = 120


def sniff_audio(head):
    """Detect a real audio container from its magic bytes (never trust the client's content type)."""
    if head[:4] == bytes([0x1A, 0x45, 0xDF, 0xA3]):
        return 'webm'
    if head[:4] == b'OggS':
        return 'ogg'
    if head[4:8] == b'ftyp':
        return 'm4a'
    if head[:4] == b'RIFF' and head[8:12] == b'WAVE':
        return 'wav'
    if head[:3] == b'ID3' or head[:2] in (bytes([0xFF, 0xFB]), bytes([0xFF, 0xF3]), bytes([0xFF, 0xF2])):
        return 'mp3'
    return None


class MessageSerializer(serializers.ModelSerializer):
    audio_url = serializers.SerializerMethodField()
    kind = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender', 'text', 'is_system', 'kind', 'audio_url', 'audio_seconds', 'created_at']

    def get_audio_url(self, m):
        return m.audio.url if m.audio else None

    def get_kind(self, m):
        return 'voice' if m.audio else 'system' if m.is_system else 'text'


def my_conversation_or_404(user, pk):
    """Only members can read or write — everyone else gets a 404 (no existence leak)."""
    return get_object_or_404(Conversation, pk=pk, members__user=user)


def summary(conv, me):
    other = next(m.user for m in conv.members.all() if m.user_id != me.id)
    mine = next(m for m in conv.members.all() if m.user_id == me.id)
    last = conv.messages.order_by('-id').first()
    return {
        'id': conv.id, 'other': PublicUserSerializer(other).data,
        'listing': {'id': conv.listing_id, 'title': conv.listing.title} if conv.listing_id else None,
        'last_message': ({**MessageSerializer(last).data, 'text': last.text or 'Note vocale'} if last else None),
        'unread': conv.messages.filter(id__gt=mine.last_read_id).exclude(sender=me).count(),
        'updated_at': conv.updated_at,
    }


class ConversationListView(APIView):
    def get(self, request):
        q = request.query_params.get('q', '').strip()
        convs = (Conversation.objects.filter(members__user=request.user).select_related('listing')
                 .prefetch_related('members__user').order_by('-updated_at'))
        data = [summary(c, request.user) for c in convs]
        if q:
            data = [d for d in data if q.lower() in (d['other']['username'] + d['other']['first_name'] + (d['listing']['title'] if d['listing'] else '')).lower()]
        return Response(data)

    def post(self, request):
        other = get_object_or_404(User, pk=request.data.get('user_id'), is_active=True)
        if other.id == request.user.id or other.id in blocked_ids(request.user):
            return Response({'detail': 'Conversation impossible.'}, status=400)
        listing = None
        if request.data.get('listing_id'):
            listing = get_object_or_404(Listing, pk=request.data['listing_id'], seller=other)
        conv = get_or_create_conversation(request.user, other, listing)
        return Response({'id': conv.id}, status=status.HTTP_200_OK)


class UnreadCountView(APIView):
    def get(self, request):
        total = 0
        for m in ConversationMember.objects.filter(user=request.user):
            total += m.conversation.messages.filter(id__gt=m.last_read_id).exclude(sender=request.user).count()
        return Response({'unread': total})


class MessageListView(APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request, pk):
        conv = my_conversation_or_404(request.user, pk)
        after = int(request.query_params.get('after', 0) or 0)
        msgs = list(conv.messages.filter(id__gt=after)[:200])
        mark_read_by_key(request.user, f'conv:{conv.id}')
        if msgs:
            ConversationMember.objects.filter(conversation=conv, user=request.user).update(last_read_id=msgs[-1].id)
        return Response({'conversation': summary(conv, request.user), 'messages': MessageSerializer(msgs, many=True).data})

    def post(self, request, pk):
        conv = my_conversation_or_404(request.user, pk)
        other = conv.members.exclude(user=request.user).first().user
        if other.id in blocked_ids(request.user):
            return Response({'detail': 'Conversation bloquée.'}, status=403)
        voice = request.FILES.get('audio')
        if voice:
            if voice.size > MAX_VOICE_BYTES:
                return Response({'audio': 'Note vocale trop lourde (4 Mo max).'}, status=400)
            ext = sniff_audio(voice.read(16))
            voice.seek(0)
            try:
                secs = int(float(request.data.get('seconds', 0)))
            except (TypeError, ValueError):
                secs = 0
            if not ext or not 1 <= secs <= MAX_VOICE_SECONDS:
                return Response({'audio': 'Fichier audio invalide ou durée hors limites (120 s max).'}, status=400)
            voice.name = f'note.{ext}'
            return Response(MessageSerializer(post_message(conv, request.user, '', audio=voice, audio_seconds=secs)).data, status=201)
        text = str(request.data.get('text', '')).strip()
        if not text or len(text) > 2000:
            return Response({'text': 'Message vide ou trop long.'}, status=400)
        return Response(MessageSerializer(post_message(conv, request.user, text)).data, status=201)
