# Campus+

Réseau social étudiant. Frontend React + TypeScript + Tailwind (Vite), backend Django REST (SQLite en dev, MySQL via `DB_ENGINE=mysql`).

## Lancer

```bash
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python manage.py migrate && .venv/Scripts/python manage.py runserver 8000
cd frontend && npm install && npm run dev   # http://localhost:5190 (proxy /api -> :8000)
```

Tests backend : `python manage.py test` (47 tests, dont `config/test_journey.py`, un parcours complet de bout en bout). Déploiement : voir `DEPLOYMENT.md` et `backend/.env.example`. Code d'invitation de dev : `CAMPUS2026` (variable `CAMPUS_INVITE_CODES`).

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

Phase 6 : rôles étudiant/modérateur/administrateur (champ `role`, modifiable uniquement par un administrateur via
l'API, journalisé), signalements utilisateurs (publications, commentaires, annonces, avis, utilisateurs) avec file de
traitement, espace `/admin` (statistiques agrégées, signalements, annonces à modérer, vérification des comptes,
suspension/réactivation, contenus, communautés, catégories, journal d'audit en lecture seule). Toute action sensible est
journalisée (acteur, action, cible, IP, motif). Sécurité : toutes les routes privées testées (401 sans jeton), limitation
de débit globale, suspension = jeton supprimé, suppression de compte avec mot de passe + anonymisation, en-têtes et cookies
sécurisés quand `DJANGO_DEBUG=0` (HTTPS, HSTS). Compte admin : `manage.py createsuperuser` ou rôle via l'API/shell.

Centre de notifications (`/notifications`, cloche sur le fil) : générées par de vrais événements (demandes d'amis,
réactions/commentaires/réponses, messages, offres Marketplace, vente/refus/publication d'annonce, notation de défi, badges,
changement de rôle dans un groupe, décisions de modération, rappels d'événements < 24 h). Préférences par catégorie
(la catégorie « compte et modération » reste toujours active), regroupement des notifications non lues répétitives
(messages, réactions), aucune notification pour ses propres actions ni entre utilisateurs bloqués, marquage lu
individuel/global, messages marqués lus à l'ouverture de la conversation. Rafraîchissement par polling (20 s) ; pas de
notification push. Les rappels d'événements sont générés à l'ouverture des notifications (pas de tâche planifiée).
39 tests backend.

Pas encore fait : notifications push, invitations/annonces de groupe (fonctionnalité inexistante), préférences de confidentialité détaillées, stories vidéo, défis collectifs, notifications push des rappels, signalement d'annonces, groupes de discussion, pièces jointes en messagerie, paiement mobile, vidéos, sondages, stories, photo de profil/couverture, annonces de groupe, Marketplace, messagerie temps réel, défis, confessions,
événements, classements, notifications, administration (hors Django admin), push. Les onglets Communautés/Messages affichent « Pas encore disponible ».

## Phase 7 (tests et déploiement)

- Thèmes clair/sombre et formats mobiles audités dans le navigateur sur 17 écrans : aucun débordement horizontal à 375 px, mise en
  page centrée à 768 px, contrastes de texte conformes WCAG AA (4,5:1) après correction des jetons de couleur (`text-link`
  séparé de `bg-primary`, accent et danger assombris en mode clair, badges lisibles en mode sombre).
- Production simulée (waitress, `DJANGO_DEBUG=0`) : application React + API servies par un seul processus, routes profondes,
  médias, en-têtes de sécurité. MySQL, gunicorn/nginx/HTTPS et SMTP n'ont pas pu être testés (voir `DEPLOYMENT.md`).

## Refonte du design, appels et notes vocales

- Formulaires refaits (composants `Field`, `SelectField`, `TextArea`, `Check`, `Submit`) : icônes intégrées, libellés, états d'erreur, affichage du mot de passe, jauge de robustesse ; inscription en 3 étapes avec validation par étape ; « Se souvenir de moi » réel (localStorage ou sessionStorage).
- Icônes : Iconify (jeu Solar) intégrées à la compilation via `unplugin-icons`, sans appel réseau au runtime ; les emojis d'interface ont été remplacés.
- Images : photos fournies par l'équipe (étudiants EIG / événement Offline) : fond de l'écran de bienvenue, en-tête des écrans de connexion, bannières de rubriques et couverture par défaut des événements (`frontend/public/img/`, redimensionnées et compressées).
- Messagerie : notes vocales (enregistrement navigateur, 120 s max, contenu vérifié côté serveur), appels audio et vidéo WebRTC pair-à-pair avec signalisation par l'API (sonnerie, répondre/refuser, micro, caméra, historique d'appels dans la conversation). Un relais TURN (`CALL_TURN_*`) est nécessaire derrière certains réseaux (4G, pare-feu stricts).
