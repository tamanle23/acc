# Implementation Plan 100 - Phase 37: Human-in-the-Loop (HITL) Operations: Task Approval Inbox, Decision Modals & SLA Tracking

## 1. Executive Summary
Phase 37 establishes first-class Human-in-the-Loop (HITL) governance across the Unipost Workflow Platform.
It equips the platform with:
1. Dedicated top-level `/approvals` inbox route with real-time SSE & polling updates, SLA urgency countdowns, role/assignee filtering, and quick cross-links.
2. Interactive Liquid Glass Decision Modal (`human-decision-modal.tsx`) with upstream payload inspection, form data capture, and mandatory rejection rationale comments.
3. Backend & Client contracts for `WAITING_FOR_APPROVAL` task status, task claiming/unclaiming (`/claim`, `/unclaim`), and task resolution (`/resolve`).
4. Unified Sandbox Platform (`@acc/sandbox`) simulation with stateful approval task pool, seed records, and automatic SSE event emission.
5. Full i18n (`en`, `vi`) and WCAG 2.2 AA accessibility compliance.

---

## 2. Architecture & Contracts

### 2.1 Backend Engine (`apps/backend/workflow-engine` & `acc-ms-aio`)
- **TaskStatus Enum**: Add `WAITING_FOR_APPROVAL` (non-terminal).
- **HumanNodeStrategy**: Transitions `TaskStatus` to `WAITING_FOR_APPROVAL` on first evaluation. When resolved with `COMPLETED`, merges `formData` into `outputData`. When resolved with `FAILED`, triggers Saga compensation.
- **REST Endpoints (`TaskWorkerController`)**:
  - `GET /api/v1/workflow/tasks/approvals`: List pending approval tasks partitioned by tenant and filtered by user role/assignee.
  - `POST /api/v1/workflow/tasks/{id}/claim`: Locks task to current authenticated user.
  - `POST /api/v1/workflow/tasks/{id}/unclaim`: Releases claim lock.
  - `POST /api/v1/workflow/tasks/{id}/resolve`: Resolves approval with `{ action: 'APPROVE' | 'REJECT', comment?: string, formData?: Record<string, unknown> }`.

### 2.2 Client Contracts (`packages/client`)
- Extend `@acc/client` contracts with:
  - `ApprovalTask`: id, workflowId, workflowKey, taskReferenceName, status, assignee, role, instructions, slaMinutes, createdAt, claimedBy, claimedAt, slaBreached, inputData, outputData.
  - `ApprovalDecisionRequest`: `action: 'APPROVE' | 'REJECT'`, `comment?: string`, `formData?: Record<string, unknown>`.
  - Add `client.workflowExecutions.getApprovals()`, `claimApproval()`, `unclaimApproval()`, `resolveApproval()`.

### 2.3 Unified Sandbox Platform (`packages/sandbox`)
- Implement approval endpoints in `workflow-handler.ts`:
  - `GET /workflow/tasks/approvals`
  - `POST /workflow/tasks/:id/claim`
  - `POST /workflow/tasks/:id/unclaim`
  - `POST /workflow/tasks/:id/resolve`
- Seed initial pending approvals for `tenant-acme` and other test tenants.

### 2.4 Console UI (`apps/console`)
- **Route**: `apps/console/src/routes/_authenticated/approvals/index.tsx`.
- **Feature**: `apps/console/src/features/approvals/`:
  - `index.tsx`: Main layout with metrics bar, tabs (**Pending My Review**, **Unassigned Queue**, **Completed History**), and search.
  - `components/approval-card.tsx` / `approval-table.tsx`: Display tasks, SLA badge countdowns, claim buttons, and review triggers.
  - `components/human-decision-modal.tsx`: Liquid Glass modal showing upstream context, dynamic checklist, comments, and Approve/Reject buttons.
  - `hooks/use-approvals.ts`: React Query hooks for fetching, claiming, and resolving approvals.
- **Sidebar Integration**: Update `sidebar-data.ts` to add `/approvals` with live badge count and update locale files (`en/console.json`, `vi/console.json`).

---

## 3. Implementation Steps Roadmap

1. **Step 1: Backend & Client Contract Updates**
   - Update `TaskStatus.java` with `WAITING_FOR_APPROVAL`.
   - Update `HumanNodeStrategy.java` to set status to `WAITING_FOR_APPROVAL`.
   - Add approval endpoints in `TaskWorkerController.java`.
   - Update `@acc/client` types and client methods.
2. **Step 2: Unified Sandbox Platform Support**
   - Add approval repository state and endpoints in `packages/sandbox/src/handlers/workflow-handler.ts`.
3. **Step 3: Console Hooks & Decision Modal**
   - Create `use-approvals.ts` and `human-decision-modal.tsx`.
4. **Step 4: Approval Inbox Table & Page Layout**
   - Build `ApprovalsFeature` with SLA countdowns and tabs.
   - Register route `/_authenticated/approvals`.
5. **Step 5: Sidebar Navigation & i18n Synchronization**
   - Add item in `sidebar-data.ts` and sync `en/console.json` and `vi/console.json`.
6. **Step 6: Automated Verification & Walkthrough**
   - Run Vitest and backend tests.
   - Create `apps/console/doc/walkthrough_100.md`, history log `docs/history/112_...md`, and commit.
