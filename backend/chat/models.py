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
    text = models.TextField(max_length=2000)
    is_system = models.BooleanField(default=False)  # offer events
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']
