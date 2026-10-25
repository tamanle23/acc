# Walkthrough 99 - Unification of Client-Backend Contracts (`@acc/client`) and Unified Sandbox Platform (`@acc/sandbox`)

## 1. Executive Summary
We successfully unified all client-backend contract models and DTOs into `@acc/client`, and centralized all mock handlers, in-memory stateful repositories, and reset lifecycle registries into `@acc/sandbox`. Backward compatibility in `@acc/console` was 100% maintained via re-export hubs, passing all unit, integration, and sandbox test suites with 0 regressions.

---

## 2. Key Changes & Architecture

### A. `@acc/client` Contract Unification
- **Modular Contracts**: Centralized all domain DTOs into `packages/client/src/contracts/`:
  - `common.ts`: API envelopes (`ApiResponse<T>`, `PagedResponse<T>`, `BatchResult<T>`), sorting, pagination, error models (`ApiErrorDetails`, `ValidationErrorItem`), and traceparent headers.
  - `auth.ts`: Authentication credentials, JWT session payloads (`AuthTokenPair`, `UserProfile`, `UserRole`, `TenantContext`).
  - `metadata.ts`: Entity types, attribute definitions, relations, JSON schemas, records (`EntityRecord`, `DynamicSchemaDefinition`).
  - `workflows.ts`: Visual DAG definition, tasks, triggers, parameters, validation results, and execution options (`WorkflowDefinition`, `WorkflowTaskNode`, `WorkflowValidationResult`).
  - `workflow-executions.ts`: Execution units, task lifecycle statuses (`WorkflowExecution`, `WorkflowExecutionStatus`, `TaskSnapshot`, `WorkflowSnapshot`).
  - `users.ts`: Tenant users, memberships, invitations, and RBAC matrix.
  - `billing.ts`: Subscription tiers, quotas, checkout, payOS VietQR requests/responses.
- **Enriched Client**: `UnipostClient` provides domain namespaces (`client.auth`, `client.metadata`, `client.workflows`, `client.workflowExecutions`, `client.users`, `client.billing`) with transparent response unwrapping, `rawResponse: true` bypass option, and SSE execution stream reader (`client.workflowExecutions.streamExecution()`).
- **Zero Third-Party Runtime Dependencies**: Pure TypeScript native `fetch` client and DTO definitions.

### B. `@acc/sandbox` Engine & Platform Centralization
- **Master Reset Registry**: Implemented `SandboxResetRegistry` (`sandboxResetRegistry`) ensuring every in-memory repository automatically registers its reset lifecycle handler.
- **Domain Handlers & Stateful Repositories**: Centralized all mock implementations into `packages/sandbox`:
  - `auth-sandbox-handler.ts` & Mock JWT Generator
  - `users-sandbox-handler.ts` & In-Memory User Repository
  - `workflow-executions-sandbox-handler.ts` & Multi-Tenant Workflow Execution Repository
  - `workflows-sandbox-handler.ts` & Workflow Definitions Catalog
  - `billing-sandbox-handler.ts` & PayOS VietQR Simulator
  - `system-sandbox-handler.ts` & Fleet Tenant / Quota Repository
  - `workspace-sandbox-handler.ts` & Tenant Workspace Hierarchy Repository
  - `chats-sandbox-handler.ts` & AI Chat Assistant Simulation
  - `apps-sandbox-handler.ts` & Installed App Integration Engine
- **State Store & Two-Way Sync**: Framework-agnostic `SandboxStoreManager` / `defaultSandboxStore` synchronized with UI Zustand stores in `@acc/console`.

### C. `@acc/console` Backward Compatibility & Routing Integration
- **Transparent Re-Export Hubs**:
  - `apps/console/src/core/sandbox/index.ts`: Re-exports all handlers, types, stores, and reset registries from `@acc/sandbox`.
  - `apps/console/src/core/sandbox/manager/sandbox-registry.ts`: Re-exports the unified `sandboxRegistry` singleton instance.
  - `apps/console/src/core/sandbox/ui/sandbox-dock.tsx`: Master reset button delegates to `sandboxResetRegistry.resetAll()`.
  - `apps/console/src/features/spring-auth/api-client.ts`: Respects `useSandboxStore` active tenant for multi-tenant isolation.
  - `apps/console/src/routes/_authenticated/workflow-executions/index.tsx`: Repaired type-safe status and priority schemas.

---

## 3. Verification Results

| Suite | Package / App | Tests Passed | Status |
| :--- | :--- | :--- | :--- |
| **Contracts & Client SDK** | `@acc/client` | 20 / 20 passed | ✅ 100% Green |
| **Typecheck** | `@acc/client` | 0 errors (`tsc --noEmit`) | ✅ 100% Green |
| **Sandbox Platform Engine** | `@acc/sandbox` | 9 / 9 passed | ✅ 100% Green |
| **Typecheck** | `@acc/sandbox` | 0 errors (`tsc --noEmit`) | ✅ 100% Green |
| **Console Sandbox Integration** | `@acc/console` (`src/core/sandbox`) | 65 / 65 passed (10 files) | ✅ 100% Green |

---

## 4. Next Steps
- Continue standardizing downstream mobile (`@acc/mobile-ui`) consumption of `@acc/client` and `@acc/sandbox`.
