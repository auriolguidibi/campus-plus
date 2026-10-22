from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CampusUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'school', 'field_of_study', 'verification', 'is_active')
    list_filter = ('verification', 'is_active', 'school')
    fieldsets = UserAdmin.fieldsets + (
        ('Campus+', {'fields': ('school', 'field_of_study', 'promotion', 'bio', 'theme', 'verification')}),
    )
