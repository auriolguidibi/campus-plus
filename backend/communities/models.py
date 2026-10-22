from django.conf import settings
from django.db import models


class Community(models.Model):
    class Category(models.TextChoices):
        FIELD = 'filiere', 'Filière'
        PROMOTION = 'promotion', 'Promotion'
        CLASS = 'classe', 'Classe'
        CLUB = 'club', 'Club'
        PROJECT = 'projet', 'Projet'
        INTEREST = 'interet', "Centre d'intérêt"

    name = models.CharField(max_length=80, unique=True)
    description = models.CharField(max_length=500, blank=True)
    rules = models.TextField(max_length=2000, blank=True)
    category = models.CharField(max_length=10, choices=Category.choices, default=Category.INTEREST)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'communities'


class Membership(models.Model):
    class Role(models.TextChoices):
        CREATOR = 'creator', 'Créateur'
        ADMIN = 'admin', 'Administrateur'
        MODERATOR = 'moderator', 'Modérateur'
        MEMBER = 'member', 'Membre'

    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['community', 'user'], name='one_membership')]
