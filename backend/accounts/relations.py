from django.db.models import Q

from .models import Block, Friendship


def friend_ids(user):
    rows = Friendship.objects.filter(status='accepted').filter(Q(requester=user) | Q(addressee=user))
    return {r.addressee_id if r.requester_id == user.id else r.requester_id for r in rows}


def blocked_ids(user):
    """Ids of users blocked by `user` or who blocked `user` — hidden from each other both ways."""
    rows = Block.objects.filter(Q(blocker=user) | Q(blocked=user))
    return {r.blocked_id if r.blocker_id == user.id else r.blocker_id for r in rows}


def relation(me, other):
    if me.id == other.id:
        return 'self'
    f = Friendship.objects.filter(Q(requester=me, addressee=other) | Q(requester=other, addressee=me)).first()
    if not f:
        return 'none'
    if f.status == 'accepted':
        return 'friends'
    return 'request_sent' if f.requester_id == me.id else 'request_received'
