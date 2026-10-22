from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from campus.models import Confession
from market.models import Category, Listing
from moderation.models import AdminAuditLog, Report
from social.models import Comment, Post

PW = 'Str0ng!pass'


class ModerationTests(APITestCase):
    def setUp(self):
        mk = lambda n, **kw: User.objects.create_user(n, f'{n}@x.bj', PW, first_name=n, verification='verified', **kw)
        self.admin = mk('root', role='admin', is_staff=True)
        self.mod = mk('mia', role='moderator', is_staff=True)
        self.a, self.b = mk('ana'), mk('bob')

    def as_(self, u):
        self.client.force_authenticate(u)

    def test_all_private_routes_require_auth(self):
        c = APIClient()
        gets = ['/api/auth/me/', '/api/posts/', '/api/users/?q=ab', '/api/friends/', '/api/blocks/', '/api/communities/', '/api/listings/',
                '/api/market/categories/', '/api/market/highlights/', '/api/offers/', '/api/conversations/', '/api/conversations/unread/',
                '/api/stories/', '/api/events/', '/api/challenges/', '/api/leaderboard/', '/api/badges/', '/api/confessions/',
                '/api/confessions/mine/', '/api/confessions/queue/', '/api/admin/stats/', '/api/admin/users/', '/api/admin/reports/',
                '/api/admin/audit-log/', '/api/admin/listings/', '/api/admin/posts/', '/api/admin/categories/']
        for u in gets:
            self.assertEqual(c.get(u).status_code, 401, u)
        for u in ['/api/reports/', '/api/posts/', '/api/confessions/', '/api/auth/logout/']:
            self.assertEqual(c.post(u, {}, format='json').status_code, 401, u)

    def test_role_boundaries(self):
        self.as_(self.a)
        for u in ['/api/admin/stats/', '/api/admin/users/', '/api/admin/reports/', '/api/admin/audit-log/']:
            self.assertEqual(self.client.get(u).status_code, 403, u)
        self.as_(self.mod)
        self.assertEqual(self.client.get('/api/admin/stats/').status_code, 200)
        self.assertEqual(self.client.get('/api/admin/audit-log/').status_code, 403)
        self.assertEqual(self.client.post(f'/api/admin/users/{self.a.id}/suspend/', {'action': 'suspend', 'reason': 'x'}, format='json').status_code, 403)
        self.assertEqual(self.client.post(f'/api/admin/users/{self.a.id}/role/', {'role': 'admin'}, format='json').status_code, 403)
        self.assertNotIn('email', self.client.get('/api/admin/users/').data[0])  # minimisation
        self.as_(self.admin)
        self.assertIn('email', self.client.get('/api/admin/users/').data[0])

    def test_cannot_self_promote_via_profile(self):
        self.as_(self.a)
        self.client.patch('/api/auth/me/', {'role': 'admin', 'is_staff': True, 'is_superuser': True, 'staff_role': 'admin'}, format='json')
        self.a.refresh_from_db()
        self.assertEqual((self.a.role, self.a.is_staff, self.a.is_superuser, self.a.staff_role), ('user', False, False, 'user'))

    def test_report_flow_and_audit(self):
        post = Post.objects.create(author=self.a, text='contenu abusif')
        self.as_(self.b)
        r = lambda **kw: self.client.post('/api/reports/', {'target_type': 'post', 'target_id': post.id, 'reason': 'harassment', **kw}, format='json')
        self.assertEqual(r().status_code, 201)
        self.assertEqual(r().status_code, 200)  # duplicate
        self.as_(self.a)
        self.assertEqual(r().status_code, 400)  # own content
        self.assertEqual(self.client.post('/api/reports/', {'target_type': 'post', 'target_id': 999, 'reason': 'spam'}, format='json').status_code, 400)
        self.as_(self.mod)
        q = self.client.get('/api/admin/reports/').data
        self.assertEqual((len(q), q[0]['target']['author']), (1, 'ana'))
        rid = q[0]['id']
        self.assertEqual(self.client.post(f'/api/admin/reports/{rid}/resolve/', {'action': 'remove'}, format='json').status_code, 400)  # note required
        self.assertEqual(self.client.post(f'/api/admin/reports/{rid}/resolve/', {'action': 'remove', 'note': 'harcèlement'}, format='json').status_code, 200)
        post.refresh_from_db()
        self.assertTrue(post.is_deleted)
        self.assertEqual(self.client.get('/api/admin/reports/').data, [])
        self.assertTrue(AdminAuditLog.objects.filter(action='report.remove', actor=self.mod, target_id=post.id).exists())
        self.assertEqual(self.client.post(f'/api/admin/reports/{rid}/resolve/', {'action': 'dismiss'}, format='json').status_code, 404)  # already closed

    def test_report_comment_listing_user(self):
        post = Post.objects.create(author=self.a, text='x')
        cm = Comment.objects.create(post=post, author=self.a, text='insulte')
        cat = Category.objects.first()
        li = Listing.objects.create(seller=self.a, category=cat, title='t', description='d', price=10)
        self.as_(self.b)
        for t, i in (('comment', cm.id), ('listing', li.id), ('user', self.a.id)):
            self.assertEqual(self.client.post('/api/reports/', {'target_type': t, 'target_id': i, 'reason': 'spam'}, format='json').status_code, 201, t)
        self.as_(self.mod)
        by = {x['target_type']: x['id'] for x in self.client.get('/api/admin/reports/').data}
        self.assertEqual(self.client.post(f"/api/admin/reports/{by['listing']}/resolve/", {'action': 'remove', 'note': 'interdit'}, format='json').status_code, 200)
        li.refresh_from_db()
        self.assertEqual(li.status, 'rejected')
        self.assertEqual(self.client.post(f"/api/admin/reports/{by['user']}/resolve/", {'action': 'remove', 'note': 'x'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f"/api/admin/reports/{by['user']}/resolve/", {'action': 'suspend_author', 'note': 'x'}, format='json').status_code, 403)
        self.as_(self.admin)
        self.assertEqual(self.client.post(f"/api/admin/reports/{by['user']}/resolve/", {'action': 'suspend_author', 'note': 'spam répété'}, format='json').status_code, 200)
        self.a.refresh_from_db()
        self.assertFalse(self.a.is_active)

    def test_suspension_kills_session_and_is_reversible(self):
        tok = Token.objects.create(user=self.b)
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Token {tok.key}')
        self.assertEqual(c.get('/api/auth/me/').status_code, 200)
        self.as_(self.admin)
        s = lambda u, **kw: self.client.post(f'/api/admin/users/{u.id}/suspend/', kw, format='json')
        self.assertEqual(s(self.b, action='suspend').status_code, 400)  # reason required
        self.assertEqual(s(self.admin, action='suspend', reason='x').status_code, 400)  # not self / admin
        self.assertEqual(s(self.b, action='suspend', reason='arnaque').status_code, 200)
        self.assertEqual(c.get('/api/auth/me/').status_code, 401)
        self.assertEqual(APIClient().post('/api/auth/login/', {'login': 'bob', 'password': PW}, format='json').status_code, 400)
        self.assertEqual(s(self.b, action='reactivate').status_code, 200)
        self.assertEqual(APIClient().post('/api/auth/login/', {'login': 'bob', 'password': PW}, format='json').status_code, 200)
        self.assertEqual(AdminAuditLog.objects.filter(action__startswith='user.').count(), 2)

    def test_role_change_rules(self):
        self.as_(self.admin)
        self.assertEqual(self.client.post(f'/api/admin/users/{self.admin.id}/role/', {'role': 'user'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/admin/users/{self.a.id}/role/', {'role': 'god'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/admin/users/{self.a.id}/role/', {'role': 'moderator'}, format='json').data['role'], 'moderator')
        self.a.refresh_from_db()  # force_authenticate reuses the in-memory object; real requests reload it
        self.as_(self.a)
        self.assertEqual(self.client.get('/api/admin/stats/').status_code, 200)  # now effective, server-side

    def test_verify_listing_moderation_and_logs(self):
        pend = User.objects.create_user('newbie', 'n@x.bj', PW)
        self.as_(self.mod)
        self.assertEqual(self.client.post(f'/api/admin/users/{pend.id}/verify/', {'decision': 'verified'}, format='json').status_code, 200)
        pend.refresh_from_db()
        self.assertEqual(pend.verification, 'verified')
        li = Listing.objects.create(seller=self.a, category=Category.objects.first(), title='t', description='d', price=10, status='pending')
        self.assertEqual(self.client.post(f'/api/admin/listings/{li.id}/', {'decision': 'reject'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/admin/listings/{li.id}/', {'decision': 'approve'}, format='json').status_code, 200)
        self.assertEqual(set(AdminAuditLog.objects.values_list('action', flat=True)), {'user.verification', 'listing.approve'})
        self.as_(self.admin)
        self.assertEqual(len(self.client.get('/api/admin/audit-log/').data), 2)

    def test_confession_moderation_logged_without_author(self):
        c = Confession.objects.create(author=self.a, text='une confession assez longue pour passer', status='pending')
        self.as_(self.a)
        self.assertEqual(self.client.get('/api/confessions/queue/').status_code, 403)
        self.as_(self.mod)
        self.client.post(f'/api/confessions/queue/{c.id}/', {'decision': 'reject', 'reason': 'hors règles'}, format='json')
        e = AdminAuditLog.objects.get(action='confession.reject')
        self.assertNotIn('ana', str(e.detail) + e.target_type)

    def test_account_deletion_requires_password_and_keeps_history(self):
        Listing.objects.create(seller=self.a, category=Category.objects.first(), title='t', description='d', price=10)
        self.as_(self.a)
        self.assertEqual(self.client.delete('/api/auth/me/', {'password': 'nope'}, format='json').status_code, 400)
        self.assertEqual(self.client.delete('/api/auth/me/', {'password': PW}, format='json').status_code, 204)
        self.a.refresh_from_db()
        self.assertEqual((self.a.is_active, self.a.first_name, self.a.email.endswith('@deleted.invalid')), (False, '', True))
        self.assertEqual(Listing.objects.filter(seller=self.a).count(), 1)
        self.assertEqual(APIClient().post('/api/auth/login/', {'login': 'ana', 'password': PW}, format='json').status_code, 400)

    def test_categories_admin_only(self):
        self.as_(self.mod)
        self.assertEqual(self.client.post('/api/admin/categories/', {'name': 'Sport'}, format='json').status_code, 403)
        self.as_(self.admin)
        cid = self.client.post('/api/admin/categories/', {'name': 'Sport'}, format='json').data['id']
        self.client.patch(f'/api/admin/categories/{cid}/', {'is_active': False}, format='json')
        self.as_(self.a)
        self.assertNotIn('Sport', [c['name'] for c in self.client.get('/api/market/categories/').data])
