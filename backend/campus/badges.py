"""Badges are derived from real data. `check_badges` is idempotent and can be called at any time."""
from django.db.models import Sum

from accounts.relations import friend_ids
from notifications.services import notify

from .models import Badge, PointEntry, UserBadge


def total_points(user):
    return PointEntry.objects.filter(user=user).aggregate(s=Sum('points'))['s'] or 0


RULES = {
    'first-challenge': lambda u: u.participations.exists(),
    'century': lambda u: total_points(u) >= 100,
    'verified': lambda u: u.verification == 'verified',
    'first-post': lambda u: u.posts.filter(is_deleted=False).exists(),
    'seller': lambda u: u.listings.filter(status='sold').exists(),
    'social': lambda u: len(friend_ids(u)) >= 5,
    'storyteller': lambda u: u.stories.exists(),
}


def check_badges(user):
    have = set(UserBadge.objects.filter(user=user).values_list('badge__code', flat=True))
    for code, rule in RULES.items():
        if code not in have and rule(user):
            badge = Badge.objects.filter(code=code).first()
            if badge:
                _, created = UserBadge.objects.get_or_create(user=user, badge=badge)
                if created:
                    notify(user, 'challenges', f'Nouveau badge : {badge.icon} {badge.name}', '/classement')
