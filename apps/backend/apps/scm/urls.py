from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "scm"

scm_router = DefaultRouter()
scm_router.register("scm-connections", views.SCMConnectionViewSet, basename="scm-connection")
scm_router.register("repositories", views.RepositoryViewSet, basename="repository")

project_repo_router = DefaultRouter()
project_repo_router.register("repositories", views.ProjectRepositoryViewSet, basename="project-repository")

# Manual routes BEFORE router to avoid pk capture conflicts
urlpatterns = [
    # GitHub App
    path("scm-connections/github/install/", views.GitHubInstallView.as_view(), name="github-install"),
    path("scm-connections/<uuid:connection_id>/available-repos/", views.GitHubAvailableReposView.as_view(), name="github-available-repos"),
    path("scm-connections/<uuid:connection_id>/disconnect/", views.SCMDisconnectView.as_view(), name="scm-disconnect"),
    path("repositories/import/", views.RepositoryBulkImportView.as_view(), name="repository-bulk-import"),
    # Router-generated routes
    path("", include(scm_router.urls)),
    path("project-repos/", include(project_repo_router.urls)),
]
