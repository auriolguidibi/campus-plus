from django.conf import settings
from django.db import models

User = settings.AUTH_USER_MODEL


# ---------- Events ----------
class Event(models.Model):
    class Category(models.TextChoices):
        PARTY = 'soiree', 'Soirée étudiante'
        HACKATHON = 'hackathon', 'Hackathon'
        CONFERENCE = 'conference', 'Conférence'
        DEFENSE = 'soutenance', 'Soutenance'
        TOURNAMENT = 'tournoi', 'Tournoi'
        CLUB = 'club', 'Rencontre de club'
        ASSOCIATION = 'association', 'Activité associative'

    title = models.CharField(max_length=120)
    description = models.TextField(max_length=3000)
    category = models.CharField(max_length=12, choices=Category.choices, default=Category.CLUB)
    starts_at = models.DateTimeField(db_index=True)
    location = models.CharField(max_length=160)
    image = models.ImageField(upload_to='events/%Y/%m/', blank=True)
    rules = models.CharField(max_length=500, blank=True)
    organizer = models.ForeignKey(User, on_delete=models.PROTECT, related_name='events_organized')
    created_at = models.DateTimeField(auto_now_add=True)


class EventRsvp(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='rsvps')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='event_rsvps')
    reminder = models.BooleanField(default=False)
    reminded = models.BooleanField(default=False)  # reminder notification already sent

    class Meta:
        constraints = [models.UniqueConstraint(fields=['event', 'user'], name='one_rsvp')]


# ---------- Challenges, points, badges ----------
class Challenge(models.Model):
    class Kind(models.TextChoices):
        CODE = 'code', 'Programmation'
        DESIGN = 'design', 'Design'
        CULTURE = 'culture', 'Culture générale'
        QUIZ = 'quiz', 'Quiz académique'
        CREATIVE = 'creative', 'Créativité'
        SPORT = 'sport', 'Sport et campus'
        MEDIA = 'media', 'Photo ou vidéo'

    title = models.CharField(max_length=120)
    description = models.TextField(max_length=3000)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    rules = models.TextField(max_length=2000, blank=True)
    max_points = models.PositiveIntegerField(default=50)
    starts_at = models.DateTimeField()
    deadline = models.DateTimeField()
    # Quiz only: [{"q": "...", "options": ["a","b"], "answer": 0}] — answers never leave the server.
    questions = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def auto_graded(self):
        return self.kind == self.Kind.QUIZ and bool(self.questions)


class Participation(models.Model):
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='participations')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='participations')
    answer = models.TextField(max_length=3000, blank=True)  # text answer, or JSON list of quiz choices
    image = models.ImageField(upload_to='challenges/%Y/%m/', blank=True)
    points = models.PositiveIntegerField(null=True, blank=True)  # null = awaiting review
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['challenge', 'user'], name='one_participation')]


class PointEntry(models.Model):
    """Append-only ledger: the leaderboard is computed from these rows, never from a mutable counter."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='point_entries')
    points = models.PositiveIntegerField()
    reason = models.CharField(max_length=160)
    participation = models.OneToOneField(Participation, null=True, blank=True, on_delete=models.SET_NULL, related_name='entry')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class Badge(models.Model):
    code = models.SlugField(unique=True)
    name = models.CharField(max_length=60)
    description = models.CharField(max_length=160)
    icon = models.CharField(max_length=8, default='🏅')


class UserBadge(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='badges')
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE)
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'badge'], name='one_badge_per_user')]


# ---------- Anonymous confessions ----------
class Confession(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        PUBLISHED = 'published', 'Publiée'
        REJECTED = 'rejected', 'Refusée'
        FLAGGED = 'flagged', 'Masquée (signalements)'
        REMOVED = 'removed', 'Supprimée'

    # `author` is kept only for abuse handling. It is NEVER serialized by the public API.
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='+')
    text = models.TextField(max_length=1000)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    reject_reason = models.CharField(max_length=200, blank=True)
    moderated_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    moderated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class ConfessionReaction(models.Model):
    confession = models.ForeignKey(Confession, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='+')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['confession', 'user'], name='one_confession_reaction')]


class ConfessionComment(models.Model):
    confession = models.ForeignKey(Confession, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='+')
    text = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']


class ConfessionReport(models.Model):
    confession = models.ForeignKey(Confession, on_delete=models.CASCADE, related_name='reports')
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='+')
    reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['confession', 'reporter'], name='one_report_per_user')]
