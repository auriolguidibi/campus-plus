from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


def default_expiry():
    return timezone.now() + timedelta(hours=settings.STORY_DURATION_HOURS)


class Story(models.Model):
    class Visibility(models.TextChoices):
        EVERYONE = 'everyone', 'Tout le campus'
        FRIENDS = 'friends', 'Amis uniquement'

    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='stories')
    image = models.ImageField(upload_to='stories/%Y/%m/')
    caption = models.CharField(max_length=200, blank=True)
    visibility = models.CharField(max_length=10, choices=Visibility.choices, default=Visibility.EVERYONE)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_expiry, db_index=True)

    class Meta:
        ordering = ['created_at']


class StoryView(models.Model):
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='views')
    viewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    seen_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['story', 'viewer'], name='one_view_per_story')]
