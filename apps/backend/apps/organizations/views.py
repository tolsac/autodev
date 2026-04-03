import secrets
from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import AuditLog, BillingAccount, Invitation, Membership, Organization
from .permissions import IsOrgAdmin, IsOrgMember, IsOrgOwner
from .serializers import (
    AuditLogSerializer,
    BillingAccountSerializer,
    InvitationCreateSerializer,
    InvitationSerializer,
    MembershipSerializer,
    OrganizationSerializer,
    OrganizationSettingsSerializer,
)


class OrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Organization.objects.filter(
            memberships__user=self.request.user
        ).distinct()

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in ("update", "partial_update"):
            return [permissions.IsAuthenticated(), IsOrgAdmin()]
        if self.action == "destroy":
            return [permissions.IsAuthenticated(), IsOrgOwner()]
        return [permissions.IsAuthenticated(), IsOrgMember()]

    def perform_create(self, serializer):
        org = serializer.save(created_by=self.request.user)
        # Creator becomes owner
        Membership.objects.create(
            user=self.request.user,
            organization=org,
            role=Membership.Role.OWNER,
        )
        # Create billing account
        BillingAccount.objects.create(organization=org)

    # --- Members ---
    @action(detail=True, methods=["get"], url_path="members")
    def list_members(self, request, slug=None):
        org = self.get_object()
        members = Membership.objects.filter(organization=org).select_related("user")
        serializer = MembershipSerializer(members, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["patch"],
        url_path="members/(?P<user_id>[^/.]+)",
    )
    def update_member(self, request, slug=None, user_id=None):
        org = self.get_object()
        membership = get_object_or_404(
            Membership, organization=org, user_id=user_id
        )
        new_role = request.data.get("role")
        if new_role:
            membership.role = new_role
            membership.save(update_fields=["role"])
        return Response(MembershipSerializer(membership).data)

    @action(
        detail=True,
        methods=["delete"],
        url_path="members/(?P<user_id>[^/.]+)/remove",
    )
    def remove_member(self, request, slug=None, user_id=None):
        org = self.get_object()
        membership = get_object_or_404(
            Membership, organization=org, user_id=user_id
        )
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # --- Invitations ---
    @action(detail=True, methods=["get", "post"], url_path="invitations")
    def invitations(self, request, slug=None):
        org = self.get_object()
        if request.method == "GET":
            invites = Invitation.objects.filter(organization=org).order_by("-created_at")
            return Response(InvitationSerializer(invites, many=True).data)

        serializer = InvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        invitation = Invitation.objects.create(
            organization=org,
            email=data["email"],
            role=data["role"],
            is_guest=data.get("is_guest", False),
            guest_project_role=data.get("guest_project_role", "viewer"),
            token=secrets.token_urlsafe(32),
            invited_by=request.user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        return Response(
            InvitationSerializer(invitation).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path="invitations/(?P<invitation_id>[^/.]+)",
    )
    def revoke_invitation(self, request, slug=None, invitation_id=None):
        org = self.get_object()
        invitation = get_object_or_404(
            Invitation, pk=invitation_id, organization=org
        )
        invitation.status = Invitation.Status.REVOKED
        invitation.save(update_fields=["status"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    # --- Billing ---
    @action(detail=True, methods=["get"], url_path="billing")
    def billing(self, request, slug=None):
        org = self.get_object()
        billing = get_object_or_404(BillingAccount, organization=org)
        return Response(BillingAccountSerializer(billing).data)

    # --- Settings ---
    @action(detail=True, methods=["get", "patch"], url_path="settings")
    def org_settings(self, request, slug=None):
        org = self.get_object()
        if request.method == "GET":
            return Response(OrganizationSettingsSerializer(org).data)
        serializer = OrganizationSettingsSerializer(org, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(OrganizationSettingsSerializer(org).data)

    # --- Audit Log ---
    @action(detail=True, methods=["get"], url_path="audit-log")
    def audit_log(self, request, slug=None):
        org = self.get_object()
        qs = AuditLog.objects.filter(organization=org).select_related("user")
        # Filters
        if user_id := request.query_params.get("user_id"):
            qs = qs.filter(user_id=user_id)
        if action_filter := request.query_params.get("action"):
            qs = qs.filter(action=action_filter)
        if after := request.query_params.get("after"):
            qs = qs.filter(created_at__gte=after)
        if before := request.query_params.get("before"):
            qs = qs.filter(created_at__lte=before)
        logs = qs[:100]
        return Response(AuditLogSerializer(logs, many=True).data)

    # --- Delete org ---
    @action(detail=True, methods=["post"], url_path="delete")
    def delete_org(self, request, slug=None):
        org = self.get_object()
        confirm_name = request.data.get("confirm_name", "")
        if confirm_name != org.name:
            return Response(
                {"confirm_name": ["Le nom saisi ne correspond pas."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        org.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AcceptInvitationView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, token):
        invitation = get_object_or_404(
            Invitation, token=token, status=Invitation.Status.PENDING
        )
        if invitation.expires_at < timezone.now():
            invitation.status = Invitation.Status.EXPIRED
            invitation.save(update_fields=["status"])
            return Response(
                {"error": "Invitation expired"}, status=status.HTTP_410_GONE
            )

        if not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        Membership.objects.get_or_create(
            user=request.user,
            organization=invitation.organization,
            defaults={"role": invitation.role},
        )
        invitation.status = Invitation.Status.ACCEPTED
        invitation.save(update_fields=["status"])
        return Response({"success": True})
