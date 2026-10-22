from django.contrib import admin

from .models import AdminAuditLog, Report


@admin.register(AdminAuditLog)
class AuditAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'actor_name', 'action', 'target_type', 'target_id')
    list_filter = ('action',)

    # append-only: nobody edits or deletes history from the admin
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(Report)
