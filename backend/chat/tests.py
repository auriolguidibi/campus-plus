import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Block, User
from chat.models import Call, CallSignal
from chat.services import get_or_create_conversation
from notifications.models import Notification

PW = 'Str0ng!pass'
WEBM = bytes([0x1A, 0x45, 0xDF, 0xA3]) + b'\x00' * 64


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class VoiceAndCallTests(APITestCase):
    def setUp(self):
        mk = lambda n: User.objects.create_user(n, f'{n}@x.bj', PW, first_name=n.title(), verification='verified')
        self.a, self.b, self.c = mk('ana'), mk('bob'), mk('cy')
        self.conv = get_or_create_conversation(self.a, self.b)

    def as_(self, u):
        self.client.force_authenticate(u)

    # ---- voice notes
    def voice(self, data=WEBM, seconds=5, name='x.webm'):
        return self.client.post(f'/api/conversations/{self.conv.id}/messages/',
                                {'audio': SimpleUploadedFile(name, data, 'audio/webm'), 'seconds': seconds}, format='multipart')

    def test_voice_note_validated_and_notified(self):
        self.as_(self.a)
        r = self.voice()
        self.assertEqual((r.status_code, r.data['kind'], r.data['audio_seconds']), (201, 'voice', 5))
        self.assertTrue(r.data['audio_url'].endswith('.webm'))
        self.assertEqual(self.voice(b'MZ-not-audio-' + b'0' * 40).status_code, 400)  # content sniffed, not trusted
        self.assertEqual(self.voice(seconds=500).status_code, 400)
        self.assertEqual(self.voice(seconds=0).status_code, 400)
        self.assertEqual(self.voice(WEBM + b'0' * (5 * 1024 * 1024)).status_code, 400)
        self.assertTrue(Notification.objects.filter(user=self.b, text__startswith='Note vocale').exists())
        self.as_(self.c)
        self.assertEqual(self.client.get(f'/api/conversations/{self.conv.id}/messages/').status_code, 404)
        self.assertEqual(self.voice().status_code, 404)  # outsiders cannot post either
        self.as_(self.b)
        last = self.client.get('/api/conversations/').data[0]['last_message']
        self.assertEqual(last['text'], 'Note vocale')

    # ---- calls
    def start(self, kind='video', who=None):
        self.as_(who or self.a)
        return self.client.post(f'/api/conversations/{self.conv.id}/call/', {'kind': kind}, format='json')

    def test_call_lifecycle_and_signalling(self):
        r = self.start()
        self.assertEqual((r.status_code, r.data['status'], r.data['incoming']), (201, 'ringing', False))
        cid = r.data['id']
        self.assertEqual(self.start('audio').status_code, 409)  # already ringing
        self.as_(self.c)
        self.assertEqual(self.client.get(f'/api/calls/{cid}/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/calls/{cid}/signal/', {'type': 'offer', 'payload': {}}, format='json').status_code, 404)
        self.as_(self.b)
        inc = self.client.get('/api/calls/incoming/').data
        self.assertEqual((len(inc), inc[0]['id'], inc[0]['kind'], inc[0]['incoming']), (1, cid, 'video', True))
        self.as_(self.a)
        self.assertEqual(self.client.post(f'/api/calls/{cid}/answer/').status_code, 400)  # caller cannot answer
        self.as_(self.b)
        self.assertEqual(self.client.post(f'/api/calls/{cid}/answer/').data['status'], 'active')
        # signalling relays only to the other side
        self.as_(self.a)
        self.client.post(f'/api/calls/{cid}/signal/', {'type': 'offer', 'payload': {'sdp': 'v=0...'}}, format='json')
        self.client.post(f'/api/calls/{cid}/signal/', {'type': 'candidate', 'payload': {'candidate': 'c1'}}, format='json')
        self.assertEqual(self.client.get(f'/api/calls/{cid}/signals/').data['signals'], [])  # own signals not echoed
        self.as_(self.b)
        got = self.client.get(f'/api/calls/{cid}/signals/').data['signals']
        self.assertEqual([s['type'] for s in got], ['offer', 'candidate'])
        self.assertEqual(self.client.get(f'/api/calls/{cid}/signals/?after={got[0]["id"]}').data['signals'][0]['type'], 'candidate')
        self.assertEqual(self.client.post(f'/api/calls/{cid}/signal/', {'type': 'hack', 'payload': {}}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/calls/{cid}/signal/', {'type': 'offer', 'payload': {'x': 'a' * 30000}}, format='json').status_code, 400)
        # hang up: state ended, signalling data purged, history message written
        self.assertEqual(self.client.post(f'/api/calls/{cid}/end/').data['status'], 'ended')
        self.assertEqual(CallSignal.objects.filter(call_id=cid).count(), 0)
        self.assertEqual(self.client.post(f'/api/calls/{cid}/signal/', {'type': 'offer', 'payload': {}}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/calls/{cid}/end/').status_code, 200)  # idempotent
        self.assertTrue(self.conv.messages.filter(is_system=True, text__contains='terminé').exists())
        self.assertEqual(self.start('audio').status_code, 201)  # free again

    def test_decline_missed_and_blocked(self):
        cid = self.start().data['id']
        self.as_(self.b)
        self.assertEqual(self.client.post(f'/api/calls/{cid}/decline/').data['status'], 'declined')
        self.assertTrue(self.conv.messages.filter(text__contains='refusé').exists())
        cid2 = self.start('audio').data['id']
        Call.objects.filter(pk=cid2).update(created_at=timezone.now() - timedelta(seconds=60))
        self.as_(self.b)
        self.assertEqual(self.client.get('/api/calls/incoming/').data, [])  # rang too long: missed
        self.assertEqual(Call.objects.get(pk=cid2).status, 'missed')
        Block.objects.create(blocker=self.b, blocked=self.a)
        self.assertEqual(self.start().status_code, 400)

    def test_ice_servers_and_validation(self):
        self.as_(self.a)
        self.assertTrue(self.client.get('/api/calls/ice-servers/').data['iceServers'][0]['urls'])
        self.assertEqual(self.client.post(f'/api/conversations/{self.conv.id}/call/', {'kind': 'hologram'}, format='json').status_code, 400)
