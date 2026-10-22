from django.db import migrations

NAMES = ['Mode et accessoires', 'Informatique et électronique', 'Livres et fournitures', 'Alimentation',
         'Beauté et coiffure', 'Services numériques', 'Cours particuliers', 'Autres']


def seed(apps, schema_editor):
    Category = apps.get_model('market', 'Category')
    for i, n in enumerate(NAMES):
        Category.objects.get_or_create(name=n, defaults={'position': i})


class Migration(migrations.Migration):
    dependencies = [('market', '0001_initial')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
