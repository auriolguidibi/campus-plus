import tempfile
import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from accounts.models import User

PW = 'Str0ng!pass'


def png(size=(50, 50)):
    b = io.BytesIO()
    Image.new('RGB', size, 'purple').save(b, 'PNG')
    return SimpleUploadedFile('a.png', b.getvalue(), 'image/png')


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class Phase3Tests(APITestCase):
    def setUp(self):
        mk = lambda n, v='verified': User.objects.create_user(n, f'{n}@x.bj', PW, first_name=n, verification=v)
        self.a, self.b, self.c = mk('anna'), mk('ben'), mk('cleo', 'pending')

    def as_(self, u):
        self.client.force_authenticate(u)

    def test_friend_flow_and_feed_scope(self):
        self.as_(self.b)
        self.client.post('/api/posts/', {'text': 'post de ben'}, format='json')
        self.as_(self.a)
        self.assertEqual(self.client.get('/api/posts/').data['count'], 0)  # not friends yet
        self.assertEqual(self.client.get('/api/posts/?scope=campus').data['count'], 1)
        self.assertEqual(self.client.post(f'/api/friends/request/{self.b.id}/').data['relation'], 'request_sent')
        self.assertEqual(self.client.post(f'/api/friends/accept/{self.b.id}/').status_code, 400)  # can't self-accept
        self.as_(self.b)
        self.assertEqual(len(self.client.get('/api/friends/requests/').data), 1)
        self.assertEqual(self.client.post(f'/api/friends/accept/{self.a.id}/').data['relation'], 'friends')
        self.as_(self.a)
        self.assertEqual(self.client.get('/api/posts/').data['count'], 1)
        prof = self.client.get('/api/users/ben/').data
        self.assertEqual((prof['relation'], prof['friends_count'], prof['posts_count']), ('friends', 1, 1))

    def test_block_hides_both_ways_and_removes_friendship(self):
        self.as_(self.a)
        self.client.post(f'/api/friends/request/{self.b.id}/')
        self.client.post(f'/api/blocks/{self.b.id}/')
        self.assertEqual(self.client.get('/api/users/ben/').status_code, 404)
        self.as_(self.b)
        self.assertEqual(self.client.get('/api/users/anna/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/friends/request/{self.a.id}/').status_code, 400)

    def test_communities_roles_and_posting(self):
        self.as_(self.c)
        self.assertEqual(self.client.post('/api/communities/', {'name': 'X'}, format='json').status_code, 403)  # unverified
        self.as_(self.a)
        cid = self.client.post('/api/communities/', {'name': 'Club Info', 'category': 'club'}, format='json').data['id']
        self.as_(self.b)
        self.assertEqual(self.client.post('/api/posts/', {'text': 'hi', 'community': cid}, format='json').status_code, 403)
        self.client.post(f'/api/communities/{cid}/join/')
        pid = self.client.post('/api/posts/', {'text': 'hi', 'community': cid}, format='json').data['id']
        self.assertEqual(self.client.post(f'/api/communities/{cid}/members/{self.b.id}/role/', {'role': 'admin'}, format='json').status_code, 403)
        self.assertEqual(self.client.get(f'/api/posts/?community={cid}').data['count'], 1)
        self.assertEqual(self.client.get('/api/communities/?scope=mine').data['count'], 1)
        self.as_(self.a)  # creator promotes ben to moderator, can leave? no
        self.assertEqual(self.client.post(f'/api/communities/{cid}/leave/').status_code, 400)
        self.client.post(f'/api/communities/{cid}/members/{self.b.id}/role/', {'role': 'moderator'}, format='json')
        self.assertEqual(self.client.delete(f'/api/posts/{pid}/').status_code, 204)  # creator moderates

    def test_photos_validated_and_recompressed(self):
        self.as_(self.a)
        r = self.client.post('/api/posts/', {'text': '', 'images': [png((3000, 2000))]}, format='multipart')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(r.data['media']), 1)
        fake = SimpleUploadedFile('x.png', b'not an image', 'image/png')
        self.assertEqual(self.client.post('/api/posts/', {'text': 't', 'images': [fake]}, format='multipart').status_code, 400)
        five = [png() for _ in range(5)]
        self.assertEqual(self.client.post('/api/posts/', {'text': 't', 'images': five}, format='multipart').status_code, 400)
        self.assertEqual(self.client.post('/api/posts/', {'text': ''}, format='json').status_code, 400)
