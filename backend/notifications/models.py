from django.conf import settings
from django.db import models

CATEGORIES = [
    ('friends', 'Demandes d\'amis'),
    ('social', 'Réactions et commentaires'),
    ('messages', 'Nouveaux messages'),
    ('groups', 'Communautés'),
    ('challenges', 'Défis, points et badges'),
    ('events', 'Événements'),
    ('market', 'Marketplace (offres, annonces)'),
    ('system', 'Compte et modération'),  # always delivered
]


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    category = models.CharField(max_length=12, choices=CATEGORIES)
    text = models.CharField(max_length=200)
    link = models.CharField(max_length=120, blank=True)  # in-app route
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    dedupe_key = models.CharField(max_length=60, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['user', 'read_at'])]


class NotificationPreference(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notification_prefs')
    category = models.CharField(max_length=12)
    enabled = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'category'], name='one_pref_per_category')]
