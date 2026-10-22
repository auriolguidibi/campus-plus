from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Student account. `username` is the public pseudo; e-mail is unique and used to log in."""

    class Theme(models.TextChoices):
        LIGHT = 'light', 'Clair'
        DARK = 'dark', 'Sombre'
        AUTO = 'auto', 'Automatique'

    class Verification(models.TextChoices):
        PENDING = 'pending', 'En attente'
        VERIFIED = 'verified', 'Vérifié'
        REJECTED = 'rejected', 'Refusé'

    email = models.EmailField(unique=True)
    school = models.CharField(max_length=120, blank=True)
    field_of_study = models.CharField(max_length=120, blank=True)
    promotion = models.CharField(max_length=40, blank=True)
    bio = models.CharField(max_length=300, blank=True)
    theme = models.CharField(max_length=5, choices=Theme.choices, default=Theme.AUTO)
    verification = models.CharField(max_length=10, choices=Verification.choices, default=Verification.PENDING)

    REQUIRED_FIELDS = ['email']

    def __str__(self):
        return self.username


class Friendship(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        ACCEPTED = 'accepted', 'Accepté'

    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friend_requests_sent')
    addressee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friend_requests_received')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['requester', 'addressee'], name='one_request_per_direction'),
            models.CheckConstraint(condition=~models.Q(requester=models.F('addressee')), name='no_self_friendship'),
        ]


class Block(models.Model):
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocks_made')
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocks_received')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['blocker', 'blocked'], name='one_block_per_pair')]
