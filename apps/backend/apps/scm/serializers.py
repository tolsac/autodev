from rest_framework import serializers

from .models import ProjectRepository, PullRequest, Repository, SCMConnection


class SCMConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SCMConnection
        fields = [
            "id",
            "provider_type",
            "external_org_name",
            "external_org_id",
            "created_at",
        ]
        read_only_fields = ["id", "external_org_name", "external_org_id", "created_at"]


class RepositorySerializer(serializers.ModelSerializer):
    provider_type = serializers.CharField(
        source="scm_connection.provider_type", read_only=True
    )

    class Meta:
        model = Repository
        fields = [
            "id",
            "name",
            "full_name",
            "provider_type",
            "default_branch",
            "html_url",
            "indexing_status",
            "last_indexed_at",
            "created_at",
        ]
        read_only_fields = fields


class RepositoryImportSerializer(serializers.Serializer):
    scm_connection_id = serializers.UUIDField()
    external_id = serializers.CharField()
    name = serializers.CharField()
    full_name = serializers.CharField()
    clone_url = serializers.URLField()
    html_url = serializers.URLField(required=False, default="")
    default_branch = serializers.CharField(default="main")


class ProjectRepositorySerializer(serializers.ModelSerializer):
    repository = RepositorySerializer(read_only=True)

    class Meta:
        model = ProjectRepository
        fields = ["id", "repository", "target_branch_override", "is_default", "linked_at"]
        read_only_fields = ["id", "linked_at"]


class ProjectRepositoryLinkSerializer(serializers.Serializer):
    repository_id = serializers.UUIDField()
    target_branch_override = serializers.CharField(required=False, default="")


class PullRequestSerializer(serializers.ModelSerializer):
    repository_name = serializers.CharField(
        source="repository.full_name", read_only=True
    )

    class Meta:
        model = PullRequest
        fields = [
            "id",
            "ticket",
            "repository",
            "repository_name",
            "external_id",
            "external_url",
            "title",
            "branch_name",
            "target_branch",
            "status",
            "additions",
            "deletions",
            "files_changed",
            "created_at",
            "merged_at",
        ]
        read_only_fields = fields
