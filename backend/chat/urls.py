from django.urls import path

from . import views

urlpatterns = [
    path('conversations/', views.ConversationListView.as_view()),
    path('conversations/unread/', views.UnreadCountView.as_view()),
    path('conversations/<int:pk>/messages/', views.MessageListView.as_view()),
]
