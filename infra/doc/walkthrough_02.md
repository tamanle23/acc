# PostgreSQL GitOps Setup Walkthrough

I have updated the GitOps architecture to natively host a PostgreSQL container using a StatefulSet across all environments, abandoning the previous Cloud-Managed RDS blueprint.

## Changes Made

- **Base Workloads (`apps/infra/k8s/base`)**:
  - `postgres.yaml`: Added a robust PostgreSQL configuration.
    - A `StatefulSet` mapping to `postgres:15-alpine`.
    - A `volumeClaimTemplates` block requesting a 1Gi `PersistentVolumeClaim` (PVC) for `postgres-data` (this persists database files across pod restarts).
    - An internal `Service` exposing port `5432`.
    - A `Secret` storing the default connection credentials.
  - `backend.yaml`: Injected Spring Boot environment variables (`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`) that read from the Postgres secret and connect via `jdbc:postgresql://postgres:5432/acc`.
  - `kustomization.yaml`: Bound `postgres.yaml` into the core compilation base.

## Impact

Because this database is configured in the **`base`** Kustomize layer:
- **Local (Kind)**: Running `kubectl apply -k apps/infra/k8s/overlays/local` will seamlessly spin up the database inside your Kind cluster.
- **Production/Staging**: The exact same container and Stateful volume will spin up in production. (In the future, you can write patches in `overlays/production` to increase the volume storage size or swap the `StorageClass` to SSDs).

All modifications have been verified and successfully committed to Git!
