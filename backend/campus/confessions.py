import re
from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Exists, OuterRef
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User

from .models import Confession, ConfessionComment, ConfessionReaction, ConfessionReport

DAILY_LIMIT = 3
FLAG_THRESHOLD = 3  # distinct reports that auto-hide a confession until a moderator decides
PHONE = re.compile(r'(?:\+?\d[\s.\-]?){8,}')
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+')
URL = re.compile(r'https?://|www\.', re.I)
THREATS = ['je vais te tuer', 'je vais le tuer', 'je vais la tuer', 'tuer', 'violer', 'va mourir', 'suicide', 'te frapper']

RULES = ("Interdits : menaces, harcèlement, accusations visant une personne identifiable, coordonnées et informations "
         "personnelles, contenus dangereux. Ton identité n'est jamais affichée ; elle n'est conservée que pour traiter les abus.")


def check_text(text):
    """Returns an error message if the text violates the rules, else None."""
    low = text.lower()
    if PHONE.search(text) or EMAIL.search(text) or URL.search(text):
        return "Ne publie pas de numéro, d'e-mail ou de lien : informations personnelles interdites."
    if any(t in low for t in THREATS):
        return 'Ce texte contient des menaces ou des propos dangereux, interdits sur Campus+.'
    return None


def public(c, user):
    """Public representation: NO author field of any kind."""
    return {'id': c.id, 'text': c.text, 'created_at': c.created_at, 'reaction_count': c.reaction_count,
            'comment_count': c.comment_count, 'reacted': c.reacted}


def annotated(qs, user):
    return qs.annotate(reaction_count=Count('reactions', distinct=True), comment_count=Count('comments', distinct=True),
                       reacted=Exists(ConfessionReaction.objects.filter(confession=OuterRef('pk'), user=user)))


def require_verified(user):
    if user.verification != User.Verification.VERIFIED:
        raise PermissionDenied('Compte non vérifié.')


class ConfessionListView(APIView):
    def get(self, request):
        qs = annotated(Confession.objects.filter(status=Confession.Status.PUBLISHED), request.user).order_by('-created_at', '-id')
        pg = PageNumberPagination()
        pg.page_size = 10
        page = pg.paginate_queryset(qs, request)
        return pg.get_paginated_response([public(c, request.user) for c in page])

    def post(self, request):
        require_verified(request.user)
        text = str(request.data.get('text', '')).strip()
        if not 20 <= len(text) <= 1000:
            return Response({'text': 'Entre 20 et 1000 caractères.'}, status=400)
        problem = check_text(text)
        if problem:
            return Response({'text': problem}, status=400)
        since = timezone.now() - timedelta(days=1)
        if Confession.objects.filter(author=request.user, created_at__gte=since).count() >= DAILY_LIMIT:
            return Response({'detail': f'Limite de {DAILY_LIMIT} confessions par jour atteinte.'}, status=429)
        st = Confession.Status.PENDING if settings.CONFESSIONS_PREMODERATION else Confession.Status.PUBLISHED
        c = Confession.objects.create(author=request.user, text=text, status=st)
        return Response({'id': c.id, 'status': c.status}, status=201)


class MyConfessionsView(APIView):
    def get(self, request):
        rows = Confession.objects.filter(author=request.user).order_by('-created_at')[:30]
        return Response([{'id': c.id, 'text': c.text, 'status': c.status, 'reject_reason': c.reject_reason,
                          'created_at': c.created_at} for c in rows])


class ConfessionReactView(APIView):
    def post(self, request, pk):
        c = get_object_or_404(Confession, pk=pk, status=Confession.Status.PUBLISHED)
        obj, created = ConfessionReaction.objects.get_or_create(confession=c, user=request.user)
        if not created:
            obj.delete()
        return Response({'active': created})


class ConfessionCommentsView(APIView):
    def _labels(self, c):
        labels, n = {}, 0
        for cm in c.comments.all():
            if cm.author_id == c.author_id:
                labels[cm.author_id] = 'Auteur'
            elif cm.author_id not in labels:
                n += 1
                labels[cm.author_id] = f'Anonyme {n}'
        return labels

    def get(self, request, pk):
        c = get_object_or_404(Confession, pk=pk, status=Confession.Status.PUBLISHED)
        labels = self._labels(c)
        return Response([{'id': cm.id, 'label': labels[cm.author_id], 'text': cm.text, 'created_at': cm.created_at}
                         for cm in c.comments.all()])

    def post(self, request, pk):
        require_verified(request.user)
        c = get_object_or_404(Confession, pk=pk, status=Confession.Status.PUBLISHED)
        text = str(request.data.get('text', '')).strip()
        if not text or len(text) > 500:
            return Response({'text': 'Commentaire vide ou trop long.'}, status=400)
        problem = check_text(text)
        if problem:
            return Response({'text': problem}, status=400)
        ConfessionComment.objects.create(confession=c, author=request.user, text=text)
        return self.get(request, pk)


class ConfessionReportView(APIView):
    def post(self, request, pk):
        c = get_object_or_404(Confession, pk=pk, status=Confession.Status.PUBLISHED)
        ConfessionReport.objects.get_or_create(confession=c, reporter=request.user,
                                               defaults={'reason': str(request.data.get('reason', ''))[:200]})
        if c.reports.count() >= FLAG_THRESHOLD:
            c.status = Confession.Status.FLAGGED
            c.save(update_fields=['status'])
        return Response({'detail': 'Merci, le signalement a été transmis aux modérateurs.'})


class ModerationQueueView(APIView):
    def get(self, request):
        if not request.user.is_staff:
            raise PermissionDenied()
        rows = (Confession.objects.filter(status__in=[Confession.Status.PENDING, Confession.Status.FLAGGED])
                .annotate(n_reports=Count('reports')).order_by('created_at'))
        return Response([{'id': c.id, 'text': c.text, 'status': c.status, 'reports': c.n_reports,
                          'created_at': c.created_at} for c in rows])  # deliberately no author

    def post(self, request, pk):
        if not request.user.is_staff:
            raise PermissionDenied()
        c = get_object_or_404(Confession, pk=pk, status__in=[Confession.Status.PENDING, Confession.Status.FLAGGED])
        decision = request.data.get('decision')
        mapping = {'approve': Confession.Status.PUBLISHED, 'reject': Confession.Status.REJECTED,
                   'remove': Confession.Status.REMOVED}
        if decision not in mapping:
            return Response({'decision': 'approve, reject ou remove.'}, status=400)
        c.status, c.moderated_by, c.moderated_at = mapping[decision], request.user, timezone.now()
        c.reject_reason = str(request.data.get('reason', ''))[:200] if decision != 'approve' else ''
        c.save()
        if decision == 'approve':
            c.reports.all().delete()  # reset after a moderator re-validated it
        return Response({'status': c.status})
