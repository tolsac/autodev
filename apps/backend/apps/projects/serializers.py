from rest_framework import serializers

from apps.users.serializers import UserMinimalSerializer

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


# ── Leaf serializers ──

class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ["id", "name", "color"]
        read_only_fields = ["id"]


class ColumnAgentTriggerSerializer(serializers.ModelSerializer):
    class Meta:
        model = ColumnAgentTrigger
        fields = [
            "id", "agent_type", "trigger_mode", "position",
            "condition_challenge_approved", "condition_plan_approved",
            "condition_has_repos", "condition_pr_created", "condition_review_done",
            "notify_on_start", "notify_on_complete", "auto_move_on_complete", "is_active",
        ]
        read_only_fields = ["id"]


class UserMinimalInlineSerializer(UserMinimalSerializer):
    class Meta(UserMinimalSerializer.Meta):
        pass


class RepositoryMinimalSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    full_name = serializers.CharField()
    html_url = serializers.URLField(default="")


# ── Comment serializers ──

class CommentSerializer(serializers.ModelSerializer):
    author = UserMinimalInlineSerializer(read_only=True)
    author_name = serializers.CharField(source="author.full_name", read_only=True, default=None)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id", "author", "author_name", "author_type", "agent_type",
            "body", "is_question", "is_resolved", "parent", "source_channel",
            "created_at", "updated_at", "replies",
        ]
        read_only_fields = [
            "id", "author", "author_name", "author_type", "agent_type",
            "is_question", "is_resolved", "source_channel",
            "created_at", "updated_at",
        ]

    def get_replies(self, obj):
        if obj.parent is None:
            replies = obj.replies.all()
            return CommentSerializer(replies, many=True).data
        return []


# ── Ticket serializers ──

class TicketListSerializer(serializers.ModelSerializer):
    assigned_to = UserMinimalInlineSerializer(read_only=True)
    created_by = UserMinimalInlineSerializer(read_only=True)
    labels = LabelSerializer(many=True, read_only=True)
    column_name = serializers.CharField(source="column.name", read_only=True)

    class Meta:
        model = Ticket
        fields = [
            "id", "ticket_key", "title", "priority", "position",
            "column", "column_name",
            "assigned_to", "created_by", "labels",
            "challenge_status", "plan_status", "code_status",
            "review_status", "fix_status",
            "estimated_complexity", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "ticket_key", "created_at", "updated_at"]


class ColumnMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Column
        fields = ["id", "name", "color"]


class TicketDetailSerializer(serializers.ModelSerializer):
    assigned_to = UserMinimalInlineSerializer(read_only=True)
    created_by = UserMinimalInlineSerializer(read_only=True)
    labels = LabelSerializer(many=True, read_only=True)
    column = ColumnMinimalSerializer(read_only=True)
    comments = serializers.SerializerMethodField()
    impacted_repos = RepositoryMinimalSerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = [
            "id", "ticket_key", "title", "description", "acceptance_criteria",
            "priority", "position", "estimated_complexity",
            "column", "project",
            "assigned_to", "created_by",
            "labels", "impacted_repos", "comments",
            "challenge_status", "plan_status", "code_status",
            "review_status", "fix_status",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_comments(self, obj):
        # Only top-level comments; replies are nested via SerializerMethodField
        top_level = obj.comments.filter(parent__isnull=True).select_related("author")
        return CommentSerializer(top_level, many=True).data


class TicketCreateSerializer(serializers.ModelSerializer):
    assigned_to_id = serializers.UUIDField(required=False, allow_null=True)
    label_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)
    impacted_repo_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)

    class Meta:
        model = Ticket
        fields = [
            "title", "description", "acceptance_criteria",
            "column", "priority", "assigned_to_id",
            "label_ids", "impacted_repo_ids", "estimated_complexity",
        ]

    def validate_column(self, value):
        project = self.context.get("project")
        if project and not Column.objects.filter(id=value.id, board__project=project).exists():
            raise serializers.ValidationError("Cette colonne n'appartient pas a ce projet.")
        return value

    def create(self, validated_data):
        from django.db.models import F, Max

        label_ids = validated_data.pop("label_ids", [])
        repo_ids = validated_data.pop("impacted_repo_ids", [])
        assigned_to_id = validated_data.pop("assigned_to_id", None)
        project = self.context["project"]
        user = self.context["request"].user

        # Atomic ticket key generation
        Project.objects.filter(id=project.id).update(ticket_counter=F("ticket_counter") + 1)
        project.refresh_from_db()
        ticket_key = f"{project.ticket_prefix}-{project.ticket_counter}"

        # Position: last in column
        column = validated_data["column"]
        max_pos = Ticket.objects.filter(column=column).aggregate(m=Max("position"))["m"]
        position = (max_pos or 0) + 1

        ticket = Ticket.objects.create(
            **validated_data,
            project=project,
            ticket_key=ticket_key,
            position=position,
            created_by=user,
            assigned_to_id=assigned_to_id,
        )
        if label_ids:
            ticket.labels.set(label_ids)
        if repo_ids:
            ticket.impacted_repos.set(repo_ids)
        return ticket


