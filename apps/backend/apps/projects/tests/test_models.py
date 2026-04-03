import pytest
from django.contrib.auth import get_user_model

from apps.organizations.models import Membership, Organization
from apps.projects.models import Board, Column, Project, Ticket

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="test@example.com",
        email="test@example.com",
        password="testpass123",
    )


@pytest.fixture
def org(db, user):
    org = Organization.objects.create(name="Acme", slug="acme", created_by=user)
    Membership.objects.create(user=user, organization=org, role=Membership.Role.OWNER)
    return org


@pytest.fixture
def project(db, org, user):
    return Project.objects.create(
        organization=org,
        name="My Project",
        slug="my-project",
        ticket_prefix="MP",
        created_by=user,
    )


@pytest.mark.django_db
class TestProjectSignal:
    def test_board_created_on_project_save(self, project):
        assert Board.objects.filter(project=project).exists()

    def test_default_columns_created(self, project):
        board = project.board
        columns = list(board.columns.order_by("position"))
        assert len(columns) == 5
        assert columns[0].name == "Backlog"
        assert columns[4].name == "Done"

    def test_columns_have_sequential_positions(self, project):
        board = project.board
        positions = list(board.columns.order_by("position").values_list("position", flat=True))
        assert positions == [0, 1, 2, 3, 4]

    def test_no_duplicate_board_on_resave(self, project):
        project.name = "Renamed"
        project.save()
        assert Board.objects.filter(project=project).count() == 1


@pytest.mark.django_db
class TestTicketKey:
    def test_ticket_key_auto_generated(self, project):
        column = project.board.columns.first()
        key = project.next_ticket_key()
        assert key == "MP-1"

    def test_ticket_key_increments(self, project):
        project.next_ticket_key()
        project.refresh_from_db()
        key2 = project.next_ticket_key()
        assert key2 == "MP-2"

    def test_ticket_creation_with_key(self, project, user):
        column = project.board.columns.first()
        key = project.next_ticket_key()
        ticket = Ticket.objects.create(
            project=project,
            column=column,
            ticket_key=key,
            title="Test ticket",
            created_by=user,
        )
        assert ticket.ticket_key == "MP-1"
        assert ticket.priority == "none"
        assert ticket.challenge_status == "not_started"
