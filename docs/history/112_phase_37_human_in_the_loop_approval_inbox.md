# 112. Phase 37: Human-in-the-Loop (HITL) Operations: Task Approval Inbox, Decision Modals & SLA Tracking

## Problem Statement
Workflows involving human review, compliance validation, and financial authorization required first-class Human-in-the-Loop governance. The system lacked:
1. An explicit `WAITING_FOR_APPROVAL` task execution status.
2. Endpoints and mechanisms to claim, unclaim, and resolve human tasks with approval/rejection decisions and form payload capture.
3. A dedicated Task Approval Inbox UI with SLA urgency countdowns and role-based assignment.
4. An interactive Decision Modal with upstream context preview, verification checklists, and mandatory rejection rationales.
5. Offline simulation in `@unipost/sandbox` with stateful approval seeding.

## Implementation Plan
1. Add `TaskStatus.WAITING_FOR_APPROVAL` to backend enum and update `HumanNodeStrategy.java` to halt DAG progression until review.
2. Implement `/claim`, `/unclaim`, and `/resolve` endpoints in `TaskWorkerController.java` with SSE broadcasting.
3. Update `@unipost/client` with `ApprovalTask`, `ApprovalDecisionRequest`, and client methods.
4. Enhance `workflowSandboxHandler` in `@unipost/sandbox` with stateful approval storage and mock endpoints.
5. Create `use-approvals.ts` query and mutation hooks in `@unipost/console`.
6. Build `HumanDecisionModal` and `ApprovalTable` components with Liquid Glass tokens and SLA countdowns.
7. Construct `ApprovalsFeature` layout with search and filter tabs (**My Review**, **Unassigned Pool**, **History**).
8. Register `/_authenticated/approvals` route and update `sidebar-data.ts` and i18n locales (`en`, `vi`).
9. Verify with Vitest and backend compilation.

## Changes Made
- `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/TaskStatus.java`: Added `WAITING_FOR_APPROVAL`.
- `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/decider/strategy/HumanNodeStrategy.java`: Transition initial evaluation to `WAITING_FOR_APPROVAL`.
- `apps/backend/unipost-ms-aio/src/main/java/com/unipost/aio/controller/workflow/TaskWorkerController.java`: Added `POST /{id}/claim`, `POST /{id}/unclaim`, `POST /{id}/resolve`.
- `packages/client/src/contracts/workflow-executions.ts`: Added `ApprovalTask`, `ApprovalDecisionRequest`, and updated `TaskSnapshot`.
- `packages/client/src/client.ts`: Added `getApprovals`, `claimApproval`, `unclaimApproval`, `resolveApproval`.
- `packages/sandbox/src/handlers/workflow-handler.ts`: Added `tenantApprovals` state, seeded records, and mock routes.
- `apps/console/src/features/metadata/components/studio/dag-node.tsx`: Added `WAITING_FOR_APPROVAL` badge and specular glow styling.
- `apps/console/src/features/workflows/hooks/use-workflow-execution-stream.ts`: Mapped `WAITING_FOR_APPROVAL` in execution stream.
- `apps/console/src/features/approvals/hooks/use-approvals.ts`: React Query hooks for approvals.
- `apps/console/src/features/approvals/components/human-decision-modal.tsx`: Interactive verification and decision modal.
- `apps/console/src/features/approvals/components/approval-table.tsx`: Table with SLA countdown badges, claim/unclaim buttons, and review actions.
- `apps/console/src/features/approvals/index.tsx`: Main inbox feature with tab filtering and search.
- `apps/console/src/routes/_authenticated/approvals/index.tsx`: Dedicated top-level approvals route.
- `apps/console/src/components/layout/data/sidebar-data.ts`: Added Task Approvals item with `UserCheck` icon.
- `apps/console/src/locales/en/console.json` & `apps/console/src/locales/vi/console.json`: Synchronized `approvals` locale string.
- `apps/console/src/features/approvals/__tests__/approvals-feature.test.tsx`: Vitest suite covering table and decision modal.

## Verification
- Vitest `@unipost/console`: `src/features/approvals/` passed **1/1 file, 2/2 tests**.
- Vitest `@unipost/console`: `src/features/metadata/components/studio/` passed **6/6 files, 28/28 tests**.
- Vitest `@unipost/client`: passed **3/3 files, 20/20 tests**.
- Vitest `@unipost/sandbox`: passed **2/2 files, 9/9 tests**.
- Maven Backend: `unipost-ms-aio` and `workflow-engine` compiled with 0 errors.
- TypeScript Typecheck: `tsc --noEmit` clean across all affected packages and apps.
