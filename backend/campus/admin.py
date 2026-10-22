from django.contrib import admin

from .models import Badge, Challenge, Confession, Event, Participation, PointEntry, UserBadge


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ('title', 'kind', 'max_points', 'starts_at', 'deadline')

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(Confession)
class ConfessionAdmin(admin.ModelAdmin):
    """The author is only visible to superusers (abuse handling); ordinary staff moderate blind."""
    list_display = ('id', 'status', 'created_at')
    list_filter = ('status',)

    def get_exclude(self, request, obj=None):
        return () if request.user.is_superuser else ('author',)


admin.site.register(Event)
admin.site.register(Participation)
admin.site.register(PointEntry)
admin.site.register(Badge)
admin.site.register(UserBadge)
