from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('accounts.api_urls')),
    path('api/', include('communities.urls')),
    path('api/', include('market.urls')),
    path('api/', include('chat.urls')),
    path('api/', include('stories.urls')),
    path('api/', include('campus.urls')),
    path('api/', include('social.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
