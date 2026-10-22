from django.conf import settings
from django.db import models


class Conversation(models.Model):
    """Private 1:1 conversation, optionally about a Marketplace listing (product context)."""
    listing = models.ForeignKey('market.Listing', null=True, blank=True, on_delete=models.SET_NULL, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)


class ConversationMember(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversation_links')
    last_read_id = models.BigIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['conversation', 'user'], name='one_member_per_conversation')]


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True)
    text = models.TextField(max_length=2000, blank=True)
    is_system = models.BooleanField(default=False)  # offer / call events
    audio = models.FileField(upload_to='voice/%Y/%m/', blank=True)  # voice note
    audio_seconds = models.PositiveSmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']


class Call(models.Model):
    """Audio/video call between the two members of a conversation. Media flows peer-to-peer (WebRTC);
    the server only relays signalling (offer/answer/ICE) and keeps the call state."""

    class Kind(models.TextChoices):
        AUDIO = 'audio', 'Audio'
        VIDEO = 'video', 'Vidéo'

    class Status(models.TextChoices):
        RINGING = 'ringing', 'Sonnerie'
        ACTIVE = 'active', 'En cours'
        ENDED = 'ended', 'Terminé'
        DECLINED = 'declined', 'Refusé'
        MISSED = 'missed', 'Manqué'

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='calls')
    caller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calls_made')
    callee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calls_received')
    kind = models.CharField(max_length=5, choices=Kind.choices)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.RINGING, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)


class CallSignal(models.Model):
    """WebRTC signalling relay; deleted when the call ends (data minimisation)."""
    call = models.ForeignKey(Call, on_delete=models.CASCADE, related_name='signals')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    type = models.CharField(max_length=10)  # offer | answer | candidate
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
