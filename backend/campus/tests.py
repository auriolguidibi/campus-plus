import io
import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from accounts.models import Friendship, User
from campus.models import Challenge, Confession

PW = 'Str0ng!pass'


def png():
    b = io.BytesIO()
    Image.new('RGB', (30, 30), 'red').save(b, 'PNG')
    return SimpleUploadedFile('a.png', b.getvalue(), 'image/png')


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class Phase5Tests(APITestCase):
    def setUp(self):
        mk = lambda n, **kw: User.objects.create_user(n, f'{n}@x.bj', PW, first_name=n, verification='verified', promotion='L1', **kw)
        self.admin, self.a, self.b, self.c = mk('boss', is_staff=True), mk('ana'), mk('bob'), mk('cy')

    def as_(self, u):
        self.client.force_authenticate(u)

    # ---- stories
    def test_story_visibility_views_and_delete(self):
        self.as_(self.a)
        sid = self.client.post('/api/stories/', {'image': png(), 'caption': 'yo', 'visibility': 'friends'}, format='multipart').data['id']
        self.as_(self.b)
        self.assertEqual(self.client.get('/api/stories/').data, [])  # friends-only, not a friend
        self.assertEqual(self.client.post(f'/api/stories/{sid}/view/').status_code, 404)
        Friendship.objects.create(requester=self.a, addressee=self.b, status='accepted')
        g = self.client.get('/api/stories/').data
        self.assertEqual((len(g), g[0]['all_seen']), (1, False))
        self.client.post(f'/api/stories/{sid}/view/')
        self.assertTrue(self.client.get('/api/stories/').data[0]['all_seen'])
        self.assertEqual(self.client.get(f'/api/stories/{sid}/viewers/').status_code, 404)  # only author
        self.as_(self.a)
        self.assertEqual([u['username'] for u in self.client.get(f'/api/stories/{sid}/viewers/').data], ['bob'])
        self.assertEqual(self.client.delete(f'/api/stories/{sid}/').status_code, 204)

    def test_story_expires(self):
        from stories.models import Story
        self.as_(self.a)
        sid = self.client.post('/api/stories/', {'image': png()}, format='multipart').data['id']
        Story.objects.filter(pk=sid).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.get('/api/stories/').data, [])

    # ---- events
    def test_events_rsvp_archive(self):
        self.as_(self.a)
        r = self.client.post('/api/events/', {'title': 'Hack', 'description': 'd', 'category': 'hackathon', 'location': 'Amphi',
                                              'starts_at': (timezone.now() + timedelta(days=2)).isoformat()}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        eid = r.data['id']
        self.assertEqual(self.client.post('/api/events/', {'title': 'Old', 'description': 'd', 'location': 'x',
                                                           'starts_at': (timezone.now() - timedelta(days=1)).isoformat()}, format='json').status_code, 400)
        self.as_(self.b)
        self.assertTrue(self.client.post(f'/api/events/{eid}/rsvp/').data['going'])
        self.assertTrue(self.client.post(f'/api/events/{eid}/reminder/').data['reminder'])
        self.assertEqual(len(self.client.get('/api/events/?scope=reminders').data['results']), 1)
        self.assertEqual(self.client.patch(f'/api/events/{eid}/', {'title': 'x'}, format='json').status_code, 403)
        from campus.models import Event
        Event.objects.filter(pk=eid).update(starts_at=timezone.now() - timedelta(hours=1))
        self.assertEqual(len(self.client.get('/api/events/').data['results']), 0)
        self.assertEqual(len(self.client.get('/api/events/?when=past').data['results']), 1)
        self.assertEqual(self.client.post(f'/api/events/{eid}/rsvp/').status_code, 400)

    # ---- challenges
    def quiz(self):
        now = timezone.now()
        return Challenge.objects.create(title='Q', description='d', kind='quiz', max_points=100, starts_at=now - timedelta(hours=1),
                                        deadline=now + timedelta(days=1), created_by=self.admin,
                                        questions=[{'q': 'a', 'options': ['x', 'y'], 'answer': 1}, {'q': 'b', 'options': ['x', 'y'], 'answer': 0}])

    def test_quiz_graded_server_side_once_and_answers_hidden(self):
        ch = self.quiz()
        self.as_(self.a)
        d = self.client.get(f'/api/challenges/{ch.id}/').data
        self.assertNotIn('answer', str(d['questions']))
        r = self.client.post(f'/api/challenges/{ch.id}/participate/', {'choices': [1, 1], 'points': 100}, format='json')
        self.assertEqual(r.data['mine']['points'], 50)  # 1/2 correct, client-sent points ignored
        self.assertEqual(self.client.post(f'/api/challenges/{ch.id}/participate/', {'choices': [1, 0]}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/challenges/{ch.id}/participate/', {'answer': 'x'}, format='json').status_code, 400)
        lb = self.client.get('/api/leaderboard/?period=all').data
        self.assertEqual((lb['entries'][0]['user']['username'], lb['me']['points']), ('ana', 50))
        codes = [b['code'] for b in self.client.get('/api/badges/').data['badges'] if b['earned_at']]
        self.assertIn('first-challenge', codes)

    def test_manual_review_rules(self):
        now = timezone.now()
        ch = Challenge.objects.create(title='C', description='d', kind='code', max_points=40, starts_at=now - timedelta(hours=1),
                                      deadline=now + timedelta(days=1), created_by=self.admin)
        self.as_(self.admin)
        self.assertEqual(self.client.post(f'/api/challenges/{ch.id}/participate/', {'answer': 'x'}, format='json').status_code, 403)  # organizer
        self.as_(self.a)
        pid = self.client.post(f'/api/challenges/{ch.id}/participate/', {'answer': 'mon code'}, format='json').data['mine']['id']
        self.assertEqual(self.client.post(f'/api/participations/{pid}/review/', {'points': 40}, format='json').status_code, 403)  # not staff
        self.as_(self.admin)
        self.assertEqual(self.client.post(f'/api/participations/{pid}/review/', {'points': 41}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/participations/{pid}/review/', {'points': 30}, format='json').status_code, 200)
        self.assertEqual(self.client.post(f'/api/participations/{pid}/review/', {'points': 35}, format='json').status_code, 200)  # re-review, not double
        self.as_(self.a)
        self.assertEqual(self.client.get('/api/badges/').data['points'], 35)
        self.assertEqual(self.client.patch(f'/api/challenges/{ch.id}/participate/', {'answer': 'z'}, format='json').status_code, 400)  # reviewed
        Challenge.objects.filter(pk=ch.id).update(deadline=now - timedelta(minutes=1))
        self.as_(self.b)
        self.assertEqual(self.client.post(f'/api/challenges/{ch.id}/participate/', {'answer': 'late'}, format='json').status_code, 403)

    def test_only_staff_creates_challenges(self):
        body = {'title': 'T', 'description': 'd', 'kind': 'code', 'max_points': 10,
                'starts_at': timezone.now().isoformat(), 'deadline': (timezone.now() + timedelta(days=1)).isoformat()}
        self.as_(self.a)
        self.assertEqual(self.client.post('/api/challenges/', body, format='json').status_code, 403)
        self.as_(self.admin)
        self.assertEqual(self.client.post('/api/challenges/', body, format='json').status_code, 201)

    # ---- confessions
    def test_confession_is_anonymous_and_moderated(self):
        self.as_(self.a)
        text = "J'avoue que j'ai peur de rater mes examens cette année."
        r = self.client.post('/api/confessions/', {'text': text}, format='json')
        self.assertEqual((r.status_code, r.data['status']), (201, 'pending'))
        cid = r.data['id']
        self.as_(self.b)
        self.assertEqual(self.client.get('/api/confessions/').data['results'], [])  # awaiting moderation
        self.assertEqual(self.client.get('/api/confessions/queue/').status_code, 403)
        self.as_(self.admin)
        q = self.client.get('/api/confessions/queue/').data
        self.assertEqual(len(q), 1)
        self.assertNotIn('author', q[0])
        self.client.post(f'/api/confessions/queue/{cid}/', {'decision': 'approve'}, format='json')
        self.as_(self.b)
        pub = self.client.get('/api/confessions/').data['results']
        self.assertEqual(len(pub), 1)
        self.assertNotIn('author', pub[0])
        self.assertNotIn('ana', str(pub))
        self.client.post(f'/api/confessions/{cid}/comments/', {'text': 'courage'}, format='json')
        self.as_(self.a)
        self.client.post(f'/api/confessions/{cid}/comments/', {'text': 'merci'}, format='json')
        labels = [c['label'] for c in self.client.get(f'/api/confessions/{cid}/comments/').data]
        self.assertEqual(labels, ['Anonyme 1', 'Auteur'])
        self.assertNotIn('ana', str(self.client.get(f'/api/confessions/{cid}/comments/').data))

    def test_confession_filters_limits_and_reports(self):
        self.as_(self.a)
        post = lambda t: self.client.post('/api/confessions/', {'text': t}, format='json')
        self.assertEqual(post('Appelle-moi au 97 12 34 56 pour savoir la vérité sur lui').status_code, 400)
        self.assertEqual(post('Je vais te tuer si tu ne me rends pas mon cahier').status_code, 400)
        self.assertEqual(post('trop court').status_code, 400)
        for _ in range(3):
            self.assertEqual(post("Une confession tout à fait normale et suffisamment longue.").status_code, 201)
        self.assertEqual(post("Une quatrième confession normale et suffisamment longue.").status_code, 429)
        c = Confession.objects.create(author=self.a, text='visible', status='published')
        for u in (self.a, self.b, self.c):
            self.as_(u)
            self.client.post(f'/api/confessions/{c.id}/report/')
        c.refresh_from_db()
        self.assertEqual(c.status, 'flagged')
        self.assertEqual(self.client.get('/api/confessions/').data['results'], [])
