# Companion App Implementation Plan - Backend Hardening (Plan 55)
# Subsystem: apps/backend (Spring Modulith / Java 21)

## Associated Master Plan
`docs/iterations/master_implementation_plan_iteration_69.md`

## 1. Objectives & Architectural Boundaries
Mirroring Iteration 69 master roadmap and `/grill-me` decisions, execute three core backend tracks:
- **Track 1**: Eliminate Spring Modulith violations by extracting `WorkflowDefinitionRegistry` to `workflow-engine`, moving `ScheduledLeaseSweeper` and `PostgresNotificationListener` into `com.acc.aio.worker` (`WorkflowWorkerConfiguration`), and decoupling `SystemTaskWorkerPool` from `ExecutionStreamBroadcaster` using in-memory `@EventListener` domain events.
- **Track 2**: Rename `WorkflowStatus` to `WorkflowExecutionStatus`, harden workflow decider and worker durability, register `AuditLedgerService` bean, implement cryptographic SHA-256 audit verification endpoint with immediate `TAMPERED` quarantine, task cancellation, and 409 Conflict response, and maintain ad-hoc only DLQ operations (`replay` and `discard` per single ID) protected by `platform:dlq:manage`.
- **Track 3**: Purge all legacy `hasRole('ADMIN')`, `ROLE_SYSTEM_ROOT`, and redundant aliases (`platform:quotas:override`, `platform:users:lock`) across all controllers in `acc-fw` and `acc-ms-aio`, enforcing strict NIST RBAC Level 2 canonical permissions.

---

## 2. Phased Execution Parity Matrix

### Phase 1: Spring Modulith Decoupling (Track 1)
- **Files**:
  - `workflow-engine/src/main/java/com/acc/workflow/application/WorkflowDefinitionRegistry.java` [NEW]
  - `workflow-engine/src/main/java/com/acc/workflow/events/WorkflowExecutionBroadcastEvent.java` [NEW]
  - `workflow-engine/src/main/java/com/acc/workflow/events/TaskLogBroadcastEvent.java` [NEW]
  - `acc-ms-aio/src/main/java/com/acc/aio/worker/ScheduledLeaseSweeper.java` [NEW]
  - `acc-ms-aio/src/main/java/com/acc/aio/worker/WorkflowWorkerConfiguration.java` [NEW]
  - `acc-ms-aio/src/main/java/com/acc/aio/config/WorkflowEngineConfiguration.java` [MODIFY]
  - `acc-ms-aio/src/main/java/com/acc/aio/worker/SystemTaskWorkerPool.java` [MODIFY]
  - `acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/ExecutionStreamBroadcaster.java` [MODIFY]
  - `acc-ms-aio/src/test/java/com/acc/aio/ModularityTests.java` [VERIFY]
  - Update imports across 8 test classes referencing definition registry.
- **Gate**: `pnpm --filter @acc/backend test:modulith` exits 0 with 0 violations.

### Phase 2: Workflow Engine Durability, Renaming & Audit Quarantine (Track 2)
- **Files**:
  - `workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowExecutionStatus.java` [NEW] (Renamed from `WorkflowStatus`, `TAMPERED` added)
  - `acc-ms-aio/src/main/java/com/acc/aio/config/WorkflowEngineConfiguration.java` [MODIFY] (Add `auditLedgerService` bean)
  - `workflow-engine/src/main/java/com/acc/workflow/application/WorkflowEngineService.java` [MODIFY] (Add `quarantineTamperedWorkflow`)
  - `acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/AuditLedgerController.java` [NEW] (Add 409 Conflict quarantine handling)
  - `acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowDlqController.java` [MODIFY] (Ad-hoc operations protected by `platform:dlq:manage`)
  - `acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/WorkflowDlqRestApiTest.java` [MODIFY]
  - Refactor all references from `WorkflowStatus` to `WorkflowExecutionStatus`.
- **Gate**: Sliced tests for AuditLedger and DLQ controllers exit 0.

### Phase 3: Canonical RBAC/ReBAC Controller Security Enforcement (Track 3)
- **Files**:
  - `acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/TaskWorkerController.java` [MODIFY]
  - `acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkerFleetController.java` [MODIFY]
  - `acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowApprovalsController.java` [MODIFY]
  - `acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowDefinitionController.java` [MODIFY]
  - `acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowExecutionController.java` [MODIFY]
  - `acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowDlqController.java` [MODIFY]
  - `acc-fw/src/main/java/com/acc/presentation/SystemFleetController.java` [MODIFY]
  - `acc-fw/src/main/java/com/acc/controller/AuditController.java` [MODIFY]
  - `acc-fw/src/main/java/com/acc/presentation/TenantProvisioningController.java` [MODIFY]
  - `acc-sandbox/src/main/java/com/acc/sandbox/auth/SandboxPersonaRegistry.java` [MODIFY]
- **Gate**: Full backend test suite `node mvnw.cjs test` exits 0.
