from rest_framework import permissions

from .models import Membership


class IsOrgMember(permissions.BasePermission):
    """Requires the user to be a member of the organization."""

    def has_object_permission(self, request, view, obj):
        org = obj if hasattr(obj, "memberships") else getattr(obj, "organization", None)
        if org is None:
            return False
        return Membership.objects.filter(
            user=request.user, organization=org
        ).exists()


class IsOrgAdmin(permissions.BasePermission):
    """Requires the user to be admin or owner of the organization."""

    def has_object_permission(self, request, view, obj):
        org = obj if hasattr(obj, "memberships") else getattr(obj, "organization", None)
        if org is None:
            return False
        return Membership.objects.filter(
            user=request.user,
            organization=org,
            role__in=[Membership.Role.ADMIN, Membership.Role.OWNER],
        ).exists()


class IsOrgOwner(permissions.BasePermission):
    """Requires the user to be owner of the organization."""

    def has_object_permission(self, request, view, obj):
        org = obj if hasattr(obj, "memberships") else getattr(obj, "organization", None)
        if org is None:
            return False
        return Membership.objects.filter(
            user=request.user,
            organization=org,
            role=Membership.Role.OWNER,
        ).exists()
