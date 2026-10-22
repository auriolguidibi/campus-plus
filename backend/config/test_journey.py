"""End-to-end API journey using real token authentication (no force_authenticate):
register -> login -> profile/theme -> friends -> post+photo -> interactions -> notifications -> community ->
marketplace (listing, offer, counter, sale, review) -> report -> moderation -> logout."""
import io
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from accounts.models import User

PW = 'Campus#2026ok'


def png():
    b = io.BytesIO()
    Image.new('RGB', (64, 64), 'purple').save(b, 'PNG')
    return SimpleUploadedFile('a.png', b.getvalue(), 'image/png')


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class FullJourney(APITestCase):
    def client_for(self, token=None):
        c = APIClient()
        if token:
            c.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        return c

    def register(self, name, code='CAMPUS2026'):
        r = APIClient().post('/api/auth/register/', {'username': name, 'first_name': name.title(), 'last_name': 'Test', 'email': f'{name}@x.bj',
                                                       'password': PW, 'school': 'EIG', 'field_of_study': 'GL', 'promotion': 'L1',
                                                       'invite_code': code}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        return r.data['token']

    def test_journey(self):
        ana, bob = self.client_for(self.register('ana')), self.client_for(self.register('bob'))
        # login with e-mail works and returns a fresh usable token
        tok = APIClient().post('/api/auth/login/', {'login': 'ana@x.bj', 'password': PW}, format='json').data['token']
        ana = self.client_for(tok)
        # profile + theme persisted on the account
        self.assertEqual(ana.patch('/api/auth/me/', {'theme': 'dark', 'bio': 'Étudiante en GL'}, format='json').data['theme'], 'dark')
        self.assertEqual(ana.get('/api/auth/me/').data['bio'], 'Étudiante en GL')
        # friendship
        bob_id = bob.get('/api/auth/me/').data['id']
        ana_id = ana.get('/api/auth/me/').data['id']
        self.assertEqual(ana.post(f'/api/friends/request/{bob_id}/').data['relation'], 'request_sent')
        self.assertEqual(bob.post(f'/api/friends/accept/{ana_id}/').data['relation'], 'friends')
        # post with photo appears in the friend's feed; interactions persist
        p = ana.post('/api/posts/', {'text': 'Bienvenue sur Campus+', 'images': [png()]}, format='multipart')
        self.assertEqual((p.status_code, len(p.data['media'])), (201, 1))
        pid = p.data['id']
        bob.post(f'/api/posts/{pid}/react/')
        bob.post(f'/api/posts/{pid}/comments/', {'text': 'Génial !'}, format='json')
        feed = bob.get('/api/posts/').data['results'][0]
        self.assertEqual((feed['id'], feed['reacted'], feed['reaction_count'], feed['comment_count']), (pid, True, 1, 1))
        # notifications reflect the real events
        cats = {n['category'] for n in ana.get('/api/notifications/').data['results']}
        self.assertTrue({'friends', 'social'} <= cats)
        # community
        cid = ana.post('/api/communities/', {'name': 'Génie logiciel', 'category': 'filiere'}, format='json').data['id']
        bob.post(f'/api/communities/{cid}/join/')
        self.assertEqual(bob.post('/api/posts/', {'text': 'Salut le groupe', 'community': cid}, format='json').status_code, 201)
        # marketplace: listing -> offer -> counter -> accept -> sold -> review
        cat = bob.get('/api/market/categories/').data[0]['id']
        lid = ana.post('/api/listings/', {'title': 'Calculatrice', 'description': 'Casio, très bon état', 'category': cat, 'price': 12000,
                                          'negotiable': 'true', 'condition': 'used', 'quantity': 1, 'images': [png()]}, format='multipart').data['id']
        self.assertEqual(len(bob.get('/api/listings/?q=calcu').data['results']), 1)
        oid = bob.post(f'/api/listings/{lid}/offers/', {'amount': 9000}, format='json').data['id']
        self.assertEqual(ana.post(f'/api/offers/{oid}/counter/', {'amount': 10500}, format='json').data['status'], 'countered')
        self.assertEqual(bob.post(f'/api/offers/{oid}/accept-counter/').data['amount'], 10500)
        self.assertEqual(ana.post(f'/api/listings/{lid}/mark-sold/', {'buyer_id': bob_id}, format='json').status_code, 200)
        self.assertEqual(bob.post(f'/api/listings/{lid}/reviews/', {'rating': 5, 'comment': 'Parfait'}, format='json').status_code, 201)
        conv = bob.get('/api/conversations/').data[0]
        self.assertEqual(conv['listing']['id'], lid)
        # report + moderation + audit trail
        mod_user = User.objects.create_user('mia', 'mia@x.bj', PW, role='moderator', is_staff=True, verification='verified')
        mod_tok = APIClient().post('/api/auth/login/', {'login': 'mia', 'password': PW}, format='json').data['token']
        mod = self.client_for(mod_tok)
        self.assertEqual(bob.post('/api/reports/', {'target_type': 'post', 'target_id': pid, 'reason': 'spam'}, format='json').status_code, 201)
        rid = mod.get('/api/admin/reports/').data[0]['id']
        self.assertEqual(mod.post(f'/api/admin/reports/{rid}/resolve/', {'action': 'remove', 'note': 'test'}, format='json').status_code, 200)
        self.assertEqual(bob.get(f'/api/posts/{pid}/').status_code, 404)
        self.assertEqual(ana.get('/api/admin/stats/').status_code, 403)  # students never reach the admin API
        # logout invalidates the token
        self.assertEqual(ana.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(ana.get('/api/auth/me/').status_code, 401)
        self.assertIsNotNone(mod_user)
