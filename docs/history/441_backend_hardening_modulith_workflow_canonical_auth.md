# 441. Backend Hardening: Spring Modulith Decoupling, Workflow Durability & Canonical Authorization Purge

## Problem
1. **Spring Modulith Boundary Cycles**:
   `apps/api/acc-ms-aio` had an unresolvable 3-way circular dependency among internal modulith package slices: `com.acc.aio.config -> com.acc.aio.worker -> com.acc.aio.controller -> com.acc.aio.config`. The cycle stemmed from:
   - `com.acc.aio.config.WorkflowEngineConfiguration` declaring inner worker classes and exposing bean factories referencing `com.acc.aio.worker`.
   - `WorkflowDefinitionRegistry` being defined inside `com.acc.aio.config` rather than the core `workflow-engine` domain layer, forcing workers and controllers to import from `config`.
   - `SystemTaskWorkerPool` directly coupling to `ExecutionStreamBroadcaster` in `com.acc.aio.controller` to push task execution events.
2. **Workflow Durability & Audit Quarantine**:
   - `WorkflowStatus` lacked explicit execution typing and quarantine state (`WorkflowExecutionStatus.TAMPERED`).
   - The workflow engine lacked an explicit REST cryptographic audit verification endpoint (`GET /api/v1/workflow/audit/{workflowId}/verify`) to verify SHA-256 chain integrity, immediately hold tampered workflow executions with `TAMPERED` status, evict active queue tasks, and return HTTP 409 Conflict.
   - DLQ operations needed strict confinement to ad-hoc queries, replays, and discards (prohibiting unprincipled bulk operations).
3. **NIST RBAC Level 2 Method Security Drift**:
   - Endpoints across multiple controllers retained legacy role checks (`or hasRole('ADMIN')`, `ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_CUSTODIAN`, `ROLE_SYSTEM_SUPPORT`) and redundant alias permissions (`platform:quotas:override`, `platform:users:lock`).
   - Under NIST RBAC Level 2, method security annotations must evaluate canonical atomic permissions exclusively (`hasAuthority(...)`). Roles bundle permissions in the data tier and must never be evaluated in `@PreAuthorize`.

## Plan
1. **Track 1: Modulith Boundary Decoupling**:
   - Move `WorkflowDefinitionRegistry` into `workflow-engine/src/main/java/com/acc/workflow/application/WorkflowDefinitionRegistry.java`.
   - Create domain events `WorkflowExecutionBroadcastEvent` and `TaskLogBroadcastEvent` in `workflow-engine/src/main/java/com/acc/workflow/events/`.
   - Refactor `SystemTaskWorkerPool` to publish Spring `ApplicationEventPublisher` domain events.
   - Refactor `ExecutionStreamBroadcaster` to listen to domain events via `@EventListener`.
   - Extract `ScheduledLeaseSweeper` and `WorkflowWorkerConfiguration` into package `com.acc.aio.worker`.
   - Clean `WorkflowEngineConfiguration` to only configure the engine core.
2. **Track 2: Workflow Engine Durability & Audit Quarantine**:
   - Create `WorkflowExecutionStatus` enum with `TAMPERED` and `isTerminal() == true`.
   - Add `quarantineTamperedWorkflow(workflowId, reason)` to `WorkflowEngineService`.
   - Create `AuditLedgerController` with `GET /api/v1/workflow/audit/{workflowId}` and `GET /api/v1/workflow/audit/{workflowId}/verify` returning HTTP 409 Conflict on tampering.
   - Restrict `WorkflowDlqController` to canonical `@PreAuthorize("hasAuthority('platform:dlq:manage')")`.
3. **Track 3: Canonical Authorization Purge**:
   - Purge `hasRole('ADMIN')`, `ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`, `ROLE_SYSTEM_CUSTODIAN`, `platform:quotas:override`, and `platform:users:lock` from all controllers (`TaskWorkerController`, `WorkerFleetController`, `WorkflowApprovalsController`, `WorkflowDefinitionController`, `WorkflowExecutionController`, `SystemFleetController`, `AuditController`, `TenantProvisioningController`, `TenantRoleDelegationController`).
   - Harmonize `SandboxPersonaRegistry` authorities to include full canonical permissions.
4. **Verification & Quality Gate**:
   - Run `pnpm --filter @acc/api test:modulith` (0 cycles, 0 boundary violations).
   - Run `pnpm --filter @acc/api test:sandbox` (53/53 tests pass).
   - Run `pnpm --filter @acc/api check-types` (all 9 modules compile cleanly).
   - Run unit and integration tests for DLQ and Audit Ledger.

## Changes
- **`apps/api/workflow-engine`**:
  - `WorkflowDefinitionRegistry.java`: Created application registry for workflow definitions in `com.acc.workflow.application`.
  - `WorkflowExecutionBroadcastEvent.java`, `TaskLogBroadcastEvent.java`: Created domain events in `com.acc.workflow.events`.
  - `WorkflowExecutionStatus.java`: Created canonical execution status enum including `TAMPERED` status.
  - `WorkflowStatus.java`: Added `TAMPERED` state and bidirectional conversion helpers (`toExecutionStatus()`, `fromExecutionStatus()`).
  - `WorkflowSnapshot.java`: Added `executionStatus()` method.
  - `WorkflowEngineService.java`: Added `quarantineTamperedWorkflow(workflowId, reason)` which transitions workflow to `WorkflowStatus.TAMPERED`, evicts active tasks from persistence queue, and records quarantine failure details.
