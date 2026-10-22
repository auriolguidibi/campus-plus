from django.urls import path
from rest_framework.routers import DefaultRouter

from . import challenges as ch
from . import confessions as co
from .events import EventViewSet

router = DefaultRouter()
router.register('events', EventViewSet, basename='event')

urlpatterns = [
    path('challenges/', ch.ChallengeListView.as_view()),
    path('challenges/<int:pk>/', ch.ChallengeDetailView.as_view()),
    path('challenges/<int:pk>/participate/', ch.ParticipateView.as_view()),
    path('challenges/<int:pk>/submissions/', ch.SubmissionsView.as_view()),
    path('participations/<int:pk>/review/', ch.ReviewView.as_view()),
    path('leaderboard/', ch.LeaderboardView.as_view()),
    path('badges/', ch.BadgesView.as_view()),
    path('points/history/', ch.PointHistoryView.as_view()),
    path('confessions/', co.ConfessionListView.as_view()),
    path('confessions/mine/', co.MyConfessionsView.as_view()),
    path('confessions/queue/', co.ModerationQueueView.as_view()),
    path('confessions/queue/<int:pk>/', co.ModerationQueueView.as_view()),
    path('confessions/<int:pk>/react/', co.ConfessionReactView.as_view()),
    path('confessions/<int:pk>/comments/', co.ConfessionCommentsView.as_view()),
    path('confessions/<int:pk>/report/', co.ConfessionReportView.as_view()),
] + router.urls
