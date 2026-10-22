from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from accounts.models import User
from campus.models import Confession
from communities.models import Community
from market.models import Category, Listing, Review
from social.models import Comment, Post

from .models import AdminAuditLog, Report
from notifications.services import notify

from .services import IsAdminRole, IsModerator, log

TARGETS = {'post': Post, 'comment': Comment, 'listing': Listing, 'review': Review, 'user': User}
DAILY_REPORTS = 20


class ReportThrottle(UserRateThrottle):
    scope = 'report'


def target_info(rtype, obj):
    """Short description of a reported object for moderators."""
    if obj is None:
        return {'exists': False, 'summary': '(contenu supprimé)'}
    if rtype == 'post':
        return {'exists': not obj.is_deleted, 'summary': obj.text[:200], 'author': obj.author.username}
    if rtype == 'comment':
        return {'exists': True, 'summary': obj.text[:200], 'author': obj.author.username}
    if rtype == 'listing':
        return {'exists': obj.status != Listing.Status.REJECTED, 'summary': f'{obj.title} — {obj.price} FCFA ({obj.status})',
                'author': obj.seller.username}
    if rtype == 'review':
        return {'exists': True, 'summary': f'{obj.rating}/5 {obj.comment}'[:200], 'author': obj.reviewer.username}
    return {'exists': obj.is_active, 'summary': f'@{obj.username}', 'author': obj.username}


def author_of(rtype, obj):
    return {'post': lambda o: o.author, 'comment': lambda o: o.author, 'listing': lambda o: o.seller,
            'review': lambda o: o.reviewer, 'user': lambda o: o}[rtype](obj)


def remove_target(rtype, obj):
    if rtype == 'post':
        obj.is_deleted = True
        obj.save(update_fields=['is_deleted'])
    elif rtype == 'listing':
        obj.status = Listing.Status.REJECTED
        obj.save(update_fields=['status'])
    elif rtype in ('comment', 'review'):
        obj.delete()
    else:
        raise serializers.ValidationError('Ce type ne peut pas être retiré ; utilise la suspension.')


class CreateReportView(APIView):
    throttle_classes = [ReportThrottle]

    def post(self, request):
        rtype, tid = request.data.get('target_type'), request.data.get('target_id')
        reason = request.data.get('reason')
        if rtype not in TARGETS or reason not in Report.Reason.values:
            return Response({'detail': 'Signalement invalide.'}, status=400)
        obj = TARGETS[rtype].objects.filter(pk=tid).first()
        if obj is None or author_of(rtype, obj).id == request.user.id:
            return Response({'detail': 'Signalement impossible.'}, status=400)
        if Report.objects.filter(reporter=request.user, created_at__gte=timezone.now() - timedelta(days=1)).count() >= DAILY_REPORTS:
            return Response({'detail': 'Trop de signalements aujourd\'hui.'}, status=429)
        _, created = Report.objects.get_or_create(reporter=request.user, target_type=rtype, target_id=obj.pk,
                                                  defaults={'reason': reason, 'details': str(request.data.get('details', ''))[:500]})
        return Response({'detail': 'Merci, ton signalement a été transmis aux modérateurs.' if created else 'Tu as déjà signalé ce contenu.'},
                        status=201 if created else 200)


# ---------------- staff area ----------------
class StatsView(APIView):
    permission_classes = [IsModerator]

    def get(self, request):
        L = Listing.Status
        return Response({
            'users': {'total': User.objects.filter(is_active=True).count(), 'pending': User.objects.filter(verification='pending', is_active=True).count(),
                      'suspended': User.objects.filter(is_active=False).exclude(email__endswith='@deleted.invalid').count()},
            'content': {'posts': Post.objects.filter(is_deleted=False).count(), 'communities': Community.objects.count(),
                        'listings_published': Listing.objects.filter(status=L.PUBLISHED).count(), 'listings_pending': Listing.objects.filter(status=L.PENDING).count()},
            'moderation': {'reports_open': Report.objects.filter(status='open').count(),
                           'confessions_waiting': Confession.objects.filter(status__in=['pending', 'flagged']).count()},
        })  # aggregates only, no personal data


class AdminUsersView(APIView):
    permission_classes = [IsModerator]

    def get(self, request):
        p = request.query_params
        qs = User.objects.exclude(email__endswith='@deleted.invalid')
        if p.get('verification') in User.Verification.values:
            qs = qs.filter(verification=p['verification'])
        if p.get('active') in ('0', '1'):
            qs = qs.filter(is_active=p['active'] == '1')
        q = p.get('q', '').strip()
        if q:
            qs = qs.filter(Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q))
        full = request.user.staff_role == 'admin'  # e-mails only for administrators (data minimization)
        rows = qs.order_by('-date_joined')[:50]
        return Response([{'id': u.id, 'username': u.username, 'name': f'{u.first_name} {u.last_name}'.strip(), 'school': u.school,
                          'field_of_study': u.field_of_study, 'promotion': u.promotion, 'verification': u.verification, 'is_active': u.is_active,
                          'role': u.staff_role, 'suspension_reason': u.suspension_reason, **({'email': u.email} if full else {})} for u in rows])


