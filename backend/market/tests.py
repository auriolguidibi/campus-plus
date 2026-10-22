import io
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from accounts.models import User
from market.models import Category, Listing

PW = 'Str0ng!pass'


def png():
    b = io.BytesIO()
    Image.new('RGB', (40, 40), 'green').save(b, 'PNG')
    return SimpleUploadedFile('a.png', b.getvalue(), 'image/png')


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class MarketTests(APITestCase):
    def setUp(self):
        mk = lambda n: User.objects.create_user(n, f'{n}@x.bj', PW, first_name=n, verification='verified')
        self.seller, self.buyer, self.other = mk('sam'), mk('bea'), mk('otto')
        self.cat = Category.objects.first()

    def login(self, u):
        self.client.force_authenticate(u)

    def make(self, **kw):
        self.login(self.seller)
        data = {'title': 'Nike Air Force 1', 'description': 'Très bon état', 'category': self.cat.id, 'price': 25000,
                'condition': 'used', 'quantity': 1, 'negotiable': 'true', 'handover': ['meetup'], **kw}
        return self.client.post('/api/listings/', data, format='multipart')

    def test_create_validate_and_search(self):
        r = self.make(images=[png(), png()])
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(len(r.data['images']), 2)
        self.assertEqual(self.make(price=0).status_code, 400)
        self.assertEqual(self.make(title='Vente de cocaïne').status_code, 400)  # forbidden term
        self.assertEqual(self.make(images=[png() for _ in range(7)]).status_code, 400)
        self.make(title='MacBook Air', price=350000, condition='new')
        self.login(self.buyer)
        g = lambda q: self.client.get('/api/listings/?' + q).data['results']
        self.assertEqual(len(g('')), 2)
        self.assertEqual([x['title'] for x in g('q=macbook')], ['MacBook Air'])
        self.assertEqual([x['price'] for x in g('sort=price_desc')], [350000, 25000])
        self.assertEqual(len(g('max_price=30000')), 1)
        self.assertEqual(len(g('condition=new')), 1)

    def test_only_owner_edits_and_drafts_hidden(self):
        lid = self.make(draft='true').data['id']
        self.login(self.buyer)
        self.assertEqual(len(self.client.get('/api/listings/').data['results']), 0)
        self.assertEqual(self.client.get(f'/api/listings/{lid}/').status_code, 404)
        self.assertEqual(self.client.patch(f'/api/listings/{lid}/', {'price': 1}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(f'/api/listings/{lid}/').status_code, 403)
        self.login(self.seller)
        self.assertEqual(self.client.patch(f'/api/listings/{lid}/', {'price': 20000}, format='json').data['price'], 20000)
        self.client.post(f'/api/listings/{lid}/set-status/', {'status': 'published'}, format='json')
        self.login(self.buyer)
        self.assertEqual(len(self.client.get('/api/listings/').data['results']), 1)

    def test_favorites(self):
        lid = self.make().data['id']
        self.login(self.buyer)
        self.assertTrue(self.client.post(f'/api/listings/{lid}/favorite/').data['active'])
        self.assertEqual(len(self.client.get('/api/listings/?scope=favorites').data['results']), 1)
        self.assertFalse(self.client.post(f'/api/listings/{lid}/favorite/').data['active'])

    def test_offer_negotiation_and_chat_permissions(self):
        lid = self.make().data['id']
        self.login(self.buyer)
        self.assertEqual(self.client.post(f'/api/listings/{lid}/offers/', {'amount': 30000}, format='json').status_code, 400)  # >= price
        r = self.client.post(f'/api/listings/{lid}/offers/', {'amount': 18000}, format='json')
        self.assertEqual(r.status_code, 201)
        oid, cid = r.data['id'], r.data['conversation']
        self.assertEqual(self.client.post(f'/api/listings/{lid}/offers/', {'amount': 19000}, format='json').status_code, 400)  # one open offer
        self.assertEqual(self.client.post(f'/api/offers/{oid}/accept/').status_code, 400)  # buyer can't accept own offer
        self.login(self.other)
        self.assertEqual(self.client.get(f'/api/conversations/{cid}/messages/').status_code, 404)  # not a member
        self.assertEqual(self.client.post(f'/api/offers/{oid}/accept/').status_code, 404)
        self.login(self.seller)
        self.assertEqual(self.client.post(f'/api/offers/{oid}/counter/', {'amount': 40000}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/offers/{oid}/counter/', {'amount': 22000}, format='json').data['status'], 'countered')
        self.login(self.buyer)
        o = self.client.post(f'/api/offers/{oid}/accept-counter/').data
        self.assertEqual((o['status'], o['amount']), ('accepted', 22000))
        msgs = self.client.get(f'/api/conversations/{cid}/messages/').data['messages']
        self.assertEqual(len(msgs), 3)
        self.client.post(f'/api/conversations/{cid}/messages/', {'text': 'On se voit où ?'}, format='json')
        self.login(self.seller)
        self.assertEqual(self.client.get('/api/conversations/unread/').data['unread'], 3)  # offer + accepted counter + text, all from the buyer

    def test_sale_and_verified_review(self):
        lid = self.make().data['id']
        self.login(self.buyer)
        self.client.post(f'/api/listings/{lid}/contact/')
        self.assertEqual(self.client.post(f'/api/listings/{lid}/reviews/', {'rating': 5}, format='json').status_code, 403)  # not sold
        self.login(self.seller)
        self.assertEqual(self.client.post(f'/api/listings/{lid}/mark-sold/', {'buyer_id': self.other.id}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/listings/{lid}/mark-sold/', {'buyer_id': self.buyer.id}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/listings/{lid}/', {'price': 1}, format='json').status_code, 400)
        self.login(self.other)
        self.assertEqual(self.client.post(f'/api/listings/{lid}/reviews/', {'rating': 5}, format='json').status_code, 403)
        self.login(self.buyer)
        self.assertEqual(self.client.post(f'/api/listings/{lid}/reviews/', {'rating': 4, 'comment': 'Top'}, format='json').status_code, 201)
        self.assertEqual(self.client.post(f'/api/listings/{lid}/reviews/', {'rating': 4}, format='json').status_code, 400)
        self.assertEqual(self.client.get(f'/api/listings/{lid}/').data['seller']['rating'], {'avg': 4.0, 'count': 1})
        self.assertEqual(Listing.objects.get(pk=lid).status, 'sold')
