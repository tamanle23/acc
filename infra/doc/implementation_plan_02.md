# Build Unified GitOps & IaC Configuration

This document outlines the plan to establish a Kubernetes-native reverse proxy setup utilizing an Ingress Controller for the Turborepo workspace, and to lay down Crossplane blueprints for cloud promotion.

## User Review Required

> [!IMPORTANT] 
> I have updated the routing configuration based on your feedback:
> * `/` routes to `tekgo-ui` (restricted to a specific domain, e.g., `app.local`).
> * `/admin` routes to `console` (available on all domains).
> * `/api` routes to `backend` (available on all domains).
> 
> Please review this new routing scheme. Let me know if you have a specific domain you'd like to use instead of `app.local` for the `tekgo-ui` route.
>
> Additionally, the `turbo.json` modifications will introduce a new pipeline task: `validate:infra`. Please confirm this naming aligns with your conventions.

## Proposed Changes

### `apps/infra` Workspace Initialization

We will create a new workspace dedicated to infrastructure, containing the Kubernetes manifests, Crossplane blueprints, and runbook.

#### [NEW] [apps/infra/package.json](file:///c:/Users/Admin/workspace/git/acc/apps/infra/package.json)
Initialize a basic `package.json` for the new `infra` app, exposing scripts like `validate:infra`.

#### [NEW] [apps/infra/README.md](file:///c:/Users/Admin/workspace/git/acc/apps/infra/README.md)
A local validation runbook detailing how to spin up Kind, install NGINX Ingress, apply these manifests, and query the reverse proxy.

---

### Local Reverse Proxy Manifests (Kind)

#### [NEW] [apps/infra/k8s/tekgo-ui.yaml](file:///c:/Users/Admin/workspace/git/acc/apps/infra/k8s/tekgo-ui.yaml)
Kubernetes Deployment and Service for the `tekgo-ui` app (exposing port 80).

#### [NEW] [apps/infra/k8s/console.yaml](file:///c:/Users/Admin/workspace/git/acc/apps/infra/k8s/console.yaml)
Kubernetes Deployment and Service for the `console` app (exposing port 80).

#### [NEW] [apps/infra/k8s/backend.yaml](file:///c:/Users/Admin/workspace/git/acc/apps/infra/k8s/backend.yaml)
Kubernetes Deployment and Service for the `backend` app (exposing port 80).

#### [NEW] [apps/infra/k8s/ingress.yaml](file:///c:/Users/Admin/workspace/git/acc/apps/infra/k8s/ingress.yaml)
Standard Ingress resource using `networking.k8s.io/v1`. It will have `ingressClassName: nginx` and the following routing rules:
- Host: `app.local` (or configured domain), Path: `/` (Prefix) -> `tekgo-ui` service.
- Host: none (wildcard/all domains), Path: `/admin` (Prefix) -> `console` service.
- Host: none (wildcard/all domains), Path: `/api` (Prefix) -> `backend` service.

---

### Crossplane IaC System Blueprints

#### [NEW] [apps/infra/crossplane/xrd.yaml](file:///c:/Users/Admin/workspace/git/acc/apps/infra/crossplane/xrd.yaml)
CompositeResourceDefinition (`v1beta1`) for `XAppLoadBalancer`, defining the schema for our custom cloud load balancer resource.

#### [NEW] [apps/infra/crossplane/composition-aws.yaml](file:///c:/Users/Admin/workspace/git/acc/apps/infra/crossplane/composition-aws.yaml)
Composition (`v1beta1`) mapping `XAppLoadBalancer` to AWS provider resources (e.g., ALB Listener Rules, Target Groups) to mirror the exact `/`, `/admin`, and `/api` routing logic with host-based conditions.

---

### Monorepo Tooling Integration

#### [MODIFY] [turbo.json](file:///c:/Users/Admin/workspace/git/acc/turbo.json)
Add `validate:infra` to the Turborepo pipeline, enabling `pnpm turbo validate:infra` to dry-run/lint the K8s and Crossplane YAMLs.

## Verification Plan

### Automated Tests
- `pnpm turbo validate:infra` will be configured to validate the syntax and structure of the YAML files using a linter/dry-run tool.

### Manual Verification
- Execute the runbook steps in `apps/infra/README.md`.
- Run `kind create cluster`.
- Install `ingress-nginx`.
- Run `kubectl apply -f apps/infra/k8s/`.
- Validate routing by sending requests to `localhost/api`, `localhost/admin`, and `app.local/` (with host header set).
