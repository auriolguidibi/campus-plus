import json
from datetime import timedelta

from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.serializers import PublicUserSerializer
from social.views import process_image

from .badges import check_badges, total_points
from .models import Badge, Challenge, Participation, PointEntry, UserBadge

CRITERIA = ("Les points viennent uniquement des défis : quiz corrigés automatiquement par le serveur, autres défis notés par "
            "un organisateur (de 0 au maximum du défi). Les likes ne comptent pas. Une seule participation par défi, "
            "aucune modification après la date limite ni après la notation.")


def my_participation(ch, user):
    p = Participation.objects.filter(challenge=ch, user=user).first()
    if not p:
        return None
    return {'id': p.id, 'points': p.points, 'submitted_at': p.submitted_at, 'answer': p.answer,
            'image': p.image.url if p.image else None, 'reviewed': p.points is not None}


def challenge_dict(ch, user, detail=False):
    now = timezone.now()
    d = {'id': ch.id, 'title': ch.title, 'kind': ch.kind, 'kind_label': ch.get_kind_display(), 'max_points': ch.max_points,
         'starts_at': ch.starts_at, 'deadline': ch.deadline, 'is_open': ch.starts_at <= now < ch.deadline,
         'auto_graded': ch.auto_graded, 'participants': ch.participations.count(), 'mine': my_participation(ch, user),
         'can_manage': user.is_staff or ch.created_by_id == user.id}
    if detail:
        d.update(description=ch.description, rules=ch.rules,
                 questions=[{'q': q['q'], 'options': q['options']} for q in ch.questions])  # never expose answers
    return d


class ChallengeWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Challenge
        fields = ['title', 'description', 'kind', 'rules', 'max_points', 'starts_at', 'deadline', 'questions']

    def validate(self, a):
        if a['deadline'] <= a['starts_at']:
            raise serializers.ValidationError('La date limite doit suivre le début.')
        if not 1 <= a.get('max_points', 50) <= 1000:
            raise serializers.ValidationError('Points maximum : 1 à 1000.')
        for q in a.get('questions', []):
            if not (isinstance(q, dict) and q.get('q') and isinstance(q.get('options'), list) and len(q['options']) >= 2
                    and isinstance(q.get('answer'), int) and 0 <= q['answer'] < len(q['options'])):
                raise serializers.ValidationError('Question de quiz invalide.')
        return a


class ChallengeListView(APIView):
    def get(self, request):
        now = timezone.now()
        qs = Challenge.objects.all()
        w = request.query_params.get('status', 'open')
        if w == 'closed':
            qs = qs.filter(deadline__lte=now).order_by('-deadline')
        elif w == 'mine':
            qs = qs.filter(participations__user=request.user).order_by('-deadline')
        else:
            qs = qs.filter(deadline__gt=now).order_by('deadline')
        return Response([challenge_dict(c, request.user) for c in qs[:50]])

    def post(self, request):
        if not request.user.is_staff:
            raise PermissionDenied('Seuls les organisateurs peuvent créer un défi.')
        ser = ChallengeWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ch = ser.save(created_by=request.user)
        return Response(challenge_dict(ch, request.user, True), status=201)


class ChallengeDetailView(APIView):
    def get(self, request, pk):
        return Response(challenge_dict(get_object_or_404(Challenge, pk=pk), request.user, True))


