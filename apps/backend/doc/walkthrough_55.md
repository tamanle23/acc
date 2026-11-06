# Walkthrough - Iteration 69 (Backend Companion 55)
# Backend Hardening: Spring Modulith Decoupling, Workflow Durability & Canonical Authorization Purge

## 1. Summary of Changes

### 1.1 Phase 1: Track 1 - Spring Modulith Decoupling (`workflow-engine` & `acc-ms-aio`)
- **[`WorkflowDefinitionRegistry.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowDefinitionRegistry.java)**:
  - Extracted definition storage from `acc-ms-aio.config` to `workflow-engine` application layer.
  - Eliminated architectural inversion where worker and controllers imported registry from configuration classes.
- **[`WorkflowExecutionBroadcastEvent.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/events/WorkflowExecutionBroadcastEvent.java) & [`TaskLogBroadcastEvent.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/events/TaskLogBroadcastEvent.java)**:
  - Introduced immutable domain event records in `com.acc.workflow.events`.
- **[`SystemTaskWorkerPool.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/main/java/com/acc/aio/worker/SystemTaskWorkerPool.java)**:
  - Replaced tight coupling to `ExecutionStreamBroadcaster` with standard Spring `ApplicationEventPublisher`.
  - Publishes `WorkflowExecutionBroadcastEvent` and `TaskLogBroadcastEvent` asynchronously across virtual threads.
- **[`ExecutionStreamBroadcaster.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/ExecutionStreamBroadcaster.java)**:
  - Added `@EventListener` handlers for decoupled event reception without violating Spring Modulith module boundaries.
- **[`ScheduledLeaseSweeper.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/main/java/com/acc/aio/worker/ScheduledLeaseSweeper.java) & [`WorkflowWorkerConfiguration.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/main/java/com/acc/aio/worker/WorkflowWorkerConfiguration.java)**:
  - Relocated lease sweeping and worker lifecycle bean initialization to package `com.acc.aio.worker`.
  - Resolved 3-way circular dependency cycle (`config -> worker -> controller -> config`).

### 1.2 Phase 2: Track 2 - Workflow Durability & Cryptographic Audit Quarantine (`workflow-engine` & `acc-ms-aio`)
- **[`WorkflowExecutionStatus.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowExecutionStatus.java)**:
  - Defined explicit execution statuses with `TAMPERED` status (`isTerminal() == true`).
- **[`WorkflowStatus.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowStatus.java) & [`WorkflowSnapshot.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowSnapshot.java)**:
  - Added `TAMPERED` terminal state and `executionStatus()` mapping helpers.
- **[`WorkflowEngineService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowEngineService.java)**:
  - Implemented `quarantineTamperedWorkflow(workflowId, reason)`:
    - Immediately freezes workflow snapshot to `WorkflowStatus.TAMPERED`.
    - Evicts and purges active queue tasks to halt further worker dispatch.
    - Records tamper audit reason in snapshot failure details.
- **[`AuditLedgerController.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/AuditLedgerController.java)**:
  - Created REST controller mapped to `/api/v1/workflow/audit`.
  - `GET /{workflowId}`: returns audit trail.
  - `GET /{workflowId}/verify`: recalculates SHA-256 hash chains. On tamper detection, triggers immediate quarantine and responds with `HTTP 409 Conflict`.
- **[`WorkflowDlqController.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowDlqController.java)**:
  - Confined exclusively to ad-hoc endpoints (`list`, `get`, `replay`, `discard`).
  - Updated `@PreAuthorize` to strictly evaluate canonical `platform:dlq:manage`.

### 1.3 Phase 3: Track 3 - Canonical NIST RBAC Level 2 Method Security Purge (`acc-ms-aio`, `acc-fw`, `acc-sandbox`)
- Purged all occurrences of `hasRole('ADMIN')`, `ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`, `ROLE_SYSTEM_CUSTODIAN`, and legacy aliases across:
  - **`TaskWorkerController.java`**: `@PreAuthorize("hasAuthority('platform:workers:manage')")`
  - **`WorkerFleetController.java`**: `@PreAuthorize("hasAuthority('platform:workers:manage')")`
  - **`WorkflowApprovalsController.java`**: `@PreAuthorize("hasAuthority('workflow:execution:read')")` and `workflow:approval:execute`
  - **`WorkflowDefinitionController.java`**: Purged all 12 occurrences of `or hasRole('ADMIN')`
  - **`WorkflowExecutionController.java`**: Purged all 11 occurrences of `or hasRole('ADMIN')`
  - **`SystemFleetController.java`**: Normalized 12 endpoints to evaluate `platform:fleet:read`, `platform:fleet:mutate`, `platform:quotas:manage`, `platform:tenant:assume`, `platform:roles:manage`, and `platform:users:manage`
  - **`AuditController.java`**: Purged `or hasRole('SYSTEM_ROOT')` from audit record queries, hash verification, and compliance export
  - **`TenantProvisioningController.java`**: Uncommented and wired canonical `metadata:schema:read` and `metadata:blueprint:provision`
  - **`TenantRoleDelegationController.java`**: Purged `hasAnyRole(...)` checks
  - **`SandboxPersonaRegistry.java`**: Harmonized custodian persona authorities to match canonical permissions

---

## 2. Verification Results

1. **Spring Modulith Application Module Verification (`pnpm test:modulith`)**:
   - `ModularityTests.java` executed: **1 passed, 0 failed, 0 errors, 0 boundary violations**.
   - Verified clean acyclic module slice topology:
     - `# Config` (`com.acc.aio.config`)
     - `# Controller` (`com.acc.aio.controller`)
     - `# Worker` (`com.acc.aio.worker`)
2. **Backend Sandbox Integration Test Suite (`pnpm test:sandbox`)**:
   - Executed: **53 passed, 0 failed, 0 errors, 0 skipped**.
3. **Cryptographic Audit Ledger & Quarantine Tests (`AuditLedgerControllerTest`)**:
   - `testSecurityAnnotationAndMapping`: Verifies `hasAuthority('workflow:execution:read')`.
   - `testWorkflowNotFound`: Verifies 404 response on unknown workflow.
   - `testVerifyValidAuditChain`: Verifies 200 OK and unbroken cryptographic audit records.
   - `testVerifyTamperedAuditChain`: Verifies 409 CONFLICT, immediate transition to `WorkflowStatus.TAMPERED`, queue task eviction, and terminal halt.
4. **Dead-Letter Queue REST API Tests (`WorkflowDlqRestApiTest`)**:
   - Verified strict `platform:dlq:manage` canonical authority enforcement and ad-hoc replay/discard mechanics.
5. **Full Reactor Build & Typecheck (`pnpm check-types`)**:
   - All 9 Maven modules compiled with **BUILD SUCCESS**.
