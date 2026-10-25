# Implementation Plan: Iteration 20 - Enterprise Hardening & High-Resilience Workflow Orchestration Engine

**Goal Description**: Implement Iteration 20 to transform the Unipost Workflow Orchestration Engine into an enterprise-grade, highly resilient system. This addresses critical architectural findings: decoupling synchronous I/O from the decider core, dynamic fork barrier synchronization, end-to-end DLQ interactive replay, and studio auto-layout improvements.

---

## User Review Required

> [!IMPORTANT]
> **Key Architectural Anchors Ratified from `/grill-me` Alignment:**
> 1. **System Task Execution Topology**:
>    - Embedded Java 21 Loom Virtual Thread workers in `acc-ms-aio` (`SystemTaskWorkerPool`) polling reserved system queues (`system:http`, `system:mcp`, `system:llm`, `system:jdbc`, `system:kafka`). Zero external process overhead and zero database pool starvation.
> 2. **Dynamic Fork Barrier Failure Policy**:
>    - **Fail-Fast & Halt**: If any dynamic child sub-task fails, the parent `DYNAMIC_FORK` task fails immediately, cancels pending in-flight children, and triggers Saga reverse compensation if configured.
> 3. **DLQ Interactive Replay Execution Model**:
>    - **In-Place Node Rerun**: Re-enqueue the poisoned task with modified input parameters preserving the original `executionId`. Downstream nodes are re-evaluated from the failed node, preserving all completed upstream states.
> 4. **Visual DAG Studio Auto-Layout Engine Architecture**:
>    - **Strategy Pattern (`DagLayoutEngineStrategy`)**: Implement a modular layout strategy interface supporting both:
>      - `DagreRankLayoutStrategy` (lightweight, zero bundle bloat, tuned for 240x90px nodes).
>      - `ElkJsLayoutStrategy` (dynamic / pluggable for ultra-dense hierarchical graphs).
>      - Hot-switchable in the Studio toolbar.
> 5. **Staging Order**:
>    - **Backend-First Execution**: Pure Decider Zero-I/O -> Dynamic Fork Barrier -> DLQ Replay API -> Studio Auto-Layout Strategy & UI -> Full Automated Verification.

---

## Proposed Changes by Component

### Backend: Workflow Engine Core (`apps/backend/workflow-engine`)
- `HttpNodeStrategy.java`: Purge `HttpClient` and convert to pure scheduler targeting `system:http`.
- `CallMcpToolStrategy.java`: Purge `HttpClient` and convert to pure scheduler targeting `system:mcp`.
- `LlmChatCompleteStrategy.java`: Purge `HttpClient` and convert to pure scheduler targeting `system:llm`.
- `DynamicForkStrategy.java`: Implement parent task tracking barrier until all dynamic child tasks complete.
- `WorkflowEngineService.java`: Add `replayDlqTask(String workflowId, String taskId, Map<String, Object> modifiedInput, long nowEpochMs)`.

### Backend: API Gateway & Workers (`apps/backend/acc-ms-aio`)
- `SystemTaskWorkerPool.java`: Implement Loom virtual-thread worker pool polling system-reserved queues (`system:http`, `system:mcp`, etc.).
- `WorkflowExecutionController.java`: Expose `/api/v1/workflow/executions/{id}/tasks/{taskId}/replay`.

### Frontend: Console Features (`apps/console/src/features/workflows`)
- `ExecutionRunDrawer.tsx`: Add "Repair & Replay" button on failed task nodes with `VisualJsonEditor` sheet.
- `use-dag-studio-state.ts`: Upgrade `handleAutoLayout` with node dimension awareness and clearance calculations.
- `workflowSandboxHandler.ts`: Add offline simulation support for task replay and dynamic fork barrier completion.

---

## Verification Plan

### Automated Tests
1. **Backend Verification**:
   ```powershell
   cd apps/backend && ./mvnw test-compile -q
   ./mvnw test -Dtest=PureDeciderTest,DynamicForkTest -q
   ```
2. **Frontend Verification**:
   ```powershell
   pnpm --filter @acc/console exec tsc --noEmit
   pnpm --filter @acc/console test -- run src/features/workflows src/features/workflow-executions
   ```

### Manual Verification
1. Open Visual DAG Studio, create an HTTP and Dynamic Fork node, and verify they save cleanly into IR.
2. Trigger an execution failure, inspect the node in the execution drawer, edit the payload in `VisualJsonEditor`, and trigger partial replay.
