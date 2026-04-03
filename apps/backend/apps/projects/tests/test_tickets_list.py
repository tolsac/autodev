import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.organizations.models import Membership, Organization
from apps.projects.models import Column, Comment, Label, Project, ProjectMembership, Ticket

User = get_user_model()


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="owner@test.com", email="owner@test.com", password="pass", full_name="Owner User")


@pytest.fixture
def viewer(db):
    return User.objects.create_user(username="viewer@test.com", email="viewer@test.com", password="pass", full_name="Viewer User")


@pytest.fixture
def outsider(db):
    return User.objects.create_user(username="outsider@test.com", email="outsider@test.com", password="pass")


@pytest.fixture
def org(db, owner):
    org = Organization.objects.create(name="TestOrg", slug="testorg", created_by=owner)
    Membership.objects.create(user=owner, organization=org, role=Membership.Role.OWNER)
    return org


@pytest.fixture
def project(db, org, owner):
    p = Project.objects.create(organization=org, name="Proj", slug="proj", ticket_prefix="P", created_by=owner)
    ProjectMembership.objects.create(user=owner, project=p, role=ProjectMembership.Role.ADMIN)
    return p


@pytest.fixture
def columns(project):
    board = project.board
    return list(board.columns.order_by("position"))


@pytest.fixture
def labels(project):
    l1 = Label.objects.create(project=project, name="bug", color="#EF4444")
    l2 = Label.objects.create(project=project, name="feature", color="#3B82F6")
    return [l1, l2]


@pytest.fixture
def tickets(project, columns, owner, labels):
    ts = []
    for i, (title, prio, col_idx) in enumerate([
        ("Fix login crash", "urgent", 0),
        ("Add profile page", "medium", 1),
        ("Refactor auth module", "low", 2),
        ("Update docs", "none", 0),
        ("API billing endpoint", "high", 3),
    ]):
        t = Ticket.objects.create(
            project=project, column=columns[col_idx],
            ticket_key=f"P-{i + 1}", title=title, priority=prio,
            created_by=owner, position=i,
        )
        if i < 2:
            t.labels.add(labels[0])
        ts.append(t)
    ts[0].assigned_to = owner
    ts[0].challenge_status = "approved"
    ts[0].save()
    return ts


@pytest.fixture
def client_for(db):
    def _make(user):
        c = APIClient()
        token = RefreshToken.for_user(user)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
        return c
    return _make


def url(org, project, suffix=""):
    return f"/api/v1/orgs/{org.slug}/projects/{project.slug}/tickets/{suffix}"


@pytest.mark.django_db
class TestTicketListFilters:
    def test_list_returns_only_project_tickets(self, client_for, owner, org, project, tickets):
        # Create ticket in another project
        p2 = Project.objects.create(organization=org, name="P2", slug="p2", ticket_prefix="X", created_by=owner)
        col = p2.board.columns.first()
        Ticket.objects.create(project=p2, column=col, ticket_key="X-1", title="Other", created_by=owner)

        resp = client_for(owner).get(url(org, project))
        assert resp.status_code == 200
        keys = [t["ticket_key"] for t in resp.data["results"]]
        assert "X-1" not in keys
        assert len(keys) == 5

    def test_filter_by_column(self, client_for, owner, org, project, tickets, columns):
        resp = client_for(owner).get(url(org, project), {"column": str(columns[0].id)})
        keys = [t["ticket_key"] for t in resp.data["results"]]
        assert set(keys) == {"P-1", "P-4"}

    def test_filter_by_assignee(self, client_for, owner, org, project, tickets):
        resp = client_for(owner).get(url(org, project), {"assigned_to": str(owner.id)})
        keys = [t["ticket_key"] for t in resp.data["results"]]
        assert keys == ["P-1"]

    def test_filter_by_priority(self, client_for, owner, org, project, tickets):
        resp = client_for(owner).get(url(org, project), {"priority": "urgent"})
        keys = [t["ticket_key"] for t in resp.data["results"]]
        assert keys == ["P-1"]

    def test_filter_by_label(self, client_for, owner, org, project, tickets, labels):
        resp = client_for(owner).get(url(org, project), {"label": str(labels[0].id)})
        keys = [t["ticket_key"] for t in resp.data["results"]]
        assert set(keys) == {"P-1", "P-2"}

    def test_filter_by_search(self, client_for, owner, org, project, tickets):
        resp = client_for(owner).get(url(org, project), {"search": "login"})
        keys = [t["ticket_key"] for t in resp.data["results"]]
        assert keys == ["P-1"]

        resp2 = client_for(owner).get(url(org, project), {"search": "P-3"})
        keys2 = [t["ticket_key"] for t in resp2.data["results"]]
        assert keys2 == ["P-3"]


@pytest.mark.django_db
class TestTicketListOrdering:
    def test_ordering_by_created_at_desc(self, client_for, owner, org, project, tickets):
        resp = client_for(owner).get(url(org, project), {"ordering": "-created_at"})
        keys = [t["ticket_key"] for t in resp.data["results"]]
        assert keys[0] == "P-5"  # last created

    def test_ordering_by_priority(self, client_for, owner, org, project, tickets):
        resp = client_for(owner).get(url(org, project), {"ordering": "priority"})
        priorities = [t["priority"] for t in resp.data["results"]]
        # urgent=0, high=1, medium=2, low=3, none=4 → ascending = urgent first
        expected = ["urgent", "high", "medium", "low", "none"]
        assert priorities == expected


@pytest.mark.django_db
class TestTicketRetrieve:
    def test_retrieve_by_key(self, client_for, owner, org, project, tickets):
        resp = client_for(owner).get(url(org, project, "P-1/"))
        assert resp.status_code == 200
        assert resp.data["ticket_key"] == "P-1"
        assert resp.data["title"] == "Fix login crash"
        assert "column" in resp.data
        assert resp.data["column"]["name"] is not None

    def test_retrieve_includes_comments(self, client_for, owner, org, project, tickets):
        ticket = tickets[0]
        parent = Comment.objects.create(
            ticket=ticket, author=owner, body="Top level comment",
            author_type="human",
        )
        Comment.objects.create(
            ticket=ticket, author=owner, body="Reply",
            author_type="human", parent=parent,
        )
        resp = client_for(owner).get(url(org, project, "P-1/"))
        comments = resp.data["comments"]
        assert len(comments) == 1  # only top-level
        assert len(comments[0]["replies"]) == 1
        assert comments[0]["replies"][0]["body"] == "Reply"


@pytest.mark.django_db
class TestTicketPermissions:
    def test_unauthenticated_cannot_list(self, org, project, tickets):
        resp = APIClient().get(url(org, project))
        assert resp.status_code == 401
