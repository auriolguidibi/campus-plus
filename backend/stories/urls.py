from django.urls import path

from . import views

urlpatterns = [
    path('stories/', views.StoryListView.as_view()),
    path('stories/<int:pk>/', views.StoryDetailView.as_view()),
    path('stories/<int:pk>/view/', views.StoryViewMark.as_view()),
    path('stories/<int:pk>/viewers/', views.StoryViewers.as_view()),
]
