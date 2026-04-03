# API Reference

Base URL: `/api/v1/`

## Endpoints

### Users
- `GET /api/v1/users/` — Liste des utilisateurs
- `POST /api/v1/users/` — Creer un utilisateur
- `GET /api/v1/users/organizations/` — Liste des organisations

### Projects
- `GET /api/v1/projects/` — Liste des projets
- `POST /api/v1/projects/` — Creer un projet
- `GET /api/v1/projects/{id}/` — Detail d'un projet

### Boards
- `GET /api/v1/boards/` — Liste des boards
- `GET /api/v1/boards/{id}/` — Detail d'un board (avec colonnes)
- `GET /api/v1/boards/columns/` — Liste des colonnes

### Tickets
- `GET /api/v1/tickets/` — Liste des tickets
- `POST /api/v1/tickets/` — Creer un ticket
- `GET /api/v1/tickets/{id}/` — Detail (avec AI analysis, plan, PRs)

### GitHub
- `GET /api/v1/github/connections/` — Connexions GitHub
- `POST /api/v1/github/connections/` — Connecter un repo
