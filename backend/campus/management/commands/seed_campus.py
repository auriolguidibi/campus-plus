from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import User
from campus.models import Challenge, Event


class Command(BaseCommand):
    help = 'Create DEMO challenges and events (organizer = given staff user). Not for production data.'

    def add_arguments(self, parser):
        parser.add_argument('--organizer', required=True, help='username of an existing user (made staff if needed)')

    def handle(self, *args, **o):
        try:
            u = User.objects.get(username=o['organizer'])
        except User.DoesNotExist:
            raise CommandError('Unknown user')
        u.is_staff = True
        u.save(update_fields=['is_staff'])
        now = timezone.now()
        Challenge.objects.get_or_create(title='Quiz culture campus', defaults=dict(
            description='5 questions pour tester ta culture générale.', kind='quiz', max_points=50,
            rules='Une seule tentative. Correction automatique.', starts_at=now - timedelta(days=1), deadline=now + timedelta(days=6),
            created_by=u, questions=[
                {'q': 'Capitale du Bénin (siège du gouvernement) ?', 'options': ['Porto-Novo', 'Cotonou', 'Parakou'], 'answer': 1},
                {'q': 'Langage du web côté navigateur ?', 'options': ['Python', 'JavaScript', 'COBOL'], 'answer': 1},
                {'q': '2 puissance 10 ?', 'options': ['512', '1024', '2048'], 'answer': 1}]))
        Challenge.objects.get_or_create(title='30 minutes challenge : interface web', defaults=dict(
            description='Crée la meilleure interface web en 30 minutes et décris ton résultat.', kind='code', max_points=100,
            rules='Texte + capture d\'écran. Notation par un organisateur.', starts_at=now - timedelta(days=1),
            deadline=now + timedelta(days=3), created_by=u))
        Challenge.objects.get_or_create(title='Photo du campus', defaults=dict(
            description='Partage ta plus belle photo du campus.', kind='media', max_points=30, rules='Photo originale uniquement.',
            starts_at=now - timedelta(days=1), deadline=now + timedelta(days=10), created_by=u))
        Event.objects.get_or_create(title='Hackathon Campus+', defaults=dict(
            description='24 h pour construire un projet utile aux étudiants.', category='hackathon',
            starts_at=now + timedelta(days=12), location='Amphi A', rules='Équipes de 3 à 5.', organizer=u))
        Event.objects.get_or_create(title='Soirée de rentrée', defaults=dict(
            description="Musique et rencontres pour les nouveaux.", category='soiree', starts_at=now + timedelta(days=5),
            location='Cour centrale', organizer=u))
        self.stdout.write('Demo challenges and events created.')
