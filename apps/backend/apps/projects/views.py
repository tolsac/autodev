from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.organizations.models import Membership, Organization

from .models import (
    Board,
    Column,
    ColumnAgentTrigger,
    Comment,
    Label,
    Project,
    ProjectMembership,
    Ticket,
)
from .permissions import IsProjectAdmin, IsProjectMember, IsProjectViewer
from .serializers import (
    BoardFullSerializer,
    ColumnAgentTriggerSerializer,
    ColumnSerializer,
    CommentSerializer,
    LabelSerializer,
    ProjectMembershipSerializer,
    ProjectSerializer,
    TicketCreateSerializer,
    TicketDetailSerializer,
    TicketListSerializer,
    TicketMoveSerializer,
)

PRIORITY_ORDER = Case(
    When(priority="urgent", then=Value(0)),
    When(priority="high", then=Value(1)),
    When(priority="medium", then=Value(2)),
    When(priority="low", then=Value(3)),
    When(priority="none", then=Value(4)),
    output_field=IntegerField(),
)


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    lookup_field = "slug"

    def get_queryset(self):
        org_slug = self.kwargs["org_slug"]
        qs = Project.objects.filter(
            organization__slug=org_slug,
        ).select_related("organization", "created_by").order_by("-created_at")
        if self.request.query_params.get("include_archived") != "true":
            qs = qs.filter(is_archived=False)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            from .serializers import ProjectCreateSerializer
            return ProjectCreateSerializer
        if self.action == "list":
            from .serializers import ProjectListSettingsSerializer
            return ProjectListSettingsSerializer
        return ProjectSerializer

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsProjectAdmin()]
        return [permissions.IsAuthenticated()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == "create":
            ctx["organization"] = get_object_or_404(Organization, slug=self.kwargs["org_slug"])
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = serializer.save()
        from .serializers import ProjectListSettingsSerializer
        return Response(
            ProjectListSettingsSerializer(project).data,
            status=status.HTTP_201_CREATED,
        )

    # --- Board ---
    @action(detail=True, methods=["get"], url_path="board")
    def board(self, request, org_slug=None, slug=None):
        project = self.get_object()
        board = get_object_or_404(
            Board.objects.prefetch_related(
                "columns__triggers",
                "columns__tickets__assigned_to",
                "columns__tickets__labels",
            ),
            project=project,
        )
        return Response(BoardFullSerializer(board).data)

    # --- Columns ---
    @action(detail=True, methods=["post"], url_path="board/columns")
    def create_column(self, request, org_slug=None, slug=None):
        project = self.get_object()
        board = get_object_or_404(Board, project=project)
        serializer = ColumnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(board=board)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path="board/columns/(?P<column_id>[^/.]+)")
    def manage_column(self, request, org_slug=None, slug=None, column_id=None):
        project = self.get_object()
        column = get_object_or_404(Column, pk=column_id, board__project=project)
        if request.method == "DELETE":
            column.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = ColumnSerializer(column, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="board/columns/reorder")
    def reorder_columns(self, request, org_slug=None, slug=None):
        project = self.get_object()
        order = request.data.get("order", [])
        for i, col_id in enumerate(order):
            Column.objects.filter(pk=col_id, board__project=project).update(position=i)
        return Response({"success": True})

    # --- Triggers ---
    @action(detail=True, methods=["get", "post"], url_path="board/columns/(?P<column_id>[^/.]+)/triggers")
    def column_triggers(self, request, org_slug=None, slug=None, column_id=None):
        project = self.get_object()
        column = get_object_or_404(Column, pk=column_id, board__project=project)
        if request.method == "GET":
            return Response(ColumnAgentTriggerSerializer(
                ColumnAgentTrigger.objects.filter(column=column), many=True
            ).data)
        serializer = ColumnAgentTriggerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(column=column)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # --- Members ---
    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, org_slug=None, slug=None):
        project = self.get_object()
        if request.method == "GET":
            members = ProjectMembership.objects.filter(project=project).select_related("user")
            return Response(ProjectMembershipSerializer(members, many=True).data)
        user_id = request.data.get("user_id")
        role = request.data.get("role", ProjectMembership.Role.MEMBER)
        membership, created = ProjectMembership.objects.get_or_create(
            user_id=user_id, project=project, defaults={"role": role},
        )
        return Response(
            ProjectMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    # --- Labels ---
    @action(detail=True, methods=["get", "post"], url_path="labels")
    def labels(self, request, org_slug=None, slug=None):
        project = self.get_object()
        if request.method == "GET":
            return Response(LabelSerializer(Label.objects.filter(project=project), many=True).data)
        serializer = LabelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # --- Settings ---
    @action(detail=True, methods=["get", "patch"], url_path="settings")
    def project_settings(self, request, org_slug=None, slug=None):
        from .serializers import ProjectSettingsSerializer
        project = self.get_object()
        if request.method == "GET":
            return Response(ProjectSettingsSerializer(project).data)
        serializer = ProjectSettingsSerializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ProjectSettingsSerializer(project).data)

    # --- Archive ---
    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, org_slug=None, slug=None):
        from django.utils import timezone
        project = self.get_object()
        archive = request.data.get("is_archived", True)
        project.is_archived = archive
        project.archived_at = timezone.now() if archive else None
        project.save(update_fields=["is_archived", "archived_at", "updated_at"])
        return Response({"is_archived": project.is_archived, "archived_at": str(project.archived_at)})

    @action(detail=True, methods=["post"], url_path="delete")
    def delete_project(self, request, org_slug=None, slug=None):
        project = self.get_object()
        confirm_name = request.data.get("confirm_name", "")
        if confirm_name != project.name:
            return Response(
                {"confirm_name": ["Le nom saisi ne correspond pas au nom du projet."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TicketViewSet(viewsets.ModelViewSet):
    lookup_field = "ticket_key"

    def get_queryset(self):
        org_slug = self.kwargs["org_slug"]
        project_slug = self.kwargs["project_slug"]
        qs = (
            Ticket.objects.filter(
                project__organization__slug=org_slug,
                project__slug=project_slug,
            )
            .select_related("assigned_to", "created_by", "column", "project")
            .prefetch_related("labels")
        )

        # Filters
        params = self.request.query_params
        if col := params.get("column"):
            qs = qs.filter(column_id=col)
        if assignee := params.get("assigned_to"):
            qs = qs.filter(assigned_to_id=assignee)
        if priority := params.get("priority"):
            qs = qs.filter(priority=priority)
        if label := params.get("label"):
            qs = qs.filter(labels__id=label)
        for status_field in ("challenge_status", "plan_status", "code_status", "review_status"):
            if val := params.get(status_field):
                qs = qs.filter(**{status_field: val})
        if search := params.get("search"):
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(ticket_key__icontains=search)
            )

        # Ordering
        ordering = params.get("ordering", "-created_at")
        if ordering in ("priority", "-priority"):
            desc = ordering.startswith("-")
            priority_expr = PRIORITY_ORDER
            if desc:
                priority_expr = priority_expr.desc()
            qs = qs.order_by(priority_expr, "-created_at")
        elif ordering in (
            "created_at", "-created_at", "updated_at", "-updated_at",
            "ticket_key", "-ticket_key", "title", "-title",
        ):
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("-created_at")

        # Only use distinct when filtering by M2M (label) to avoid duplicates
        if self.request.query_params.get("label"):
            return qs.distinct()
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return TicketCreateSerializer
        if self.action in ("update", "partial_update"):
            from .serializers import TicketUpdateSerializer
            return TicketUpdateSerializer
        if self.action == "retrieve":
            return TicketDetailSerializer
        return TicketListSerializer

    pagination_class = None  # Disable pagination — tickets are bounded per project

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"results": serializer.data, "count": len(serializer.data)})

    def get_object(self):
        qs = self.get_queryset()
        if self.action == "retrieve":
            qs = qs.prefetch_related(
                "impacted_repos",
                "comments__author",
                "comments__replies__author",
            )
        return get_object_or_404(qs, ticket_key=self.kwargs["ticket_key"])

    def get_project(self):
        return get_object_or_404(
            Project,
            organization__slug=self.kwargs["org_slug"],
            slug=self.kwargs["project_slug"],
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == "create":
            ctx["project"] = self.get_project()
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()

        # Evaluate agent triggers
        try:
            from apps.agents.engine.trigger_evaluator import evaluate_triggers_for_event
            evaluate_triggers_for_event(ticket.project, ticket, "ticket_created")
        except Exception:
            pass  # Don't fail ticket creation if trigger eval fails

        return Response(
            TicketListSerializer(ticket).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, **kwargs):
        ticket = self.get_object()
        serializer = TicketMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        old_column_id = str(ticket.column_id)
        ticket.column_id = serializer.validated_data["column_id"]
        ticket.position = serializer.validated_data["position"]
        ticket.save(update_fields=["column_id", "position", "updated_at"])

        # Evaluate agent triggers for move
        try:
            from apps.agents.engine.trigger_evaluator import evaluate_triggers_for_event
            evaluate_triggers_for_event(
                ticket.project, ticket, "ticket_moved",
                source_column_id=old_column_id,
                target_column_id=str(ticket.column_id),
            )
        except Exception:
            pass
        return Response(TicketDetailSerializer(ticket).data)

    # --- Impacted Repos ---
    @action(detail=True, methods=["patch"], url_path="impacted-repos")
    def update_impacted_repos(self, request, **kwargs):
        ticket = self.get_object()
        repo_ids = request.data.get("repository_ids", [])
        from apps.scm.models import ProjectRepository
        linked_ids = set(
            str(rid) for rid in ProjectRepository.objects.filter(
                project=ticket.project
            ).values_list("repository_id", flat=True)
        )
        for rid in repo_ids:
            if str(rid) not in linked_ids:
                return Response({"error": f"Repo {rid} not linked to project."}, status=status.HTTP_400_BAD_REQUEST)
        ticket.impacted_repos.set(repo_ids)
        return Response(TicketDetailSerializer(ticket).data)

    # --- Comments ---
    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, **kwargs):
        ticket = self.get_object()
        if request.method == "GET":
            comments = Comment.objects.filter(ticket=ticket, parent__isnull=True).select_related("author").prefetch_related("replies__author")
            return Response(CommentSerializer(comments, many=True).data)
        serializer = CommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(ticket=ticket, author=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="comments/(?P<comment_id>[^/.]+)/resolve")
    def resolve_comment(self, request, comment_id=None, **kwargs):
        ticket = self.get_object()
        comment = get_object_or_404(Comment, pk=comment_id, ticket=ticket, is_question=True)
        comment.is_resolved = True
        comment.save(update_fields=["is_resolved", "updated_at"])
        return Response(CommentSerializer(comment).data)
