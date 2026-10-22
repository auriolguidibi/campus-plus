from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', views.health),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('accounts.api_urls')),
    path('api/', include('communities.urls')),
    path('api/', include('market.urls')),
    path('api/', include('chat.urls')),
    path('api/', include('stories.urls')),
    path('api/', include('campus.urls')),
    path('api/', include('moderation.urls')),
    path('api/', include('notifications.urls')),
    path('api/', include('social.urls')),
]
if settings.SERVE_MEDIA:
    urlpatterns.append(re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}))
# SPA fallback must stay last: anything that is not api/admin/media/static gets the React shell.
urlpatterns.append(re_path(r'^(?!api/|admin/|media/|static/)(?P<path>.*)$', views.spa_index))
