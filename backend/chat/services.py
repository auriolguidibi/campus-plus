from django.db.models import Count

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


def post_message(conv, sender, text, system=False):
    conv.save(update_fields=['updated_at'])  # bump ordering
    return Message.objects.create(conversation=conv, sender=sender, text=text, is_system=system)
