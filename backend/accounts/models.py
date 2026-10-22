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

    class Role(models.TextChoices):
        USER = 'user', 'Étudiant'
        MODERATOR = 'moderator', 'Modérateur'
        ADMIN = 'admin', 'Administrateur'

    # Only changeable server-side by an administrator (see moderation.views); never writable from a profile payload.
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.USER)
    suspension_reason = models.CharField(max_length=200, blank=True)

    REQUIRED_FIELDS = ['email']

    def __str__(self):
        return self.username

    @property
    def staff_role(self):
        if self.is_superuser or self.role == self.Role.ADMIN:
            return 'admin'
        if self.role == self.Role.MODERATOR or self.is_staff:
            return 'moderator'
        return 'user'

    def anonymize(self):
        """Account deletion: keep rows that other people's history depends on (sales, messages) but drop personal data."""
        self.username = f'supprime-{self.pk}'
        self.email = f'supprime-{self.pk}@deleted.invalid'
        self.first_name = self.last_name = self.bio = self.school = self.field_of_study = self.promotion = ''
        self.is_active, self.is_staff, self.role = False, False, self.Role.USER
        self.set_unusable_password()
        self.save()
        self.auth_token.delete() if hasattr(self, 'auth_token') else None


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