- **`apps/api/acc-ms-aio`**:
  - `ScheduledLeaseSweeper.java`: Relocated to `com.acc.aio.worker.ScheduledLeaseSweeper`.
  - `WorkflowWorkerConfiguration.java`: Created worker bean configuration in `com.acc.aio.worker`.
  - `SystemTaskWorkerPool.java`: Replaced direct dependency on `ExecutionStreamBroadcaster` with Spring `ApplicationEventPublisher`.
  - `ExecutionStreamBroadcaster.java`: Added `@EventListener` handlers for `WorkflowExecutionBroadcastEvent` and `TaskLogBroadcastEvent`.
  - `WorkflowEngineConfiguration.java`: Decoupled worker beans; registered `AuditLedgerService`.
  - `AuditLedgerController.java`: Created REST verification controller mapped to `/api/v1/workflow/audit`, verifying SHA-256 cryptographic audit chains and quarantining tampered workflows with HTTP 409 Conflict.
  - `WorkflowDlqController.java`: Updated `@PreAuthorize` to strictly evaluate `hasAuthority('platform:dlq:manage')`.
  - Controllers updated to use `WorkflowDefinitionRegistry` from `workflow-engine` and purged of role-based security checks: `TaskWorkerController`, `WorkerFleetController`, `WorkflowApprovalsController`, `WorkflowDefinitionController`, `WorkflowExecutionController`.
- **`apps/api/acc-fw`**:
  - `SystemFleetController.java`: Converted all 12 endpoints to evaluate strictly canonical permissions (`platform:fleet:read`, `platform:fleet:mutate`, `platform:quotas:manage`, `platform:tenant:assume`, `platform:roles:manage`, `platform:users:manage`).
  - `AuditController.java`: Purged `or hasRole('SYSTEM_ROOT')` from `/records`, `/verify`, and `/export`.
  - `TenantProvisioningController.java`: Uncommented and wired canonical permissions `metadata:schema:read` and `metadata:blueprint:provision`.
  - `TenantRoleDelegationController.java`: Purged `hasAnyRole(...)` checks from role retrieval and delegation endpoints.
- **`apps/api/acc-sandbox`**:
  - `SandboxPersonaRegistry.java`: Updated custodian persona to grant canonical permissions `platform:quotas:manage`, `platform:users:manage`, `metadata:blueprint:provision`, and `platform:audit:verify`.

## Verification
1. **Spring Modulith Application Module Tests**:
   - Executed: `pnpm --filter @acc/api test:modulith`
   - Result: **0 failures, 0 errors, 0 boundary violations**. Slices `# Config`, `# Controller`, and `# Worker` verified completely acyclic.
2. **Backend Sandbox Tests**:
   - Executed: `pnpm --filter @acc/api test:sandbox`
   - Result: **53 tests run, 0 failures, 0 errors, 0 skipped**.
3. **Audit Ledger & Quarantine Tests**:
   - Executed: `node mvnw.cjs -pl acc-ms-aio test -Dtest=AuditLedgerControllerTest`
   - Result: Valid chain verified 200 OK; tampered chain triggers immediate quarantine, sets `WorkflowStatus.TAMPERED`, evicts active tasks, and returns 409 CONFLICT.
4. **Dead-Letter Queue Tests**:
   - Executed: `node mvnw.cjs -pl acc-ms-aio test -Dtest=WorkflowDlqRestApiTest`
   - Result: Passed with `platform:dlq:manage` canonical authority verification.
5. **Full Reactor Compilation**:
   - Executed: `pnpm --filter @acc/api check-types`
   - Result: **All 9 modules compiled with BUILD SUCCESS**.

## Walkthrough
- Refer to `apps/api/doc/walkthrough_55.md` for detailed code changes, verification steps, and operational guidelines.

## Tasks
- [x] Extract `WorkflowDefinitionRegistry` and domain events to `workflow-engine`
- [x] Decouple `SystemTaskWorkerPool` and `ExecutionStreamBroadcaster` via Spring domain events
- [x] Relocate `ScheduledLeaseSweeper` and `WorkflowWorkerConfiguration` to `com.acc.aio.worker`
- [x] Enforce Spring Modulith acyclic boundary test pass
- [x] Implement `WorkflowExecutionStatus.TAMPERED` and `WorkflowEngineService.quarantineTamperedWorkflow`
- [x] Create `AuditLedgerController` with immediate execution hold and HTTP 409 Conflict on tampering
- [x] Restrict `WorkflowDlqController` to ad-hoc operations under `platform:dlq:manage`
- [x] Purge all role checks (`hasRole('ADMIN')`, `ROLE_SYSTEM_ROOT`, etc.) and legacy aliases from backend controllers
- [x] Harmonize `SandboxPersonaRegistry` authorities
- [x] Execute complete verification suite and register history records

## Enhancement
- Future iterations can attach automatic hash recalculation on background lease renewals to pre-emptively catch data corruption before worker dispatch.
