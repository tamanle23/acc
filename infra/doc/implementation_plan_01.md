# Build Unified GitOps & IaC Configuration

This document outlines the plan to establish a Kubernetes-native reverse proxy setup utilizing an Ingress Controller for the Turborepo workspace, and to lay down Crossplane blueprints for cloud promotion.

## User Review Required

> [!IMPORTANT] 
> Please review the chosen routing targets: the `console` app will be routed to `/` and the `backend` app will be routed to `/api`. If you prefer different applications (e.g., `tekgo-ui` instead of `console`), please let me know before execution.
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

#### [NEW] [apps/infra/k8s/frontend.yaml](file:///c:/Users/Admin/workspace/git/acc/apps/infra/k8s/frontend.yaml)
Kubernetes Deployment and Service for the frontend app (exposing port 80).

#### [NEW] [apps/infra/k8s/backend.yaml](file:///c:/Users/Admin/workspace/git/acc/apps/infra/k8s/backend.yaml)
Kubernetes Deployment and Service for the backend app (exposing port 80).

#### [NEW] [apps/infra/k8s/ingress.yaml](file:///c:/Users/Admin/workspace/git/acc/apps/infra/k8s/ingress.yaml)
Standard Ingress resource using `networking.k8s.io/v1`. It will have `ingressClassName: nginx` and route `/` to the frontend service and `/api` (Prefix) to the backend service.

---

### Crossplane IaC System Blueprints

#### [NEW] [apps/infra/crossplane/xrd.yaml](file:///c:/Users/Admin/workspace/git/acc/apps/infra/crossplane/xrd.yaml)
CompositeResourceDefinition (`v1beta1`) for `XAppLoadBalancer`, defining the schema for our custom cloud load balancer resource.

#### [NEW] [apps/infra/crossplane/composition-aws.yaml](file:///c:/Users/Admin/workspace/git/acc/apps/infra/crossplane/composition-aws.yaml)
Composition (`v1beta1`) mapping `XAppLoadBalancer` to AWS provider resources (e.g., ALB Listener Rules, Target Groups) to mirror the exact `/` and `/api` routing logic.

---

### Monorepo Tooling Integration

#### [MODIFY] [turbo.json](file:///c:/Users/Admin/workspace/git/acc/turbo.json)
Add `validate:infra` to the Turborepo pipeline, enabling `pnpm turbo validate:infra` to dry-run/lint the K8s and Crossplane YAMLs.

## Verification Plan

### Automated Tests
- `pnpm turbo validate:infra` will be configured to validate the syntax and structure of the YAML files using a linter/dry-run tool (like `kubeconform` or a simple YAML syntax checker if specific binaries aren't present).

### Manual Verification
- Execute the runbook steps in `apps/infra/README.md`.
- Run `kind create cluster`.
- Install `ingress-nginx`.
- Run `kubectl apply -f apps/infra/k8s/`.
- Validate routing by sending requests to `localhost/` and `localhost/api`.