class TicketUpdateSerializer(serializers.ModelSerializer):
    label_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    impacted_repo_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    assigned_to_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = Ticket
        fields = [
            "title", "description", "acceptance_criteria",
            "column", "priority", "assigned_to_id",
            "label_ids", "impacted_repo_ids", "estimated_complexity",
        ]
        extra_kwargs = {f: {"required": False} for f in fields}

    def update(self, instance, validated_data):
        label_ids = validated_data.pop("label_ids", None)
        repo_ids = validated_data.pop("impacted_repo_ids", None)
        assigned_to_id = validated_data.pop("assigned_to_id", ...)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if assigned_to_id is not ...:
            instance.assigned_to_id = assigned_to_id
        instance.save()

        if label_ids is not None:
            instance.labels.set(label_ids)
        if repo_ids is not None:
            instance.impacted_repos.set(repo_ids)
        return instance


class TicketMoveSerializer(serializers.Serializer):
    column_id = serializers.UUIDField()
    position = serializers.IntegerField(default=0)


# ── Column serializers ──

class ColumnSerializer(serializers.ModelSerializer):
    triggers = ColumnAgentTriggerSerializer(many=True, read_only=True)
    ticket_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Column
        fields = ["id", "name", "position", "color", "wip_limit", "triggers", "ticket_count"]
        read_only_fields = ["id"]


class ColumnWithTicketsSerializer(serializers.ModelSerializer):
    triggers = ColumnAgentTriggerSerializer(many=True, read_only=True)
    tickets = TicketListSerializer(many=True, read_only=True)

    class Meta:
        model = Column
        fields = ["id", "name", "position", "color", "wip_limit", "triggers", "tickets"]


# ── Board serializers ──

class BoardSerializer(serializers.ModelSerializer):
    columns = ColumnSerializer(many=True, read_only=True)

    class Meta:
        model = Board
        fields = ["id", "project", "columns", "created_at"]
        read_only_fields = fields


class BoardFullSerializer(serializers.ModelSerializer):
    columns = ColumnWithTicketsSerializer(many=True, read_only=True)

    class Meta:
        model = Board
        fields = ["id", "project", "columns", "created_at"]
        read_only_fields = fields


# ── Project serializers ──

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id", "name", "slug", "description", "icon", "color", "ticket_prefix",
            "default_target_branch", "branch_naming_template", "pr_title_template",
            "agent_custom_instructions", "organization", "created_by",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "organization", "created_by", "created_at", "updated_at"]


class ProjectMembershipSerializer(serializers.ModelSerializer):
    user = UserMinimalInlineSerializer(read_only=True)

    class Meta:
        model = ProjectMembership
        fields = ["id", "user", "role", "joined_at"]
        read_only_fields = ["id", "joined_at"]


class ProjectSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id", "name", "slug", "description", "icon", "color",
            "ticket_prefix", "ticket_counter", "is_archived", "archived_at",
            "default_target_branch", "branch_naming_template",
            "pr_title_template", "pr_body_template",
            "llm_model", "agent_global_instructions",
            "agent_challenge_instructions", "agent_plan_instructions",
            "agent_code_instructions", "agent_review_instructions",
            "agent_fix_instructions", "agent_custom_instructions",
            "challenge_auto_approve_threshold",
            "fix_severity_filter", "fix_max_iterations",
            "notification_channel_override",
            "notify_agent_questions", "notify_plan_generated",
            "notify_pr_created", "notify_review_completed", "notify_fix_applied",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "slug", "ticket_counter", "created_at", "updated_at", "archived_at"]

    def validate_ticket_prefix(self, value):
        if not value.isalpha() or len(value) > 10:
            raise serializers.ValidationError("Le prefixe doit contenir uniquement des lettres (max 10).")
        return value.upper()


class ProjectListSettingsSerializer(serializers.ModelSerializer):
    ticket_count = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    repo_count = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True, default=None)

    class Meta:
        model = Project
        fields = [
            "id", "name", "slug", "description", "icon", "color",
            "ticket_prefix", "is_archived",
            "ticket_count", "member_count", "repo_count",
            "created_by_name", "created_at", "updated_at",
        ]

    def get_ticket_count(self, obj):
        return obj.tickets.count()

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_repo_count(self, obj):
        return obj.project_repositories.count()


class ProjectCreateSerializer(serializers.ModelSerializer):
    repository_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list, write_only=True,
    )

    class Meta:
        model = Project
        fields = [
            "name", "description", "icon", "color", "ticket_prefix",
            "default_target_branch", "branch_naming_template", "pr_title_template",
            "llm_model", "agent_global_instructions",
            "repository_ids",
        ]
        extra_kwargs = {f: {"required": False} for f in fields if f != "name"}

    def validate_name(self, value):
        org = self.context.get("organization")
        if org and Project.objects.filter(organization=org, name=value).exists():
            raise serializers.ValidationError("Un projet avec ce nom existe deja.")
        return value

    def validate_ticket_prefix(self, value):
        if not value:
            return value
        if not value.isalpha() or len(value) > 10:
            raise serializers.ValidationError("Le prefixe doit contenir uniquement des lettres (max 10).")
        return value.upper()

    def validate_repository_ids(self, value):
        from apps.scm.models import Repository
        org = self.context.get("organization")
        if org and value:
            org_ids = set(Repository.objects.filter(organization=org).values_list("id", flat=True))
            for rid in value:
                if rid not in org_ids:
                    raise serializers.ValidationError(f"Le repo {rid} n'appartient pas a cette organisation.")
        return value

    def create(self, validated_data):
        from django.utils.text import slugify
        from apps.scm.models import ProjectRepository

        repository_ids = validated_data.pop("repository_ids", [])
        org = self.context["organization"]
        user = self.context["request"].user

        # Auto-generate slug
        base_slug = slugify(validated_data["name"])[:100]
        slug = base_slug
        counter = 1
        while Project.objects.filter(organization=org, slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        # Auto-generate prefix if not provided
        prefix = validated_data.get("ticket_prefix", "")
        if not prefix:
            words = validated_data["name"].split()
            prefix = "".join(w[0] for w in words if w and w[0].isalpha())[:4].upper() or base_slug[:3].upper()
            base_prefix = prefix
            counter = 1
            while Project.objects.filter(organization=org, ticket_prefix=prefix).exists():
                prefix = f"{base_prefix}{counter}"
                counter += 1
            validated_data["ticket_prefix"] = prefix

        project = Project.objects.create(
            **validated_data, organization=org, slug=slug, created_by=user,
        )

        # Link repos
        for rid in repository_ids:
            ProjectRepository.objects.create(project=project, repository_id=rid, linked_by=user)

        # Creator becomes admin
        ProjectMembership.objects.create(user=user, project=project, role=ProjectMembership.Role.ADMIN)

        return project

    def validate_challenge_auto_approve_threshold(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Le seuil doit etre entre 0 et 100.")
        return value

    def validate_fix_max_iterations(self, value):
        if value < 1 or value > 10:
            raise serializers.ValidationError("Le nombre d'iterations doit etre entre 1 et 10.")
        return value
