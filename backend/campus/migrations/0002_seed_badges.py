from django.db import migrations

BADGES = [
    ('verified', 'Étudiant vérifié', "Ton compte est vérifié par ton école.", '🛡️'),
    ('first-post', 'Première publication', 'Tu as publié sur le fil.', '✍️'),
    ('storyteller', 'Conteur', 'Tu as publié une story.', '📸'),
    ('social', 'Sociable', 'Tu as 5 amis ou plus.', '🤝'),
    ('first-challenge', 'Challenger', 'Tu as participé à un défi.', '🎯'),
    ('century', 'Centurion', 'Tu as cumulé 100 points de défis.', '💯'),
    ('seller', 'Vendeur confirmé', 'Tu as réalisé une vente sur la Marketplace.', '🛍️'),
]


def seed(apps, schema_editor):
    Badge = apps.get_model('campus', 'Badge')
    for code, name, desc, icon in BADGES:
        Badge.objects.get_or_create(code=code, defaults={'name': name, 'description': desc, 'icon': icon})


class Migration(migrations.Migration):
    dependencies = [('campus', '0001_initial')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
