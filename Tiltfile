# Autodev — Tiltfile for local K8s development
# Requires: k3d cluster "autodev" running

# Apply Kustomize dev overlay
k8s_yaml(kustomize('./infra/k8s/overlays/dev'))

# --- PostgreSQL ---
k8s_resource(
    'postgres',
    port_forwards=['5432:5432'],
    labels=['infra'],
)

# --- Redis ---
k8s_resource(
    'redis',
    port_forwards=['6379:6379'],
    labels=['infra'],
)

# --- Backend (run locally, not in k3d) ---
# Django runs locally on port 8000, connecting to Postgres (5432) and Redis (6379)
# port-forwarded from k3d above.
#
# Start with:
#   cd apps/backend && python manage.py runserver

# --- Migration Job ---
local_resource(
    'db-migrate',
    cmd='cd apps/backend && python manage.py migrate --noinput',
    resource_deps=['postgres', 'redis'],
    labels=['setup'],
    auto_init=True,
    trigger_mode=TRIGGER_MODE_MANUAL,
)
