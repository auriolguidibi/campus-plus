# Déploiement de Campus+

Un seul processus Django sert l'API (`/api/`), l'admin Django (`/admin/`), l'application React construite (`frontend/dist`,
via WhiteNoise) et, si besoin, les médias (`SERVE_MEDIA=1`).

## Ce qui a été vérifié ici (Windows, SQLite)

- `manage.py check --deploy` : un seul avertissement facultatif (`SECURE_HSTS_PRELOAD`, non activé volontairement).
- Mode production (`DJANGO_DEBUG=0`) servi par **waitress** : `/`, routes profondes (`/marketplace/3`), `/api/health/`, fichiers
  statiques de l'admin, assets JS hachés, médias, en-têtes de sécurité (nosniff, X-Frame-Options DENY, Referrer-Policy,
  COOP), inscription + publication avec photo + thème sombre persistant.
- 43 tests backend (dont un parcours complet de bout en bout avec authentification réelle par jeton).

## Ce qui n'a PAS pu être vérifié ici

- **MySQL** (non installé sur la machine de développement) : la configuration est prête (`DB_ENGINE=mysql` + `mysqlclient`), mais
  aucune migration n'a été exécutée sur MySQL. Lancez `manage.py migrate` et `manage.py test` sur une base MySQL de test d'abord.
- **gunicorn / nginx / HTTPS / SMTP** : non testés (Windows, pas de domaine). Les commandes ci-dessous sont standard mais à valider.
- Pas de Dockerfile : Docker n'est pas installé ici, je n'ai donc pas livré de fichier non testé.

## Étapes (serveur Linux)

```bash
# 1. Code et dépendances
git clone <repo> && cd campus-plus
python -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt mysqlclient
cd frontend && npm ci && npm run build && cd ..

# 2. Configuration : copier backend/.env.example vers backend/.env et remplir (clé secrète, hôtes, base, e-mail, codes d'invitation)

# 3. Base de données et statiques
cd backend
.venv/bin/python manage.py migrate
.venv/bin/python manage.py collectstatic --noinput
.venv/bin/python manage.py createsuperuser        # premier administrateur (rôle admin automatique)
.venv/bin/python manage.py check --deploy

# 4. Lancer
.venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3
```

Placez nginx (ou Caddy) devant pour le HTTPS, et servez `/media/` directement depuis `backend/media/` (`SERVE_MEDIA=0`) :

```nginx
location /media/ { alias /srv/campus/backend/media/; }
location /       { proxy_pass http://127.0.0.1:8000; proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header Host $host; }
client_max_body_size 50m;
```

## Tâches à planifier

- `manage.py purge_stories` toutes les heures (supprime les stories expirées et leurs fichiers).
- Sauvegardes de la base et du dossier `media/`.

## Premier administrateur

`createsuperuser` crée un compte au rôle **administrateur** (un superuser est toujours administrateur). Il peut ensuite promouvoir
des modérateurs depuis `/admin` → Utilisateurs → « Changer le rôle ». Chaque action est écrite dans le journal d'audit.
Vérification des étudiants : `CAMPUS_VERIFICATION_MODE=invite` (code d'invitation), `admin` (validation manuelle) ou `open`.

## Sécurité en production

- `DJANGO_DEBUG=0` exige `DJANGO_SECRET_KEY` ; HTTPS, HSTS et cookies sécurisés sont alors activés automatiquement.
- Aucun secret côté frontend ; le jeton d'API est envoyé dans l'en-tête `Authorization` (pas de cookie), donc pas de CSRF sur l'API.
- Supprimez les comptes de démonstration (`admin`, `aicha`, `koffi`…) s'ils existent dans la base copiée, et changez les codes d'invitation.
- Limites de débit : DRF utilise le cache local ; derrière plusieurs workers, configurez un cache partagé (Redis/Memcached) pour que les
  limites (connexion, signalements) soient globales.
