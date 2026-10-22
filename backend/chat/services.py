from django.db.models import Count

from notifications.services import notify

from .models import Conversation, ConversationMember, Message


def get_or_create_conversation(a, b, listing=None):
    """One private conversation per (pair, listing context)."""
    qs = Conversation.objects.filter(listing=listing, members__user=a).filter(members__user=b)
    conv = qs.annotate(n=Count('members')).filter(n=2).first()
    if conv:
        return conv
    conv = Conversation.objects.create(listing=listing)
    ConversationMember.objects.bulk_create([ConversationMember(conversation=conv, user=a), ConversationMember(conversation=conv, user=b)])
    return conv


def post_message(conv, sender, text, system=False, audio=None, audio_seconds=None):
    conv.save(update_fields=['updated_at'])  # bump ordering
    msg = Message.objects.create(conversation=conv, sender=sender, text=text, is_system=system, audio=audio or '', audio_seconds=audio_seconds)
    who = sender.first_name or sender.username
    for m in conv.members.exclude(user=sender).select_related('user'):
        if system:  # offer events
            notify(m.user, 'market', text, f'/messages/{conv.id}', actor=sender)
        else:
            notify(m.user, 'messages', f'Note vocale de {who}' if audio else f'Nouveau message de {who}', f'/messages/{conv.id}', actor=sender, key=f'conv:{conv.id}')
    return msg
