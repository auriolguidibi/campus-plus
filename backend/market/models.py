from django.conf import settings
from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=60, unique=True)
    position = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['position', 'name']
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Listing(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Brouillon'
        PENDING = 'pending', 'En attente de modération'
        PUBLISHED = 'published', 'Publié'
        RESERVED = 'reserved', 'Réservé'
        SOLD = 'sold', 'Vendu'
        REJECTED = 'rejected', 'Refusé'
        ARCHIVED = 'archived', 'Archivé'

    class Condition(models.TextChoices):
        NEW = 'new', 'Neuf'
        USED = 'used', 'Occasion'

    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='listings')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='listings')
    title = models.CharField(max_length=120)
    description = models.TextField(max_length=3000)
    price = models.PositiveIntegerField(help_text='FCFA')
    condition = models.CharField(max_length=4, choices=Condition.choices, default=Condition.USED)
    quantity = models.PositiveIntegerField(default=1)
    location = models.CharField(max_length=120, blank=True)
    handover = models.JSONField(default=list, blank=True)  # e.g. ["meetup", "delivery"]
    negotiable = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PUBLISHED, db_index=True)
    sold_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='purchases')
    sold_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']


class ListingImage(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='listings/%Y/%m/')
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['position', 'id']


class Favorite(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='favorites')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='listing_favorites')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['listing', 'user'], name='one_listing_favorite')]


class Offer(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        COUNTERED = 'countered', 'Contre-proposition'
        ACCEPTED = 'accepted', 'Acceptée'
        DECLINED = 'declined', 'Refusée'
        WITHDRAWN = 'withdrawn', 'Retirée'

    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='offers')
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='offers_made')
    conversation = models.ForeignKey('chat.Conversation', on_delete=models.SET_NULL, null=True, related_name='offers')
    amount = models.PositiveIntegerField()
    counter_amount = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']


class Review(models.Model):
    """Verified review: only the buyer a listing was sold to can write one."""
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews_written')
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews_received')
    rating = models.PositiveSmallIntegerField()
    comment = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['listing', 'reviewer'], name='one_review_per_sale'),
            models.CheckConstraint(condition=models.Q(rating__gte=1, rating__lte=5), name='rating_1_5'),
        ]
