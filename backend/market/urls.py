from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('listings', views.ListingViewSet, basename='listing')
urlpatterns = [
    path('market/categories/', views.CategoryListView.as_view()),
    path('market/highlights/', views.HighlightsView.as_view()),
    path('offers/', views.MyOffersView.as_view()),
    path('offers/<int:pk>/<str:act>/', views.OfferActionView.as_view()),
] + router.urls
