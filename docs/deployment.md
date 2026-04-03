# Deployment

## Docker Compose (staging)

```bash
cd infra
docker compose up --build -d
```

## Kubernetes (production)

```bash
# Creer le namespace
kubectl apply -f infra/k8s/namespace.yaml

# Deployer les services
kubectl apply -f infra/k8s/postgres/
kubectl apply -f infra/k8s/redis/
kubectl apply -f infra/k8s/backend/
kubectl apply -f infra/k8s/ai-service/
kubectl apply -f infra/k8s/frontend/
kubectl apply -f infra/k8s/ingress/
```

## Providers recommandes

- DigitalOcean DOKS
- Scaleway Kapsule
- OVH Managed Kubernetes
