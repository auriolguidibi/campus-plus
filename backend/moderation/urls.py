from django.urls import path

from . import views as v

urlpatterns = [
    path('reports/', v.CreateReportView.as_view()),
    path('admin/stats/', v.StatsView.as_view()),
    path('admin/users/', v.AdminUsersView.as_view()),
    path('admin/users/<int:pk>/verify/', v.VerifyUserView.as_view()),
    path('admin/users/<int:pk>/suspend/', v.SuspendUserView.as_view()),
    path('admin/users/<int:pk>/role/', v.SetRoleView.as_view()),
    path('admin/reports/', v.ReportListView.as_view()),
    path('admin/reports/<int:pk>/resolve/', v.ReportResolveView.as_view()),
    path('admin/listings/', v.AdminListingsView.as_view()),
    path('admin/listings/<int:pk>/', v.AdminListingsView.as_view()),
    path('admin/posts/', v.AdminPostsView.as_view()),
    path('admin/posts/<int:pk>/remove/', v.AdminPostsView.as_view()),
    path('admin/communities/', v.AdminCommunitiesView.as_view()),
    path('admin/communities/<int:pk>/', v.AdminCommunitiesView.as_view()),
    path('admin/categories/', v.AdminCategoriesView.as_view()),
    path('admin/categories/<int:pk>/', v.AdminCategoriesView.as_view()),
    path('admin/audit-log/', v.AuditLogView.as_view()),
]
