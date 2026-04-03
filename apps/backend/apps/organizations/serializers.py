from rest_framework import serializers

from apps.users.serializers import UserMinimalSerializer

from .models import AuditLog, BillingAccount, Invitation, Membership, Organization


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "slug", "logo_url", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class MembershipSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "user", "organization", "role", "joined_at"]
        read_only_fields = ["id", "organization", "joined_at"]


class BillingAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingAccount
        fields = [
            "id",
            "plan",
            "max_projects",
            "max_members",
            "max_ai_runs_per_month",
            "current_ai_runs_count",
            "current_period_start",
            "current_period_end",
        ]
        read_only_fields = fields


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = [
            "id",
            "email",
            "role",
            "is_guest",
            "guest_project_role",
            "status",
            "invited_by",
            "created_at",
            "expires_at",
        ]
        read_only_fields = ["id", "status", "invited_by", "created_at", "expires_at"]


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=Membership.Role.choices, default="member")
    is_guest = serializers.BooleanField(default=False)
    guest_project_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    guest_project_role = serializers.ChoiceField(
        choices=[("member", "Member"), ("viewer", "Viewer")],
        default="viewer",
        required=False,
    )


class AuditLogSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True, default=None)
    user_email = serializers.CharField(source="user.email", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = [
            "id", "user", "user_name", "user_email",
            "action", "resource_type", "resource_id", "metadata",
            "ip_address", "created_at",
        ]
        read_only_fields = fields


class OrganizationSettingsSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id", "name", "slug", "logo_url", "timezone",
            "default_notification_channel",
            "member_count", "project_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_project_count(self, obj):
        return obj.projects.filter(is_archived=False).count()
