# Docker Configuration Implementation Plan

Currently, the Kubernetes manifests use placeholder images (`nginx:alpine` and `node:18-alpine`). While there are Dockerfiles present in the `backend` subdirectories, **there are no Dockerfiles for `tekgo-ui` (Next.js) or `console` (Vite)**.

To fully containerize the ecosystem, we need to create multi-stage, Turborepo-optimized Dockerfiles for the frontend apps and update our Kubernetes configurations to use them.

## User Review Required

> [!IMPORTANT]
> The plan proposes using **`turbo prune`** inside multi-stage Docker builds. This is a monorepo best practice that drastically reduces build times by only installing dependencies relevant to the specific application.
> 
> Do you approve this Dockerization approach for the frontend apps?

## Proposed Changes

### 1. `tekgo-ui` Dockerfile (Next.js)
Create `apps/tekgo-ui/Dockerfile`. This will be a standard Next.js standalone build container:
- **Base/Builder Stage**: Runs `pnpm turbo prune tekgo-ui --docker` to isolate dependencies.
- **Installer Stage**: Installs dependencies via `pnpm install` and runs `pnpm turbo build --filter=tekgo-ui`.
- **Runner Stage**: Uses a minimal Node.js alpine image, copies the `.next/standalone` output, and exposes port `3000`.

### 2. `console` Dockerfile (Vite/SPA)
Create `apps/console/Dockerfile`. This will build the Vite app and serve it using NGINX:
- **Base/Builder Stage**: Runs `pnpm turbo prune console --docker`.
- **Installer Stage**: Installs dependencies and runs `pnpm turbo build --filter=console` to output static files to `dist/`.
- **Runner Stage**: Uses an `nginx:alpine` base image, copies the `dist/` artifacts into NGINX's web root, and exposes port `80`.

### 3. Update Kubernetes Manifests
Modify the K8s `Deployment` YAMLs in `apps/infra/k8s/base/`:
- **[MODIFY] `tekgo-ui.yaml`**: Update the image to `acc/tekgo-ui:latest`, change `containerPort` to `3000` (and `targetPort` in the Service to `3000`). Ensure `imagePullPolicy: IfNotPresent` is set for Kind.
- **[MODIFY] `console.yaml`**: Update the image to `acc/console:latest`. (Keeps port `80`).

### 4. Update the Runbook
Add instructions to `apps/infra/README.md` on how to build the Docker images and load them into the local Kind cluster:
```bash
docker build -t acc/tekgo-ui:latest -f apps/tekgo-ui/Dockerfile .
docker build -t acc/console:latest -f apps/console/Dockerfile .
kind load docker-image acc/tekgo-ui:latest --name acc-local
kind load docker-image acc/console:latest --name acc-local
```
