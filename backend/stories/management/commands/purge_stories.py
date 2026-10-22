from django.core.management.base import BaseCommand
from django.utils import timezone

from stories.models import Story


class Command(BaseCommand):
    help = 'Delete expired stories (and their image files).'

    def handle(self, *args, **opts):
        n = 0
        for s in Story.objects.filter(expires_at__lte=timezone.now()):
            s.image.delete(save=False)
            s.delete()
            n += 1
        self.stdout.write(f'{n} story(ies) purged')
