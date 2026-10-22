from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Count, Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.relations import blocked_ids
from accounts.serializers import PublicUserSerializer
from chat.services import get_or_create_conversation, post_message
from notifications.services import notify
from social.views import process_image

from .models import Category, Favorite, Listing, ListingImage, Offer, Review

MAX_IMAGES = 6
VISIBLE = (Listing.Status.PUBLISHED, Listing.Status.RESERVED, Listing.Status.SOLD)
OPEN_OFFER = (Offer.Status.PENDING, Offer.Status.COUNTERED)


def fcfa(n):
    return f'{n:,}'.replace(',', ' ') + ' FCFA'


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']


class SellerSerializer(PublicUserSerializer):
    rating = serializers.SerializerMethodField()
    sales = serializers.SerializerMethodField()

    class Meta(PublicUserSerializer.Meta):
        fields = PublicUserSerializer.Meta.fields + ['rating', 'sales']

    def get_rating(self, u):
        r = u.reviews_received.aggregate(a=Avg('rating'), n=Count('id'))
        return {'avg': round(r['a'], 1) if r['a'] else None, 'count': r['n']}

    def get_sales(self, u):
        return u.listings.filter(status=Listing.Status.SOLD).count()


class OfferSerializer(serializers.ModelSerializer):
    buyer = PublicUserSerializer(read_only=True)
    listing_title = serializers.CharField(source='listing.title', read_only=True)
    listing_price = serializers.IntegerField(source='listing.price', read_only=True)

    class Meta:
        model = Offer
        fields = ['id', 'listing', 'listing_title', 'listing_price', 'buyer', 'conversation', 'amount',
                  'counter_amount', 'status', 'created_at', 'responded_at']


class ListingSerializer(serializers.ModelSerializer):
    seller = SellerSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    images = serializers.SerializerMethodField()
    favorited = serializers.BooleanField(read_only=True, default=False)
    my_offer = serializers.SerializerMethodField()
    bought_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = ['id', 'seller', 'category', 'title', 'description', 'price', 'condition', 'quantity', 'location',
                  'handover', 'negotiable', 'status', 'images', 'favorited', 'my_offer', 'bought_by_me', 'created_at']

    def get_images(self, listing):
        return [{'id': i.id, 'url': i.image.url} for i in listing.images.all()]

    def get_bought_by_me(self, listing):
        return listing.sold_to_id == self.context['request'].user.id

    def get_my_offer(self, listing):
        o = listing.offers.filter(buyer=self.context['request'].user,
                                  status__in=OPEN_OFFER + (Offer.Status.ACCEPTED,)).first()
        return OfferSerializer(o).data if o else None


class ListingWriteSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.filter(is_active=True))
    handover = serializers.ListField(child=serializers.ChoiceField(['meetup', 'campus', 'delivery']), required=False)
    price = serializers.IntegerField(min_value=1, max_value=100_000_000)
    quantity = serializers.IntegerField(min_value=0, max_value=999, required=False)

    class Meta:
        model = Listing
        fields = ['title', 'description', 'category', 'price', 'condition', 'quantity', 'location', 'handover',
                  'negotiable']

    def validate(self, attrs):
        text = f"{attrs.get('title', '')} {attrs.get('description', '')}".lower()
        for term in settings.MARKET_FORBIDDEN_TERMS:
            if term in text:
                raise serializers.ValidationError('Cette annonce contient un terme interdit par les règles de la plateforme.')
        return attrs


