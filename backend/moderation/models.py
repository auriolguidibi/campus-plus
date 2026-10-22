from django.conf import settings
from django.db import models

User = settings.AUTH_USER_MODEL


class Report(models.Model):
    """User report on a post, comment, listing, review or user. (Confessions have their own anonymous flow.)"""

    class Target(models.TextChoices):
        POST = 'post', 'Publication'
        COMMENT = 'comment', 'Commentaire'
        LISTING = 'listing', 'Annonce'
        REVIEW = 'review', 'Avis'
        USER = 'user', 'Utilisateur'

    class Reason(models.TextChoices):
        SPAM = 'spam', 'Spam ou arnaque'
        HARASSMENT = 'harassment', 'Harcèlement ou menaces'
        INAPPROPRIATE = 'inappropriate', 'Contenu inapproprié'
        ILLEGAL = 'illegal', 'Produit ou contenu interdit'
        PERSONAL = 'personal', 'Informations personnelles'
        OTHER = 'other', 'Autre'

    class Status(models.TextChoices):
        OPEN = 'open', 'À traiter'
        ACTIONED = 'actioned', 'Mesure prise'
        DISMISSED = 'dismissed', 'Classé sans suite'

    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_made')
    target_type = models.CharField(max_length=10, choices=Target.choices)
    target_id = models.PositiveBigIntegerField()
    reason = models.CharField(max_length=15, choices=Reason.choices)
    details = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN, db_index=True)
    handled_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    handled_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['reporter', 'target_type', 'target_id'], name='one_report_per_target')]
        indexes = [models.Index(fields=['target_type', 'target_id'])]
        ordering = ['created_at']


class AdminAuditLog(models.Model):
    """Append-only record of every sensitive staff action."""
    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='+')
    actor_name = models.CharField(max_length=150)  # survives account deletion
    action = models.CharField(max_length=60, db_index=True)
    target_type = models.CharField(max_length=30)
    target_id = models.PositiveBigIntegerField(null=True)
    detail = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at', '-id']
