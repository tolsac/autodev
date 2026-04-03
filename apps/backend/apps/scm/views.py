from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization

from .models import ProjectRepository, PullRequest, Repository, SCMConnection
from .serializers import (
    ProjectRepositoryLinkSerializer,
    ProjectRepositorySerializer,
    PullRequestSerializer,
    RepositoryImportSerializer,
    RepositorySerializer,
    SCMConnectionSerializer,
)


class SCMConnectionViewSet(viewsets.ModelViewSet):
    serializer_class = SCMConnectionSerializer

    def get_queryset(self):
        org_slug = self.kwargs["org_slug"]
        return SCMConnection.objects.filter(organization__slug=org_slug)

    def perform_create(self, serializer):
        org = get_object_or_404(Organization, slug=self.kwargs["org_slug"])
        serializer.save(organization=org, connected_by=self.request.user)


class RepositoryViewSet(viewsets.ModelViewSet):
    serializer_class = RepositorySerializer
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        org_slug = self.kwargs["org_slug"]
        return Repository.objects.filter(
            organization__slug=org_slug
        ).select_related("scm_connection")

    def create(self, request, org_slug=None):
        org = get_object_or_404(Organization, slug=org_slug)
        serializer = RepositoryImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        repo, created = Repository.objects.get_or_create(
            organization=org,
            scm_connection_id=data["scm_connection_id"],
            external_id=data["external_id"],
            defaults={
                "name": data["name"],
                "full_name": data["full_name"],
                "clone_url": data["clone_url"],
                "html_url": data.get("html_url", ""),
                "default_branch": data.get("default_branch", "main"),
                "added_by": request.user,
            },
        )
        return Response(
            RepositorySerializer(repo).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="reindex")
    def reindex(self, request, org_slug=None, pk=None):
        repo = self.get_object()
        repo.indexing_status = Repository.IndexingStatus.PENDING
        repo.save(update_fields=["indexing_status"])
        # TODO: trigger Celery task for reindexing
        return Response({"status": "reindex_queued"})


class ProjectRepositoryViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectRepositorySerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        return ProjectRepository.objects.filter(
            project__organization__slug=self.kwargs["org_slug"],
            project__slug=self.kwargs["project_slug"],
        ).select_related("repository__scm_connection")

    def create(self, request, org_slug=None, project_slug=None):
        serializer = ProjectRepositoryLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        from apps.projects.models import Project

        project = get_object_or_404(
            Project, organization__slug=org_slug, slug=project_slug
        )
        link, created = ProjectRepository.objects.get_or_create(
            project=project,
            repository_id=data["repository_id"],
            defaults={
                "target_branch_override": data.get("target_branch_override", ""),
                "linked_by": request.user,
            },
        )
        return Response(
            ProjectRepositorySerializer(link).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class WebhookGitHubView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return Response({"received": True})


class WebhookStripeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return Response({"received": True})


# ── GitHub App Integration ──

class GitHubInstallView(APIView):
    def post(self, request, org_slug):
        org = get_object_or_404(Organization, slug=org_slug)
        if SCMConnection.objects.filter(organization=org, provider_type="github").exists():
            return Response({"error": "GitHub deja connecte."}, status=400)
        from .providers.github import GitHubProvider
        provider = GitHubProvider()
        # Pass org_slug as state param in the redirect URL
        install_url = f"{provider.get_installation_url()}?state={org_slug}"
        return Response({"redirect_url": install_url})


class GitHubCallbackView(APIView):
    """
    Callback after GitHub App installation.
    GitHub redirects here with ?installation_id=XXX&setup_action=install&state=org_slug
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.shortcuts import redirect
        from django.conf import settings as django_settings

        installation_id = request.query_params.get("installation_id")
        setup_action = request.query_params.get("setup_action", "")
        org_slug = request.query_params.get("state", "")

        frontend = django_settings.FRONTEND_URL

        if not installation_id:
            return redirect(f"{frontend}?error=Installation+ID+manquant")

        if not org_slug:
            # Fallback: try to find the org from the installation
            org_slug = self._resolve_org_slug(installation_id)
            if not org_slug:
                return redirect(f"{frontend}?error=Organisation+introuvable")

        try:
            org = Organization.objects.get(slug=org_slug)
        except Organization.DoesNotExist:
            return redirect(f"{frontend}?error=Organisation+introuvable")

        from .providers.github import GitHubProvider
        provider = GitHubProvider()
        try:
            details = provider.get_installation_details(int(installation_id))
        except Exception as e:
            return redirect(f"{frontend}/{org_slug}/settings/scm?error=GitHub+erreur")

        SCMConnection.objects.update_or_create(
            organization=org,
            provider_type="github",
            defaults={
                "installation_id": str(installation_id),
                "external_org_name": details.get("account", {}).get("login", ""),
                "external_org_id": str(details.get("account", {}).get("id", "")),
                "connected_by": request.user if request.user.is_authenticated else None,
            },
        )

        return redirect(f"{frontend}/{org_slug}/settings/scm?connected=github")

    def _resolve_org_slug(self, installation_id):
        """Fallback: if no state param, try to match installation to an existing org."""
        # For now, return None — the state param should always be present
        return None


class GitHubAvailableReposView(APIView):
    def get(self, request, org_slug, connection_id):
        org = get_object_or_404(Organization, slug=org_slug)
        connection = get_object_or_404(SCMConnection, id=connection_id, organization=org, provider_type="github")

        from .providers.github import GitHubProvider
        provider = GitHubProvider()
        try:
            all_repos = provider.list_accessible_repos(int(connection.installation_id))
        except Exception as e:
            return Response({"error": str(e)}, status=502)

        existing_ids = set(
            Repository.objects.filter(organization=org, scm_connection=connection).values_list("external_id", flat=True)
        )
        available = [r for r in all_repos if r["external_id"] not in existing_ids]

        return Response({
            "total_on_github": len(all_repos),
            "already_imported": len(existing_ids),
            "available": available,
        })


class RepositoryBulkImportView(APIView):
    def post(self, request, org_slug):
        org = get_object_or_404(Organization, slug=org_slug)
        connection_id = request.data.get("scm_connection_id")
        external_ids = request.data.get("external_ids", [])
        if not connection_id or not external_ids:
            return Response({"error": "scm_connection_id et external_ids requis."}, status=400)

        connection = get_object_or_404(SCMConnection, id=connection_id, organization=org)

        from .providers.github import GitHubProvider
        provider = GitHubProvider()
        try:
            all_repos = provider.list_accessible_repos(int(connection.installation_id))
        except Exception as e:
            return Response({"error": str(e)}, status=502)

        to_import = [r for r in all_repos if r["external_id"] in external_ids]
        existing_ids = set(
            Repository.objects.filter(organization=org, scm_connection=connection).values_list("external_id", flat=True)
        )

        created = []
        for rd in to_import:
            if rd["external_id"] in existing_ids:
                continue
            repo = Repository.objects.create(
                organization=org, scm_connection=connection,
                name=rd["name"], full_name=rd["full_name"],
                external_id=rd["external_id"], clone_url=rd["clone_url"],
                html_url=rd["html_url"], default_branch=rd["default_branch"],
                indexing_status="pending", added_by=request.user,
            )
            created.append(repo)
            # Launch indexation task
            from apps.agents.tasks import index_repository
            index_repository.delay(str(repo.id))

        return Response(
            RepositorySerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class SCMDisconnectView(APIView):
    def delete(self, request, org_slug, connection_id):
        org = get_object_or_404(Organization, slug=org_slug)
        connection = get_object_or_404(SCMConnection, id=connection_id, organization=org)
        repo_count = connection.repositories.count()
        ProjectRepository.objects.filter(repository__scm_connection=connection).delete()
        connection.repositories.all().delete()
        connection.delete()
        return Response({"deleted": True, "repos_removed": repo_count})
