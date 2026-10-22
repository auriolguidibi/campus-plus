from django.test import override_settings
from rest_framework.test import APITestCase

REG = {'username': 'koffi', 'first_name': 'Koffi', 'last_name': 'R', 'email': 'k@x.bj', 'password': 'Str0ng!pass',
       'school': 'EIG', 'field_of_study': 'GL', 'promotion': 'L1', 'invite_code': 'CAMPUS2026'}


class AuthAndFeedTests(APITestCase):
    def register(self, **over):
        r = self.client.post('/api/auth/register/', {**REG, **over}, format='json')
        return r

    def test_register_login_and_verification(self):
        r = self.register()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['user']['verification'], 'verified')
        self.assertEqual(self.register(username='b', email='b@x.bj', invite_code='bad').data['user']['verification'], 'pending')
        self.assertEqual(self.register().status_code, 400)  # duplicate
        r = self.client.post('/api/auth/login/', {'login': 'K@x.bj', 'password': 'Str0ng!pass'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.post('/api/auth/login/', {'login': 'koffi', 'password': 'nope'}, format='json').status_code, 400)

    def test_user_cannot_self_verify_or_admin(self):
        tok = self.register(invite_code='').data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {tok}')
        self.client.patch('/api/auth/me/', {'verification': 'verified', 'is_staff': True, 'theme': 'dark'}, format='json')
        me = self.client.get('/api/auth/me/').data
        self.assertEqual(me['verification'], 'pending')
        self.assertEqual(me['theme'], 'dark')

    def test_feed_requires_auth_and_interactions_persist(self):
        self.assertEqual(self.client.get('/api/posts/').status_code, 401)
        tok = self.register().data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {tok}')
        pid = self.client.post('/api/posts/', {'text': 'Salut'}, format='json').data['id']
        self.client.post(f'/api/posts/{pid}/react/')
        self.client.post(f'/api/posts/{pid}/comments/', {'text': 'ok'}, format='json')
        p = self.client.get('/api/posts/').data['results'][0]
        self.assertEqual((p['reaction_count'], p['comment_count'], p['reacted']), (1, 1, True))
        # another user cannot edit/delete it
        tok2 = self.register(username='b', email='b@x.bj').data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {tok2}')
        self.assertEqual(self.client.patch(f'/api/posts/{pid}/', {'text': 'x'}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(f'/api/posts/{pid}/').status_code, 403)
