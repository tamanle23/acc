# Acc Infrastructure & GitOps Architecture

This directory (`/infra`) contains the Infrastructure-as-Code (IaC) and Kubernetes manifests for the Acc ecosystem. 

The core philosophy of this setup is **GitOps**: Git is the absolute, single source of truth for your entire physical system. You do not deploy to production manually; you simply update Git, and automated systems reconcile the cloud to match your repository.

---

## 🏛️ Architecture: How It Works

To eliminate configuration drift and manual infrastructure management, this architecture relies on three core pillars:

### 1. The Core DNA (`infra/k8s/base/`)
Instead of duplicating Kubernetes YAML files for every environment, we store the core "DNA" of the application here. This directory contains the absolute truths about your system: *The Backend needs port 80*, *The Tekgo-UI runs this container*, and *The system requires a PostgreSQL database*.

### 2. The Environment Adapters (`infra/k8s/overlays/`)
Because local development, staging, and production have different physical constraints, we use Kustomize **Overlays** to "patch" the base DNA.
- **Local Overlay**: Patches the base to use a local NGINX Ingress Controller. It keeps replica counts at 1 to save local CPU and RAM.
- **Production Overlay**: Bumps replica counts to 3 (for High Availability), attaches a HorizontalPodAutoscaler (HPA), and injects a claim for a Cloud Load Balancer.

### 3. The Cloud Bridge (`infra/crossplane/`)
Traditionally, Terraform is used to manage AWS/GCP resources while Kubernetes YAML manages containers—creating a disconnect. **Crossplane** solves this by turning cloud infrastructure into native Kubernetes resources.
When the Production overlay applies the `AppLoadBalancer` YAML file, Crossplane intercepts it, reaches out to the AWS API, and automatically provisions a physical Application Load Balancer and Target Groups for you.

---

## 💻 1. Local Development Workflow

Use this workflow to test the entire microservice ecosystem locally on your machine using **Kind** (Kubernetes IN Docker).

### Prerequisites
- [Docker](https://www.docker.com/)
- [Kind](https://kind.sigs.k8s.io/)
- `kubectl`

### Step 1: Build Local Images
Run these commands from the **root** of the monorepo to build the optimized Turborepo multi-stage images:
```bash
docker build -t acc/tekgo-ui:latest -f apps/tekgo-ui/Dockerfile .
docker build -t acc/console:latest -f apps/console/Dockerfile .
docker build -t acc/backend:latest -f apps/backend/acc-ms-aio/deloyment/Dockerfile .
```

### Step 2: Spin Up Cluster & Load Images
```bash
kind create cluster --name acc-local

# Load your locally built images into the cluster
kind load docker-image acc/tekgo-ui:latest --name acc-local
kind load docker-image acc/console:latest --name acc-local
kind load docker-image acc/backend:latest --name acc-local
```

### Step 3: Install Local Ingress Controller
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for the ingress pod to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

### Step 4: Apply Local Overlay
This applies the base workloads, the PostgreSQL database, and the local routing rules.
```bash
kubectl apply -k infra/k8s/overlays/local/
```

### Step 5: Test Routing
- **Tekgo UI**: `curl -H "Host: app.local" http://localhost/`
- **Console (Admin)**: `http://localhost/admin`
- **Backend (API)**: `http://localhost/api`

---

## 🛠️ 2. Infrastructure Modification Workflow

When you need to alter the infrastructure (e.g., adding environment variables, bumping memory limits, creating new services):

1. **Environment-Agnostic Changes**: Edit files in `infra/k8s/base/`.
2. **Environment-Specific Changes**: Edit files in `infra/k8s/overlays/<env>/`.
3. **Cloud Infrastructure Changes**: Edit the Crossplane definitions in `infra/crossplane/`.
4. **Validation**: Always validate your YAML before committing by running the Turborepo pipeline from the project root:
   ```bash
   pnpm turbo validate:infra
   ```

---

## 🚀 3. Production Deployment Workflow (GitOps)

For staging and production environments, **do not run `kubectl apply` manually**. 

1. **Develop**: You test changes locally using the Kind workflow.
2. **Validate**: Turborepo runs `validate:infra` in CI/CD, catching YAML syntax errors or broken patches before the code merges.
3. **Merge**: You merge your PR into the `main` branch.
4. **Deploy**: A GitOps controller (such as **ArgoCD** or **Flux**) running in your production cluster detects the commit. It automatically synchronizes the cluster state by applying `infra/k8s/overlays/production/`.
5. **Reconcile**: Kubernetes instantly updates your containers, and Crossplane automatically communicates with AWS/GCP to adjust the physical cloud resources.
