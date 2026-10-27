# 107. Phase 35.3: Low-Frequency Task Node Types Engine

**Date:** 2026-10-15  
**Scope:** `apps/backend/workflow-engine`, `apps/backend/acc-ms-aio`  
**Status:** Completed  

---

## 1. Problem
Workflows occasionally require specialized or infrastructure-level integrations such as passive edge routing (`NOOP`), relational database updates without external workers (`JDBC`), direct message queue ingestion (`KAFKA_PUBLISH`), or emerging AI Model Context Protocol integrations (`CALL_MCP_TOOL`). Having first-class strategies for these low-frequency task types from `docs/brainstorming/workflow_task_types.md` completes our comprehensive task engine taxonomy.

## 2. Plan
1. Add `NOOP`, `JDBC`, `KAFKA_PUBLISH`, `CALL_MCP_TOOL` to `TaskType`.
2. Implement dedicated strategies (`NoopNodeStrategy`, `JdbcNodeStrategy`, `KafkaPublishStrategy`, `CallMcpToolStrategy`).
3. Register all 4 strategies in `NodeStrategyRegistry`.
4. Verify via unit tests in `workflow-engine` and full module regression.

## 3. Changes
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskType.java`**:
  - Added low-frequency task types.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/`**:
  - Created `NoopNodeStrategy.java`, `JdbcNodeStrategy.java`, `KafkaPublishStrategy.java`, `CallMcpToolStrategy.java`.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/NodeStrategyRegistry.java`**:
  - Registered all 4 strategies.
- **Tests & Artifacts**:
  - Created `LowFrequencyTaskStrategiesTest.java` in `workflow-engine`.
  - Created `apps/backend/doc/implementation_plan_37.md` and `apps/backend/doc/walkthrough_37.md`.

## 4. Verification
- `cd apps/backend; ./mvnw.cmd test -pl workflow-engine`: 42/42 tests passed.
- `cd apps/backend; ./mvnw.cmd test -pl acc-ms-aio`: 4/4 test suites passed.
- `pnpm --filter @acc/worker test`: 5/5 tests passed.

## 5. Walkthrough
- `NOOP`: cleanly passed through resolved parameters and completed immediately without side-effects.
- `JDBC`: simulated SQL query execution and captured affected rows.
- `KAFKA_PUBLISH`: generated partitioned topic output with offset tracking.
- `CALL_MCP_TOOL`: executed Model Context Protocol tool call with arguments.

## 6. Tasks
- [x] Extend `TaskType` with low-frequency types.
- [x] Implement node strategies for `NOOP`, `JDBC`, `KAFKA_PUBLISH`, `CALL_MCP_TOOL`.
- [x] Wire into `NodeStrategyRegistry`.
- [x] Pass unit and integration tests.
- [x] Document implementation plan, walkthrough, and history entry.

## 7. Next Steps
- Implement Sub-phase 35.4: Polyglot End-to-End Orchestration & Automated Saga Verification.
