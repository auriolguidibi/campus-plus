from rest_framework.permissions import BasePermission

from .models import AdminAuditLog


class IsModerator(BasePermission):
    """Moderator or administrator. Evaluated server-side from the database, never from client data."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_active and u.staff_role in ('moderator', 'admin'))


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_active and u.staff_role == 'admin')


def client_ip(request):
    return request.META.get('REMOTE_ADDR')


def log(request, action, target_type, target_id=None, **detail):
    AdminAuditLog.objects.create(actor=request.user, actor_name=request.user.username, action=action, target_type=target_type,
                                 target_id=target_id, detail=detail, ip=client_ip(request))