class ParticipateView(APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def _check(self, request, ch):
        now = timezone.now()
        if request.user.verification != User.Verification.VERIFIED:
            raise PermissionDenied('Compte non vérifié.')
        if ch.created_by_id == request.user.id:
            raise PermissionDenied('Tu ne peux pas participer à ton propre défi.')
        if not ch.starts_at <= now < ch.deadline:
            raise PermissionDenied("Ce défi n'est pas ouvert (pas commencé ou date limite dépassée).")

    def post(self, request, pk):
        ch = get_object_or_404(Challenge, pk=pk)
        self._check(request, ch)
        answer = str(request.data.get('answer', '')).strip()[:3000]
        f = request.FILES.get('image')
        points = None
        if ch.auto_graded:
            raw = request.data.get('choices')
            choices = json.loads(raw) if isinstance(raw, str) else raw
            if not isinstance(choices, list) or len(choices) != len(ch.questions) or not all(isinstance(c, int) for c in choices):
                return Response({'choices': 'Réponds à toutes les questions.'}, status=400)
            ok = sum(1 for c, q in zip(choices, ch.questions) if c == q['answer'])
            points = round(ch.max_points * ok / len(ch.questions))
            answer = json.dumps(choices)
        elif not answer and not f:
            return Response({'answer': 'Ajoute une réponse ou une photo.'}, status=400)
        img = process_image(f) if f else None
        with transaction.atomic():
            if Participation.objects.select_for_update().filter(challenge=ch, user=request.user).exists():
                return Response({'detail': 'Tu as déjà participé à ce défi.'}, status=400)
            p = Participation.objects.create(challenge=ch, user=request.user, answer=answer, points=points,
                                             **({'image': img} if img else {}))
            if points is not None:
                PointEntry.objects.create(user=request.user, points=points, reason=f'Quiz : {ch.title}', participation=p)
        check_badges(request.user)
        return Response(challenge_dict(ch, request.user, True), status=201)

    def patch(self, request, pk):
        ch = get_object_or_404(Challenge, pk=pk)
        self._check(request, ch)
        p = get_object_or_404(Participation, challenge=ch, user=request.user)
        if ch.auto_graded or p.points is not None:
            return Response({'detail': 'Cette participation ne peut plus être modifiée.'}, status=400)
        if 'answer' in request.data:
            p.answer = str(request.data['answer']).strip()[:3000]
        f = request.FILES.get('image')
        if f:
            p.image = process_image(f)
        p.save()
        return Response(challenge_dict(ch, request.user, True))


class SubmissionsView(APIView):
    def get(self, request, pk):
        ch = get_object_or_404(Challenge, pk=pk)
        if not (request.user.is_staff or ch.created_by_id == request.user.id):
            raise PermissionDenied()
        rows = ch.participations.select_related('user').order_by('submitted_at')
        return Response([{'id': p.id, 'user': PublicUserSerializer(p.user).data, 'answer': ('' if ch.auto_graded else p.answer),
                          'image': p.image.url if p.image else None, 'points': p.points} for p in rows])


class ReviewView(APIView):
    def post(self, request, pk):
        p = get_object_or_404(Participation.objects.select_related('challenge'), pk=pk)
        ch = p.challenge
        if not (request.user.is_staff or ch.created_by_id == request.user.id) or p.user_id == request.user.id:
            raise PermissionDenied()
        if ch.auto_graded:
            return Response({'detail': 'Ce quiz est corrigé automatiquement.'}, status=400)
        try:
            pts = int(request.data.get('points'))
        except (TypeError, ValueError):
            return Response({'points': 'Nombre invalide.'}, status=400)
        if not 0 <= pts <= ch.max_points:
            return Response({'points': f'Entre 0 et {ch.max_points}.'}, status=400)
        with transaction.atomic():
            p.points, p.reviewed_by = pts, request.user
            p.save(update_fields=['points', 'reviewed_by'])
            PointEntry.objects.update_or_create(participation=p, defaults={'user': p.user, 'points': pts, 'reason': f'Défi : {ch.title}'})
        check_badges(p.user)
        return Response({'points': pts})


class LeaderboardView(APIView):
    def get(self, request):
        period = request.query_params.get('period', 'week')
        entries = PointEntry.objects.all()
        if period == 'week':
            entries = entries.filter(created_at__gte=timezone.now() - timedelta(days=7))
        if period == 'promotion':
            rows = (entries.values('user__promotion').annotate(total=Sum('points')).order_by('-total')[:20])
            return Response({'criteria': CRITERIA, 'period': period,
                             'entries': [{'rank': i + 1, 'label': r['user__promotion'] or 'Sans promotion', 'points': r['total']}
                                         for i, r in enumerate(rows)], 'me': None})
        rows = list(entries.values('user').annotate(total=Sum('points')).order_by('-total', 'user')[:50])
        users = User.objects.in_bulk([r['user'] for r in rows])
        out = [{'rank': i + 1, 'user': PublicUserSerializer(users[r['user']]).data, 'points': r['total']} for i, r in enumerate(rows)]
        me = next(({'rank': e['rank'], 'points': e['points']} for e in out if e['user']['id'] == request.user.id), None)
        return Response({'criteria': CRITERIA, 'period': period, 'entries': out, 'me': me})


class BadgesView(APIView):
    def get(self, request):
        check_badges(request.user)
        earned = {ub.badge_id: ub.awarded_at for ub in UserBadge.objects.filter(user=request.user)}
        return Response({'points': total_points(request.user),
                         'badges': [{'code': b.code, 'name': b.name, 'description': b.description, 'icon': b.icon,
                                     'earned_at': earned.get(b.id)} for b in Badge.objects.order_by('id')]})


class PointHistoryView(APIView):
    def get(self, request):
        rows = PointEntry.objects.filter(user=request.user).order_by('-created_at')[:50]
        return Response([{'id': r.id, 'points': r.points, 'reason': r.reason, 'created_at': r.created_at} for r in rows])
