# Autodev — Spécification technique détaillée

> Version : 0.1.0-draft
> Date : 2026-04-02
> Statut : En cours de rédaction

---

## Table des matières

1. [Modèles de données Django](#1-modèles-de-données-django)
2. [Agents AI](#2-agents-ai)
3. [Endpoints API REST](#3-endpoints-api-rest)
4. [Vues Frontend](#4-vues-frontend)

---

## 1. Modèles de données Django

### Architecture des apps Django

```
autodev/
  ├── apps/
  │     ├── organizations/     # Organization, Membership, BillingAccount
  │     ├── projects/          # Project, Board, Column, Ticket, Comment
  │     ├── scm/               # SCMProvider, Repository, PullRequest
  │     ├── agents/            # AgentRun, AIAnalysis, ImplementationPlan
  │     ├── notifications/     # NotificationProvider, Notification, UserNotificationPreference
  │     └── users/             # User (custom), UserProfile
```

---

### 1.1 App `users`

#### `User`

Extends `AbstractUser`. Compte utilisateur principal.

```python
class User(AbstractUser):
    # --- Identité ---
    id              = UUIDField(primary_key=True, default=uuid4)
    email           = EmailField(unique=True)  # utilisé comme login principal
    full_name       = CharField(max_length=255)
    avatar_url      = URLField(blank=True, null=True)
    preferred_language = CharField(max_length=5, default='fr', choices=[('fr','Français'),('en','English')])

    # --- Auth ---
    # username hérité d'AbstractUser mais non utilisé (email-based auth)
    # password hérité d'AbstractUser

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)
    last_login_at   = DateTimeField(null=True, blank=True)

    # --- Settings ---
    preferred_notification_channel = CharField(
        max_length=20,
        default='in_app',
        choices=[('in_app','In-App'),('slack','Slack'),('email','Email')]
    )
    notify_on_agent_questions  = BooleanField(default=True)
    notify_on_plan_generated   = BooleanField(default=True)
    notify_on_pr_created       = BooleanField(default=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        db_table = 'users'
        indexes = [
            Index(fields=['email']),
        ]
```

---

### 1.2 App `organizations`

#### `Organization`

Tenant principal. Toutes les données sont scopées par organisation.

```python
class Organization(Model):
    id              = UUIDField(primary_key=True, default=uuid4)
    name            = CharField(max_length=255)
    slug            = SlugField(max_length=100, unique=True)  # pour les URLs : app.autodev.com/{slug}
    logo_url        = URLField(blank=True, null=True)

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)
    created_by      = ForeignKey('users.User', on_delete=SET_NULL, null=True, related_name='created_organizations')

    class Meta:
        db_table = 'organizations'
        indexes = [
            Index(fields=['slug']),
        ]
```

#### `Membership`

Relation N:M entre User et Organization avec rôle.

```python
class Membership(Model):
    class OrgRole(TextChoices):
        OWNER  = 'owner', 'Owner'
        ADMIN  = 'admin', 'Admin'
        MEMBER = 'member', 'Member'

    id              = UUIDField(primary_key=True, default=uuid4)
    user            = ForeignKey('users.User', on_delete=CASCADE, related_name='memberships')
    organization    = ForeignKey('Organization', on_delete=CASCADE, related_name='memberships')
    role            = CharField(max_length=20, choices=OrgRole.choices, default=OrgRole.MEMBER)

    # --- Timestamps ---
    joined_at       = DateTimeField(auto_now_add=True)
    invited_by      = ForeignKey('users.User', on_delete=SET_NULL, null=True, related_name='sent_invitations')

    class Meta:
        db_table = 'memberships'
        unique_together = [('user', 'organization')]
        indexes = [
            Index(fields=['organization', 'role']),
            Index(fields=['user']),
        ]
```

#### `BillingAccount`

Compte de facturation rattaché à une organisation (1:1).

```python
class BillingAccount(Model):
    class PlanType(TextChoices):
        FREE       = 'free', 'Free'
        STARTER    = 'starter', 'Starter'
        PRO        = 'pro', 'Pro'
        ENTERPRISE = 'enterprise', 'Enterprise'

    id              = UUIDField(primary_key=True, default=uuid4)
    organization    = OneToOneField('Organization', on_delete=CASCADE, related_name='billing_account')

    # --- Plan ---
    plan            = CharField(max_length=20, choices=PlanType.choices, default=PlanType.FREE)
    stripe_customer_id    = CharField(max_length=255, blank=True, null=True)
    stripe_subscription_id = CharField(max_length=255, blank=True, null=True)

    # --- Limites ---
    max_projects          = IntegerField(default=3)        # selon le plan
    max_members           = IntegerField(default=5)        # selon le plan
    max_ai_runs_per_month = IntegerField(default=100)      # selon le plan
    current_ai_runs_count = IntegerField(default=0)        # compteur mensuel, reset auto

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)
    current_period_start = DateTimeField(null=True)
    current_period_end   = DateTimeField(null=True)

    class Meta:
        db_table = 'billing_accounts'
```

#### `Invitation`

Invitation en attente pour rejoindre une organisation.

```python
class Invitation(Model):
    class Status(TextChoices):
        PENDING  = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        EXPIRED  = 'expired', 'Expired'
        REVOKED  = 'revoked', 'Revoked'

    id              = UUIDField(primary_key=True, default=uuid4)
    organization    = ForeignKey('Organization', on_delete=CASCADE, related_name='invitations')
    email           = EmailField()
    role            = CharField(max_length=20, choices=Membership.OrgRole.choices, default=Membership.OrgRole.MEMBER)
    is_guest        = BooleanField(default=False)  # True = Guest cross-orga
    status          = CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    token           = CharField(max_length=255, unique=True)  # token d'invitation unique

    # --- Guest : projets assignés ---
    guest_projects  = ManyToManyField('projects.Project', blank=True)  # si is_guest, projets auxquels le guest a accès
    guest_project_role = CharField(
        max_length=20,
        choices=[('member','Member'),('viewer','Viewer')],
        default='viewer'
    )

    # --- Timestamps ---
    invited_by      = ForeignKey('users.User', on_delete=SET_NULL, null=True)
    created_at      = DateTimeField(auto_now_add=True)
    expires_at      = DateTimeField()

    class Meta:
        db_table = 'invitations'
        indexes = [
            Index(fields=['email', 'organization']),
            Index(fields=['token']),
            Index(fields=['status']),
        ]
```

---

### 1.3 App `projects`

#### `Project`

Un projet au sein d'une organisation. Contient un board et des repos.

```python
class Project(Model):
    id              = UUIDField(primary_key=True, default=uuid4)
    organization    = ForeignKey('organizations.Organization', on_delete=CASCADE, related_name='projects')
    name            = CharField(max_length=255)
    slug            = SlugField(max_length=100)
    description     = TextField(blank=True, default='')
    icon            = CharField(max_length=10, blank=True, default='')  # emoji ou code icône
    color           = CharField(max_length=7, blank=True, default='#6366F1')  # couleur hex du projet

    # --- Settings agents ---
    default_target_branch    = CharField(max_length=255, default='main')
    branch_naming_template   = CharField(max_length=255, default='feature/AD-{ticket_id}-{slug}')
    pr_title_template        = CharField(max_length=255, default='[AD-{ticket_id}] {ticket_title}')
    agent_custom_instructions = TextField(blank=True, default='')  # prompt override pour les agents

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)
    created_by      = ForeignKey('users.User', on_delete=SET_NULL, null=True)

    class Meta:
        db_table = 'projects'
        unique_together = [('organization', 'slug')]
        indexes = [
            Index(fields=['organization']),
        ]
```

#### `ProjectMembership`

Rôle d'un utilisateur au sein d'un projet.

```python
class ProjectMembership(Model):
    class ProjectRole(TextChoices):
        ADMIN  = 'admin', 'Project Admin'
        MEMBER = 'member', 'Member'
        VIEWER = 'viewer', 'Viewer'

    id              = UUIDField(primary_key=True, default=uuid4)
    user            = ForeignKey('users.User', on_delete=CASCADE, related_name='project_memberships')
    project         = ForeignKey('Project', on_delete=CASCADE, related_name='memberships')
    role            = CharField(max_length=20, choices=ProjectRole.choices, default=ProjectRole.MEMBER)

    # --- Timestamps ---
    joined_at       = DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'project_memberships'
        unique_together = [('user', 'project')]
        indexes = [
            Index(fields=['project', 'role']),
        ]
```

#### `Board`

Un board Kanban par projet (1:1).

```python
class Board(Model):
    id              = UUIDField(primary_key=True, default=uuid4)
    project         = OneToOneField('Project', on_delete=CASCADE, related_name='board')

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)

    class Meta:
        db_table = 'boards'
```

#### `Column`

Colonne du board Kanban. Ordonnée.

```python
class Column(Model):
    id              = UUIDField(primary_key=True, default=uuid4)
    board           = ForeignKey('Board', on_delete=CASCADE, related_name='columns')
    name            = CharField(max_length=100)
    position        = IntegerField()  # ordre d'affichage (0, 1, 2, ...)
    color           = CharField(max_length=7, blank=True, default='#E5E7EB')

    # --- Limites ---
    wip_limit       = IntegerField(null=True, blank=True)  # limite de tickets dans la colonne (optionnel)

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)

    class Meta:
        db_table = 'columns'
        ordering = ['position']
        unique_together = [('board', 'position')]
        indexes = [
            Index(fields=['board', 'position']),
        ]
```

#### `ColumnAgentTrigger`

Configuration d'un agent déclenché quand un ticket arrive dans une colonne. Une colonne peut avoir 0, 1 ou plusieurs triggers. Chaque trigger est configurable indépendamment.

```python
class ColumnAgentTrigger(Model):
    class AgentType(TextChoices):
        CHALLENGE = 'challenge', 'Challenge Agent'
        PLAN      = 'plan', 'Plan Agent'
        CODE      = 'code', 'Code Agent'
        REVIEW    = 'review', 'Review Agent'
        FIX       = 'fix', 'Fix Agent'

    class TriggerMode(TextChoices):
        AUTO   = 'auto', 'Automatique'   # se lance dès qu'un ticket arrive dans la colonne
        MANUAL = 'manual', 'Manuel'      # bouton disponible mais pas de lancement auto

    id              = UUIDField(primary_key=True, default=uuid4)
    column          = ForeignKey('Column', on_delete=CASCADE, related_name='agent_triggers')
    agent_type      = CharField(max_length=20, choices=AgentType.choices)
    trigger_mode    = CharField(max_length=20, choices=TriggerMode.choices, default=TriggerMode.MANUAL)
    position        = IntegerField(default=0)  # ordre d'exécution si plusieurs triggers sur la même colonne

    # --- Conditions (optionnel) ---
    # Conditions à remplir pour que le trigger se lance (évaluées en AND)
    condition_challenge_approved = BooleanField(default=False)  # ne trigger que si challenge_status=approved
    condition_plan_approved      = BooleanField(default=False)  # ne trigger que si plan_status=approved
    condition_has_repos          = BooleanField(default=False)  # ne trigger que si le ticket a des repos impactés sélectionnés
    condition_pr_created         = BooleanField(default=False)  # ne trigger que si code_status=pr_created (utile pour Review)
    condition_review_done        = BooleanField(default=False)  # ne trigger que si review_status=completed (utile pour Fix)

    # --- Options ---
    notify_on_start    = BooleanField(default=False)  # notifier l'assignee quand l'agent démarre
    notify_on_complete = BooleanField(default=True)   # notifier quand l'agent a fini
    auto_move_on_complete = ForeignKey(
        'Column', on_delete=SET_NULL, null=True, blank=True,
        related_name='incoming_auto_moves'
    )  # déplacer automatiquement le ticket dans cette colonne quand l'agent a terminé avec succès

    is_active       = BooleanField(default=True)  # permet de désactiver un trigger sans le supprimer

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)

    class Meta:
        db_table = 'column_agent_triggers'
        ordering = ['position']
        unique_together = [('column', 'agent_type')]  # un seul trigger par type d'agent par colonne
        indexes = [
            Index(fields=['column', 'is_active']),
        ]
```

#### `Ticket`

Ticket / carte du Kanban. Entité centrale du produit.

```python
class Ticket(Model):
    class Priority(TextChoices):
        NONE     = 'none', 'None'
        LOW      = 'low', 'Low'
        MEDIUM   = 'medium', 'Medium'
        HIGH     = 'high', 'High'
        URGENT   = 'urgent', 'Urgent'

    class ChallengeStatus(TextChoices):
        NOT_STARTED       = 'not_started', 'Not Started'
        IN_PROGRESS       = 'in_progress', 'In Progress'
        WAITING_FOR_INPUT = 'waiting_for_input', 'Waiting for Input'
        APPROVED          = 'approved', 'Approved'
        FAILED            = 'failed', 'Failed'

    class PlanStatus(TextChoices):
        NOT_STARTED = 'not_started', 'Not Started'
        IN_PROGRESS = 'in_progress', 'In Progress'
        GENERATED   = 'generated', 'Generated'
        APPROVED    = 'approved', 'Approved'
        REJECTED    = 'rejected', 'Rejected'

    class CodeStatus(TextChoices):
        NOT_STARTED = 'not_started', 'Not Started'
        IN_PROGRESS = 'in_progress', 'In Progress'
        PR_CREATED  = 'pr_created', 'PR Created'
        PR_MERGED   = 'pr_merged', 'PR Merged'
        FAILED      = 'failed', 'Failed'

    class ReviewStatus(TextChoices):
        NOT_STARTED = 'not_started', 'Not Started'
        IN_PROGRESS = 'in_progress', 'In Progress'
        APPROVED    = 'approved', 'Approved'           # code OK, pas de fix nécessaire
        CHANGES_REQUESTED = 'changes_requested', 'Changes Requested'  # des problèmes identifiés
        FAILED      = 'failed', 'Failed'

    class FixStatus(TextChoices):
        NOT_STARTED = 'not_started', 'Not Started'
        IN_PROGRESS = 'in_progress', 'In Progress'
        FIXED       = 'fixed', 'Fixed'                # fix appliqué, PR mise à jour
        FAILED      = 'failed', 'Failed'

    id              = UUIDField(primary_key=True, default=uuid4)
    column          = ForeignKey('Column', on_delete=CASCADE, related_name='tickets')
    project         = ForeignKey('Project', on_delete=CASCADE, related_name='tickets')  # dénormalisé pour les queries

    # --- Contenu ---
    ticket_key      = CharField(max_length=20, unique=True)  # ex: AD-42, généré auto
    title           = CharField(max_length=500)
    description     = TextField(blank=True, default='')  # Markdown
    acceptance_criteria = TextField(blank=True, default='')  # Markdown
    priority        = CharField(max_length=20, choices=Priority.choices, default=Priority.NONE)
    position        = IntegerField()  # ordre dans la colonne

    # --- Assignation ---
    created_by      = ForeignKey('users.User', on_delete=SET_NULL, null=True, related_name='created_tickets')
    assigned_to     = ForeignKey('users.User', on_delete=SET_NULL, null=True, blank=True, related_name='assigned_tickets')

    # --- Repos impactés ---
    impacted_repos  = ManyToManyField('scm.Repository', blank=True, related_name='tickets')

    # --- Statuts agents ---
    challenge_status = CharField(max_length=30, choices=ChallengeStatus.choices, default=ChallengeStatus.NOT_STARTED)
    plan_status      = CharField(max_length=30, choices=PlanStatus.choices, default=PlanStatus.NOT_STARTED)
    code_status      = CharField(max_length=30, choices=CodeStatus.choices, default=CodeStatus.NOT_STARTED)
    review_status    = CharField(max_length=30, choices=ReviewStatus.choices, default=ReviewStatus.NOT_STARTED)
    fix_status       = CharField(max_length=30, choices=FixStatus.choices, default=FixStatus.NOT_STARTED)

    # --- Estimation ---
    estimated_complexity = CharField(
        max_length=10, blank=True, null=True,
        choices=[('xs','XS'),('s','S'),('m','M'),('l','L'),('xl','XL')]
    )

    # --- Labels ---
    labels          = ManyToManyField('Label', blank=True, related_name='tickets')

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tickets'
        ordering = ['position']
        indexes = [
            Index(fields=['project', 'column']),
            Index(fields=['ticket_key']),
            Index(fields=['assigned_to']),
            Index(fields=['challenge_status']),
            Index(fields=['plan_status']),
            Index(fields=['code_status']),
            Index(fields=['review_status']),
            Index(fields=['fix_status']),
            Index(fields=['created_at']),
        ]
```

#### `Label`

Labels / tags pour les tickets.

```python
class Label(Model):
    id              = UUIDField(primary_key=True, default=uuid4)
    project         = ForeignKey('Project', on_delete=CASCADE, related_name='labels')
    name            = CharField(max_length=50)
    color           = CharField(max_length=7, default='#6366F1')

    class Meta:
        db_table = 'labels'
        unique_together = [('project', 'name')]
```

#### `Comment`

Commentaires sur un ticket. Utilisés aussi par les agents AI pour poser des questions.

```python
class Comment(Model):
    class AuthorType(TextChoices):
        HUMAN = 'human', 'Human'
        AGENT = 'agent', 'Agent'

    id              = UUIDField(primary_key=True, default=uuid4)
    ticket          = ForeignKey('Ticket', on_delete=CASCADE, related_name='comments')
    author          = ForeignKey('users.User', on_delete=SET_NULL, null=True, blank=True)  # null si agent
    author_type     = CharField(max_length=10, choices=AuthorType.choices, default=AuthorType.HUMAN)
    agent_type      = CharField(max_length=20, blank=True, null=True)  # 'challenge', 'plan', 'code' si author_type=agent

    # --- Contenu ---
    body            = TextField()  # Markdown
    is_question     = BooleanField(default=False)  # True si c'est une question de l'agent
    is_resolved     = BooleanField(default=False)  # True si la question a reçu une réponse
    parent          = ForeignKey('self', on_delete=CASCADE, null=True, blank=True, related_name='replies')  # réponse à un commentaire

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)

    class Meta:
        db_table = 'comments'
        ordering = ['created_at']
        indexes = [
            Index(fields=['ticket', 'created_at']),
            Index(fields=['is_question', 'is_resolved']),
        ]
```

---

### 1.4 App `scm`

#### `SCMConnection`

Connexion à une forge Git au niveau organisation.

```python
class SCMConnection(Model):
    class ProviderType(TextChoices):
        GITHUB    = 'github', 'GitHub'
        BITBUCKET = 'bitbucket', 'Bitbucket'
        GITLAB    = 'gitlab', 'GitLab'

    id              = UUIDField(primary_key=True, default=uuid4)
    organization    = ForeignKey('organizations.Organization', on_delete=CASCADE, related_name='scm_connections')
    provider_type   = CharField(max_length=20, choices=ProviderType.choices)

    # --- Credentials ---
    # GitHub : installation_id de la GitHub App
    # Bitbucket : OAuth consumer key/secret
    # GitLab : OAuth application ou personal access token
    installation_id    = CharField(max_length=255, blank=True, null=True)  # GitHub App
    access_token       = TextField(blank=True, null=True)  # chiffré en DB
    refresh_token      = TextField(blank=True, null=True)  # chiffré en DB
    token_expires_at   = DateTimeField(null=True, blank=True)

    # --- Metadata ---
    external_org_name  = CharField(max_length=255, blank=True, default='')  # nom de l'org sur la forge
    external_org_id    = CharField(max_length=255, blank=True, default='')

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)
    connected_by    = ForeignKey('users.User', on_delete=SET_NULL, null=True)

    class Meta:
        db_table = 'scm_connections'
        indexes = [
            Index(fields=['organization', 'provider_type']),
        ]
```

#### `Repository`

Repo Git découvert via une SCM Connection. **Appartient à l'organisation**, pas au projet. Un même repo peut être utilisé par plusieurs projets.

```python
class Repository(Model):
    id              = UUIDField(primary_key=True, default=uuid4)
    organization    = ForeignKey('organizations.Organization', on_delete=CASCADE, related_name='repositories')
    scm_connection  = ForeignKey('SCMConnection', on_delete=CASCADE, related_name='repositories')

    # --- Identité du repo ---
    name            = CharField(max_length=255)  # ex: "autodev-api"
    full_name       = CharField(max_length=500)  # ex: "acme-corp/autodev-api"
    external_id     = CharField(max_length=255)  # ID sur la forge
    clone_url       = URLField()
    default_branch  = CharField(max_length=255, default='main')
    html_url        = URLField(blank=True, default='')  # URL web du repo

    # --- Indexation ---
    last_indexed_at     = DateTimeField(null=True, blank=True)
    last_indexed_commit = CharField(max_length=40, blank=True, default='')  # SHA du dernier commit indexé
    indexing_status     = CharField(
        max_length=20, default='pending',
        choices=[('pending','Pending'),('indexing','Indexing'),('indexed','Indexed'),('failed','Failed')]
    )

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)
    added_by        = ForeignKey('users.User', on_delete=SET_NULL, null=True)

    class Meta:
        db_table = 'repositories'
        unique_together = [('organization', 'scm_connection', 'external_id')]
        indexes = [
            Index(fields=['organization']),
            Index(fields=['scm_connection']),
            Index(fields=['indexing_status']),
        ]
```

#### `ProjectRepository`

Liaison N:M entre un projet et les repos qu'il utilise. Un repo peut appartenir à plusieurs projets, un projet peut utiliser des repos de forges différentes.

```python
class ProjectRepository(Model):
    id              = UUIDField(primary_key=True, default=uuid4)
    project         = ForeignKey('projects.Project', on_delete=CASCADE, related_name='project_repositories')
    repository      = ForeignKey('Repository', on_delete=CASCADE, related_name='project_links')

    # --- Overrides par projet (optionnel) ---
    target_branch_override = CharField(max_length=255, blank=True, null=True)  # override la branche cible du projet pour ce repo spécifique

    # --- Timestamps ---
    linked_at       = DateTimeField(auto_now_add=True)
    linked_by       = ForeignKey('users.User', on_delete=SET_NULL, null=True)

    class Meta:
        db_table = 'project_repositories'
        unique_together = [('project', 'repository')]
        indexes = [
            Index(fields=['project']),
            Index(fields=['repository']),
        ]
```

#### `CodeEmbedding`

Embeddings du code source pour l'analyse AI (stocké dans pgvector).

```python
from pgvector.django import VectorField

class CodeEmbedding(Model):
    id              = UUIDField(primary_key=True, default=uuid4)
    repository      = ForeignKey('Repository', on_delete=CASCADE, related_name='embeddings')

    # --- Référence fichier ---
    file_path       = CharField(max_length=1000)  # ex: "src/api/views/users.py"
    chunk_index     = IntegerField()  # index du chunk dans le fichier
    chunk_content   = TextField()  # contenu brut du chunk de code
    start_line      = IntegerField()
    end_line        = IntegerField()

    # --- Embedding ---
    embedding       = VectorField(dimensions=1536)  # dimension selon le modèle d'embedding

    # --- Metadata ---
    language        = CharField(max_length=50, blank=True, default='')  # python, javascript, etc.
    commit_sha      = CharField(max_length=40)

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'code_embeddings'
        indexes = [
            Index(fields=['repository', 'file_path']),
            # Index ivfflat ou hnsw sur embedding — créé via migration SQL brute
        ]
```

#### `PullRequest`

Pull Request créée par l'agent Code sur un repo.

```python
class PullRequest(Model):
    class Status(TextChoices):
        DRAFT    = 'draft', 'Draft'
        OPEN     = 'open', 'Open'
        MERGED   = 'merged', 'Merged'
        CLOSED   = 'closed', 'Closed'

    id              = UUIDField(primary_key=True, default=uuid4)
    ticket          = ForeignKey('projects.Ticket', on_delete=CASCADE, related_name='pull_requests')
    repository      = ForeignKey('Repository', on_delete=CASCADE, related_name='pull_requests')

    # --- Identité PR ---
    external_id     = CharField(max_length=255)  # ID/number sur la forge
    external_url    = URLField()  # URL web de la PR
    title           = CharField(max_length=500)
    branch_name     = CharField(max_length=255)
    target_branch   = CharField(max_length=255)
    status          = CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    # --- Stats ---
    additions       = IntegerField(default=0)
    deletions       = IntegerField(default=0)
    files_changed   = IntegerField(default=0)

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)
    merged_at       = DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'pull_requests'
        indexes = [
            Index(fields=['ticket']),
            Index(fields=['repository']),
            Index(fields=['status']),
        ]
```

---

### 1.5 App `agents`

#### `AgentRun`

Chaque exécution d'un agent (challenge, plan, code) est tracée.

```python
class AgentRun(Model):
    class AgentType(TextChoices):
        CHALLENGE = 'challenge', 'Challenge Agent'
        PLAN      = 'plan', 'Plan Agent'
        CODE      = 'code', 'Code Agent'
        REVIEW    = 'review', 'Review Agent'
        FIX       = 'fix', 'Fix Agent'

    class Status(TextChoices):
        QUEUED      = 'queued', 'Queued'
        RUNNING     = 'running', 'Running'
        WAITING     = 'waiting', 'Waiting for Input'
        COMPLETED   = 'completed', 'Completed'
        FAILED      = 'failed', 'Failed'
        CANCELLED   = 'cancelled', 'Cancelled'

    id              = UUIDField(primary_key=True, default=uuid4)
    ticket          = ForeignKey('projects.Ticket', on_delete=CASCADE, related_name='agent_runs')
    agent_type      = CharField(max_length=20, choices=AgentType.choices)
    status          = CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)

    # --- Execution ---
    triggered_by    = ForeignKey('users.User', on_delete=SET_NULL, null=True)  # null si auto-trigger
    auto_triggered  = BooleanField(default=False)

    # --- LLM Usage (agrégé de tous les steps) ---
    total_input_tokens  = IntegerField(default=0)
    total_output_tokens = IntegerField(default=0)
    total_cost_usd  = DecimalField(max_digits=10, decimal_places=6, default=0)
    total_steps     = IntegerField(default=0)

    # --- Résultat ---
    result_summary  = TextField(blank=True, default='')  # résumé court du résultat
    error_message   = TextField(blank=True, default='')  # si failed

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    started_at      = DateTimeField(null=True, blank=True)
    completed_at    = DateTimeField(null=True, blank=True)
    duration_seconds = IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'agent_runs'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['ticket', 'agent_type']),
            Index(fields=['status']),
            Index(fields=['created_at']),
        ]
```

#### `AgentRunStep`

Chaque appel LLM individuel au sein d'un run. Un agent peut faire plusieurs appels (recherche de contexte, analyse, reformulation, etc.). Chaque step stocke le prompt envoyé et la réponse reçue.

```python
class AgentRunStep(Model):
    class StepType(TextChoices):
        CONTEXT_RETRIEVAL = 'context_retrieval', 'Recherche de contexte'  # récupération des fichiers pertinents
        ANALYSIS          = 'analysis', 'Analyse'                        # analyse principale
        QUESTION_GEN      = 'question_gen', 'Génération de questions'    # formulation des questions
        PLAN_GEN          = 'plan_gen', 'Génération de plan'             # génération du plan d'implémentation
        CODE_GEN          = 'code_gen', 'Génération de code'             # écriture du code
        CODE_REVIEW       = 'code_review', 'Revue de code'              # review du code généré
        REVIEW_ANALYSIS   = 'review_analysis', 'Analyse de review'      # identification des problèmes dans le code
        FIX_GEN           = 'fix_gen', 'Génération de fix'              # écriture du code de correction
        REFINEMENT        = 'refinement', 'Raffinement'                  # itération / correction

    id              = UUIDField(primary_key=True, default=uuid4)
    agent_run       = ForeignKey('AgentRun', on_delete=CASCADE, related_name='steps')
    position        = IntegerField()  # ordre d'exécution (0, 1, 2, ...)
    step_type       = CharField(max_length=30, choices=StepType.choices)
    name            = CharField(max_length=255)  # nom lisible du step (ex: "Analyse de complétude du ticket")

    # --- Prompt & Réponse ---
    system_prompt   = TextField()          # system prompt envoyé au LLM
    user_prompt     = TextField()          # user prompt envoyé au LLM (contient le ticket, le code, etc.)
    raw_response    = TextField()          # réponse brute du LLM
    parsed_result   = JSONField(default=dict, blank=True)  # réponse parsée en JSON structuré (si applicable)

    # --- Modèle utilisé ---
    model_used      = CharField(max_length=100, default='claude-sonnet-4-20250514')
    input_tokens    = IntegerField(default=0)
    output_tokens   = IntegerField(default=0)
    cost_usd        = DecimalField(max_digits=10, decimal_places=6, default=0)

    # --- Statut ---
    is_success      = BooleanField(default=True)
    error_message   = TextField(blank=True, default='')

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    duration_ms     = IntegerField(null=True, blank=True)  # durée de l'appel LLM en millisecondes

    class Meta:
        db_table = 'agent_run_steps'
        ordering = ['position']
        indexes = [
            Index(fields=['agent_run', 'position']),
            Index(fields=['step_type']),
        ]
```

#### `AIAnalysis`

Résultat du Challenge Agent.

```python
class AIAnalysis(Model):
    id              = UUIDField(primary_key=True, default=uuid4)
    agent_run       = OneToOneField('AgentRun', on_delete=CASCADE, related_name='analysis')
    ticket          = ForeignKey('projects.Ticket', on_delete=CASCADE, related_name='analyses')

    # --- Analyse ---
    completeness_score = IntegerField()  # 0-100, score de complétude du ticket
    summary         = TextField()  # résumé de l'analyse en Markdown
    strengths       = JSONField(default=list)  # liste de points forts du ticket
    weaknesses      = JSONField(default=list)  # liste de faiblesses / manques
    suggestions     = JSONField(default=list)  # suggestions d'amélioration
    questions       = JSONField(default=list)  # questions ouvertes pour le porteur du besoin

    # --- Verdict ---
    is_approved     = BooleanField(default=False)  # True si le ticket est suffisamment détaillé
    requires_input  = BooleanField(default=False)  # True si des questions ont été posées

    # --- Contexte utilisé ---
    relevant_files  = JSONField(default=list)  # fichiers de la codebase pertinents identifiés

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_analyses'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['ticket']),
        ]
```

#### `ImplementationPlan`

Plan d'implémentation généré par le Plan Agent.

```python
class ImplementationPlan(Model):
    id              = UUIDField(primary_key=True, default=uuid4)
    agent_run       = OneToOneField('AgentRun', on_delete=CASCADE, related_name='plan')
    ticket          = ForeignKey('projects.Ticket', on_delete=CASCADE, related_name='plans')

    # --- Plan global ---
    summary         = TextField()  # résumé du plan en Markdown
    estimated_complexity = CharField(
        max_length=10,
        choices=[('xs','XS'),('s','S'),('m','M'),('l','L'),('xl','XL')]
    )
    estimated_hours = DecimalField(max_digits=5, decimal_places=1, null=True)

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    approved_at     = DateTimeField(null=True, blank=True)
    approved_by     = ForeignKey('users.User', on_delete=SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'implementation_plans'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['ticket']),
        ]
```

#### `PlanStep`

Étape individuelle d'un plan d'implémentation, scopée par repo.

```python
class PlanStep(Model):
    class StepType(TextChoices):
        BACKEND  = 'backend', 'Backend'
        FRONTEND = 'frontend', 'Frontend'
        TEST     = 'test', 'Test'
        MIGRATION = 'migration', 'Migration'
        CONFIG   = 'config', 'Config'
        DOCS     = 'docs', 'Documentation'

    id              = UUIDField(primary_key=True, default=uuid4)
    plan            = ForeignKey('ImplementationPlan', on_delete=CASCADE, related_name='steps')
    repository      = ForeignKey('scm.Repository', on_delete=CASCADE, related_name='plan_steps')

    # --- Contenu ---
    position        = IntegerField()
    step_type       = CharField(max_length=20, choices=StepType.choices)
    title           = CharField(max_length=500)
    description     = TextField()  # Markdown
    files_to_modify = JSONField(default=list)  # ex: ["src/api/views.py", "src/api/serializers.py"]
    files_to_create = JSONField(default=list)  # ex: ["src/api/views/profile.py"]

    class Meta:
        db_table = 'plan_steps'
        ordering = ['position']
        indexes = [
            Index(fields=['plan', 'position']),
            Index(fields=['repository']),
        ]
```

#### `ReviewResult`

Résultat du Review Agent. Contient le verdict global et les findings détaillés.

```python
class ReviewResult(Model):
    id              = UUIDField(primary_key=True, default=uuid4)
    agent_run       = OneToOneField('AgentRun', on_delete=CASCADE, related_name='review_result')
    ticket          = ForeignKey('projects.Ticket', on_delete=CASCADE, related_name='reviews')
    pull_request    = ForeignKey('scm.PullRequest', on_delete=CASCADE, related_name='reviews')

    # --- Verdict ---
    is_approved     = BooleanField(default=False)  # True si aucun finding critical/major
    summary         = TextField()  # résumé de la review en Markdown
    plan_conformity_score = IntegerField(null=True, blank=True)  # 0-100, conformité au plan (si applicable)

    # --- Stats ---
    total_findings      = IntegerField(default=0)
    critical_count      = IntegerField(default=0)
    major_count         = IntegerField(default=0)
    minor_count         = IntegerField(default=0)
    suggestion_count    = IntegerField(default=0)

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'review_results'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['ticket']),
            Index(fields=['pull_request']),
        ]
```

#### `ReviewFinding`

Finding individuel identifié par le Review Agent.

```python
class ReviewFinding(Model):
    class Severity(TextChoices):
        CRITICAL   = 'critical', 'Critical'
        MAJOR      = 'major', 'Major'
        MINOR      = 'minor', 'Minor'
        SUGGESTION = 'suggestion', 'Suggestion'

    class Category(TextChoices):
        BUG          = 'bug', 'Bug potentiel'
        SECURITY     = 'security', 'Sécurité'
        PERFORMANCE  = 'performance', 'Performance'
        STYLE        = 'style', 'Style / Convention'
        TEST         = 'test', 'Tests manquants'
        PLAN_DRIFT   = 'plan_drift', 'Non-conformité au plan'
        LOGIC        = 'logic', 'Erreur de logique'

    class FixStatus(TextChoices):
        OPEN    = 'open', 'Open'
        FIXED   = 'fixed', 'Fixed'
        WONTFIX = 'wontfix', 'Won\'t Fix'
        IGNORED = 'ignored', 'Ignored'

    id              = UUIDField(primary_key=True, default=uuid4)
    review_result   = ForeignKey('ReviewResult', on_delete=CASCADE, related_name='findings')

    # --- Localisation ---
    file_path       = CharField(max_length=1000)
    start_line      = IntegerField(null=True, blank=True)
    end_line        = IntegerField(null=True, blank=True)

    # --- Contenu ---
    severity        = CharField(max_length=20, choices=Severity.choices)
    category        = CharField(max_length=20, choices=Category.choices)
    title           = CharField(max_length=500)
    description     = TextField()  # Markdown
    suggested_fix   = TextField(blank=True, default='')  # suggestion de correction

    # --- Fix tracking ---
    fix_status      = CharField(max_length=20, choices=FixStatus.choices, default=FixStatus.OPEN)
    fixed_by_run    = ForeignKey('AgentRun', on_delete=SET_NULL, null=True, blank=True, related_name='fixed_findings')  # lien vers le run du Fix Agent

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'review_findings'
        ordering = ['severity', 'file_path', 'start_line']
        indexes = [
            Index(fields=['review_result', 'severity']),
            Index(fields=['fix_status']),
        ]
```

---

### 1.6 App `notifications`

#### `NotificationChannel`

Configuration d'un canal de notification au niveau orga. Le canal IN_APP est créé automatiquement à la création de l'orga et ne peut pas être supprimé.

```python
class NotificationChannel(Model):
    class ChannelType(TextChoices):
        IN_APP = 'in_app', 'In-App'
        SLACK  = 'slack', 'Slack'
        EMAIL  = 'email', 'Email'

    id              = UUIDField(primary_key=True, default=uuid4)
    organization    = ForeignKey('organizations.Organization', on_delete=CASCADE, related_name='notification_channels')
    channel_type    = CharField(max_length=20, choices=ChannelType.choices)
    is_active       = BooleanField(default=True)
    is_default      = BooleanField(default=False)  # canal par défaut pour les notifications des agents
    is_deletable    = BooleanField(default=True)   # False pour IN_APP, empêche la suppression

    # --- Config Slack ---
    slack_workspace_id  = CharField(max_length=255, blank=True, null=True)
    slack_bot_token     = TextField(blank=True, null=True)  # chiffré
    slack_webhook_url   = URLField(blank=True, null=True)

    # --- Config Email ---
    email_provider      = CharField(max_length=50, blank=True, null=True)  # sendgrid, ses, smtp
    email_config        = JSONField(default=dict, blank=True)  # config spécifique au provider

    # --- Config In-App ---
    # Pas de config externe nécessaire, le canal fonctionne nativement

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notification_channels'
        unique_together = [('organization', 'channel_type')]
```

#### `Notification`

Notification individuelle envoyée à un utilisateur.

```python
class Notification(Model):
    class NotifType(TextChoices):
        AGENT_QUESTION     = 'agent_question', 'Agent Question'
        AGENT_COMPLETED    = 'agent_completed', 'Agent Completed'
        PLAN_GENERATED     = 'plan_generated', 'Plan Generated'
        PR_CREATED         = 'pr_created', 'PR Created'
        PR_MERGED          = 'pr_merged', 'PR Merged'
        REVIEW_COMPLETED   = 'review_completed', 'Review Completed'
        REVIEW_APPROVED    = 'review_approved', 'Review Approved'
        REVIEW_CHANGES     = 'review_changes', 'Changes Requested'
        FIX_APPLIED        = 'fix_applied', 'Fix Applied'
        TICKET_ASSIGNED    = 'ticket_assigned', 'Ticket Assigned'
        MENTION            = 'mention', 'Mention'
        INVITATION         = 'invitation', 'Invitation'

    id              = UUIDField(primary_key=True, default=uuid4)
    user            = ForeignKey('users.User', on_delete=CASCADE, related_name='notifications')
    notification_type = CharField(max_length=30, choices=NotifType.choices)

    # --- Contenu ---
    title           = CharField(max_length=500)
    body            = TextField()
    action_url      = URLField(blank=True, null=True)  # lien vers le ticket/PR/plan

    # --- Contexte ---
    ticket          = ForeignKey('projects.Ticket', on_delete=CASCADE, null=True, blank=True)
    agent_run       = ForeignKey('agents.AgentRun', on_delete=CASCADE, null=True, blank=True)

    # --- Statut ---
    is_read         = BooleanField(default=False)
    read_at         = DateTimeField(null=True, blank=True)

    # --- Delivery ---
    channels_sent   = JSONField(default=list)  # ['in_app', 'slack', 'email']

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['user', 'is_read', 'created_at']),
            Index(fields=['ticket']),
        ]
```

---

## 2. Agents AI

### 2.1 Architecture du service Agent

```
┌─────────────────────────────────────────────────────────────┐
│                    Django Backend (API)                       │
│                                                              │
│  Ticket créé/déplacé  ──►  Celery Task  ──►  Redis Queue     │
└──────────────────────────────────┬───────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Agent Service (Python)                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Challenge    │  │  Plan        │  │  Code        │       │
│  │  Agent        │  │  Agent       │  │  Agent       │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         ▼                 ▼                 ▼                │
│  ┌─────────────────────────────────────────────────┐        │
│  │           LLM Gateway (Anthropic API)            │        │
│  └─────────────────────────────────────────────────┘        │
│         │                 │                                  │
│         ▼                 ▼                                  │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  pgvector     │  │  SCMProvider  │                         │
│  │  (embeddings) │  │  (Git ops)    │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Challenge Agent

**But** : Évaluer si un ticket est suffisamment détaillé et clair pour être implémenté.

**Input** :
- Titre + description + critères d'acceptation du ticket
- Fichiers pertinents de la codebase (via recherche vectorielle pgvector)
- Instructions custom du projet (`agent_custom_instructions`)

**Processus** :
1. Récupérer le ticket et ses métadonnées
2. Rechercher les fichiers de code pertinents via embedding similarity (top 20 chunks)
3. Construire le prompt avec le contexte
4. Appel LLM : analyser la complétude, identifier ambiguïtés, scorer
5. Si score < seuil ou ambiguïtés détectées :
   - Générer des questions structurées
   - Créer des commentaires `is_question=True` sur le ticket
   - Envoyer notification au `created_by` du ticket
   - Passer le ticket en `waiting_for_input`
6. Si score OK :
   - Passer le ticket en `challenge_status=approved`
   - Créer l'AIAnalysis

**Output** : `AIAnalysis` avec score, forces, faiblesses, suggestions, questions

**Prompt system (template)** :
```
Tu es un tech lead senior qui review les tickets avant implémentation.
Contexte du projet : {agent_custom_instructions}
Codebase pertinente : {relevant_code_chunks}

Analyse ce ticket et évalue :
1. La clarté du besoin (est-ce qu'un dev comprend ce qu'il faut faire ?)
2. La complétude (manque-t-il des critères d'acceptation ?)
3. La faisabilité (est-ce cohérent avec la codebase existante ?)
4. Les edge cases non mentionnés
5. Les dépendances potentielles avec d'autres parties du code

Donne un score de complétude sur 100.
Si < 70 : formule des questions précises pour le porteur du besoin.
```

### 2.3 Plan Agent

**But** : Proposer un plan d'implémentation détaillé, découpé par repo et par type (front/back/test).

**Input** :
- Ticket validé (challenge_status=approved)
- AIAnalysis du Challenge Agent
- Repos impactés sélectionnés sur le ticket
- Codebase indexée de chaque repo impacté
- Instructions custom du projet

**Processus** :
1. Récupérer le ticket, l'analyse, et les repos impactés
2. Pour chaque repo : rechercher les fichiers pertinents via pgvector
3. Construire le prompt avec le contexte multi-repo
4. Appel LLM : générer le plan d'implémentation
5. Parser la réponse en `PlanStep` par repo
6. Créer l'`ImplementationPlan` et ses `PlanStep`
7. Passer le ticket en `plan_status=generated`
8. Notifier l'assignee ou le créateur du ticket

**Output** : `ImplementationPlan` avec N `PlanStep` (chacun lié à un repo)

**Prompt system (template)** :
```
Tu es un architecte logiciel senior. Tu dois proposer un plan d'implémentation détaillé.
Contexte du projet : {agent_custom_instructions}

Ticket : {ticket_title} — {ticket_description}
Analyse du besoin : {ai_analysis_summary}

Repos impactés :
{for each repo: repo_name, relevant_code_chunks, tech_stack_detected}

Pour chaque repo impacté, détaille :
- Les fichiers à modifier (avec le chemin exact)
- Les fichiers à créer
- Le type d'action : backend / frontend / test / migration / config / docs
- Les étapes dans l'ordre logique d'implémentation

Estime la complexité globale (XS/S/M/L/XL) et le temps en heures.
```

### 2.4 Code Agent

**But** : Générer le code et créer des Pull Requests sur les repos impactés.

**Input** :
- `ImplementationPlan` validé (approved_by non null)
- `PlanStep` pour chaque repo
- Codebase complète des fichiers à modifier
- Conventions du projet (branch naming, PR title template)

**Processus** :
1. Récupérer le plan validé et ses steps
2. Pour chaque repo impacté :
   a. Cloner/pull le repo (branche cible)
   b. Créer la branche selon le template (`feature/AD-{ticket_id}-{slug}`)
   c. Pour chaque PlanStep du repo :
      - Lire les fichiers existants à modifier
      - Appel LLM : générer le code modifié / nouveau
      - Écrire les fichiers
   d. Committer les changements
   e. Pusher la branche
   f. Créer la PR via SCMProvider
   g. Créer l'entité `PullRequest` en DB
3. Passer le ticket en `code_status=pr_created`
4. Notifier le créateur et l'assignee

**Output** : 1 `PullRequest` par repo impacté

**Sécurité** : Le Code Agent ne merge jamais — la PR est toujours soumise à revue humaine.

### 2.5 Review Agent

**But** : Analyser le code produit par le Code Agent (ou un humain) et identifier les problèmes de qualité, bugs potentiels, incohérences avec le plan, et violations des conventions du projet.

**Input** :
- Pull Request(s) créée(s) sur le ticket
- Diff de la PR (fichiers modifiés/ajoutés)
- Plan d'implémentation (si disponible, pour vérifier la conformité)
- Codebase existante (pour vérifier la cohérence)
- Instructions custom du projet (`agent_custom_instructions`)

**Processus** :
1. Récupérer les PRs du ticket et leurs diffs via SCMProvider
2. Pour chaque PR / repo :
   a. Lire le diff complet
   b. Charger les fichiers de contexte autour des modifications
   c. Si un plan existe : comparer la PR au plan (tous les steps sont-ils couverts ?)
   d. Appel LLM : analyser la qualité du code
3. Générer un `ReviewResult` avec les findings catégorisés
4. Poster les commentaires de review sur la PR via SCMProvider (inline comments sur les lignes concernées)
5. Poster un résumé en commentaire sur le ticket
6. Si aucun problème : passer le ticket en `review_status=approved`
7. Si problèmes trouvés : passer en `review_status=changes_requested`
8. Notifier l'assignee

**Output** : `ReviewResult` avec findings catégorisés + commentaires sur la PR

**Prompt system (template)** :
```
Tu es un senior code reviewer exigeant mais bienveillant.
Contexte du projet : {agent_custom_instructions}
Plan d'implémentation attendu : {implementation_plan}

Analyse ce diff et évalue :
1. Conformité au plan (si applicable) : tous les steps sont-ils implémentés ?
2. Bugs potentiels et edge cases non gérés
3. Qualité du code : lisibilité, nommage, structure
4. Sécurité : injections, données sensibles, authentification
5. Performance : requêtes N+1, algorithmes inefficaces
6. Tests : couverture suffisante, cas limites testés

Pour chaque problème trouvé, indique :
- Sévérité : critical / major / minor / suggestion
- Fichier et ligne(s) concernée(s)
- Description du problème
- Suggestion de fix
```

### 2.6 Fix Agent

**But** : Implémenter automatiquement les corrections identifiées par le Review Agent.

**Input** :
- `ReviewResult` avec les findings
- PR existante (branche déjà créée par le Code Agent)
- Diff actuel de la PR
- Codebase du repo

**Processus** :
1. Récupérer le ReviewResult et filtrer les findings `critical` et `major` (les `minor` et `suggestion` sont optionnels, configurable)
2. Pour chaque repo / PR impactée :
   a. Checkout la branche existante de la PR
   b. Pour chaque finding à corriger :
      - Lire le fichier concerné
      - Appel LLM : générer le fix en tenant compte du contexte et de la suggestion du Review Agent
      - Écrire le fichier corrigé
   c. Committer les corrections (message: `fix: address review findings for AD-{ticket_id}`)
   d. Pusher sur la même branche (la PR se met à jour automatiquement)
3. Passer le ticket en `fix_status=fixed`
4. Optionnel : relancer le Review Agent automatiquement pour valider les fixes (boucle configurable, max N itérations)
5. Notifier l'assignee

**Output** : Commits de correction poussés sur la branche de la PR existante

**Sécurité** : Le Fix Agent ne fixe que les findings identifiés par le Review Agent. Il ne modifie pas d'autres fichiers. Une limite d'itérations review→fix est configurable pour éviter les boucles infinies (défaut : 3 itérations max).

**Prompt system (template)** :
```
Tu es un développeur senior qui corrige des problèmes identifiés en code review.
Contexte du projet : {agent_custom_instructions}

Problème à corriger :
- Sévérité : {severity}
- Fichier : {file_path}, ligne(s) {lines}
- Description : {finding_description}
- Suggestion du reviewer : {suggested_fix}

Code actuel du fichier :
{file_content}

Applique la correction demandée en respectant :
- Le style du code existant
- Les conventions du projet
- Ne modifie que ce qui est nécessaire pour corriger ce problème spécifique
```

### 2.7 Indexation de la codebase

**Processus d'indexation** (tâche Celery récurrente ou déclenchée par webhook push) :

1. Cloner ou pull le repo
2. Parcourir les fichiers source (filtrer par extension : .py, .js, .ts, .jsx, .tsx, .vue, .go, .rs, .java, etc.)
3. Ignorer les fichiers non pertinents (.gitignore, node_modules, __pycache__, fichiers binaires, etc.)
4. Découper chaque fichier en chunks (stratégie : par fonction/classe pour les langages qui le permettent, sinon par blocs de ~100 lignes avec overlap de 20 lignes)
5. Générer un embedding par chunk (modèle : `text-embedding-3-small` ou équivalent)
6. Stocker dans `CodeEmbedding` avec pgvector
7. Mettre à jour `Repository.last_indexed_at` et `last_indexed_commit`

**Indexation incrémentale** : sur webhook push, ne réindexer que les fichiers modifiés (diff entre `last_indexed_commit` et le nouveau HEAD).

---

## 3. Endpoints API REST

### 3.0 Conventions

- Base URL : `/api/v1/`
- Auth : Bearer token (JWT)
- Format : JSON
- Pagination : cursor-based (`?cursor=xxx&limit=20`)
- Scope : toutes les routes sont scopées par organisation (`/api/v1/orgs/{org_slug}/...`)
- Erreurs : format standard `{ "error": { "code": "...", "message": "..." } }`

### 3.1 Auth

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/v1/auth/register` | Inscription (email + password) |
| POST | `/api/v1/auth/login` | Login → retourne JWT access + refresh |
| POST | `/api/v1/auth/refresh` | Refresh du JWT |
| POST | `/api/v1/auth/logout` | Invalidation du refresh token |
| GET  | `/api/v1/auth/github/callback` | OAuth callback GitHub (pour la connexion utilisateur) |
| GET  | `/api/v1/auth/me` | Profil de l'utilisateur connecté |
| PATCH | `/api/v1/auth/me` | Mise à jour profil + préférences |

### 3.2 Organizations

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST   | `/api/v1/orgs` | Créer une organisation |
| GET    | `/api/v1/orgs` | Lister mes organisations |
| GET    | `/api/v1/orgs/{org_slug}` | Détail d'une organisation |
| PATCH  | `/api/v1/orgs/{org_slug}` | Modifier une organisation |
| DELETE | `/api/v1/orgs/{org_slug}` | Supprimer une organisation (Owner only) |

**Members :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `/api/v1/orgs/{org_slug}/members` | Lister les membres |
| PATCH  | `/api/v1/orgs/{org_slug}/members/{user_id}` | Changer le rôle d'un membre |
| DELETE | `/api/v1/orgs/{org_slug}/members/{user_id}` | Retirer un membre |

**Invitations :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST   | `/api/v1/orgs/{org_slug}/invitations` | Inviter (email, rôle, is_guest, projets guest) |
| GET    | `/api/v1/orgs/{org_slug}/invitations` | Lister les invitations en cours |
| DELETE | `/api/v1/orgs/{org_slug}/invitations/{id}` | Révoquer une invitation |
| POST   | `/api/v1/invitations/{token}/accept` | Accepter une invitation (non scopé par org) |

**Billing :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `/api/v1/orgs/{org_slug}/billing` | Détail du plan et de l'usage |
| POST   | `/api/v1/orgs/{org_slug}/billing/checkout` | Créer une session Stripe Checkout |
| POST   | `/api/v1/orgs/{org_slug}/billing/portal` | Ouvrir le portail Stripe (gestion abo) |
| POST   | `/api/v1/webhooks/stripe` | Webhook Stripe (non scopé, signature vérifiée) |

### 3.3 SCM Connections & Repositories (niveau Organisation)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST   | `/api/v1/orgs/{org_slug}/scm-connections` | Connecter une forge (lance OAuth flow) |
| GET    | `/api/v1/orgs/{org_slug}/scm-connections` | Lister les connexions |
| DELETE | `/api/v1/orgs/{org_slug}/scm-connections/{id}` | Déconnecter une forge |
| GET    | `/api/v1/orgs/{org_slug}/scm-connections/{id}/available-repos` | Lister les repos disponibles sur la forge (pour import) |

**Repositories (niveau orga) :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `/api/v1/orgs/{org_slug}/repositories` | Lister tous les repos importés dans l'orga (toutes forges confondues) |
| POST   | `/api/v1/orgs/{org_slug}/repositories` | Importer un repo dans l'orga (body: `{ "scm_connection_id": "...", "external_id": "..." }`) |
| GET    | `/api/v1/orgs/{org_slug}/repositories/{id}` | Détail d'un repo (indexation status, projets liés, etc.) |
| DELETE | `/api/v1/orgs/{org_slug}/repositories/{id}` | Retirer un repo de l'orga (le délier de tous les projets) |
| POST   | `/api/v1/orgs/{org_slug}/repositories/{id}/reindex` | Forcer la réindexation |

### 3.4 Projects

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST   | `/api/v1/orgs/{org_slug}/projects` | Créer un projet |
| GET    | `/api/v1/orgs/{org_slug}/projects` | Lister les projets de l'orga |
| GET    | `/api/v1/orgs/{org_slug}/projects/{project_slug}` | Détail d'un projet |
| PATCH  | `/api/v1/orgs/{org_slug}/projects/{project_slug}` | Modifier un projet (settings inclus) |
| DELETE | `/api/v1/orgs/{org_slug}/projects/{project_slug}` | Supprimer un projet |

**Project Members :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `.../{project_slug}/members` | Lister les membres du projet |
| POST   | `.../{project_slug}/members` | Ajouter un membre au projet (user_id, role) |
| PATCH  | `.../{project_slug}/members/{user_id}` | Changer le rôle projet |
| DELETE | `.../{project_slug}/members/{user_id}` | Retirer du projet |

**Project ↔ Repositories (liaison) :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `.../{project_slug}/repositories` | Lister les repos liés à ce projet |
| POST   | `.../{project_slug}/repositories` | Lier un repo au projet (body: `{ "repository_id": "...", "target_branch_override": "develop" }`) |
| PATCH  | `.../{project_slug}/repositories/{id}` | Modifier le lien (ex: changer le target_branch_override) |
| DELETE | `.../{project_slug}/repositories/{id}` | Délier un repo du projet (ne le supprime pas de l'orga) |

**Labels :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST   | `.../{project_slug}/labels` | Créer un label |
| GET    | `.../{project_slug}/labels` | Lister les labels |
| PATCH  | `.../{project_slug}/labels/{id}` | Modifier un label |
| DELETE | `.../{project_slug}/labels/{id}` | Supprimer un label |

### 3.5 Board & Columns

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `.../{project_slug}/board` | Récupérer le board avec toutes les colonnes, leurs triggers, et les tickets |
| POST   | `.../{project_slug}/board/columns` | Créer une colonne |
| PATCH  | `.../{project_slug}/board/columns/{id}` | Modifier une colonne (nom, position, color, wip_limit) |
| DELETE | `.../{project_slug}/board/columns/{id}` | Supprimer une colonne (déplacer tickets d'abord) |
| POST   | `.../{project_slug}/board/columns/reorder` | Réordonner les colonnes (body: `{ "order": [id1, id2, ...] }`) |

**Column Agent Triggers :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `.../{project_slug}/board/columns/{col_id}/triggers` | Lister les triggers de la colonne |
| POST   | `.../{project_slug}/board/columns/{col_id}/triggers` | Ajouter un trigger (body: `{ "agent_type": "challenge", "trigger_mode": "auto", "conditions": {...}, "auto_move_on_complete": "col_id" }`) |
| PATCH  | `.../{project_slug}/board/columns/{col_id}/triggers/{id}` | Modifier un trigger (mode, conditions, options) |
| DELETE | `.../{project_slug}/board/columns/{col_id}/triggers/{id}` | Supprimer un trigger |

### 3.6 Tickets

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST   | `.../{project_slug}/tickets` | Créer un ticket |
| GET    | `.../{project_slug}/tickets` | Lister les tickets (filtres: column, status, assignee, label, search) |
| GET    | `.../{project_slug}/tickets/{ticket_key}` | Détail d'un ticket (avec analyses, plans, PRs, commentaires) |
| PATCH  | `.../{project_slug}/tickets/{ticket_key}` | Modifier un ticket |
| DELETE | `.../{project_slug}/tickets/{ticket_key}` | Supprimer un ticket |
| POST   | `.../{project_slug}/tickets/{ticket_key}/move` | Déplacer un ticket (body: `{ "column_id": "...", "position": 2 }`) — peut trigger un agent |
| POST   | `.../{project_slug}/tickets/reorder` | Réordonner les tickets dans une colonne |

**Payloads :**

Création de ticket :
```json
{
  "title": "Ajouter la page de profil utilisateur",
  "description": "En tant qu'utilisateur, je veux voir mon profil...",
  "acceptance_criteria": "- Le profil affiche nom, email, avatar\n- ...",
  "column_id": "uuid-backlog",
  "priority": "medium",
  "assigned_to": "uuid-user",
  "impacted_repo_ids": ["uuid-repo-front", "uuid-repo-api"],
  "label_ids": ["uuid-label-feature"]
}
```

Déplacement de ticket :
```json
{
  "column_id": "uuid-column-target",
  "position": 0
}
```

### 3.7 Comments

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `.../{ticket_key}/comments` | Lister les commentaires du ticket |
| POST   | `.../{ticket_key}/comments` | Ajouter un commentaire |
| PATCH  | `.../{ticket_key}/comments/{id}` | Modifier un commentaire |
| DELETE | `.../{ticket_key}/comments/{id}` | Supprimer un commentaire |
| POST   | `.../{ticket_key}/comments/{id}/resolve` | Marquer une question agent comme résolue |

### 3.8 Agents

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST   | `.../{ticket_key}/agents/challenge` | Lancer le Challenge Agent manuellement |
| POST   | `.../{ticket_key}/agents/plan` | Lancer le Plan Agent manuellement |
| POST   | `.../{ticket_key}/agents/code` | Lancer le Code Agent manuellement |
| POST   | `.../{ticket_key}/agents/review` | Lancer le Review Agent manuellement |
| POST   | `.../{ticket_key}/agents/fix` | Lancer le Fix Agent manuellement (body optionnel: `{ "severity_filter": ["critical", "major"] }`) |
| GET    | `.../{ticket_key}/agents/runs` | Lister les exécutions d'agents sur ce ticket |
| GET    | `.../{ticket_key}/agents/runs/{run_id}` | Détail d'une exécution (avec steps agrégés) |
| GET    | `.../{ticket_key}/agents/runs/{run_id}/steps` | Lister tous les steps du run (prompts, réponses, tokens, durée) |
| GET    | `.../{ticket_key}/agents/runs/{run_id}/steps/{step_id}` | Détail d'un step (prompt complet + réponse brute) |
| POST   | `.../{ticket_key}/agents/runs/{run_id}/cancel` | Annuler une exécution en cours |

**Analyses :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `.../{ticket_key}/analysis` | Dernière analyse du ticket |
| GET    | `.../{ticket_key}/analyses` | Historique des analyses |

**Plans :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `.../{ticket_key}/plan` | Dernier plan d'implémentation |
| GET    | `.../{ticket_key}/plans` | Historique des plans |
| POST   | `.../{ticket_key}/plan/approve` | Valider le plan (déclenche l'éligibilité du Code Agent) |
| POST   | `.../{ticket_key}/plan/reject` | Rejeter le plan (avec commentaire) |

**Pull Requests :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `.../{ticket_key}/pull-requests` | Lister les PRs du ticket |

**Reviews :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `.../{ticket_key}/review` | Dernière review du ticket |
| GET    | `.../{ticket_key}/reviews` | Historique des reviews |
| GET    | `.../{ticket_key}/review/findings` | Lister les findings de la dernière review (filtrable par severity, category, fix_status) |
| PATCH  | `.../{ticket_key}/review/findings/{id}` | Modifier un finding (ex: changer fix_status en "wontfix" ou "ignored") |

### 3.9 Notifications

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `/api/v1/notifications` | Lister mes notifications (paginé, filtrable par is_read) |
| POST   | `/api/v1/notifications/{id}/read` | Marquer comme lue |
| POST   | `/api/v1/notifications/read-all` | Tout marquer comme lu |
| GET    | `/api/v1/notifications/unread-count` | Nombre de notifications non lues |

### 3.10 Notification Channels (Settings orga)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET    | `/api/v1/orgs/{org_slug}/notification-channels` | Lister les canaux configurés |
| POST   | `/api/v1/orgs/{org_slug}/notification-channels` | Configurer un canal (Slack, Email) |
| PATCH  | `/api/v1/orgs/{org_slug}/notification-channels/{id}` | Modifier un canal |
| DELETE | `/api/v1/orgs/{org_slug}/notification-channels/{id}` | Supprimer un canal |

### 3.11 Webhooks entrants

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST   | `/api/v1/webhooks/github` | Webhook GitHub (push, PR events) |
| POST   | `/api/v1/webhooks/bitbucket` | Webhook Bitbucket |
| POST   | `/api/v1/webhooks/gitlab` | Webhook GitLab |
| POST   | `/api/v1/webhooks/stripe` | Webhook Stripe (billing events) |
| POST   | `/api/v1/webhooks/slack` | Webhook Slack (réponses interactives) |

---

## 4. Vues Frontend

### 4.0 Layout général

```
┌──────────────────────────────────────────────────────────────────┐
│  Top Bar                                                         │
│  ┌─────────────┐  ┌────────────┐              ┌──┐ ┌──┐ ┌────┐ │
│  │ Org Switcher │  │ Breadcrumb │              │🔔│ │❓│ │Avatar│ │
│  └─────────────┘  └────────────┘              └──┘ └──┘ └────┘ │
├────────────┬─────────────────────────────────────────────────────┤
│ Sidebar    │  Main Content                                       │
│            │                                                     │
│ Projects   │  (varie selon la page)                              │
│  ├ Proj A  │                                                     │
│  ├ Proj B  │                                                     │
│  └ Proj C  │                                                     │
│            │                                                     │
│ ────────── │                                                     │
│ Settings   │                                                     │
│ Members    │                                                     │
│ Billing    │                                                     │
│ SCM        │                                                     │
│            │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

- **Top Bar** : Org Switcher (dropdown pour changer d'orga), breadcrumb contextuel, cloche notifications (badge unread count), aide, avatar utilisateur (menu: profil, préférences, logout)
- **Sidebar** : Navigation principale. Liste des projets de l'orga (avec icône + couleur). Section settings en bas. La sidebar est collapsible.
- **Main Content** : Zone principale qui change selon la route.

### 4.1 Page : Onboarding / Création d'organisation

**Route** : `/onboarding`

**Description** : Wizard en 3 étapes pour les nouveaux utilisateurs.

```
┌─────────────────────────────────────────────┐
│          Bienvenue sur Autodev               │
│                                              │
│  Étape 1/3 : Créer votre organisation        │
│  ┌────────────────────────────────────────┐  │
│  │ Nom de l'organisation : [___________]  │  │
│  │ Slug URL : autodev.com/ [___________]  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Étape 2/3 : Connecter votre forge Git       │
│  ┌──────┐  ┌──────────┐  ┌────────┐         │
│  │GitHub│  │Bitbucket  │  │GitLab  │         │
│  └──────┘  └──────────┘  └────────┘         │
│  (OAuth flow)                                │
│                                              │
│  Étape 3/3 : Créer votre premier projet      │
│  ┌────────────────────────────────────────┐  │
│  │ Nom du projet : [___________]          │  │
│  │ Sélectionner les repos : ☑ repo-api    │  │
│  │                          ☑ repo-front  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│              [Commencer →]                   │
└─────────────────────────────────────────────┘
```

### 4.2 Page : Dashboard Organisation

**Route** : `/{org_slug}`

**Description** : Vue d'ensemble de l'organisation.

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard — Acme Corp                                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  3 projets   │  │  47 tickets  │  │  12 PRs       │       │
│  │  actifs      │  │  ouverts     │  │  cette semaine│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  Projets                                          [+ Nouveau]│
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 🟣 Autodev API     │ 12 tickets │ 3 PRs │ Dernière     │ │
│  │                     │            │       │ activité: 2h │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ 🔵 Autodev Front   │  8 tickets │ 1 PR  │ Dernière     │ │
│  │                     │            │       │ activité: 5h │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ 🟢 Landing Page     │  3 tickets │ 0 PR  │ Dernière     │ │
│  │                     │            │       │ activité: 2j │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  Activité récente                                            │
│  • Challenge Agent terminé sur AD-42 — Score: 85/100   2h   │
│  • PR #23 merged sur autodev-api                       3h   │
│  • Plan généré pour AD-38 (3 steps, 2 repos)           5h   │
│                                                              │
│  Usage AI ce mois : ████████░░ 78/100 runs                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Page : Board Kanban (vue principale du projet)

**Route** : `/{org_slug}/{project_slug}/board`

**Description** : Le cœur de l'application. Board Kanban avec drag & drop.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🟣 Autodev API — Board                          [Filtres ▼] [+ Ticket] │
│                                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐ ┌──────┐ │
│  │  Backlog (5) │ │ To Refine(2)│ │ Ready (3)   │ │ In Prog  │ │ Done │ │
│  │             │ │  🤖 auto    │ │  🤖 plan    │ │ (1)      │ │ (8)  │ │
│  │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │┌────────┐│ │      │ │
│  │ │ AD-45   │ │ │ │ AD-42   │ │ │ │ AD-38   │ │ ││ AD-35  ││ │      │ │
│  │ │ Page    │ │ │ │ Auth    │ │ │ │ API     │ │ ││ Search ││ │      │ │
│  │ │ profil  │ │ │ │ OAuth   │ │ │ │ billing │ │ ││        ││ │      │ │
│  │ │         │ │ │ │ 🟡 85   │ │ │ │ ✅ Plan │ │ ││ 🔄 PR  ││ │      │ │
│  │ │ Med ●●  │ │ │ │ ⏳input │ │ │ │ [Code▶] │ │ ││ open   ││ │      │ │
│  │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │└────────┘│ │      │ │
│  │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │          │ │      │ │
│  │ │ AD-44   │ │ │ │ AD-41   │ │ │ │ AD-37   │ │ │          │ │      │ │
│  │ │ ...     │ │ │ │ ...     │ │ │ │ ...     │ │ │          │ │      │ │
│  │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │          │ │      │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘ └──────┘ │
│                                                                          │
│  Légende : 🤖 = agent auto-trigger │ 🟡 = score challenge │             │
│            ⏳ = waiting for input   │ ✅ = validé          │             │
│            🔄 = PR en cours         │ [Code▶] = bouton     │             │
└──────────────────────────────────────────────────────────────────────────┘
```

**Composants clés** :
- **Colonnes** : drag & drop horizontal (réordonner). Badge avec le nombre de tickets. Indicateur 🤖 si un agent est en auto-trigger sur cette colonne.
- **Cartes ticket** : drag & drop vertical (entre colonnes et dans une colonne). Affichent : ticket_key, titre, priorité (pastilles couleur), status agents (icônes), assignee (avatar).
- **Barre de filtres** : filtrer par assignee, label, priorité, status agent, recherche texte.
- **Bouton [+ Ticket]** : ouvre une modale de création rapide.

### 4.4 Page : Détail d'un ticket

**Route** : `/{org_slug}/{project_slug}/tickets/{ticket_key}`

**Description** : Vue complète d'un ticket avec tous les onglets.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Board    AD-42 Auth OAuth GitHub                          [Éditer]   │
│                                                                          │
│  ┌────────────────────────────────┬─────────────────────────────────────┐│
│  │  Contenu principal             │  Panneau latéral                    ││
│  │                                │                                     ││
│  │  ## Description                │  Statut : To Refine                 ││
│  │  En tant qu'utilisateur...     │  Priorité : 🔴 High                ││
│  │                                │  Assigné à : @camille               ││
│  │  ## Critères d'acceptation     │  Labels : feature, auth             ││
│  │  - L'utilisateur peut se...    │                                     ││
│  │  - Le token est stocké...      │  Repos impactés :                   ││
│  │                                │  ☑ autodev-api                      ││
│  │  ─────────────────────────     │  ☑ autodev-front                    ││
│  │                                │  ☐ autodev-shared                   ││
│  │  [Challenge 🤖] [Plan 📋]     │                                     ││
│  │  [Code ▶]                      │  Créé par : @pierre                 ││
│  │                                │  Créé le : 2 avril 2026             ││
│  │                                │                                     ││
│  └────────────────────────────────┴─────────────────────────────────────┘│
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │ [Analyse] [Plan] [Pull Requests] [Commentaires (5)] [Historique]    ││
│  ├──────────────────────────────────────────────────────────────────────┤│
│  │                                                                      ││
│  │  === Onglet Analyse ===                                              ││
│  │  Score de complétude : 85/100                                        ││
│  │  ✅ Forces : Besoin clair, critères d'acceptation présents           ││
│  │  ⚠️ Faiblesses : Pas de mention du refresh token                    ││
│  │  💡 Suggestions : Ajouter le comportement en cas d'erreur OAuth      ││
│  │  ❓ Questions ouvertes (2) :                                         ││
│  │     1. Faut-il supporter GitLab OAuth aussi ? [Résolu ✓]             ││
│  │     2. Quel est le TTL souhaité pour le token ? [En attente]         ││
│  │                                                                      ││
│  │  === Onglet Plan ===                                                 ││
│  │  Complexité estimée : M — ~4h                                        ││
│  │  📦 autodev-api (3 steps) :                                          ││
│  │    1. [Backend] Créer le modèle OAuthToken — models/oauth.py         ││
│  │    2. [Backend] Endpoint callback — views/auth.py                    ││
│  │    3. [Test] Tests OAuth flow — tests/test_auth.py                   ││
│  │  📦 autodev-front (2 steps) :                                        ││
│  │    1. [Frontend] Bouton "Login with GitHub" — components/AuthBtn.tsx ││
│  │    2. [Frontend] Page callback — pages/auth/callback.tsx             ││
│  │                                          [✅ Approuver] [❌ Rejeter] ││
│  │                                                                      ││
│  │  === Onglet Pull Requests ===                                        ││
│  │  PR #23 — autodev-api — feature/AD-42-auth-oauth — Open             ││
│  │    +142 -12 — 5 fichiers — Créée il y a 2h                          ││
│  │    [Voir sur GitHub ↗]                                               ││
│  │  PR #11 — autodev-front — feature/AD-42-auth-oauth — Open           ││
│  │    +89 -3 — 3 fichiers — Créée il y a 2h                            ││
│  │    [Voir sur GitHub ↗]                                               ││
│  │                                                                      ││
│  │  === Onglet Commentaires ===                                         ││
│  │  🤖 Challenge Agent — il y a 3h                                      ││
│  │  "Le ticket est globalement clair mais j'ai 2 questions..."          ││
│  │     ↳ @pierre — il y a 2h                                           ││
│  │       "Pour la question 1, on reste sur GitHub uniquement"           ││
│  │                                                                      ││
│  │  @camille — il y a 1h                                                ││
│  │  "J'ai regardé le plan, c'est cohérent. J'approuve."                ││
│  │                                                                      ││
│  │  [Écrire un commentaire...]                                          ││
│  └──────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Page : Settings du projet

**Route** : `/{org_slug}/{project_slug}/settings`

**Description** : Configuration du projet — onglets multiples.

```
┌──────────────────────────────────────────────────────────────────┐
│  🟣 Autodev API — Settings                                       │
│                                                                   │
│  [Général] [Repos] [Board & Agents] [Membres] [Danger Zone]      │
│                                                                   │
│  === Onglet Général ===                                           │
│  Nom : [Autodev API_________]                                     │
│  Description : [Backend API du projet Autodev___]                 │
│  Icône : 🟣  Couleur : [#6366F1]                                 │
│  Instructions pour les agents AI :                                │
│  ┌────────────────────────────────────────────────────┐           │
│  │ Ce projet utilise Django + DRF. Architecture        │           │
│  │ hexagonale. Les tests utilisent pytest-django.      │           │
│  │ La base de données est PostgreSQL avec pgvector.    │           │
│  └────────────────────────────────────────────────────┘           │
│                                              [Sauvegarder]        │
│                                                                   │
│  === Onglet Repos ===                                             │
│  Repos connectés :                                                │
│  ┌────────────────────────────────────────────────────┐           │
│  │ ✅ acme-corp/autodev-api    │ main │ Indexé ✓  [🗑]│           │
│  │ ✅ acme-corp/autodev-front  │ main │ Indexé ✓  [🗑]│           │
│  └────────────────────────────────────────────────────┘           │
│  [+ Ajouter un repo]  → ouvre un picker des repos dispo          │
│                                                                   │
│  Branche cible par défaut : [main_______]                         │
│  Template de branche : [feature/AD-{ticket_id}-{slug}]            │
│  Template titre PR : [[AD-{ticket_id}] {ticket_title}]            │
│                                                                   │
│  === Onglet Board & Agents ===                                    │
│  Colonnes du board :                                              │
│  ┌────────────────────────────────────────────────────┐           │
│  │ ≡ Backlog       │ 0 triggers          │ [⚙] [🗑]  │           │
│  │ ≡ To Refine     │ 1 trigger (auto)    │ [⚙] [🗑]  │           │
│  │ ≡ Ready         │ 1 trigger (auto)    │ [⚙] [🗑]  │           │
│  │ ≡ In Progress   │ 0 triggers          │ [⚙] [🗑]  │           │
│  │ ≡ Review        │ 0 triggers          │ [⚙] [🗑]  │           │
│  │ ≡ Done          │ 0 triggers          │ [⚙] [🗑]  │           │
│  └────────────────────────────────────────────────────┘           │
│  [+ Ajouter une colonne]                                          │
│  (≡ = drag handle pour réordonner, ⚙ = configurer les triggers)  │
│                                                                   │
│  --- Panneau de config triggers (clic sur ⚙ de "To Refine") ---  │
│  ┌────────────────────────────────────────────────────┐           │
│  │ Triggers pour "To Refine"              [+ Trigger] │           │
│  │                                                    │           │
│  │ 1. 🤖 Challenge Agent                              │           │
│  │    Mode : [Automatique ▼]                           │           │
│  │    Conditions :                                     │           │
│  │      ☐ Challenge approuvé requis                    │           │
│  │      ☐ Plan approuvé requis                         │           │
│  │      ☑ Repos impactés sélectionnés requis           │           │
│  │    Options :                                        │           │
│  │      ☐ Notifier l'assignee au démarrage             │           │
│  │      ☑ Notifier à la fin                            │           │
│  │      Déplacer vers : [Ready ▼] si succès            │           │
│  │    [Désactiver] [Supprimer]                         │           │
│  └────────────────────────────────────────────────────┘           │
│                                                                   │
│  === Onglet Membres ===                                           │
│  ┌────────────────────────────────────────────────────┐           │
│  │ @camille  │ Project Admin │ [Changer rôle ▼] [🗑]  │           │
│  │ @pierre   │ Member        │ [Changer rôle ▼] [🗑]  │           │
│  │ @client   │ Viewer (Guest)│ [Changer rôle ▼] [🗑]  │           │
│  └────────────────────────────────────────────────────┘           │
│  [+ Inviter un membre]                                            │
│                                                                   │
│  === Onglet Danger Zone ===                                       │
│  ┌────────────────────────────────────────────────────┐           │
│  │ ⚠️ Supprimer ce projet                              │           │
│  │ Cette action est irréversible.         [Supprimer]  │           │
│  └────────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

### 4.6 Page : Settings Organisation

**Route** : `/{org_slug}/settings`

```
┌──────────────────────────────────────────────────────────────────┐
│  Acme Corp — Settings Organisation                                │
│                                                                   │
│  [Général] [Membres] [SCM Connections] [Notifications] [Billing]  │
│                                                                   │
│  === Onglet Général ===                                           │
│  Nom : [Acme Corp___________]                                     │
│  Slug : acme-corp (non modifiable)                                │
│  Logo : [Upload]                                                  │
│  Forge Git par défaut : [GitHub ▼]                                │
│                                                                   │
│  === Onglet Membres ===                                           │
│  ┌────────────────────────────────────────────────────┐           │
│  │ @camille  │ Owner   │ camille@acme.com        [—]  │           │
│  │ @pierre   │ Admin   │ pierre@acme.com   [▼ rôle]   │           │
│  │ @julie    │ Member  │ julie@acme.com    [▼ rôle][🗑]│           │
│  └────────────────────────────────────────────────────┘           │
│  Invitations en attente :                                         │
│  │ guest@client.com │ Guest │ Viewer sur Proj A │ [Révoquer]     │
│  [+ Inviter]                                                      │
│                                                                   │
│  === Onglet SCM Connections ===                                   │
│  ┌────────────────────────────────────────────────────┐           │
│  │ 🐙 GitHub │ Org: acme-corp │ Connecté ✅  [Déco]   │           │
│  └────────────────────────────────────────────────────┘           │
│  [+ Connecter une forge]                                          │
│  → GitHub : installe la GitHub App                                │
│  → Bitbucket : OAuth flow                                         │
│  → GitLab : OAuth flow                                            │
│                                                                   │
│  === Onglet Notifications ===                                     │
│  Canaux actifs :                                                  │
│  ┌────────────────────────────────────────────────────┐           │
│  │ 💬 Slack │ Workspace: Acme Corp │ Actif ✅  [Config]│           │
│  │ 📧 Email │ Provider: SendGrid   │ Actif ✅  [Config]│           │
│  └────────────────────────────────────────────────────┘           │
│  [+ Ajouter un canal]                                             │
│  Canal par défaut pour les agents : [Slack ▼]                     │
│                                                                   │
│  === Onglet Billing ===                                           │
│  Plan actuel : Pro (19€/mois)                                     │
│  Membres : 3/10                                                   │
│  Projets : 3/20                                                   │
│  AI Runs ce mois : 78/500                                         │
│  Prochaine facturation : 1er mai 2026                             │
│  [Changer de plan] [Gérer le paiement] (→ Stripe Portal)          │
└──────────────────────────────────────────────────────────────────┘
```

### 4.7 Page : Notifications

**Route** : `/{org_slug}/notifications`

```
┌──────────────────────────────────────────────────────────────────┐
│  Notifications                              [Tout marquer lu]     │
│                                                                   │
│  Aujourd'hui                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 🔵 🤖 Challenge Agent a des questions sur AD-42       2h   │   │
│  │    "Quel est le TTL souhaité pour le token OAuth ?"         │   │
│  │    → Autodev API                                            │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │ 🔵 📋 Plan généré pour AD-38                          5h   │   │
│  │    "3 steps, 2 repos — Complexité M"                        │   │
│  │    → Autodev API                                            │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │ ○  🔀 PR #23 créée sur autodev-api                    6h   │   │
│  │    "feature/AD-35-search — +142 -12"                        │   │
│  │    → Autodev API                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Hier                                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ ○  👤 Tu as été assigné à AD-42                      1j    │   │
│  │    → Autodev API                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  🔵 = non lu    ○ = lu                                            │
└──────────────────────────────────────────────────────────────────┘
```

### 4.8 Page : Profil utilisateur / Préférences

**Route** : `/settings/profile`

```
┌──────────────────────────────────────────────────────────────────┐
│  Mon profil                                                       │
│                                                                   │
│  Avatar : [Upload]                                                │
│  Nom complet : [Camille Dupont______]                             │
│  Email : camille@acme.com (non modifiable)                        │
│  Langue : [Français ▼]                                            │
│                                                                   │
│  Notifications                                                    │
│  Canal préféré : [Slack ▼]                                        │
│  ☑ Questions des agents AI                                        │
│  ☑ Plans d'implémentation générés                                 │
│  ☑ Pull Requests créées                                           │
│                                                                   │
│  Sécurité                                                         │
│  [Changer le mot de passe]                                        │
│  Sessions actives : 2 (ce navigateur, iPhone)                     │
│                                                                   │
│                                              [Sauvegarder]        │
└──────────────────────────────────────────────────────────────────┘
```

### 4.9 Modale : Création rapide de ticket

**Trigger** : Bouton [+ Ticket] sur le board ou raccourci clavier `C`

```
┌──────────────────────────────────────────────────────────────┐
│  Nouveau ticket                                        [✕]   │
│                                                              │
│  Titre : [________________________________]                  │
│                                                              │
│  Description (Markdown) :                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │  (éditeur Markdown avec preview)                     │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Critères d'acceptation (Markdown) :                         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Colonne : [Backlog ▼]        Priorité : [Medium ▼]         │
│  Assigné à : [@camille ▼]                                    │
│  Labels : [feature ✕] [+ ajouter]                            │
│                                                              │
│  Repos impactés :                                            │
│  ☑ acme-corp/autodev-api                                     │
│  ☐ acme-corp/autodev-front                                   │
│  ☐ acme-corp/autodev-shared                                  │
│                                                              │
│                            [Annuler]  [Créer le ticket]      │
└──────────────────────────────────────────────────────────────┘
```

### 4.10 Routes frontend (résumé)

| Route | Page | Accès minimum |
|-------|------|---------------|
| `/onboarding` | Wizard création orga | Authenticated, no org |
| `/{org_slug}` | Dashboard orga | Member |
| `/{org_slug}/settings` | Settings orga (onglets) | Admin |
| `/{org_slug}/settings/billing` | Billing | Owner |
| `/{org_slug}/notifications` | Notifications | Member |
| `/{org_slug}/{project_slug}/board` | Board Kanban | Project Viewer+ |
| `/{org_slug}/{project_slug}/tickets/{key}` | Détail ticket | Project Viewer+ |
| `/{org_slug}/{project_slug}/settings` | Settings projet | Project Admin |
| `/settings/profile` | Profil utilisateur | Authenticated |
| `/auth/login` | Login | Public |
| `/auth/register` | Register | Public |
| `/auth/forgot-password` | Reset password | Public |
| `/invitations/{token}` | Accepter invitation | Public (avec token) |

---

## 5. Architecture Infrastructure

### 5.1 Vue d'ensemble des services

```
                                    ┌─────────────────────┐
                                    │    Ingress NGINX     │
                                    │    (+ cert-manager)  │
                                    └──────┬──────┬───────┘
                                           │      │
                              ┌────────────┘      └────────────┐
                              ▼                                ▼
                    ┌──────────────────┐             ┌──────────────────┐
                    │   Frontend       │             │   Backend API    │
                    │   React/Vite     │             │   Django + DRF   │
                    │   (Nginx static) │             │   (Gunicorn)     │
                    │                  │             │                  │
                    │   Port: 3000     │             │   Port: 8000     │
                    └──────────────────┘             └───────┬──────────┘
                                                            │
                              ┌──────────────────────────────┤
                              │              │               │
                              ▼              ▼               ▼
                    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                    │  PostgreSQL  │ │    Redis      │ │  Celery      │
                    │  + pgvector  │ │  (cache +     │ │  Worker      │
                    │              │ │   broker)     │ │              │
                    │  Port: 5432  │ │  Port: 6379   │ │  (no port)   │
                    └──────────────┘ └──────────────┘ └──────┬───────┘
                                                            │
                                                            ▼
                                                   ┌──────────────────┐
                                                   │  Agent Service   │
                                                   │  (Python)        │
                                                   │                  │
                                                   │  - Challenge     │
                                                   │  - Plan          │
                                                   │  - Code          │
                                                   │  - Review        │
                                                   │  - Fix           │
                                                   │                  │
                                                   │  Port: 8001      │
                                                   └────────┬─────────┘
                                                            │
                              ┌──────────────────────────────┤
                              │              │               │
                              ▼              ▼               ▼
                    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                    │  Anthropic   │ │  SCM APIs    │ │  PostgreSQL  │
                    │  API (LLM)   │ │  (GitHub,    │ │  (pgvector   │
                    │              │ │  Bitbucket,  │ │   embeddings)│
                    │  (externe)   │ │  GitLab)     │ │              │
                    └──────────────┘ └──────────────┘ └──────────────┘
```

### 5.2 Description des services

| Service | Image | Rôle | Replicas (prod) | Ressources |
|---------|-------|------|-----------------|------------|
| **frontend** | Node/Nginx | Sert le build statique React | 2 | 128MB RAM, 0.1 CPU |
| **backend** | Python/Gunicorn | API REST Django, auth, webhooks | 2-4 | 512MB RAM, 0.5 CPU |
| **celery-worker** | Python/Celery | Tâches async : notifications, indexation, orchestration agents | 2-4 | 512MB RAM, 0.5 CPU |
| **celery-beat** | Python/Celery Beat | Scheduler : réindexation périodique, nettoyage, reset compteurs billing | 1 | 128MB RAM, 0.1 CPU |
| **agent-service** | Python | Exécution des agents AI (challenge, plan, code, review, fix) | 2-4 | 1GB RAM, 1 CPU |
| **postgresql** | PostgreSQL 16 + pgvector | Base de données principale | 1 (managé en prod) | 2GB RAM, 1 CPU |
| **redis** | Redis 7 | Cache, broker Celery, sessions | 1 | 256MB RAM, 0.2 CPU |

### 5.3 Communication entre services

```
Frontend ──HTTP──► Backend API (REST JSON)

Backend ──Celery task──► Redis (broker) ──► Celery Worker
                                           └──► Agent Service

Agent Service ──HTTP──► Anthropic API (LLM)
Agent Service ──HTTP──► GitHub/Bitbucket/GitLab API (SCM)
Agent Service ──SQL──► PostgreSQL (lecture codebase, écriture résultats)
Agent Service ──Celery result──► Redis ──► Backend (mise à jour statuts)

Backend ──SQL──► PostgreSQL
Backend ──cache──► Redis

Webhooks (GitHub, Stripe, Slack) ──HTTP──► Backend API ──► Celery tasks
```

**Communication Backend ↔ Agent Service :**

Deux options possibles, à choisir :

**Option A — Celery tasks (recommandé pour le MVP)** : le backend poste une tâche Celery (`run_challenge_agent(ticket_id)`), le worker Celery lance l'agent service en import Python direct. Simple, pas de service réseau séparé. Le "agent service" est en fait un module Python importé par les workers Celery.

**Option B — Service HTTP séparé** : l'agent service expose une API REST interne (`POST /agents/run`), le backend l'appelle via HTTP. Plus propre architecturalement, permet de scaler indépendamment, mais ajoute de la complexité réseau. À considérer quand le MVP est stable.

→ **Décision : Option A pour le MVP**, migration vers Option B si besoin de scaling indépendant.

### 5.4 Environnement unique : Kubernetes partout (dev + staging + prod)

**Décision** : pas de Docker Compose. Un seul mode de déploiement basé sur Kubernetes, du dev à la prod. Cela élimine la confusion entre deux configurations différentes, permet de détecter les problèmes K8s dès le développement, et évite le travail en double sur les manifests.

**Stack de dev local :**
- **k3d** : crée un cluster K8s léger (basé sur k3s) dans Docker. Démarre en ~30 secondes. Plus léger que Minikube, pas besoin de VM.
- **Tilt** : outil de dev qui surveille les fichiers source, rebuild les images Docker, et redéploie les pods automatiquement. Remplace le hot reload de Docker Compose. Dashboard web intégré pour voir les logs et l'état de tous les services.
- **Kustomize** : overlays pour distinguer dev / staging / prod (même manifests de base, overrides par environnement).

**Setup du cluster local :**

```bash
# Créer le cluster local avec k3d
k3d cluster create autodev-local \
  --port "3000:80@loadbalancer" \
  --port "8000:8000@loadbalancer" \
  -v "$PWD:/src@all"

# Lancer Tilt (surveille les fichiers, rebuild + redeploy auto)
tilt up
```

**Tiltfile (configuration Tilt)** :

```python
# Tiltfile

# --- Backend Django ---
docker_build(
    'autodev-backend',
    context='services/backend',
    live_update=[
        sync('services/backend/', '/app/'),
        run('pip install -r requirements/dev.txt', trigger=['requirements/']),
    ]
)
k8s_yaml(kustomize('infra/k8s/overlays/dev'))
k8s_resource('backend', port_forwards='8000:8000')

# --- Frontend React ---
docker_build(
    'autodev-frontend',
    context='services/frontend',
    live_update=[
        sync('services/frontend/src/', '/app/src/'),
        sync('services/frontend/public/', '/app/public/'),
    ]
)
k8s_resource('frontend', port_forwards='3000:3000')

# --- Celery Worker ---
docker_build(
    'autodev-celery',
    context='services/backend',
    dockerfile='services/backend/Dockerfile',
)
k8s_resource('celery-worker')
k8s_resource('celery-beat')

# --- Infra (PostgreSQL + Redis via Helm) ---
load('ext://helm_resource', 'helm_resource')
helm_resource(
    'postgresql',
    'oci://registry-1.docker.io/bitnamicharts/postgresql',
    flags=['--set=auth.postgresPassword=autodev_dev',
           '--set=auth.database=autodev',
           '--set=image.repository=pgvector/pgvector',
           '--set=image.tag=pg16']
)
helm_resource(
    'redis',
    'oci://registry-1.docker.io/bitnamicharts/redis',
    flags=['--set=auth.enabled=false']
)
```

**Ce que Tilt apporte** :
- Hot reload : tu modifies un fichier Python ou React → Tilt sync le fichier dans le pod → le serveur de dev redémarre automatiquement (live_update sans rebuild d'image)
- Dashboard web (localhost:10350) : vue de tous les services, logs en temps réel, statut des builds, bouton restart par service
- Erreurs visibles immédiatement : si un pod crash loop, Tilt le signale

**Différences entre overlays** :

| Aspect | dev (k3d local) | staging | production |
|--------|-----------------|---------|------------|
| Replicas | 1 par service | 1-2 | 2-4 (HPA) |
| Images | build local (Tilt) | ghcr.io/autodev/*:sha | ghcr.io/autodev/*:tag |
| PostgreSQL | Helm chart local | Managé (DO/Scaleway) | Managé (DO/Scaleway) |
| Redis | Helm chart local | Managé ou Helm | Managé ou Helm |
| Ingress | k3d traefik | NGINX Ingress | NGINX Ingress + cert-manager |
| Debug | DEBUG=true, Tilt | DEBUG=false | DEBUG=false |
| Secrets | ConfigMap en clair | K8s Secrets | K8s Secrets + Sealed Secrets |
| Volumes | Sources montées (live_update) | Images immutables | Images immutables |

### 5.5 Kubernetes — Manifests et structure

```
autodev-namespace/
  ├── Deployments
  │     ├── frontend          (2 replicas, Nginx + static build)
  │     ├── backend           (2-4 replicas, Gunicorn, HPA)
  │     ├── celery-worker     (2-4 replicas, HPA sur queue length)
  │     ├── celery-beat       (1 replica, pas de scaling)
  │
  ├── Services (ClusterIP)
  │     ├── frontend-svc      → frontend pods :3000
  │     ├── backend-svc       → backend pods :8000
  │
  ├── Ingress
  │     ├── app.autodev.com       → frontend-svc
  │     ├── app.autodev.com/api/  → backend-svc
  │     ├── app.autodev.com/ws/   → backend-svc (futur SSE/WS)
  │
  ├── StatefulSets / External
  │     ├── PostgreSQL        (managé : DigitalOcean Managed DB ou Scaleway)
  │     └── Redis             (managé ou Helm chart Bitnami)
  │
  ├── ConfigMaps
  │     ├── backend-config    (ALLOWED_HOSTS, CORS, etc.)
  │     └── frontend-config   (VITE_API_URL, etc.)
  │
  ├── Secrets
  │     ├── db-credentials
  │     ├── redis-credentials
  │     ├── anthropic-api-key
  │     ├── stripe-keys
  │     ├── github-app-keys
  │     └── smtp-credentials
  │
  ├── HorizontalPodAutoscaler
  │     ├── backend-hpa       (CPU > 70% → scale up, min 2, max 8)
  │     └── celery-worker-hpa (queue length > 50 → scale up, min 2, max 10)
  │
  └── CronJobs
        ├── billing-reset     (1er du mois : reset des compteurs AI runs)
        └── cleanup-old-runs  (hebdo : nettoyage des AgentRunSteps > 90 jours)
```

**Providers recommandés pour débuter :**
- **DigitalOcean DOKS** : le plus simple pour apprendre K8s, bon rapport qualité/prix, DB managée dispo
- **Scaleway Kapsule** : alternative européenne (données en France), RGPD friendly
- Les deux supportent Helm, cert-manager, Ingress NGINX out of the box

### 5.6 CI/CD Pipeline

```
Push sur main
  │
  ├── Lint + Type check (frontend: ESLint + tsc, backend: ruff + mypy)
  ├── Tests unitaires (frontend: vitest, backend: pytest)
  ├── Tests d'intégration (backend: pytest + test DB)
  │
  ├── Build Docker images
  │     ├── frontend → ghcr.io/autodev/frontend:{sha}
  │     ├── backend  → ghcr.io/autodev/backend:{sha}
  │
  ├── Push images vers Container Registry
  │
  └── Deploy
        ├── Staging : auto-deploy sur push main
        └── Production : deploy manuel (tag release) ou auto après staging OK

Outil recommandé : GitHub Actions (gratuit pour les repos publics, intégré)
```

---

## 6. Structure du Monorepo

### 6.1 Arborescence

```
autodev/
  ├── .github/
  │     └── workflows/
  │           ├── ci.yml                  # lint, tests, build
  │           ├── deploy-staging.yml      # deploy auto sur staging
  │           └── deploy-production.yml   # deploy manuel sur prod
  │
  ├── services/
  │     ├── backend/                      # Django API + Agent Service
  │     │     ├── Dockerfile
  │     │     ├── Dockerfile.dev
  │     │     ├── requirements/
  │     │     │     ├── base.txt
  │     │     │     ├── dev.txt
  │     │     │     └── prod.txt
  │     │     ├── manage.py
  │     │     ├── autodev/                # projet Django
  │     │     │     ├── settings/
  │     │     │     │     ├── base.py
  │     │     │     │     ├── dev.py
  │     │     │     │     ├── prod.py
  │     │     │     │     └── test.py
  │     │     │     ├── urls.py
  │     │     │     ├── celery.py
  │     │     │     └── wsgi.py
  │     │     ├── apps/
  │     │     │     ├── users/
  │     │     │     │     ├── models.py
  │     │     │     │     ├── serializers.py
  │     │     │     │     ├── views.py
  │     │     │     │     ├── urls.py
  │     │     │     │     ├── permissions.py
  │     │     │     │     ├── tests/
  │     │     │     │     └── admin.py
  │     │     │     ├── organizations/
  │     │     │     │     ├── models.py    # Organization, Membership, BillingAccount, Invitation
  │     │     │     │     ├── serializers.py
  │     │     │     │     ├── views.py
  │     │     │     │     ├── urls.py
  │     │     │     │     ├── permissions.py
  │     │     │     │     ├── signals.py   # post_save: créer BillingAccount + NotificationChannel in_app
  │     │     │     │     └── tests/
  │     │     │     ├── projects/
  │     │     │     │     ├── models.py    # Project, ProjectMembership, Board, Column, ColumnAgentTrigger, Ticket, Label, Comment
  │     │     │     │     ├── serializers.py
  │     │     │     │     ├── views.py
  │     │     │     │     ├── urls.py
  │     │     │     │     ├── permissions.py
  │     │     │     │     ├── signals.py   # post_save: créer Board à la création du projet
  │     │     │     │     └── tests/
  │     │     │     ├── scm/
  │     │     │     │     ├── models.py    # SCMConnection, Repository, ProjectRepository, CodeEmbedding, PullRequest
  │     │     │     │     ├── providers/
  │     │     │     │     │     ├── base.py          # SCMProvider (classe abstraite)
  │     │     │     │     │     ├── github.py         # GitHubProvider
  │     │     │     │     │     ├── bitbucket.py      # BitbucketProvider (futur)
  │     │     │     │     │     └── gitlab.py         # GitLabProvider (futur)
  │     │     │     │     ├── webhooks.py  # handlers pour les webhooks SCM
  │     │     │     │     ├── serializers.py
  │     │     │     │     ├── views.py
  │     │     │     │     ├── urls.py
  │     │     │     │     └── tests/
  │     │     │     ├── agents/
  │     │     │     │     ├── models.py    # AgentRun, AgentRunStep, AIAnalysis, ImplementationPlan, PlanStep, ReviewResult, ReviewFinding
  │     │     │     │     ├── engine/
  │     │     │     │     │     ├── base.py           # BaseAgent (classe abstraite)
  │     │     │     │     │     ├── challenge.py      # ChallengeAgent
  │     │     │     │     │     ├── plan.py           # PlanAgent
  │     │     │     │     │     ├── code.py           # CodeAgent
  │     │     │     │     │     ├── review.py         # ReviewAgent
  │     │     │     │     │     ├── fix.py            # FixAgent
  │     │     │     │     │     └── prompts/
  │     │     │     │     │           ├── challenge.py  # templates de prompts Challenge
  │     │     │     │     │           ├── plan.py       # templates de prompts Plan
  │     │     │     │     │           ├── code.py       # templates de prompts Code
  │     │     │     │     │           ├── review.py     # templates de prompts Review
  │     │     │     │     │           └── fix.py        # templates de prompts Fix
  │     │     │     │     ├── tasks.py     # tâches Celery (run_agent, index_repository, etc.)
  │     │     │     │     ├── serializers.py
  │     │     │     │     ├── views.py
  │     │     │     │     ├── urls.py
  │     │     │     │     └── tests/
  │     │     │     └── notifications/
  │     │     │           ├── models.py    # NotificationChannel, Notification
  │     │     │           ├── providers/
  │     │     │           │     ├── base.py          # NotificationProvider (classe abstraite)
  │     │     │           │     ├── in_app.py        # InAppProvider
  │     │     │           │     ├── slack.py         # SlackProvider
  │     │     │           │     └── email.py         # EmailProvider
  │     │     │           ├── serializers.py
  │     │     │           ├── views.py
  │     │     │           ├── urls.py
  │     │     │           └── tests/
  │     │     └── core/
  │     │           ├── pagination.py      # CursorPagination custom
  │     │           ├── permissions.py     # permissions partagées (IsOrgMember, IsProjectMember, etc.)
  │     │           ├── exceptions.py      # exception handlers DRF custom
  │     │           ├── middleware.py      # OrgScopeMiddleware (injecte l'orga courante)
  │     │           └── mixins.py         # OrgScopedMixin, ProjectScopedMixin pour les viewsets
  │     │
  │     └── frontend/                     # React SPA
  │           ├── Dockerfile
  │           ├── Dockerfile.dev
  │           ├── package.json
  │           ├── tsconfig.json
  │           ├── vite.config.ts
  │           ├── tailwind.config.ts
  │           ├── index.html
  │           ├── public/
  │           └── src/
  │                 ├── main.tsx
  │                 ├── App.tsx
  │                 ├── router.tsx           # React Router config
  │                 ├── api/
  │                 │     ├── client.ts       # Axios/fetch wrapper avec auth
  │                 │     ├── auth.ts         # endpoints auth
  │                 │     ├── organizations.ts
  │                 │     ├── projects.ts
  │                 │     ├── tickets.ts
  │                 │     ├── agents.ts
  │                 │     └── notifications.ts
  │                 ├── stores/
  │                 │     ├── auth.ts         # Zustand store auth
  │                 │     ├── org.ts          # organisation courante
  │                 │     └── notifications.ts
  │                 ├── hooks/
  │                 │     ├── useAuth.ts
  │                 │     ├── useOrg.ts
  │                 │     ├── useProject.ts
  │                 │     ├── useTickets.ts   # TanStack Query hooks
  │                 │     ├── useBoard.ts
  │                 │     └── usePolling.ts   # polling générique pour les updates
  │                 ├── components/
  │                 │     ├── ui/             # shadcn/ui components (installés via CLI)
  │                 │     ├── layout/
  │                 │     │     ├── AppLayout.tsx     # layout principal (topbar + sidebar + content)
  │                 │     │     ├── TopBar.tsx
  │                 │     │     ├── Sidebar.tsx
  │                 │     │     └── OrgSwitcher.tsx
  │                 │     ├── board/
  │                 │     │     ├── BoardView.tsx      # vue Kanban complète
  │                 │     │     ├── BoardColumn.tsx    # colonne avec drop zone
  │                 │     │     ├── TicketCard.tsx     # carte ticket draggable
  │                 │     │     └── TicketCreateModal.tsx
  │                 │     ├── tickets/
  │                 │     │     ├── TicketDetail.tsx
  │                 │     │     ├── TicketSidebar.tsx  # panneau latéral (status, assignee, repos)
  │                 │     │     ├── AnalysisTab.tsx
  │                 │     │     ├── PlanTab.tsx
  │                 │     │     ├── ReviewTab.tsx
  │                 │     │     ├── PullRequestsTab.tsx
  │                 │     │     └── CommentsTab.tsx
  │                 │     ├── agents/
  │                 │     │     ├── AgentRunStatus.tsx  # badge/indicateur de statut
  │                 │     │     ├── AgentRunDetail.tsx  # détail d'un run avec ses steps
  │                 │     │     └── AgentButtons.tsx    # boutons Challenge/Plan/Code/Review/Fix
  │                 │     └── settings/
  │                 │           ├── OrgSettings.tsx
  │                 │           ├── ProjectSettings.tsx
  │                 │           ├── BoardAgentConfig.tsx  # config des triggers par colonne
  │                 │           └── ProfileSettings.tsx
  │                 ├── pages/
  │                 │     ├── auth/
  │                 │     │     ├── LoginPage.tsx
  │                 │     │     ├── RegisterPage.tsx
  │                 │     │     └── ForgotPasswordPage.tsx
  │                 │     ├── onboarding/
  │                 │     │     └── OnboardingPage.tsx
  │                 │     ├── dashboard/
  │                 │     │     └── OrgDashboardPage.tsx
  │                 │     ├── board/
  │                 │     │     └── BoardPage.tsx
  │                 │     ├── tickets/
  │                 │     │     └── TicketPage.tsx
  │                 │     ├── settings/
  │                 │     │     ├── OrgSettingsPage.tsx
  │                 │     │     ├── ProjectSettingsPage.tsx
  │                 │     │     └── ProfilePage.tsx
  │                 │     └── notifications/
  │                 │           └── NotificationsPage.tsx
  │                 ├── lib/
  │                 │     ├── utils.ts         # utilitaires (cn, formatDate, etc.)
  │                 │     └── constants.ts     # constantes (roles, statuses, etc.)
  │                 └── types/
  │                       ├── auth.ts
  │                       ├── organization.ts
  │                       ├── project.ts
  │                       ├── ticket.ts
  │                       ├── agent.ts
  │                       └── notification.ts
  │
  ├── infra/
  │     ├── k8s/
  │     │     ├── base/                   # manifests de base (kustomize)
  │     │     │     ├── namespace.yml
  │     │     │     ├── frontend/
  │     │     │     ├── backend/
  │     │     │     ├── celery/
  │     │     │     ├── ingress.yml
  │     │     │     └── kustomization.yml
  │     │     ├── overlays/
  │     │     │     ├── dev/              # overrides dev local (k3d)
  │     │     │     ├── staging/          # overrides staging
  │     │     │     └── production/       # overrides production
  │     │     └── helm-values/
  │     │           ├── postgresql.yml
  │     │           └── redis.yml
  │     └── terraform/                    # (optionnel) provisionning du cluster K8s
  │           ├── main.tf
  │           ├── variables.tf
  │           └── outputs.tf
  │
  ├── docs/
  │     ├── architecture.md
  │     ├── api.md
  │     └── agents.md
  │
  ├── scripts/
  │     ├── setup-dev.sh                  # script de setup du dev local
  │     ├── seed-db.sh                    # données de test
  │     └── reset-db.sh
  │
  ├── .env.example
  ├── .gitignore
  ├── Tiltfile                            # configuration Tilt (dev local K8s)
  ├── Makefile                            # commandes utilitaires
  └── README.md
```

### 6.2 Makefile (commandes clés)

```makefile
# === Cluster local ===
cluster-create:             # Créer le cluster k3d local
	k3d cluster create autodev-local \
		--port "3000:80@loadbalancer" \
		--port "8000:8000@loadbalancer"

cluster-delete:             # Supprimer le cluster local
	k3d cluster delete autodev-local

# === Développement ===
dev:                        # Lance Tilt (build, deploy, hot reload)
	tilt up

dev-down:                   # Stop Tilt
	tilt down

dev-dashboard:              # Ouvre le dashboard Tilt
	open http://localhost:10350

# === Backend (via kubectl exec) ===
migrate:                    # Appliquer les migrations Django
	kubectl exec -it deploy/backend -- python manage.py migrate

makemigrations:             # Créer les migrations
	kubectl exec -it deploy/backend -- python manage.py makemigrations

shell:                      # Shell Django
	kubectl exec -it deploy/backend -- python manage.py shell_plus

# === Tests ===
test-backend:               # Tests backend
	kubectl exec -it deploy/backend -- pytest

test-frontend:              # Tests frontend
	kubectl exec -it deploy/frontend -- npm run test

test:                       # Tous les tests
	make test-backend && make test-frontend

# === Lint ===
lint:                       # Lint tout
	kubectl exec -it deploy/backend -- ruff check .
	kubectl exec -it deploy/frontend -- npm run lint

# === Build (CI) ===
build:                      # Build les images Docker
	docker build -t ghcr.io/autodev/backend:latest services/backend
	docker build -t ghcr.io/autodev/frontend:latest services/frontend

# === Deploy ===
deploy-staging:             # Deploy sur staging
	kubectl apply -k infra/k8s/overlays/staging

deploy-prod:                # Deploy sur production
	kubectl apply -k infra/k8s/overlays/production

# === Setup initial ===
setup:                      # Setup complet du dev local
	make cluster-create
	make dev
```

---

## 7. Modèle de données — Compléments et affinements

### 7.1 Éléments manquants identifiés

#### `AuditLog`

Traçabilité des actions importantes dans l'organisation. Essentiel pour un SaaS B2B.

```python
class AuditLog(Model):
    class Action(TextChoices):
        # Org
        ORG_UPDATED        = 'org_updated', 'Organization Updated'
        MEMBER_INVITED      = 'member_invited', 'Member Invited'
        MEMBER_REMOVED      = 'member_removed', 'Member Removed'
        MEMBER_ROLE_CHANGED = 'member_role_changed', 'Member Role Changed'
        # Project
        PROJECT_CREATED     = 'project_created', 'Project Created'
        PROJECT_DELETED     = 'project_deleted', 'Project Deleted'
        REPO_LINKED         = 'repo_linked', 'Repository Linked'
        REPO_UNLINKED       = 'repo_unlinked', 'Repository Unlinked'
        # SCM
        SCM_CONNECTED       = 'scm_connected', 'SCM Connected'
        SCM_DISCONNECTED    = 'scm_disconnected', 'SCM Disconnected'
        # Billing
        PLAN_CHANGED        = 'plan_changed', 'Plan Changed'
        # Agent
        AGENT_TRIGGERED     = 'agent_triggered', 'Agent Triggered'
        AGENT_COMPLETED     = 'agent_completed', 'Agent Completed'

    id              = UUIDField(primary_key=True, default=uuid4)
    organization    = ForeignKey('organizations.Organization', on_delete=CASCADE, related_name='audit_logs')
    user            = ForeignKey('users.User', on_delete=SET_NULL, null=True)  # qui a fait l'action
    action          = CharField(max_length=50, choices=Action.choices)

    # --- Contexte ---
    resource_type   = CharField(max_length=50)   # 'project', 'ticket', 'repository', etc.
    resource_id     = UUIDField(null=True)        # ID de la ressource concernée
    metadata        = JSONField(default=dict)     # détails supplémentaires (ex: ancien rôle → nouveau rôle)

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)
    ip_address      = GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['organization', 'created_at']),
            Index(fields=['action']),
            Index(fields=['user']),
        ]
```

#### `WebhookEvent`

Log des webhooks entrants (GitHub, Stripe, Slack). Essentiel pour le debug et le replay.

```python
class WebhookEvent(Model):
    class Source(TextChoices):
        GITHUB    = 'github', 'GitHub'
        BITBUCKET = 'bitbucket', 'Bitbucket'
        GITLAB    = 'gitlab', 'GitLab'
        STRIPE    = 'stripe', 'Stripe'
        SLACK     = 'slack', 'Slack'

    class Status(TextChoices):
        RECEIVED   = 'received', 'Received'
        PROCESSING = 'processing', 'Processing'
        PROCESSED  = 'processed', 'Processed'
        FAILED     = 'failed', 'Failed'
        IGNORED    = 'ignored', 'Ignored'

    id              = UUIDField(primary_key=True, default=uuid4)
    source          = CharField(max_length=20, choices=Source.choices)
    event_type      = CharField(max_length=100)  # ex: "push", "pull_request.opened", "invoice.paid"
    external_id     = CharField(max_length=255, blank=True, default='')  # ID du webhook côté provider

    # --- Payload ---
    headers         = JSONField(default=dict)
    payload         = JSONField(default=dict)

    # --- Traitement ---
    status          = CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)
    error_message   = TextField(blank=True, default='')
    processed_at    = DateTimeField(null=True, blank=True)

    # --- Lien orga (si identifiable) ---
    organization    = ForeignKey('organizations.Organization', on_delete=SET_NULL, null=True, blank=True)

    # --- Timestamps ---
    created_at      = DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'webhook_events'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['source', 'event_type']),
            Index(fields=['status']),
            Index(fields=['created_at']),
            Index(fields=['external_id']),
        ]
```

### 7.2 Affinements sur les modèles existants

**Ticket — ajout de `ticket_prefix` sur Project** : chaque projet devrait avoir un préfixe personnalisable pour ses tickets (ex: "AD" pour Autodev, "LP" pour Landing Page). Ajout d'un champ sur `Project` :

```python
# Dans Project
ticket_prefix = CharField(max_length=10, default='AD')  # préfixe des tickets, ex: AD-1, AD-2
ticket_counter = IntegerField(default=0)  # auto-incrémenté à chaque création de ticket
```

**Comment — ajout de `source_channel`** : pour savoir d'où vient une réponse (directement dans l'app, via Slack, via email) :

```python
# Dans Comment
source_channel = CharField(
    max_length=20, default='in_app',
    choices=[('in_app','In-App'),('slack','Slack'),('email','Email')]
)
```

---

## 8. Wireframes — Vues Review & Fix

### 8.1 Onglet Review (dans le détail ticket)

```
┌──────────────────────────────────────────────────────────────────────┐
│  === Onglet Review ===                                               │
│                                                                      │
│  Dernière review — il y a 1h │ PR #23 (autodev-api)                  │
│  Verdict : ⚠️ Changes Requested │ Conformité au plan : 92/100        │
│                                                                      │
│  Résumé :                                                            │
│  "Le code est globalement conforme au plan. 2 problèmes majeurs      │
│   identifiés : une faille de sécurité sur l'endpoint et un test      │
│   manquant pour le edge case d'expiration du token."                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Findings (5)        [Tous ▼] [Sévérité ▼] [Statut ▼]         │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ 🔴 CRITICAL │ Sécurité │ views/auth.py:42                     │  │
│  │ Token non validé avant utilisation                             │  │
│  │ Status: Open                              [Voir] [Ignorer]    │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ 🟠 MAJOR │ Tests │ tests/test_auth.py                         │  │
│  │ Test manquant : expiration du refresh token                    │  │
│  │ Status: Open                              [Voir] [Ignorer]    │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ 🟡 MINOR │ Style │ serializers/user.py:15                     │  │
│  │ Variable mal nommée : 'x' devrait être 'user_data'            │  │
│  │ Status: Fixed ✅                                               │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ 💬 SUGGESTION │ Performance │ views/auth.py:78                 │  │
│  │ Requête N+1 potentielle, préférer select_related              │  │
│  │ Status: Open                              [Voir] [Ignorer]    │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ 💬 SUGGESTION │ Style │ views/auth.py:92                      │  │
│  │ Docstring manquante sur la méthode handle_callback             │  │
│  │ Status: Won't Fix                                              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [🔄 Relancer la review]  [🔧 Lancer le Fix Agent (2 critical+major)]│
│                                                                      │
│  Historique des reviews :                                            │
│  • Review #2 — il y a 1h — 5 findings (1 critical, 1 major)         │
│  • Review #1 — il y a 3h — 8 findings (2 critical, 3 major)         │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Détail d'un Finding (modale ou panneau)

```
┌──────────────────────────────────────────────────────────────────┐
│  🔴 CRITICAL — Sécurité                                    [✕]  │
│  Token non validé avant utilisation                              │
│                                                                  │
│  Fichier : views/auth.py                                         │
│  Lignes : 42-48                                                  │
│                                                                  │
│  Description :                                                   │
│  Le token reçu dans le callback OAuth est utilisé directement    │
│  sans vérification de signature ni de date d'expiration.         │
│  Un attaquant pourrait forger un token valide.                   │
│                                                                  │
│  Code concerné :                                                 │
│  ┌────────────────────────────────────────────────────────┐      │
│  │ 42 │ def handle_callback(request):                     │      │
│  │ 43 │     token = request.GET.get('token')              │      │
│  │ 44 │     user_data = decode_token(token)  # ← pas de  │      │
│  │ 45 │     # vérification de validité                    │      │
│  │ 46 │     user = get_or_create_user(user_data)          │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                  │
│  Suggestion du reviewer :                                        │
│  "Ajouter une vérification du token avec validate_token()        │
│   avant le decode, et vérifier que exp > now(). Lever une        │
│   AuthenticationError si invalide."                              │
│                                                                  │
│  Statut : [Open ▼]                                               │
│  Fix appliqué par : —                                            │
│                                                                  │
│                     [Marquer Won't Fix]  [Lancer le Fix ▶]       │
└──────────────────────────────────────────────────────────────────┘
```

### 8.3 Boutons agents mis à jour sur le ticket

```
┌──────────────────────────────────────────────────────────────────┐
│  Actions agents :                                                │
│                                                                  │
│  [🤖 Challenge]  [📋 Plan]  [▶ Code]  [🔍 Review]  [🔧 Fix]    │
│                                                                  │
│  État actuel :                                                   │
│  Challenge : ✅ Approved (85/100)                                │
│  Plan      : ✅ Approved (M, ~4h)                               │
│  Code      : ✅ PR Created (#23, #11)                           │
│  Review    : ⚠️ Changes Requested (1 critical, 1 major)         │
│  Fix       : 🔄 In Progress...                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 8.4 Ajout aux routes frontend

| Route | Page | Accès minimum |
|-------|------|---------------|
| `/{org_slug}/{project_slug}/tickets/{key}?tab=review` | Onglet Review du ticket | Project Viewer+ |
| `/{org_slug}/settings/audit-log` | Journal d'audit | Admin |

---

## 9. Modèle de pricing

### 9.1 Philosophie

- **Freemium** : un plan gratuit pour attirer et convertir
- Facturation à la maille **organisation**
- Les **Guests sont gratuits** (comme Linear, Notion) — ça encourage l'adoption
- Le levier de monétisation principal : le nombre de **runs AI par mois** (c'est ce qui coûte en LLM)
- Levier secondaire : nombre de projets et de membres

### 9.2 Plans

| | **Free** | **Starter** | **Pro** | **Enterprise** |
|---|---|---|---|---|
| **Prix** | 0€ | 19€/mois | 49€/mois | Sur devis |
| **Membres** | 2 | 5 | 20 | Illimité |
| **Projets** | 1 | 5 | 20 | Illimité |
| **AI Runs / mois** | 50 | 300 | 1 500 | Illimité / custom |
| **Repos par projet** | 2 | 5 | Illimité | Illimité |
| **Guests** | Illimité | Illimité | Illimité | Illimité |
| **Agents disponibles** | Challenge + Plan | Tous (5) | Tous (5) | Tous (5) |
| **Historique runs** | 7 jours | 30 jours | 90 jours | Illimité |
| **Audit log** | ✗ | ✗ | ✅ | ✅ |
| **SSO / SAML** | ✗ | ✗ | ✗ | ✅ |
| **Support** | Community | Email | Email prioritaire | Dédié |
| **SLA** | — | — | 99.5% | 99.9% |

### 9.3 Comptabilisation des AI Runs

Un **AI Run** = une exécution complète d'un agent (quel que soit le nombre de steps LLM internes). Donc :
- Lancer le Challenge Agent = 1 run
- Lancer le Plan Agent = 1 run
- Lancer le Code Agent = 1 run
- Lancer le Review Agent = 1 run
- Lancer le Fix Agent = 1 run

Le compteur est incrémenté sur `BillingAccount.current_ai_runs_count` à chaque AgentRun créé. Il est reset le 1er du mois par un CronJob.

Si le quota est atteint :
- Les triggers automatiques sont désactivés
- Les boutons manuels affichent "Quota atteint — Passez au plan supérieur"
- Les agents en cours de run ne sont pas interrompus

### 9.4 Intégration Stripe

- **Stripe Checkout** pour l'abonnement initial
- **Stripe Customer Portal** pour la gestion (changement de plan, mise à jour carte, factures)
- **Stripe Webhooks** pour synchroniser les événements (paiement réussi, échec, annulation, changement de plan)
- Les prix sont définis dans Stripe (Price IDs), pas en dur dans le code

---

## 10. Briefing Écrans — Google Stitch

### 10.0 Contexte produit

**Autodev** est un SaaS B2B d'AI-powered project management pour les équipes de développement. C'est un board Kanban (style Linear/Jira) dans lequel des agents AI analysent les tickets, proposent des plans d'implémentation, génèrent du code et des Pull Requests, font des code reviews, et appliquent les fixes automatiquement.

**Esthétique visée** : Linear, Notion, Vercel Dashboard. Interface sombre ou claire, épurée, dense en information mais pas surchargée. Typographie propre, espaces généreux, micro-interactions fluides. Pas de couleurs criardes — palette sobre avec des accents de couleur pour les statuts et priorités.

**Utilisateurs cibles** : développeurs, tech leads, CTOs, product owners.

**Structure de navigation** : layout à 3 zones — top bar (org switcher, breadcrumb, notifications, profil), sidebar gauche (liste des projets, navigation settings), zone de contenu principale.

---

### 10.1 Écran : Login

**Route** : `/auth/login`

**Layout** : pleine page, pas de sidebar ni topbar. Split screen ou centré.

**Contenu** :
- Logo Autodev en haut
- Formulaire : champ email, champ mot de passe
- Bouton "Se connecter" (primaire)
- Lien "Mot de passe oublié ?"
- Séparateur "ou"
- Bouton "Continuer avec GitHub" (OAuth, icône GitHub)
- Lien en bas : "Pas encore de compte ? S'inscrire"

**Notes** : pas d'autres providers OAuth pour le MVP, juste GitHub (c'est la cible principale).

---

### 10.2 Écran : Register

**Route** : `/auth/register`

**Layout** : même layout que le login, pleine page centrée.

**Contenu** :
- Logo Autodev
- Formulaire : champ nom complet, champ email, champ mot de passe, champ confirmation mot de passe
- Bouton "Créer mon compte" (primaire)
- Séparateur "ou"
- Bouton "Continuer avec GitHub"
- Lien en bas : "Déjà un compte ? Se connecter"

---

### 10.3 Écran : Onboarding (wizard 3 étapes)

**Route** : `/onboarding`

**Layout** : pleine page, pas de sidebar. Stepper horizontal en haut montrant les 3 étapes avec progression. Une étape visible à la fois.

**Étape 1 — Créer votre organisation** :
- Champ : nom de l'organisation
- Champ : slug URL (auto-généré depuis le nom, éditable). Preview : "app.autodev.com/mon-slug"
- Upload logo (optionnel)
- Bouton "Suivant →"

**Étape 2 — Connecter votre forge Git** :
- 3 cartes cliquables côte à côte : GitHub (icône), Bitbucket (icône), GitLab (icône)
- Cliquer lance le flow OAuth / installation de l'App
- Une fois connecté, la carte affiche "✅ Connecté — org-name"
- Bouton "Passer cette étape" (texte discret)
- Bouton "Suivant →"

**Étape 3 — Créer votre premier projet** :
- Champ : nom du projet
- Champ : préfixe des tickets (auto-généré, 2-4 lettres, ex: "AD")
- Liste de repos disponibles (depuis la connexion étape 2) avec des checkboxes pour sélectionner ceux à lier au projet
- Bouton "Commencer →" (primaire, lance le projet et redirige vers le board)

---

### 10.4 Écran : Dashboard Organisation

**Route** : `/{org_slug}`

**Layout** : layout principal (topbar + sidebar + contenu). C'est la page d'accueil après login.

**Top bar** :
- À gauche : Org Switcher (dropdown avec liste des orgas de l'utilisateur, option "Créer une organisation")
- Centre : breadcrumb "Acme Corp > Dashboard"
- À droite : icône cloche (notifications, badge rouge si unread), icône aide (?), avatar utilisateur (dropdown : Mon profil, Préférences, Déconnexion)

**Sidebar gauche** :
- Section haute : "Projets" avec la liste des projets de l'orga. Chaque projet a une pastille de couleur + nom. Cliquer navigue vers le board du projet. Bouton "+ Nouveau projet" en bas de la liste.
- Séparateur
- Section basse : liens "Settings", "Membres", "Billing", "Connexions Git". Visibles uniquement pour les rôles Admin/Owner.

**Contenu principal** :
- Titre : "Dashboard"
- Ligne de 3 cartes stats : nombre de projets actifs, nombre de tickets ouverts (tous projets), nombre de PRs cette semaine
- Section "Projets" : liste sous forme de cartes ou de lignes de tableau. Chaque projet affiche : icône couleur, nom, nombre de tickets ouverts, nombre de PRs ouvertes, dernière activité (relative : "il y a 2h"). Cliquer navigue vers le board.
- Section "Activité récente" : fil chronologique des dernières actions sur l'orga (agent terminé, PR créée, PR mergée, membre ajouté). Chaque ligne : icône, description courte, projet concerné, temps relatif.
- Barre de progression "Usage AI ce mois" : barre de progression avec le ratio runs utilisés / quota du plan (ex: "78/100 runs"). Couleur verte si < 80%, orange si 80-95%, rouge si > 95%.

---

### 10.5 Écran : Board Kanban (vue principale)

**Route** : `/{org_slug}/{project_slug}/board`

**Layout** : layout principal. C'est l'écran le plus important de l'application.

**Top bar** : breadcrumb "Acme Corp > Autodev API > Board"

**Sidebar** : même que le dashboard, avec le projet courant mis en surbrillance.

**Contenu principal — zone board** :
- **Barre d'outils** en haut :
  - À gauche : nom du projet avec icône couleur
  - Filtres : dropdown "Assigné à" (liste des membres avec avatar), dropdown "Labels" (multi-select avec pastilles couleur), dropdown "Priorité" (None/Low/Medium/High/Urgent), champ de recherche texte
  - À droite : bouton "+ Ticket" (primaire, ouvre la modale de création)

- **Board** : scroll horizontal. Chaque colonne est un conteneur vertical.
  - **En-tête de colonne** : nom de la colonne, badge compteur de tickets, icône 🤖 si un agent auto-trigger est configuré sur cette colonne. Menu ⋯ (renommer, configurer triggers, supprimer).
  - **Cartes ticket** : draggable verticalement (dans la colonne) et horizontalement (entre colonnes). Chaque carte affiche :
    - Ticket key (ex: "AD-42") en gras, grisé
    - Titre du ticket (1-2 lignes, tronqué)
    - Ligne de badges : priorité (pastille couleur : gris/vert/jaune/orange/rouge), labels (petites pastilles colorées)
    - Ligne de statuts agents : icônes compactes montrant l'état de chaque agent qui a été lancé. Ex: ✅ (challenge OK), 📋 (plan généré), 🔄 (code en cours), ⚠️ (review changes requested). Seuls les agents qui ont un statut autre que "not_started" sont affichés.
    - Avatar de l'assignee (petit, en bas à droite de la carte)
  - **Zone de drop** en bas de chaque colonne : espace vide pour dropper un ticket en dernière position
  - **WIP limit** : si la colonne a une limite et qu'elle est atteinte, l'en-tête passe en rouge/orange

---

### 10.6 Écran : Modale création de ticket

**Trigger** : bouton "+ Ticket" sur le board, ou raccourci clavier "C"

**Layout** : modale centrée, largeur ~700px, overlay sombre derrière.

**Contenu** :
- Titre de la modale : "Nouveau ticket"
- Champ : titre du ticket (input texte, pleine largeur, placeholder "Titre du ticket")
- Champ : description (éditeur Markdown avec toolbar basique : bold, italic, code, lien, liste. Zone de texte haute ~200px. Preview Markdown optionnel)
- Champ : critères d'acceptation (même éditeur Markdown, zone plus petite ~120px)
- Ligne de sélecteurs :
  - Dropdown "Colonne" (défaut : Backlog)
  - Dropdown "Priorité" (défaut : None)
- Ligne de sélecteurs :
  - Dropdown "Assigné à" (liste des membres du projet avec avatars, option "Non assigné")
  - Multi-select "Labels" (avec pastilles couleur, option "Créer un label")
- Section "Repos impactés" : liste des repos liés au projet, chacun avec une checkbox. Au moins un repo doit être coché pour que les agents Code/Review/Fix puissent fonctionner.
- Pied de modale : bouton "Annuler" (secondaire), bouton "Créer le ticket" (primaire)

---

### 10.7 Écran : Détail d'un ticket

**Route** : `/{org_slug}/{project_slug}/tickets/{ticket_key}`

**Layout** : layout principal. Page en deux zones : contenu principal à gauche (~70%), panneau latéral à droite (~30%).

**Zone principale gauche** :
- En-tête : bouton retour "← Board", ticket key "AD-42" (gris), titre du ticket (grand, éditable inline), bouton "Éditer" (si permission Member+)
- Description en Markdown rendu. Cliquer pour éditer (si permission).
- Critères d'acceptation en Markdown rendu.
- Ligne de boutons agents : 5 boutons côte à côte [🤖 Challenge] [📋 Plan] [▶ Code] [🔍 Review] [🔧 Fix]. Chaque bouton affiche le statut courant sous forme de badge (ex: "✅ 85/100" sous le bouton Challenge). Un bouton est disabled si ses pré-requis ne sont pas remplis (ex: Code disabled si plan pas approuvé). Tooltip explicatif au hover.
- Onglets : [Analyse] [Plan] [Pull Requests] [Review] [Commentaires] [Historique]
  - **Onglet Analyse** : affiche la dernière AIAnalysis. Score de complétude (jauge circulaire ou barre), liste des forces (✅), faiblesses (⚠️), suggestions (💡), questions ouvertes (❓ avec statut résolu/en attente). Lien vers l'historique des analyses.
  - **Onglet Plan** : affiche le dernier ImplementationPlan. Complexité estimée + heures. Liste des steps groupés par repo. Chaque step : icône de type (backend/frontend/test/migration/config/docs), titre, description, fichiers impactés. Boutons "✅ Approuver" et "❌ Rejeter" en bas (si permission Member+).
  - **Onglet Pull Requests** : liste des PRs du ticket. Chaque PR : titre, repo, branche → branche cible, statut (Draft/Open/Merged/Closed), stats (+additions, -deletions, fichiers), lien "Voir sur GitHub ↗". Badge de statut coloré.
  - **Onglet Review** : dernière review avec verdict (Approved ✅ ou Changes Requested ⚠️), score de conformité au plan, résumé Markdown. Liste des findings filtrables par sévérité et statut. Chaque finding : pastille sévérité (🔴🟠🟡💬), catégorie, fichier:ligne, titre, statut (Open/Fixed/Won't Fix/Ignored). Actions par finding : "Voir détail", "Ignorer", "Marquer Won't Fix". Boutons en bas : "🔄 Relancer la review", "🔧 Lancer le Fix Agent (N findings open)". Cliquer sur un finding ouvre une modale avec le code concerné, la description détaillée, et la suggestion de fix.
  - **Onglet Commentaires** : fil de commentaires chronologique. Chaque commentaire : avatar + nom (ou 🤖 + "Challenge Agent"), timestamp relatif, corps en Markdown. Les commentaires des agents ont un style distinct (fond légèrement différent, icône agent). Les questions des agents ont un indicateur "❓ Question" et un bouton "Marquer comme résolu". Possibilité de répondre en thread (réponse indentée sous le commentaire parent). Zone de saisie en bas avec éditeur Markdown.
  - **Onglet Historique** : timeline des événements du ticket : création, déplacements entre colonnes, lancements d'agents, changements de statut, commentaires, PRs créées. Chaque événement : icône, description, auteur, timestamp.

**Panneau latéral droit** :
- Section "Statut" : nom de la colonne actuelle (dropdown pour déplacer)
- Section "Priorité" : dropdown (None/Low/Medium/High/Urgent avec pastille couleur)
- Section "Assigné à" : avatar + nom (dropdown pour changer)
- Section "Labels" : pastilles colorées (multi-select pour ajouter/retirer)
- Section "Repos impactés" : liste des repos du projet avec checkboxes
- Séparateur
- Section "Infos" : créé par (avatar + nom), créé le (date), mis à jour le (date)
- Section "Estimation" : complexité (XS/S/M/L/XL, dropdown ou boutons radio)

---

### 10.8 Écran : Settings du projet

**Route** : `/{org_slug}/{project_slug}/settings`

**Layout** : layout principal. Navigation par onglets horizontaux en haut du contenu.

**Onglets : [Général] [Repos] [Board & Agents] [Membres] [Danger Zone]**

**Onglet Général** :
- Champ : nom du projet (input texte)
- Champ : description (textarea)
- Champ : préfixe des tickets (input texte, ex: "AD")
- Sélecteur : icône (emoji picker) + couleur (color picker)
- Zone : "Instructions pour les agents AI" (textarea large, Markdown). Placeholder : "Décrivez l'architecture, les conventions, le style de code attendu..."
- Bouton "Sauvegarder" (primaire)

**Onglet Repos** :
- Liste des repos liés au projet. Chaque repo : nom complet (ex: "acme-corp/autodev-api"), forge (icône GitHub/Bitbucket/GitLab), branche par défaut, statut d'indexation (Indexed ✅ / Indexing 🔄 / Failed ❌ / Pending ⏳), date de dernière indexation, boutons "Réindexer" et "Délier" (icône poubelle).
- Bouton "+ Lier un repo" : ouvre un picker avec les repos de l'orga non encore liés à ce projet.
- Section "Conventions Git" :
  - Champ : branche cible par défaut (input, ex: "main")
  - Champ : template de branche (input, ex: "feature/AD-{ticket_id}-{slug}"). Preview dynamique.
  - Champ : template titre de PR (input, ex: "[AD-{ticket_id}] {ticket_title}"). Preview dynamique.

**Onglet Board & Agents** :
- Liste des colonnes du board. Chaque colonne : drag handle (≡) pour réordonner, nom (éditable inline), couleur, WIP limit (input nombre, optionnel), nombre de triggers configurés (badge), bouton ⚙ (configurer les triggers), bouton 🗑 (supprimer, avec confirmation).
- Bouton "+ Ajouter une colonne"
- Au clic sur ⚙ d'une colonne, un panneau/modale s'ouvre :
  - Titre : "Triggers pour [nom de la colonne]"
  - Liste des triggers existants. Chaque trigger : type d'agent (icône + nom), mode (Auto/Manuel), conditions actives (badges texte), colonne de destination si succès, toggle actif/inactif, bouton supprimer.
  - Bouton "+ Ajouter un trigger" : formulaire avec dropdown agent type, dropdown mode (Auto/Manuel), checkboxes conditions (challenge approuvé requis, plan approuvé requis, repos sélectionnés requis, PR créée requise, review terminée requise), dropdown colonne de destination en cas de succès (optionnel, "Ne pas déplacer"), toggles notification au démarrage / à la fin.

**Onglet Membres** :
- Liste des membres du projet. Chaque membre : avatar, nom, email, rôle (badge), mention "(Guest)" si guest, dropdown pour changer le rôle, bouton retirer.
- Bouton "+ Inviter un membre" : dropdown pour sélectionner un membre de l'orga à ajouter au projet, avec sélection du rôle projet.

**Onglet Danger Zone** :
- Fond rouge léger. Titre "Supprimer ce projet". Description "Cette action est irréversible. Tous les tickets, plans, analyses et PRs seront supprimés." Bouton "Supprimer le projet" (rouge, avec confirmation par re-saisie du nom du projet).

---

### 10.9 Écran : Settings Organisation

**Route** : `/{org_slug}/settings`

**Layout** : layout principal. Onglets horizontaux.

**Onglets : [Général] [Membres] [Connexions Git] [Notifications] [Billing] [Audit Log]**

**Onglet Général** :
- Champ : nom de l'organisation (input)
- Slug affiché en lecture seule (non modifiable après création)
- Upload logo
- Bouton "Sauvegarder"

**Onglet Membres** :
- Liste des membres de l'orga. Chaque membre : avatar, nom complet, email, rôle (badge couleur : Owner bleu, Admin violet, Member gris), date d'ajout. Actions : dropdown changer rôle (sauf Owner si dernier), bouton retirer (icône poubelle, avec confirmation).
- Section "Invitations en attente" : liste des invitations non acceptées. Chaque invitation : email, rôle prévu, "(Guest)" si guest, projets guest assignés, date d'envoi, bouton "Révoquer".
- Bouton "+ Inviter" : modale avec champ email, dropdown rôle (Admin/Member), checkbox "Inviter en tant que Guest" (si coché : affiche un multi-select de projets et un dropdown rôle projet Viewer/Member).

**Onglet Connexions Git** :
- Liste des SCM Connections. Chaque connexion : icône de la forge (GitHub/Bitbucket/GitLab), nom de l'organisation sur la forge, statut "Connecté ✅", nombre de repos importés, date de connexion, bouton "Déconnecter" (avec confirmation).
- Bouton "+ Connecter une forge" : 3 boutons/cartes (GitHub, Bitbucket, GitLab) qui lancent le flow OAuth.
- Section "Repositories de l'organisation" : liste de tous les repos importés, toutes forges confondues. Chaque repo : icône forge, nom complet, statut d'indexation, nombre de projets qui l'utilisent. Actions : "Réindexer", "Retirer" (avec warning si utilisé par des projets).
- Bouton "+ Importer des repos" : ouvre un picker par connexion avec la liste des repos disponibles sur la forge (non encore importés), avec checkboxes pour sélection multiple.

**Onglet Notifications** :
- Liste des canaux de notification. Chaque canal : icône (🔔 In-App, 💬 Slack, 📧 Email), statut actif/inactif (toggle), badge "Par défaut" si c'est le canal par défaut, bouton "Configurer" (pour Slack : workspace connecté ; pour Email : provider configuré). Le canal In-App ne peut pas être supprimé (pas de bouton supprimer).
- Bouton "+ Ajouter un canal" : choix entre Slack et Email, avec le formulaire de configuration approprié.
- Dropdown "Canal par défaut pour les agents" : sélectionner le canal par défaut.

**Onglet Billing** :
- Carte du plan actuel : nom du plan (ex: "Pro"), prix, date de renouvellement.
- Barres de progression des limites : membres (3/20), projets (3/20), AI runs ce mois (78/1500).
- Bouton "Changer de plan" : affiche les 4 plans côte à côte (Free/Starter/Pro/Enterprise) avec les features de chaque plan, le plan actuel mis en surbrillance, et des boutons "Passer à ce plan" sur les autres.
- Bouton "Gérer le paiement" : redirige vers Stripe Customer Portal.
- Section "Historique des factures" : liste des dernières factures avec date, montant, statut (payé/en attente/échoué), lien de téléchargement PDF.

**Onglet Audit Log** (Pro+ uniquement) :
- Fil chronologique des événements de l'orga. Chaque événement : icône d'action, description ("Camille a ajouté Pierre comme Member"), ressource concernée (lien vers le projet/ticket), timestamp.
- Filtres : par utilisateur, par type d'action, par plage de dates.
- Pagination.

---

### 10.10 Écran : Notifications

**Route** : `/{org_slug}/notifications`

**Layout** : layout principal.

**Contenu** :
- Titre "Notifications" avec bouton "Tout marquer lu" à droite.
- Liste de notifications groupées par jour ("Aujourd'hui", "Hier", "Lundi 30 mars", etc.).
- Chaque notification : indicateur non lu (pastille bleue) ou lu (gris), icône du type (🤖 question agent, 📋 plan généré, 🔀 PR créée, 🔍 review terminée, 🔧 fix appliqué, 👤 assignation, 📨 invitation), titre, description courte (1 ligne), nom du projet concerné, timestamp relatif.
- Cliquer sur une notification : marque comme lue et navigue vers la ressource (ticket, PR, etc.).
- Si pas de notifications : état vide avec illustration et texte "Pas de notification pour l'instant".

La top bar affiche aussi un panneau de notifications en dropdown (au clic sur la cloche) qui montre les 5-10 dernières notifications avec un lien "Voir toutes les notifications" en bas.

---

### 10.11 Écran : Profil utilisateur

**Route** : `/settings/profile`

**Layout** : layout principal, contenu centré (largeur max ~600px).

**Contenu** :
- Section "Profil" :
  - Upload avatar (zone circulaire cliquable)
  - Champ : nom complet
  - Email affiché en lecture seule
  - Dropdown : langue préférée (Français / English)

- Section "Notifications" :
  - Dropdown : canal de notification préféré (In-App / Slack / Email)
  - Checkboxes : "Questions des agents AI" (on/off), "Plans d'implémentation générés" (on/off), "Pull Requests créées" (on/off), "Reviews terminées" (on/off), "Fixes appliqués" (on/off)

- Section "Sécurité" :
  - Bouton "Changer le mot de passe" (ouvre une modale avec ancien mdp, nouveau mdp, confirmation)
  - Liste "Sessions actives" : navigateur/appareil, dernière activité, bouton "Révoquer" par session

- Bouton "Sauvegarder" (primaire, sticky en bas)

---

### 10.12 Écran : Accepter une invitation

**Route** : `/invitations/{token}`

**Layout** : pleine page centrée, pas de sidebar ni topbar (l'utilisateur n'est peut-être pas encore connecté).

**Contenu** :
- Logo Autodev
- Message : "Vous avez été invité à rejoindre **Acme Corp** en tant que **Member**"
- Si l'utilisateur est déjà connecté : bouton "Accepter l'invitation" (primaire), bouton "Décliner" (secondaire)
- Si l'utilisateur n'est pas connecté : formulaire de login/register avec message "Connectez-vous ou créez un compte pour accepter l'invitation"
- Si l'invitation est expirée ou révoquée : message d'erreur "Cette invitation n'est plus valide" avec bouton "Retour à l'accueil"