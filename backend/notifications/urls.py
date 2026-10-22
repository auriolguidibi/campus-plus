from django.urls import path

from . import views as v

urlpatterns = [
    path('notifications/', v.NotificationListView.as_view()),
    path('notifications/unread-count/', v.UnreadCountView.as_view()),
    path('notifications/read-all/', v.ReadAllView.as_view()),
    path('notifications/preferences/', v.PreferencesView.as_view()),
    path('notifications/<int:pk>/read/', v.MarkReadView.as_view()),
]
