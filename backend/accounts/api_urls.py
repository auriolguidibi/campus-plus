from django.urls import path

from . import social_views as v

urlpatterns = [
    path('users/', v.UserSearchView.as_view()),
    path('users/<str:username>/', v.UserDetailView.as_view()),
    path('friends/', v.FriendsView.as_view()),
    path('friends/suggestions/', v.FriendSuggestionsView.as_view()),
    path('friends/requests/', v.FriendRequestsView.as_view()),
    path('friends/<str:action>/<int:user_id>/', v.FriendActionView.as_view()),
    path('blocks/', v.BlockView.as_view()),
    path('blocks/<int:user_id>/', v.BlockView.as_view()),
]