class VerifyUserView(APIView):
    permission_classes = [IsModerator]

    def post(self, request, pk):
        u = get_object_or_404(User, pk=pk)
        decision = request.data.get('decision')
        if decision not in ('verified', 'rejected'):
            return Response({'decision': 'verified ou rejected.'}, status=400)
        old, u.verification = u.verification, decision
        u.save(update_fields=['verification'])
        log(request, 'user.verification', 'user', u.id, old=old, new=decision)
        notify(u, 'system', 'Ton compte a été vérifié' if decision == 'verified' else "La vérification de ton compte a été refusée.", '/profil')
        return Response({'verification': decision})


class SuspendUserView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        u = get_object_or_404(User, pk=pk)
        act = request.data.get('action')
        reason = str(request.data.get('reason', '')).strip()[:200]
        if u.id == request.user.id or u.staff_role == 'admin':
            return Response({'detail': 'Un administrateur ne peut pas être suspendu ici.'}, status=400)
        if act == 'suspend':
            if not reason:
                return Response({'reason': 'Un motif est obligatoire.'}, status=400)
            u.is_active, u.suspension_reason = False, reason
            Token.objects.filter(user=u).delete()
        elif act == 'reactivate':
            u.is_active, u.suspension_reason = True, ''
        else:
            return Response({'action': 'suspend ou reactivate.'}, status=400)
        u.save(update_fields=['is_active', 'suspension_reason'])
        log(request, f'user.{act}', 'user', u.id, reason=reason)
        return Response({'is_active': u.is_active})


class SetRoleView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        u = get_object_or_404(User, pk=pk, is_active=True)
        role = request.data.get('role')
        if role not in User.Role.values:
            return Response({'role': 'Rôle invalide.'}, status=400)
        if u.id == request.user.id:
            return Response({'detail': 'Tu ne peux pas modifier ton propre rôle.'}, status=400)
        old = u.staff_role
        u.role, u.is_staff = role, role in ('moderator', 'admin')
        u.save(update_fields=['role', 'is_staff'])
        log(request, 'user.role', 'user', u.id, old=old, new=role)
        return Response({'role': u.staff_role})


class ReportListView(APIView):
    permission_classes = [IsModerator]

    def get(self, request):
        st = request.query_params.get('status', 'open')
        rows = Report.objects.filter(status=st).select_related('reporter', 'handled_by')[:100]
        out = []
        for r in rows:
            obj = TARGETS[r.target_type].objects.filter(pk=r.target_id).first()
            out.append({'id': r.id, 'target_type': r.target_type, 'target_id': r.target_id, 'reason': r.reason,
                        'reason_label': r.get_reason_display(), 'details': r.details, 'status': r.status, 'created_at': r.created_at,
                        'reporter': r.reporter.username, 'others': Report.objects.filter(target_type=r.target_type, target_id=r.target_id).count() - 1,
                        'target': target_info(r.target_type, obj), 'resolution_note': r.resolution_note})
        return Response(out)


class ReportResolveView(APIView):
    permission_classes = [IsModerator]

    @transaction.atomic
    def post(self, request, pk):
        r = get_object_or_404(Report.objects.select_for_update(), pk=pk, status='open')
        act = request.data.get('action')
        note = str(request.data.get('note', '')).strip()[:300]
        obj = TARGETS[r.target_type].objects.filter(pk=r.target_id).first()
        if act == 'dismiss':
            new = Report.Status.DISMISSED
        elif act in ('remove', 'suspend_author'):
            if obj is None:
                return Response({'detail': 'Contenu déjà supprimé.'}, status=400)
            if not note:
                return Response({'note': 'Un motif est obligatoire.'}, status=400)
            if act == 'remove':
                try:
                    remove_target(r.target_type, obj)
                except serializers.ValidationError as e:
                    return Response({'detail': e.detail[0]}, status=400)
            else:
                if request.user.staff_role != 'admin':
                    return Response({'detail': 'Réservé aux administrateurs.'}, status=403)
                a = author_of(r.target_type, obj)
                if a.staff_role == 'admin':
                    return Response({'detail': 'Impossible.'}, status=400)
                a.is_active, a.suspension_reason = False, note
                a.save(update_fields=['is_active', 'suspension_reason'])
                Token.objects.filter(user=a).delete()
            new = Report.Status.ACTIONED
        else:
            return Response({'action': 'dismiss, remove ou suspend_author.'}, status=400)
        # one decision closes every open report about the same target
        Report.objects.filter(target_type=r.target_type, target_id=r.target_id, status='open').update(
            status=new, handled_by=request.user, handled_at=timezone.now(), resolution_note=note)
        log(request, f'report.{act}', r.target_type, r.target_id, report=r.id, note=note)
        if act == 'remove' and obj is not None:
            notify(author_of(r.target_type, obj), 'system', f'Un de tes contenus a été retiré par la modération : {note}', '/')
        return Response({'status': new})


