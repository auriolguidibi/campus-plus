# Campus+

Réseau social étudiant. Frontend React + TypeScript + Tailwind (Vite), backend Django REST (SQLite en dev, MySQL via `DB_ENGINE=mysql`).

## Lancer

```bash
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python manage.py migrate && .venv/Scripts/python manage.py runserver 8000
cd frontend && npm install && npm run dev   # http://localhost:5190 (proxy /api -> :8000)
```

Tests backend : `python manage.py test`. Code d'invitation de dev : `CAMPUS2026` (variable `CAMPUS_INVITE_CODES`).

## État (Phase 1-3 partielles)

Fait et testé : inscription/connexion (jeton, limitation de tentatives, hachage), mot de passe oublié (e-mail console),
profil + biographie, thème clair/sombre/auto persistant (navigateur + compte), fil d'actualité (publier, réagir,
commenter/répondre, favoris, suppression, pagination), navigation mobile.

Phase 3 ajoutée : profils publics, amis (demandes, acceptation, retrait), blocage, communautés (créer, rejoindre/quitter,
rôles créateur/admin/modérateur/membre, règles, publications de groupe), photos dans les publications (4 max, recompressées en JPEG),
fil « Amis & groupes » / « Tout le campus » / « Favoris ». 7 tests backend.

Phase 4 : Marketplace (annonces avec 6 photos max, catégories, recherche, filtres prix/état, tri, favoris, bons plans,
vendeur de la semaine, statuts brouillon/publié/réservé/vendu/archivé, offres avec contre-proposition, ventes et avis
vérifiés) et messagerie privée liée au produit (rafraîchissement par polling toutes les 4 s, pas de WebSocket).
`MARKET_REQUIRE_MODERATION=1` met les nouvelles annonces en attente (validation via l'admin Django). 12 tests backend.

Phase 5 : stories photo (expiration 24 h configurable, spectateurs, visibilité tout le campus/amis, `manage.py purge_stories`),
événements (RSVP, rappel enregistré, partage, archives), défis (quiz corrigés par le serveur, autres défis notés par un
organisateur, une participation par défi, journal de points), classements semaine/général/promotions, badges calculés
sur données réelles, confessions anonymes (pré-modération, filtre infos personnelles/menaces, 3 signalements = masquage,
file de modération sans auteur). Les défis se créent via l'admin Django ou l'API (staff) ; `manage.py seed_campus
--organizer <pseudo>` crée des défis/événements de démonstration. 20 tests backend.

Pas encore fait : stories vidéo, défis collectifs, notifications push des rappels, signalement d'annonces, groupes de discussion, pièces jointes en messagerie, paiement mobile, vidéos, sondages, stories, photo de profil/couverture, annonces de groupe, Marketplace, messagerie temps réel, défis, confessions,
événements, classements, notifications, administration (hors Django admin), push. Les onglets Communautés/Messages affichent « Pas encore disponible ».
