# Implementation Plan - Phase 35.3: Low-Frequency Task Node Types Engine

Prioritize and implement low-frequency task node types in `@unipost/backend` based on `docs/brainstorming/workflow_task_types.md` and `docs/integration_master_plan_iteration_4.md`.

## Proposed Changes

### 1. `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/TaskType.java`
- Added:
  - `NOOP`
  - `JDBC`
  - `KAFKA_PUBLISH`
  - `CALL_MCP_TOOL`

### 2. Node Evaluator Strategies
Implement dedicated strategies implementing `NodeEvaluatorStrategy`:
- `NoopNodeStrategy.java`: Clean pass-through node resolving inputs and completing immediately.
- `JdbcNodeStrategy.java`: Direct relational database operation execution.
- `KafkaPublishStrategy.java`: Dedicated Kafka topic producer with partition/offset tracking.
- `CallMcpToolStrategy.java`: Model Context Protocol tool invocation node.

### 3. Strategy Registry Wiring
- Register all 4 strategies in `NodeStrategyRegistry.java`.

### 4. Verification
- `LowFrequencyTaskStrategiesTest.java` in `workflow-engine`.
- Full regression test run across `workflow-engine`, `unipost-ms-aio`, and `@unipost/worker`.
