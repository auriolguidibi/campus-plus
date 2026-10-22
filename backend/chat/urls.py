from django.urls import path

from . import calls, views

urlpatterns = [
    path('conversations/', views.ConversationListView.as_view()),
    path('conversations/unread/', views.UnreadCountView.as_view()),
    path('conversations/<int:pk>/messages/', views.MessageListView.as_view()),
    path('conversations/<int:pk>/call/', calls.StartCallView.as_view()),
    path('calls/ice-servers/', calls.IceServersView.as_view()),
    path('calls/incoming/', calls.IncomingCallView.as_view()),
    path('calls/<int:pk>/', calls.CallDetailView.as_view()),
    path('calls/<int:pk>/signal/', calls.SignalView.as_view()),
    path('calls/<int:pk>/signals/', calls.SignalView.as_view()),
    path('calls/<int:pk>/<str:action>/', calls.CallActionView.as_view()),
]
