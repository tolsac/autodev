import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.organizations.models import Membership, Organization
from apps.projects.models import Project, ProjectMembership, Ticket

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="owner@example.com",
        email="owner@example.com",
        password="testpass123",
    )


@pytest.fixture
def viewer_user(db):
    return User.objects.create_user(
        username="viewer@example.com",
        email="viewer@example.com",
        password="testpass123",
    )


@pytest.fixture
def org(db, user):
    org = Organization.objects.create(name="Acme", slug="acme", created_by=user)
    Membership.objects.create(user=user, organization=org, role=Membership.Role.OWNER)
    return org


@pytest.fixture
def project(db, org, user):
    p = Project.objects.create(
        organization=org,
        name="Test Project",
        slug="test-project",
        ticket_prefix="TP",
        created_by=user,
    )
    ProjectMembership.objects.create(
        user=user, project=p, role=ProjectMembership.Role.ADMIN
    )
    return p


@pytest.fixture
def api_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.fixture
def viewer_client(viewer_user):
    client = APIClient()
    token = RefreshToken.for_user(viewer_user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.mark.django_db
class TestProjectAPI:
    def test_create_project(self, api_client, org):
        response = api_client.post(
            f"/api/v1/orgs/{org.slug}/projects/",
            {"name": "New Project", "slug": "new-project", "ticket_prefix": "NP"},
            format="json",
        )
        assert response.status_code == 201
        assert response.data["name"] == "New Project"
        assert response.data["slug"] == "new-project"

    def test_list_projects(self, api_client, org, project):
        response = api_client.get(f"/api/v1/orgs/{org.slug}/projects/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 1

    def test_get_project_detail(self, api_client, org, project):
        response = api_client.get(f"/api/v1/orgs/{org.slug}/projects/{project.slug}/")
        assert response.status_code == 200
        assert response.data["name"] == "Test Project"


@pytest.mark.django_db
class TestBoardAPI:
    def test_get_board(self, api_client, org, project):
        response = api_client.get(
            f"/api/v1/orgs/{org.slug}/projects/{project.slug}/board/"
        )
        assert response.status_code == 200
        assert len(response.data["columns"]) == 5

    def test_board_columns_include_tickets(self, api_client, org, project, user):
        column = project.board.columns.first()
        Ticket.objects.create(
            project=project,
            column=column,
            ticket_key="TP-1",
            title="Test ticket",
            created_by=user,
        )
        response = api_client.get(
            f"/api/v1/orgs/{org.slug}/projects/{project.slug}/board/"
        )
        first_col = response.data["columns"][0]
        assert len(first_col["tickets"]) == 1
        assert first_col["tickets"][0]["ticket_key"] == "TP-1"


@pytest.mark.django_db
class TestTicketAPI:
    def test_create_ticket(self, api_client, org, project):
        column = project.board.columns.first()
        response = api_client.post(
            f"/api/v1/orgs/{org.slug}/projects/{project.slug}/tickets/",
            {
                "title": "New ticket",
                "description": "Some description",
                "column": str(column.id),
                "priority": "medium",
            },
            format="json",
        )
        assert response.status_code == 201

    def test_move_ticket(self, api_client, org, project, user):
        columns = list(project.board.columns.order_by("position"))
        ticket = Ticket.objects.create(
            project=project,
            column=columns[0],
            ticket_key="TP-1",
            title="Moveable",
            created_by=user,
        )
        target_column = columns[2]
        response = api_client.post(
            f"/api/v1/orgs/{org.slug}/projects/{project.slug}/tickets/TP-1/move/",
            {"column_id": str(target_column.id), "position": 0},
            format="json",
        )
        assert response.status_code == 200
        ticket.refresh_from_db()
        assert ticket.column_id == target_column.id
        assert ticket.position == 0


@pytest.mark.django_db
class TestPermissions:
    def test_unauthenticated_cannot_access(self, org, project):
        client = APIClient()
        response = client.get(f"/api/v1/orgs/{org.slug}/projects/")
        assert response.status_code == 401