class ListingViewSet(viewsets.ModelViewSet):
    serializer_class = ListingSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        u, p = self.request.user, self.request.query_params
        qs = (Listing.objects.select_related('seller', 'category').prefetch_related('images')
              .annotate(favorited=Exists(Favorite.objects.filter(listing=OuterRef('pk'), user=u))))
        if self.action != 'list':
            return qs
        if p.get('scope') == 'mine':
            qs = qs.filter(seller=u)
            if p.get('status'):
                qs = qs.filter(status=p['status'])
        elif p.get('scope') == 'favorites':
            qs = qs.filter(favorited=True, status__in=VISIBLE)
        elif p.get('scope') == 'purchases':
            qs = qs.filter(sold_to=u)
        else:
            qs = qs.filter(status__in=(Listing.Status.PUBLISHED, Listing.Status.RESERVED))
            qs = qs.exclude(seller_id__in=blocked_ids(u))
        if p.get('category'):
            qs = qs.filter(category_id=p['category'])
        if p.get('condition') in ('new', 'used'):
            qs = qs.filter(condition=p['condition'])
        q = p.get('q', '').strip()
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))
        for key, lookup in (('min_price', 'price__gte'), ('max_price', 'price__lte')):
            if p.get(key, '').isdigit():
                qs = qs.filter(**{lookup: int(p[key])})
        order = {'price_asc': ('price', '-id'), 'price_desc': ('-price', '-id')}.get(p.get('sort'), ('-created_at', '-id'))
        return qs.order_by(*order)

    def retrieve(self, request, *args, **kwargs):
        listing = self.get_object()
        mine = listing.seller_id == request.user.id
        if not mine and (listing.status not in VISIBLE or listing.seller_id in blocked_ids(request.user)):
            return Response({'detail': 'Annonce introuvable.'}, status=404)
        return Response(self.get_serializer(listing).data)

    def _images(self, request, existing=0):
        files = request.FILES.getlist('images')
        if existing + len(files) > MAX_IMAGES:
            raise serializers.ValidationError({'images': f'{MAX_IMAGES} photos maximum.'})
        return [process_image(f) for f in files]

    def _fresh(self, pk):
        return self.get_serializer(self.get_queryset().get(pk=pk)).data

    def create(self, request, *args, **kwargs):
        ser = ListingWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        images = self._images(request)
        new_status = Listing.Status.PENDING if settings.MARKET_REQUIRE_MODERATION else Listing.Status.PUBLISHED
        if str(request.data.get('draft', '')).lower() in ('1', 'true'):
            new_status = Listing.Status.DRAFT
        with transaction.atomic():
            listing = ser.save(seller=request.user, status=new_status)
            for i, img in enumerate(images):
                ListingImage.objects.create(listing=listing, image=img, position=i)
        return Response(self._fresh(listing.pk), status=201)

    def partial_update(self, request, *args, **kwargs):
        listing = self._own(request)
        if listing.status in (Listing.Status.SOLD, Listing.Status.REJECTED):
            return Response({'detail': 'Cette annonce ne peut plus être modifiée.'}, status=400)
        ser = ListingWriteSerializer(listing, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        remove = [int(i) for i in request.data.getlist('remove_images')] if hasattr(request.data, 'getlist') else []
        images = self._images(request, listing.images.exclude(id__in=remove).count())
        with transaction.atomic():
            listing = ser.save()
            listing.images.filter(id__in=remove).delete()
            start = listing.images.count()
            for i, img in enumerate(images):
                ListingImage.objects.create(listing=listing, image=img, position=start + i)
            if listing.quantity == 0:  # stock exhausted
                listing.status, listing.sold_at = Listing.Status.SOLD, timezone.now()
                listing.save(update_fields=['status', 'sold_at'])
        return Response(self._fresh(listing.pk))

    def destroy(self, request, *args, **kwargs):
        listing = self._own(request)
        if listing.status == Listing.Status.SOLD or listing.offers.exists():  # keep transaction history
            listing.status = Listing.Status.ARCHIVED
            listing.save(update_fields=['status'])
        else:
            listing.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _own(self, request):
        listing = self.get_object()
        if listing.seller_id != request.user.id:
            raise PermissionDenied()
        return listing

    @action(detail=True, methods=['post'], url_path='set-status')
    def set_status(self, request, pk=None):
        listing = self._own(request)
        new = request.data.get('status')
        if listing.status in (Listing.Status.SOLD, Listing.Status.REJECTED, Listing.Status.PENDING):
            return Response({'detail': 'Changement de statut impossible.'}, status=400)
        if new not in ('draft', 'published', 'reserved', 'archived'):
            return Response({'status': 'Statut invalide.'}, status=400)
        if new == 'published' and listing.status in (Listing.Status.DRAFT, Listing.Status.ARCHIVED) and settings.MARKET_REQUIRE_MODERATION:
            new = Listing.Status.PENDING
        listing.status = new
        listing.save(update_fields=['status'])
        return Response({'status': listing.status})

    @action(detail=True, methods=['post'], url_path='mark-sold')
    def mark_sold(self, request, pk=None):
        listing = self._own(request)
        if listing.status not in (Listing.Status.PUBLISHED, Listing.Status.RESERVED):
            return Response({'detail': 'Annonce non vendable.'}, status=400)
        buyer = None
        if request.data.get('buyer_id'):
            buyer = get_object_or_404(User, pk=request.data['buyer_id'])
            if not listing.conversations.filter(members__user=buyer).exists():
                return Response({'buyer_id': "Cet acheteur n'a pas contacté le vendeur pour cette annonce."}, status=400)
        listing.status, listing.sold_to, listing.sold_at = Listing.Status.SOLD, buyer, timezone.now()
        listing.save(update_fields=['status', 'sold_to', 'sold_at'])
        if buyer:
            notify(buyer, 'market', f"« {listing.title} » t'a été vendu : tu peux laisser un avis vérifié.", f'/marketplace/{listing.id}', actor=request.user)
        return Response({'status': listing.status})

    @action(detail=True, methods=['get'])
    def buyers(self, request, pk=None):
        listing = self._own(request)
        users = User.objects.filter(conversation_links__conversation__listing=listing).exclude(id=request.user.id).distinct()
        return Response(PublicUserSerializer(users, many=True).data)

    @action(detail=True, methods=['post'])
    def favorite(self, request, pk=None):
        obj, created = Favorite.objects.get_or_create(listing=self.get_object(), user=request.user)
        if not created:
            obj.delete()
        return Response({'active': created})

    @action(detail=True, methods=['post'])
    def contact(self, request, pk=None):
        listing = self.get_object()
        if listing.seller_id == request.user.id or listing.status not in VISIBLE \
                or listing.seller_id in blocked_ids(request.user):
            return Response({'detail': 'Contact impossible.'}, status=400)
        return Response({'id': get_or_create_conversation(request.user, listing.seller, listing).id})

    @action(detail=True, methods=['get', 'post'])
    def offers(self, request, pk=None):
        listing = self.get_object()
        if request.method == 'GET':
            if listing.seller_id != request.user.id:
                raise PermissionDenied()
            return Response(OfferSerializer(listing.offers.select_related('buyer', 'listing'), many=True).data)
        if listing.seller_id == request.user.id or not listing.negotiable or listing.status != Listing.Status.PUBLISHED \
                or listing.seller_id in blocked_ids(request.user):
            return Response({'detail': 'Les offres ne sont pas possibles pour cette annonce.'}, status=400)
        try:
            amount = int(request.data.get('amount'))
        except (TypeError, ValueError):
            return Response({'amount': 'Montant invalide.'}, status=400)
        if not 0 < amount < listing.price:
            return Response({'amount': "L'offre doit être positive et inférieure au prix demandé."}, status=400)
        if listing.offers.filter(buyer=request.user, status__in=OPEN_OFFER).exists():
            return Response({'detail': 'Tu as déjà une offre en cours pour cette annonce.'}, status=400)
        with transaction.atomic():
            conv = get_or_create_conversation(request.user, listing.seller, listing)
            offer = Offer.objects.create(listing=listing, buyer=request.user, conversation=conv, amount=amount)
            post_message(conv, request.user, f'Offre : {fcfa(amount)} (prix demandé {fcfa(listing.price)})', system=True)
        return Response(OfferSerializer(offer).data, status=201)

    @action(detail=True, methods=['get', 'post'])
    def reviews(self, request, pk=None):
        listing = self.get_object()
        if request.method == 'GET':
            rows = listing.seller.reviews_received.select_related('reviewer', 'listing').order_by('-created_at')[:20]
            return Response([{'id': r.id, 'rating': r.rating, 'comment': r.comment, 'listing': r.listing.title,
                              'reviewer': PublicUserSerializer(r.reviewer).data, 'created_at': r.created_at} for r in rows])
        if listing.sold_to_id != request.user.id:
            return Response({'detail': "Seul l'acheteur confirmé peut laisser un avis."}, status=403)
        try:
            rating = int(request.data.get('rating'))
        except (TypeError, ValueError):
            rating = 0
        if not 1 <= rating <= 5:
            return Response({'rating': 'Note de 1 à 5.'}, status=400)
        if Review.objects.filter(listing=listing, reviewer=request.user).exists():
            return Response({'detail': 'Avis déjà publié.'}, status=400)
        Review.objects.create(listing=listing, reviewer=request.user, seller=listing.seller, rating=rating,
                              comment=str(request.data.get('comment', ''))[:500])
        return Response(status=201)


class OfferActionView(APIView):
    """accept/decline/counter by the seller; withdraw/accept-counter by the buyer.
    Each step is timestamped and logged as a system message in the conversation."""

    def post(self, request, pk, act):
        S = Offer.Status
        with transaction.atomic():
            o = get_object_or_404(Offer.objects.select_for_update().select_related('listing'), pk=pk)
            listing, me = o.listing, request.user
            seller, buyer = me.id == listing.seller_id, me.id == o.buyer_id
            if not (seller or buyer):
                return Response({'detail': 'Introuvable.'}, status=404)
            if seller and act == 'accept' and o.status == S.PENDING:
                o.status, note = S.ACCEPTED, f'Offre de {fcfa(o.amount)} acceptée.'
            elif seller and act == 'decline' and o.status == S.PENDING:
                o.status, note = S.DECLINED, 'Offre refusée.'
            elif seller and act == 'counter' and o.status == S.PENDING:
                try:
                    c = int(request.data.get('amount'))
                except (TypeError, ValueError):
                    return Response({'amount': 'Montant invalide.'}, status=400)
                if not o.amount < c <= listing.price:
                    return Response({'amount': "La contre-proposition doit être entre l'offre et le prix demandé."}, status=400)
                o.status, o.counter_amount, note = S.COUNTERED, c, f'Contre-proposition : {fcfa(c)}.'
            elif buyer and act == 'accept-counter' and o.status == S.COUNTERED:
                o.status, o.amount = S.ACCEPTED, o.counter_amount
                note = f'Contre-proposition acceptée : {fcfa(o.counter_amount)}.'
            elif buyer and act in ('withdraw', 'decline') and o.status in (S.PENDING, S.COUNTERED):
                o.status, note = S.WITHDRAWN, 'Offre retirée.'
            else:
                return Response({'detail': 'Action impossible.'}, status=400)
            o.responded_at = timezone.now()
            o.save()
            if o.conversation_id:
                post_message(o.conversation, me, note, system=True)
        return Response(OfferSerializer(o).data)


class MyOffersView(APIView):
    def get(self, request):
        qs = Offer.objects.select_related('buyer', 'listing')
        if request.query_params.get('role') == 'seller':
            qs = qs.filter(listing__seller=request.user)
        else:
            qs = qs.filter(buyer=request.user)
        return Response(OfferSerializer(qs[:100], many=True).data)


class CategoryListView(APIView):
    def get(self, request):
        return Response(CategorySerializer(Category.objects.filter(is_active=True), many=True).data)


class HighlightsView(APIView):
    """Transparent rules: 'bons plans' = cheapest published listings of the last 30 days;
    'vendeur de la semaine' = seller with the most sales in the last 7 days (ties: most active listings)."""

    def get(self, request):
        base = (Listing.objects.filter(status=Listing.Status.PUBLISHED).exclude(seller_id__in=blocked_ids(request.user))
                .select_related('seller', 'category').prefetch_related('images'))
        deals = base.filter(created_at__gte=timezone.now() - timedelta(days=30)).order_by('price')[:6]
        week = timezone.now() - timedelta(days=7)
        top = (User.objects.filter(is_active=True)
               .annotate(s=Count('listings', filter=Q(listings__status='sold', listings__sold_at__gte=week)),
                         n=Count('listings', filter=Q(listings__status='published')))
               .filter(Q(s__gt=0) | Q(n__gt=0)).order_by('-s', '-n').first())
        ctx = {'request': request}
        return Response({'deals': ListingSerializer(deals, many=True, context=ctx).data,
                         'seller_of_week': SellerSerializer(top).data if top else None})
