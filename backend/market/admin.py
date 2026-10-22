from django.contrib import admin

from .models import Category, Listing, Offer, Review


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ('title', 'seller', 'price', 'status', 'created_at')
    list_filter = ('status', 'category')
    search_fields = ('title', 'seller__username')
    actions = ['publish', 'reject']

    @admin.action(description='Publier les annonces sélectionnées')
    def publish(self, request, qs):
        qs.filter(status='pending').update(status='published')

    @admin.action(description='Refuser les annonces sélectionnées')
    def reject(self, request, qs):
        qs.filter(status='pending').update(status='rejected')


admin.site.register(Category)
admin.site.register(Offer)
admin.site.register(Review)
