from rest_framework import permissions

from apps.organizations.models import Membership

from .models import ProjectMembership


def _get_project(obj):
    """Extract project from various object types."""
    if hasattr(obj, "board"):
        return obj  # It's a Project
    if hasattr(obj, "project"):
        return obj.project
    if hasattr(obj, "column"):
        return obj.column.board.project
    if hasattr(obj, "ticket"):
        return obj.ticket.project
    return None


class IsProjectViewer(permissions.BasePermission):
    """Viewer+ on the project, or Admin/Owner on the org."""

    def has_object_permission(self, request, view, obj):
        project = _get_project(obj)
        if project is None:
            return False
        # Org admins/owners have implicit access
        if Membership.objects.filter(
            user=request.user,
            organization=project.organization,
            role__in=[Membership.Role.ADMIN, Membership.Role.OWNER],
        ).exists():
            return True
        return ProjectMembership.objects.filter(
            user=request.user, project=project
        ).exists()


class IsProjectMember(permissions.BasePermission):
    """Member+ on the project, or Admin/Owner on the org."""

    def has_object_permission(self, request, view, obj):
        project = _get_project(obj)
        if project is None:
            return False
        if Membership.objects.filter(
            user=request.user,
            organization=project.organization,
            role__in=[Membership.Role.ADMIN, Membership.Role.OWNER],
        ).exists():
            return True
        return ProjectMembership.objects.filter(
            user=request.user,
            project=project,
            role__in=[ProjectMembership.Role.ADMIN, ProjectMembership.Role.MEMBER],
        ).exists()


class IsProjectAdmin(permissions.BasePermission):
    """Admin on the project, or Admin/Owner on the org."""

    def has_object_permission(self, request, view, obj):
        project = _get_project(obj)
        if project is None:
            return False
        if Membership.objects.filter(
            user=request.user,
            organization=project.organization,
            role__in=[Membership.Role.ADMIN, Membership.Role.OWNER],
        ).exists():
            return True
        return ProjectMembership.objects.filter(
            user=request.user,
            project=project,
            role=ProjectMembership.Role.ADMIN,
        ).exists()
