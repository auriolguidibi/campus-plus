from unittest import mock

from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase
from rest_framework.throttling import SimpleRateThrottle

from accounts.models import User


class ThrottleAndHeaders(APITestCase):
    def test_login_is_rate_limited(self):
        User.objects.create_user('ana', 'ana@x.bj', 'Str0ng!pass')
        cache.clear()
        with mock.patch.dict(SimpleRateThrottle.THROTTLE_RATES, {'login': '3/min'}):
            c = APIClient()
            codes = [c.post('/api/auth/login/', {'login': 'ana', 'password': 'wrong'}, format='json').status_code for _ in range(5)]
        cache.clear()
        self.assertEqual(codes, [400, 400, 400, 429, 429])

    def test_health_is_public_and_minimal(self):
        r = APIClient().get('/api/health/')
        self.assertEqual((r.status_code, r.json()), (200, {'status': 'ok'}))

    def test_security_headers_present(self):
        r = APIClient().get('/api/health/')
        self.assertEqual(r['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(r['X-Frame-Options'], 'DENY')
