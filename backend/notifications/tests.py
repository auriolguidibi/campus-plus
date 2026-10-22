from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Block, User
from campus.models import Event, EventRsvp
from market.models import Category, Listing
from notifications.models import Notification

PW = 'Str0ng!pass'


class NotificationTests(APITestCase):
    def setUp(self):
        mk = lambda n, **kw: User.objects.create_user(n, f'{n}@x.bj', PW, first_name=n.title(), verification='verified', **kw)
        self.a, self.b, self.c = mk('ana'), mk('bob'), mk('cy')
        self.mod = mk('mia', role='moderator', is_staff=True)

    def as_(self, u):
        self.client.force_authenticate(u)

    def mine(self, u):
        self.as_(u)
        return self.client.get('/api/notifications/').data['results']

    def test_friend_request_and_accept(self):
        self.as_(self.a)
        self.client.post(f'/api/friends/request/{self.b.id}/')
        n = self.mine(self.b)
        self.assertEqual((len(n), n[0]['category'], n[0]['read']), (1, 'friends', False))
        self.assertEqual(self.mine(self.a), [])  # no self-notification
        self.as_(self.b)
        self.client.post(f'/api/friends/accept/{self.a.id}/')
        self.assertEqual(self.mine(self.a)[0]['category'], 'friends')

    def test_reactions_collapse_and_no_self_notify(self):
        self.as_(self.a)
        pid = self.client.post('/api/posts/', {'text': 'salut'}, format='json').data['id']
        self.client.post(f'/api/posts/{pid}/react/')
        self.client.post(f'/api/posts/{pid}/comments/', {'text': 'moi'}, format='json')
        self.assertEqual(self.mine(self.a), [])
        for u in (self.b, self.c):
            self.as_(u)
            self.client.post(f'/api/posts/{pid}/react/')
        n = self.mine(self.a)
        self.assertEqual(len(n), 1)  # two reactions, one unread notification
        self.as_(self.b)
        cid = self.client.post(f'/api/posts/{pid}/comments/', {'text': 'hey'}, format='json').data['id']
        self.as_(self.c)
        self.client.post(f'/api/posts/{pid}/comments/', {'text': 're', 'parent': cid}, format='json')
        texts = [x['text'] for x in self.mine(self.b)]
        self.assertTrue(any('répondu' in t for t in texts))
        self.assertEqual(len(self.mine(self.a)), 2)  # reactions + comments

    def test_messages_dedupe_and_read_on_open(self):
        L = Listing.objects.create(seller=self.a, category=Category.objects.first(), title='t', description='d', price=100, negotiable=True)
        self.as_(self.b)
        cid = self.client.post(f'/api/listings/{L.id}/contact/').data['id']
        for t in ('a', 'b', 'c'):
            self.client.post(f'/api/conversations/{cid}/messages/', {'text': t}, format='json')
        n = [x for x in self.mine(self.a) if x['category'] == 'messages']
        self.assertEqual(len(n), 1)
        self.client.get(f'/api/conversations/{cid}/messages/')
        self.assertEqual(self.client.get('/api/notifications/unread-count/').data['unread'], 0)
        # offers go to the seller under 'market'
        self.as_(self.b)
        self.client.post(f'/api/listings/{L.id}/offers/', {'amount': 50}, format='json')
        self.assertTrue(any(x['category'] == 'market' for x in self.mine(self.a)))

    def test_preferences_and_system_lock(self):
        self.as_(self.a)
        r = self.client.put('/api/notifications/preferences/', {'social': False, 'system': False, 'bogus': False}, format='json').data
        self.assertEqual({x['category']: x['enabled'] for x in r}['social'], False)
        self.assertTrue({x['category']: x['enabled'] for x in r}['system'])
        pid = self.client.post('/api/posts/', {'text': 'x'}, format='json').data['id']
        self.as_(self.b)
        self.client.post(f'/api/posts/{pid}/react/')
        self.assertEqual(self.mine(self.a), [])  # disabled category: nothing created
        self.assertEqual(Notification.objects.filter(user=self.a).count(), 0)
        self.as_(self.mod)
        self.client.post(f'/api/admin/users/{self.a.id}/verify/', {'decision': 'rejected'}, format='json')
        self.assertEqual(self.mine(self.a)[0]['category'], 'system')

    def test_blocked_users_do_not_notify(self):
        Block.objects.create(blocker=self.a, blocked=self.b)
        self.as_(self.b)
        self.client.post(f'/api/friends/request/{self.a.id}/')
        self.assertEqual(Notification.objects.filter(user=self.a).count(), 0)

    def test_isolation_read_and_read_all(self):
        self.as_(self.a)
        self.client.post(f'/api/friends/request/{self.b.id}/')
        self.client.post(f'/api/friends/request/{self.c.id}/')
        nid = Notification.objects.get(user=self.b).id
        self.as_(self.c)
        self.assertEqual(self.client.post(f'/api/notifications/{nid}/read/').status_code, 404)  # not yours
        self.as_(self.b)
        self.assertEqual(self.client.get('/api/notifications/unread-count/').data['unread'], 1)
        self.assertTrue(self.client.post(f'/api/notifications/{nid}/read/').data['read'])
        self.as_(self.c)
        self.client.post('/api/notifications/read-all/')
        self.assertEqual(self.client.get('/api/notifications/?unread=1').data['count'], 0)

    def test_event_reminder_once_within_24h(self):
        soon = Event.objects.create(title='Hack', description='d', location='Amphi', starts_at=timezone.now() + timedelta(hours=5), organizer=self.a)
        far = Event.objects.create(title='Later', description='d', location='x', starts_at=timezone.now() + timedelta(days=5), organizer=self.a)
        for e in (soon, far):
            EventRsvp.objects.create(event=e, user=self.b, reminder=True)
        self.assertEqual(len([x for x in self.mine(self.b) if x['category'] == 'events']), 1)
        self.assertEqual(len([x for x in self.mine(self.b) if x['category'] == 'events']), 1)  # not repeated

    def test_badge_and_listing_moderation_notifications(self):
        self.as_(self.a)
        self.client.post('/api/posts/', {'text': 'premier'}, format='json')
        self.client.get('/api/badges/')
        self.assertTrue(any('badge' in x['text'].lower() for x in self.mine(self.a)))
        L = Listing.objects.create(seller=self.b, category=Category.objects.first(), title='Velo', description='d', price=10, status='pending')
        self.as_(self.mod)
        self.client.post(f'/api/admin/listings/{L.id}/', {'decision': 'reject', 'note': 'interdit'}, format='json')
        self.assertIn('refusée', self.mine(self.b)[0]['text'])
