import io
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from accounts.models import User

PW = 'Str0ng!pass'


def png(size=(800, 400)):
    b = io.BytesIO()
    Image.new('RGB', size, 'purple').save(b, 'PNG')
    return SimpleUploadedFile('p.png', b.getvalue(), 'image/png')


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ProfilePhotoTests(APITestCase):
    def setUp(self):
        self.a = User.objects.create_user('ana', 'ana@x.bj', PW, first_name='Ana', verification='verified', promotion='L1')
        self.b = User.objects.create_user('ben', 'ben@x.bj', PW, first_name='Ben', verification='verified', promotion='L2')

    def test_avatar_and_cover_upload_crop_replace_remove(self):
        self.client.force_authenticate(self.a)
        r = self.client.patch('/api/auth/me/', {'avatar': png(), 'cover': png((3000, 2000))}, format='multipart')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data['avatar'].endswith('.jpg') and r.data['cover'])
        self.a.refresh_from_db()
        self.assertEqual(Image.open(self.a.avatar).size, (512, 512))  # square crop
        self.assertEqual(Image.open(self.a.cover).size, (1500, 500))
        first = r.data['avatar']
        again = self.client.patch('/api/auth/me/', {'avatar': png()}, format='multipart').data['avatar']
        self.assertTrue(again and first)
        r = self.client.patch('/api/auth/me/', {'remove_avatar': 'true'}, format='multipart')
        self.assertIsNone(r.data['avatar'])
        self.assertTrue(r.data['cover'])  # untouched

    def test_fake_image_rejected(self):
        self.client.force_authenticate(self.a)
        r = self.client.patch('/api/auth/me/', {'avatar': SimpleUploadedFile('x.png', b'not an image', 'image/png')}, format='multipart')
        self.assertEqual(r.status_code, 400)

    def test_everyone_can_see_and_message_everyone_across_classes(self):
        self.client.force_authenticate(self.a)  # an L1 student
        self.assertEqual([u['username'] for u in self.client.get('/api/users/?q=ben').data], ['ben'])  # L2 is findable
        cid = self.client.post('/api/conversations/', {'user_id': self.b.id}, format='json')
        self.assertEqual(cid.status_code, 200)
        self.assertEqual(self.client.post(f'/api/conversations/{cid.data["id"]}/messages/', {'text': 'Salut !'}, format='json').status_code, 201)
        self.assertIn('avatar', self.client.get('/api/users/ben/').data)
