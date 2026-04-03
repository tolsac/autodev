# Autodev — AI-Powered Project Management & Dev Agent

## Vision produit

SaaS B2B de gestion de projet augmentée par l'IA. Un board Kanban (style Linear/Jira) dans lequel une IA vient :
- **Challenger les tickets** : analyser si le besoin est suffisamment détaillé, identifier les manques
- **Proposer des plans d'implémentation** : découpage front/back/tests, estimation de complexité
- **Analyser la codebase** : comparer le ticket au code existant du repo connecté
- **Générer des Pull Requests** : coder directement et proposer une PR sur GitHub

Multi-projets, chaque projet connecté à un ou plusieurs repositories GitHub.

## Objectif business

- SaaS à monétiser (modèle d'abonnement)
- Cible : équipes de développement, tech leads, CTOs
- Landing page marketing séparée de l'application

## Stack technique

### Frontend — React + Vite + shadcn/ui

- **React** (avec TypeScript) pour l'interface utilisateur
- **Vite** comme build tool / dev server (remplace Create React App, pas de SSR inutile)
- **shadcn/ui** (open source, MIT) comme bibliothèque de composants — esthétique Linear-like
- **Tailwind CSS** pour le styling
- **dnd-kit** ou **@hello-pangea/dnd** pour le drag & drop du Kanban
- **React Router** pour le routing côté client (SPA)
- **Zustand** ou **TanStack Query** pour la gestion d'état / données serveur
- **Monaco Editor** (optionnel) pour l'affichage de code dans les tickets

> Pas de Next.js : l'app est derrière un login, pas besoin de SSR/SEO.
> La landing page marketing sera un site statique séparé (Astro, Hugo, ou Webflow).

### Backend API — Django + DRF + PostgreSQL

- **Django** avec **Django REST Framework** pour l'API REST
- **PostgreSQL** + **pgvector** (embeddings du code source dans la même DB)
- **django-allauth** avec OAuth GitHub (connexion des repos)
- **Redis** pour le cache et les queues
- **Celery** pour les tâches asynchrones (ou Redis Streams pour les événements AI)

> Pas de Django Channels / WebSockets pour le MVP.
> Temps réel via **polling court** (3-5s) ou **SSE (Server-Sent Events)**.
> Migration vers WebSocket possible plus tard si besoin de scaling.

### Moteur AI / Agentic — Service Python séparé

- Service dédié, découplé du monolithe Django
- Communication via queue de tâches (Redis + Celery ou Redis Streams / NATS)
- **API Anthropic** (Claude) comme LLM principal
- **LangGraph** pour l'orchestration multi-étapes (workflows agentic)
- Agents :
  - **Agent d'analyse de codebase** : clone le repo, indexe le code avec des embeddings (pgvector)
  - **Agent de challenge de ticket** : compare ticket vs codebase, identifie les manques
  - **Agent de plan d'implémentation** : propose découpage front/back/tests
  - **Agent de PR** : génère le code, crée la PR via API GitHub

### Intégration GitHub — GitHub App

- GitHub App (pas un simple OAuth token)
- Webhooks (push, PR events)
- Accès aux repos, création de PRs et reviews programmatiquement

### Infrastructure — Kubernetes everywhere (k3d + Tilt)

- Un seul mode de déploiement : Kubernetes du dev à la prod (pas de Docker Compose)
- **k3d** (k3s dans Docker) pour le cluster local — léger, démarre en 30 secondes
- **Tilt** pour le dev local — hot reload, dashboard web, rebuild auto des images
- **Kustomize** avec overlays dev / staging / production
- Chaque composant dans son pod : frontend, backend Django, Celery worker, Celery beat, PostgreSQL (Helm), Redis (Helm)
- **Staging/Prod** : cluster managé DigitalOcean DOKS ou Scaleway Kapsule
  - Helm charts pour PostgreSQL (Bitnami) et Redis
  - Ingress NGINX + cert-manager pour le TLS
  - HPA (Horizontal Pod Autoscaler) sur backend et celery workers
- Architecture portable : même manifests K8s partout, pas de vendor lock-in

## Modèle de données (ébauche)

### Hiérarchie organisationnelle

```
Organization (maille la plus haute — ex: "Acme Corp")
  ├── BillingAccount (1:1) — abonnement, plan, facturation Stripe
  ├── Members (N:M) — utilisateurs avec rôles (owner, admin, member)
  ├── SCMConnection (1:N) — connexions aux forges Git (GitHub App, Bitbucket OAuth, GitLab OAuth)
  ├── Repository (1:N) — repos importés dans l'orga, tous providers confondus
  └── Project (1:N) — chaque projet est indépendant
        ├── ProjectRepository (N:M) — repos liés au projet (peuvent venir de forges différentes)
        └── Board (1:1) — chaque projet a son propre Kanban
              ├── Column (1:N) — ex: Backlog, To Do, In Progress, Review, Done
              └── Ticket (1:N)
                    ├── AIAnalysis (challenge du besoin)
                    ├── ImplementationPlan (plan front/back/tests)
                    └── PullRequest (lien vers la PR sur le repo)
```

### Notes sur la hiérarchie

- **Organization** est le tenant principal. Un utilisateur peut appartenir à plusieurs organisations (ex: freelance qui travaille pour plusieurs clients).
- **BillingAccount** est rattaché à l'organisation, pas au projet. La facturation se fait à la maille orga (nombre de projets, nombre de tickets AI traités, etc.).
- **Repository** appartient à l'organisation, pas au projet. Un même repo peut être utilisé par plusieurs projets. Chaque repo est lié à sa SCMConnection (et donc à son type de forge). Un projet peut mixer des repos GitHub et Bitbucket.
- **Project** est le scope de travail. Le board, les tickets — tout vit dans un projet. Les repos sont liés au projet via ProjectRepository (N:M).
- Un utilisateur se connecte → choisit/crée une organisation → accède aux projets de cette orga.

### Rôles & Permissions

#### Rôles Organisation

| Rôle | Description | Accès projets |
|------|-------------|---------------|
| **Owner** | Super-admin. Gère la facturation, les settings orga, peut supprimer l'orga. Minimum 1 par orga, ne peut pas être supprimé s'il est le dernier. | Accès total à tous les projets (implicite, non restreint) |
| **Admin** | Gère les membres de l'orga (inviter, retirer, changer les rôles sauf Owner). Crée des projets. Configure les intégrations GitHub au niveau orga. | Accès total à tous les projets (implicite) |
| **Member** | Rôle par défaut à l'invitation. Ne voit pas les settings orga ni la facturation. | Uniquement les projets auxquels il est explicitement ajouté |

#### Rôles Projet

| Rôle | Description |
|------|-------------|
| **Project Admin** | Configure le projet (repos GitHub, colonnes du board, agents AI). Invite des membres au projet. Peut supprimer le projet (si aussi Admin/Owner orga). |
| **Member** | Crée, édite, supprime des tickets. Déplace les cartes sur le board. Lance les analyses AI, valide les plans d'implémentation, déclenche la génération de PRs. Rôle du développeur au quotidien. |
| **Viewer** | Lecture seule. Voit le board, les tickets, les plans, les PRs. Ne peut rien modifier. Pour les product owners, stakeholders, managers. |

#### Rôle Guest (cross-orga)

| Rôle | Description |
|------|-------------|
| **Guest** | Utilisateur externe invité sur un ou plusieurs projets sans faire partie de l'orga. N'apparaît pas dans la liste des membres orga. Ne voit que les projets auxquels il est invité. Peut avoir un rôle projet (Member ou Viewer) par projet. Cas d'usage : client, prestataire externe, stakeholder. |

#### Règles d'héritage

- **Owner orga** → implicitement **Project Admin** sur tous les projets, non restrictible
- **Admin orga** → implicitement **Project Admin** sur tous les projets, non restrictible
- **Member orga** → aucun accès projet par défaut, doit être ajouté explicitement avec un rôle projet
- **Guest** → aucun accès orga, accès projet uniquement sur invitation avec rôle explicite (Member ou Viewer)

## Agents AI & Interactions avec le Board

### Les agents

Trois agents principaux, déclenchables manuellement ou automatiquement :

| Agent | Déclencheur | Input | Output |
|-------|-------------|-------|--------|
| **Challenge Agent** | Ticket créé ou déplacé dans une colonne cible (configurable) / bouton manuel | Ticket (titre, description, critères d'acceptation) + codebase indexée | Analyse du besoin : complétude, ambiguïtés, questions ouvertes, suggestions d'amélioration |
| **Plan Agent** | Bouton manuel sur un ticket "challengé OK" / automatique après validation du challenge | Ticket validé + codebase indexée + repos impactés | Plan d'implémentation : découpage front/back/tests, fichiers impactés, estimation de complexité |
| **Code Agent** | Bouton manuel "Générer PR" sur un plan validé | Plan d'implémentation validé + codebase + repos cibles | Branche, commits, Pull Request(s) créée(s) sur le(s) repo(s) impacté(s) |

### Workflow type sur le board

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────┐     ┌──────┐
│   Backlog    │ ──► │   Challenge AI   │ ──► │   Plan AI        │ ──► │  Code AI /   │ ──► │ Done │
│              │     │                  │     │                  │     │  Review      │     │      │
│ Ticket créé  │     │ Agent analyse le │     │ Agent propose le │     │ Agent génère │     │      │
│              │     │ besoin, pose des │     │ plan front/back/ │     │ la PR, revue │     │      │
│              │     │ questions si     │     │ tests + fichiers │     │ humaine      │     │      │
│              │     │ nécessaire       │     │ impactés         │     │              │     │      │
└─────────────┘     └──────────────────┘     └──────────────────┘     └─────────────┘     └──────┘
                           │                                                
                           ▼                                                
                    Questions → notification                               
                    au porteur du besoin                                    
                    (Slack / Email / in-app)                                
```

### Interaction Challenge Agent ↔ Porteur du besoin

Quand le Challenge Agent identifie des ambiguïtés ou des manques dans un ticket, il doit pouvoir contacter le créateur du ticket (le "porteur du besoin") pour poser des questions. Ce flux fonctionne comme suit :

1. L'agent génère une liste de questions structurées
2. Les questions sont postées en **commentaire sur le ticket** (toujours, c'est la source de vérité)
3. Une **notification** est envoyée au porteur du besoin via le canal configuré (Slack, email, etc.)
4. Le porteur répond (soit dans l'app, soit via Slack/email — les réponses sont synchronisées dans les commentaires du ticket)
5. L'agent reprend l'analyse avec les nouvelles informations
6. Le ticket reste dans la colonne "Challenge AI" tant que des questions sont ouvertes

Le statut du ticket reflète l'état de l'échange :
- `challenge_in_progress` — l'agent analyse
- `waiting_for_input` — questions posées, en attente de réponse
- `challenge_ok` — besoin validé, prêt pour le plan
- `challenge_failed` — besoin trop flou même après échanges, nécessite une réécriture

### Tickets & Repositories impactés

Un ticket peut impacter **un ou plusieurs repositories** (cas d'un projet avec repos front/back séparés). Sur chaque ticket, l'utilisateur sélectionne les repos impactés parmi ceux connectés au projet.

```
Ticket "Ajouter la page de profil utilisateur"
  ├── Repo impacté : autodev-frontend (React)
  ├── Repo impacté : autodev-api (Django)
  └── Repo impacté : autodev-shared (types/schemas partagés)
```

Le **Plan Agent** produit un plan par repo impacté. Le **Code Agent** génère une PR par repo impacté.

## Abstractions & Providers

### SCM Provider (abstraction Git)

L'intégration avec les forges Git est abstraite derrière une interface `SCMProvider`. GitHub est implémenté en premier, Bitbucket et GitLab suivront.

```
SCMProvider (interface abstraite)
  ├── GitHubProvider (implémentation v1)
  ├── BitbucketProvider (implémentation future)
  └── GitLabProvider (implémentation future)
```

Responsabilités du SCMProvider :
- Authentification (OAuth / App / Token selon la forge)
- Lister les repos accessibles
- Cloner / pull un repo
- Créer une branche
- Committer des fichiers
- Créer une Pull Request / Merge Request
- Écouter les webhooks (push, PR events, reviews)
- Lire les fichiers d'un repo (pour l'indexation)

Chaque projet a un `scm_provider_type` (github, bitbucket, gitlab) configuré au niveau du projet. Tous les repos d'un même projet utilisent le même provider.

### Notification Provider (abstraction communication)

La communication entre les agents AI et les utilisateurs est abstraite derrière une interface `NotificationProvider`.

```
NotificationProvider (interface abstraite)
  ├── SlackProvider (webhook ou bot Slack)
  ├── EmailProvider (SMTP / SendGrid / SES)
  ├── InAppProvider (notifications internes, toujours actif)
  └── (futur : Microsoft Teams, Discord, etc.)
```

Responsabilités du NotificationProvider :
- Envoyer une notification à un utilisateur
- Envoyer une question structurée (avec possibilité de réponse)
- Synchroniser les réponses vers les commentaires du ticket
- Gérer les préférences de canal par utilisateur

**Règle** : InAppProvider est toujours actif en parallèle. Les autres canaux sont configurables et cumulables.

## Settings & Configuration

### Settings au niveau Organisation

| Setting | Description |
|---------|-------------|
| **SCM Provider par défaut** | Type de forge Git par défaut pour les nouveaux projets (GitHub / Bitbucket / GitLab) |
| **Connexion SCM** | Credentials / App installée au niveau orga (ex: GitHub App installée sur l'org GitHub) |
| **Notification Providers** | Canaux de notification activés pour l'orga (Slack workspace connecté, config email, etc.) |
| **Préférences de notification par défaut** | Canal par défaut pour les notifications des agents (Slack, email, in-app only) |
| **LLM Provider** | (futur) Choix du modèle AI (Claude, GPT, etc.) — Claude par défaut |
| **Usage limits** | Limites liées au plan de facturation (nombre de tickets AI/mois, etc.) |

### Settings au niveau Projet

| Setting | Description |
|---------|-------------|
| **Repos connectés** | Liste des repos Git rattachés au projet (via le SCM Provider de l'orga) |
| **Colonnes du board** | Noms et ordre des colonnes du Kanban (personnalisables) |
| **Triggers automatiques des agents** | Configurer quand les agents se déclenchent automatiquement (ex: "Lancer le Challenge Agent quand un ticket arrive dans la colonne 'To Refine'") |
| **Mapping colonnes ↔ agents** | Quelle colonne déclenche quel agent (ex: colonne "To Refine" → Challenge Agent, colonne "Ready for Plan" → Plan Agent) |
| **Branche cible par défaut** | Branche sur laquelle les PRs sont créées (ex: `develop`, `main`) |
| **Convention de nommage des branches** | Template pour les branches générées (ex: `feature/AD-{ticket_id}-{slug}`) |
| **Convention de nommage des PRs** | Template pour les titres de PR (ex: `[AD-{ticket_id}] {ticket_title}`) |
| **Agent prompt overrides** | (avancé) Instructions supplémentaires pour chaque agent, spécifiques au projet (ex: "Ce projet utilise une architecture hexagonale", "Les tests doivent utiliser pytest-django") |

### Settings au niveau Utilisateur (préférences personnelles)

| Setting | Description |
|---------|-------------|
| **Canal de notification préféré** | Slack / Email / In-app only (override le défaut orga) |
| **Langue des agents** | Langue dans laquelle les agents communiquent (français, anglais, etc.) |
| **Notifications activées** | Granularité : être notifié pour les questions des agents, les plans générés, les PRs créées, etc. |

## Ordre de développement suggéré

1. **Phase 1 — Board Kanban basique** : CRUD projets/tickets, drag & drop, auth utilisateur
2. **Phase 2 — Intégration GitHub** : connexion de repo, clone, indexation du code
3. **Phase 3 — Premier agent AI** : challenge de ticket (analyse du besoin vs codebase)
4. **Phase 4 — Plans d'implémentation** : génération de plans front/back/tests
5. **Phase 5 — Génération de PRs** : coding par l'IA et création de PRs via GitHub API

## Nom du projet

**Autodev** (nom temporaire de travail)

Nom définitif à trouver — critères :
- ≤ 10 caractères
- Disponible en .com
- Évoque l'IA / l'automatisation / le shipping — PAS une équipe humaine
- Sonorité tech, mémorable

Candidats en cours d'évaluation (à vérifier sur instantdomainsearch.com) :
- Devqo, Tikkr, Kodaiq, Buildzr, Planlm, etc.

## Décisions techniques prises

| Sujet | Décision | Raison |
|-------|----------|--------|
| Framework frontend | React + Vite (SPA) | UI riche (kanban, drag & drop), écosystème le plus large, pas besoin de SSR |
| Pas Flutter Web | Rejeté | Rendu CanvasKit/HTML, perte d'accessibilité DOM, copier-coller problématique, pas adapté au web-first |
| Pas Angular | Rejeté | Écosystème composants UI moins riche pour du "Linear-like", vivier recrutement startup plus faible |
| Pas Next.js | Rejeté | SSR inutile pour une app derrière login, complexité ajoutée sans bénéfice |
| Temps réel | Polling / SSE | Django Channels décriés, complexité ASGI, suffisant pour le MVP |
| DB vectorielle | pgvector (dans PostgreSQL) | Évite un service séparé (Pinecone, Qdrant), simplifie l'infra |
| Moteur AI | Service Python séparé | Scaling indépendant, itération rapide, tâches longues |
| Infra | K8s everywhere (k3d + Tilt en local) | Un seul mode de déploiement, détection des problèmes K8s dès le dev, pas de double maintenance |
| Intégration Git | Abstraction SCMProvider (GitHub first, puis Bitbucket, GitLab) | Évite le vendor lock-in, extensibilité multi-forge |
| Notifications agents | Abstraction NotificationProvider (InApp + Slack + Email) | Extensibilité, préférences utilisateur, canal toujours disponible (in-app) |
| Tickets multi-repos | Un ticket peut impacter N repos, 1 PR par repo | Supporte les architectures mono-repo ET multi-repos (front/back séparés) |
| Déclenchement agents | Configurable par mapping colonne ↔ agent + boutons manuels | Flexibilité : chaque équipe configure son workflow |
| Communication agent ↔ humain | Questions en commentaire ticket + notification externe | Source de vérité dans l'app, notification en push sur le canal préféré |