class AdminListingsView(APIView):
    permission_classes = [IsModerator]

    def get(self, request):
        st = request.query_params.get('status', 'pending')
        rows = Listing.objects.filter(status=st).select_related('seller', 'category').order_by('created_at')[:50]
        return Response([{'id': l.id, 'title': l.title, 'description': l.description[:300], 'price': l.price, 'category': l.category.name,
                          'seller': l.seller.username, 'status': l.status, 'created_at': l.created_at} for l in rows])

    def post(self, request, pk):
        l = get_object_or_404(Listing, pk=pk)
        decision, note = request.data.get('decision'), str(request.data.get('note', ''))[:300]
        if decision not in ('approve', 'reject') or (decision == 'reject' and not note.strip()):
            return Response({'detail': 'Décision invalide (motif requis pour un refus).'}, status=400)
        if l.status not in (Listing.Status.PENDING, Listing.Status.PUBLISHED, Listing.Status.RESERVED):
            return Response({'detail': 'Statut non modifiable.'}, status=400)
        old = l.status
        l.status = Listing.Status.PUBLISHED if decision == 'approve' else Listing.Status.REJECTED
        l.save(update_fields=['status'])
        log(request, f'listing.{decision}', 'listing', l.id, old=old, note=note)
        notify(l.seller, 'market', f'Ton annonce « {l.title} » est publiée.' if decision == 'approve' else f'Ton annonce « {l.title} » a été refusée : {note}',
               f'/marketplace/{l.id}')
        return Response({'status': l.status})


class AdminPostsView(APIView):
    permission_classes = [IsModerator]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        qs = Post.objects.filter(is_deleted=False).select_related('author').order_by('-created_at')
        if q:
            qs = qs.filter(Q(text__icontains=q) | Q(author__username__icontains=q))
        return Response([{'id': p.id, 'text': p.text[:200], 'author': p.author.username, 'community': p.community_id, 'created_at': p.created_at} for p in qs[:30]])

    def post(self, request, pk):
        p = get_object_or_404(Post, pk=pk, is_deleted=False)
        note = str(request.data.get('note', '')).strip()[:300]
        if not note:
            return Response({'note': 'Un motif est obligatoire.'}, status=400)
        p.is_deleted = True
        p.save(update_fields=['is_deleted'])
        log(request, 'post.remove', 'post', p.id, note=note)
        return Response(status=204)


class AdminCommunitiesView(APIView):
    permission_classes = [IsModerator]

    def get(self, request):
        rows = Community.objects.annotate(n=Count('memberships')).order_by('-created_at')[:100]
        return Response([{'id': c.id, 'name': c.name, 'category': c.category, 'members': c.n} for c in rows])

    def delete(self, request, pk):
        if request.user.staff_role != 'admin':
            return Response({'detail': 'Réservé aux administrateurs.'}, status=403)
        c = get_object_or_404(Community, pk=pk)
        log(request, 'community.delete', 'community', c.id, name=c.name)
        c.delete()
        return Response(status=204)


class AdminCategoriesView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response([{'id': c.id, 'name': c.name, 'is_active': c.is_active} for c in Category.objects.all()])

    def post(self, request):
        name = str(request.data.get('name', '')).strip()[:60]
        if not name or Category.objects.filter(name__iexact=name).exists():
            return Response({'name': 'Nom vide ou déjà utilisé.'}, status=400)
        c = Category.objects.create(name=name, position=Category.objects.count())
        log(request, 'category.create', 'category', c.id, name=name)
        return Response({'id': c.id, 'name': c.name, 'is_active': True}, status=201)

    def patch(self, request, pk):
        c = get_object_or_404(Category, pk=pk)
        c.is_active = bool(request.data.get('is_active', c.is_active))
        c.save(update_fields=['is_active'])
        log(request, 'category.toggle', 'category', c.id, is_active=c.is_active)
        return Response({'id': c.id, 'name': c.name, 'is_active': c.is_active})


class AuditLogView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = AdminAuditLog.objects.all()
        a = request.query_params.get('action', '').strip()
        if a:
            qs = qs.filter(action__startswith=a)
        return Response([{'id': e.id, 'actor': e.actor_name, 'action': e.action, 'target_type': e.target_type, 'target_id': e.target_id,
                          'detail': e.detail, 'ip': e.ip, 'created_at': e.created_at} for e in qs[:100]])
