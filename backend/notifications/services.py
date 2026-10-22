from datetime import timedelta

from django.utils import timezone

from accounts.relations import blocked_ids

from .models import Notification, NotificationPreference


def notify(user, category, text, link='', actor=None, key=''):
    """Create (or refresh) a notification. Skips: self-notifications, inactive/blocked users, categories the user disabled.
    With `key`, an existing UNREAD notification with the same key is refreshed instead of stacking a new one."""
    if user is None or not user.is_active or (actor is not None and actor.id == user.id):
        return None
    if actor is not None and actor.id in blocked_ids(user):
        return None
    if category != 'system' and NotificationPreference.objects.filter(user=user, category=category, enabled=False).exists():
        return None
    text = text[:200]
    if key:
        n = Notification.objects.filter(user=user, dedupe_key=key, read_at__isnull=True).first()
        if n:
            n.text, n.link, n.actor, n.created_at = text, link, actor, timezone.now()
            n.save(update_fields=['text', 'link', 'actor', 'created_at'])
            return n
    return Notification.objects.create(user=user, category=category, text=text, link=link, actor=actor, dedupe_key=key)


def mark_read_by_key(user, key):
    Notification.objects.filter(user=user, dedupe_key=key, read_at__isnull=True).update(read_at=timezone.now())


def event_reminders(user):
    """Real reminders without a scheduler: when the user opens their notifications, events they asked to be reminded about
    that start within 24 h produce one notification each."""
    from campus.models import EventRsvp
    now = timezone.now()
    due = EventRsvp.objects.filter(user=user, reminder=True, reminded=False, event__starts_at__gt=now,
                                   event__starts_at__lte=now + timedelta(hours=24)).select_related('event')
    for r in due:
        when = timezone.localtime(r.event.starts_at).strftime('%d/%m à %H:%M')
        notify(user, 'events', f'Rappel : « {r.event.title} » commence le {when} ({r.event.location}).', f'/evenements/{r.event_id}')
        r.reminded = True
        r.save(update_fields=['reminded'])
