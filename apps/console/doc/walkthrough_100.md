# Walkthrough 100: Phase 37 - Human-in-the-Loop (HITL) Operations: Task Approval Inbox, Decision Modals & SLA Tracking

## 1. Overview
In Phase 37, we delivered the complete Human-in-the-Loop (HITL) governance and review subsystem across the backend (`workflow-engine`, `unipost-ms-aio`), client contracts (`@unipost/client`), offline simulator (`@unipost/sandbox`), and frontend (`@unipost/console`).

## 2. Key Accomplishments

### 2.1 Backend Engine & REST Endpoints
- **Task Status Lifecycle (`TaskStatus.java`)**:
  - Added `TaskStatus.WAITING_FOR_APPROVAL` (non-terminal).
- **HumanNodeStrategy (`HumanNodeStrategy.java`)**:
  - On first evaluation, schedules task in `WAITING_FOR_APPROVAL` state, halting downstream DAG progression until explicit human resolution.
  - When resolved with `COMPLETED`, unblocks downstream execution nodes.
  - When resolved with `FAILED`, halts execution and triggers Saga compensation.
- **TaskWorkerController Endpoints (`TaskWorkerController.java`)**:
  - `POST /api/v1/workflow/tasks/{id}/claim`: Locks task to authenticated user and broadcasts `TASK_CLAIMED`.
  - `POST /api/v1/workflow/tasks/{id}/unclaim`: Releases task lock back to role pool and broadcasts `TASK_UNCLAIMED`.
  - `POST /api/v1/workflow/tasks/{id}/resolve`: Resolves review gate with `{ action: 'APPROVE' | 'REJECT', comment?: string, formData?: Record<string, unknown> }`, updates task output data, triggers decider, and broadcasts real-time SSE execution events.

### 2.2 Client Contracts (`@unipost/client`)
- Added `ApprovalTask` and `ApprovalDecisionRequest` models in `packages/client/src/contracts/workflow-executions.ts`.
- Added domain methods to `UnipostClient`:
  - `client.workflowExecutions.getApprovals()`
  - `client.workflowExecutions.claimApproval()`
  - `client.workflowExecutions.unclaimApproval()`
  - `client.workflowExecutions.resolveApproval()`

### 2.3 Unified Sandbox Platform Simulation (`@unipost/sandbox`)
- Added in-memory multi-tenant approval repository state and seeded default pending approvals in `WorkflowSandboxRepository`:
  - `appr_01`: Compliance Review (`ROLE_COMPLIANCE_OFFICER`, Order Fulfillment Pipeline).
  - `appr_02`: Finance Signoff (`ROLE_FINANCE_DIRECTOR`, Monthly Billing & Tax Reconciliation, SLA Breached).
- Handled mock routes:
  - `GET /workflow/tasks/approvals`
  - `POST /workflow/tasks/:id/claim`
  - `POST /workflow/tasks/:id/unclaim`
  - `POST /workflow/tasks/:id/resolve`
- Wired state reset into `sandboxResetRegistry.resetAll()`.

### 2.4 Console UI & Interactive Decision Modal (`apps/console`)
- **Dedicated Route**: `/_authenticated/approvals` registered in `apps/console/src/routes/_authenticated/approvals/index.tsx`.
- **Approval Inbox Feature (`apps/console/src/features/approvals`)**:
  - Filter tabs: **My Review**, **Unassigned Pool**, **History**.
  - SLA countdown badges with urgency colors (Normal, Urgent < 30m pulsing amber, Breached red).
  - Real-time search query filtering by workflow name, step reference, role, or instructions.
- **Interactive Human Decision Modal (`human-decision-modal.tsx`)**:
  - Left column: Upstream execution JSON payload, reviewer instructions, and required role.
  - Right column: Verification checklist, decision rationale textarea (mandatory on rejection), and Approve / Reject buttons.
- **Sidebar & i18n Synchronization**:
  - Registered `/approvals` in `sidebar-data.ts` under Workspace group.
  - Synchronized `en/console.json` and `vi/console.json` locales.

## 3. Verification Results
- **Vitest `@unipost/console`**:
  - `src/features/approvals/`: **1 passed (2 tests)**.
  - `src/features/metadata/components/studio/`: **6 passed (28 tests)**.
- **Vitest `@unipost/client`**: **3 passed (20 tests)**.
- **Vitest `@unipost/sandbox`**: **2 passed (9 tests)**.
- **Maven Backend Compile**: `workflow-engine` & `unipost-ms-aio` compiled clean with 0 errors.
- **TypeScript Typecheck**: `tsc --noEmit` clean across `@unipost/console`, `@unipost/client`, and `@unipost/sandbox`.
