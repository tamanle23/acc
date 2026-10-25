# PostgreSQL Container Implementation Plan

Based on your feedback, we will bypass cloud-managed databases (like RDS/Crossplane) and instead use an in-cluster **PostgreSQL StatefulSet with a Persistent Volume (PVC)** natively across all environments.

## User Review Required

> [!IMPORTANT]
> Because PostgreSQL will now run inside the cluster for all environments, we will define the `StatefulSet` and its `volumeClaimTemplates` in the `base/` directory. 
> 
> By default, I will configure it to request `1Gi` of storage in the base. We can use Kustomize patches in the `production` overlay later to request larger volumes (e.g., `50Gi`) and specify production StorageClasses.
> 
> Do you approve this updated StatefulSet approach?

## Proposed Changes

### 1. Base Database Workload (`base/`)
We will add the PostgreSQL container directly into the common base so it spins up in local, staging, and production identically.
- **[NEW] `apps/infra/k8s/base/postgres.yaml`**: 
  - A `StatefulSet` running the `postgres:15-alpine` container.
  - A `volumeClaimTemplates` block requesting a PersistentVolume to ensure data is retained across pod restarts.
  - A `Service` exposing port `5432` internally to the cluster.
- **[MODIFY] `apps/infra/k8s/base/backend.yaml`**: 
  - Inject the `SPRING_DATASOURCE_URL` (`jdbc:postgresql://postgres:5432/acc`), `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD` environment variables directly into the backend deployment.
- **[MODIFY] `apps/infra/k8s/base/kustomization.yaml`**: Include `postgres.yaml`.

*(Note: We are no longer creating Crossplane PostgreSQL blueprints, keeping the database entirely self-hosted in Kubernetes).*
