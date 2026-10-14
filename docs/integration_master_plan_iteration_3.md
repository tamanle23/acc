# Integration Master Plan (Iteration 3)
## Workstream 6: Distributed DAG Workflow Execution Engine & Autonomous Workflow Orchestration

---

## 1. Executive Summary & Architectural Vision

Iteration 3 advances the UniPost platform from metadata-driven data persistence and visual state machines to a **high-throughput, distributed Directed Acyclic Graph (DAG) Workflow Execution Engine**. 

While state machines (FSM) manage lifecycle state transitions on individual aggregate entities (e.g. `DRAFT -> SUBMITTED -> APPROVED`), enterprise business operations demand complex multi-step orchestration across distributed systems, parallel task execution, conditional branching, automated compensation (Sagas), and asynchronous worker dispatch.

Iteration 3 bridges **code-first developer authoring** with **zero-code visual builder authoring** via a bidirectional **Canonical Intermediate Representation (IR)**, backed by PostgreSQL JSONB persistence, Kahn's algorithm topological dispatch, and transactional outbox event streaming.

```
       +-------------------------------------------------------+
       |               Authoring Interfaces                    |
       |                                                       |
       |   [ Developer IDE ]            [ Web Canvas (React Flow) ]
       |   Java Fluent DSL              Visual DAG Studio      |
       |   (.builder().build())         (Drag, Drop, Connect)  |
       +---------------------------+---------------------------+
                                   |
                                   v
       +-------------------------------------------------------+
       |       Canonical DAG Intermediate Representation       |
       |                       (IR / JSONB)                    |
       |   - nodes: Task key, handlerRef, timeout, retries     |
       |   - edges: Source, target, condition SpEL, joinMode   |
       |   - layoutMetadata: (x, y) coordinates & zoom         |
       +---------------------------+---------------------------+
                                   |
                Topological Sorter & Acyclicity Verifier
                       (Kahn's Algorithm + Tarjan)
                                   |
                                   v
       +-------------------------------------------------------+
       |           Spring Boot Distributed Orchestrator        |
       |                                                       |
       |   - dag_definitions (JSONB, versioned)                |
       |   - dag_runs (id, status, context_data JSONB)         |
       |   - task_instances (id, task_key, status, in/out)    |
       |   - outbox_events (Transactional Outbox FIFO)         |
       +---------------------------+---------------------------+
                                   |
            Pub/Sub Event Streaming / Hazelcast Distributed Lock
                                   |
                                   v
       +-------------------------------------------------------+
       |           Distributed Idempotent Worker Pool          |
       |   - Parallel execution of independent tasks           |
       |   - Fan-out / Fan-in synchronization barriers         |
       |   - Automatic compensating actions on failure (Saga)  |
       +-------------------------------------------------------+
```

---

## 2. Iteration 3 Scope & Phase Breakdown (Phases 26 – 30)

| Phase | Milestone Title | Target Deliverables | Verification Mechanism |
| :---: | :--- | :--- | :--- |
| **Phase 26** | Canonical DAG IR Schema & Bidirectional Compiler | PostgreSQL tables (`dag_definitions`, `dag_runs`, `task_instances`), JSON Schema validation, bidirectional JSON $\leftrightarrow$ Java fluent DSL compiler. | JUnit & Jackson contract tests verifying round-trip JSON serialization and schema validation. |
| **Phase 27** | Topological Cycle Detection & Kahn's Dispatch Engine | Kahn's algorithm topological sorter, Tarjan strongly-connected component cycle detection, ready-task discovery engine with fan-out/fan-in barriers. | Unit tests asserting acyclicity, cycle rejection with cycle path traces, and multi-branch execution order. |
| **Phase 28** | Distributed Execution & Transactional Outbox Dispatcher | `DagExecutionService`, state machine transition per task, Hazelcast distributed locks for race condition prevention, transactional outbox dispatching. | Concurrent multi-thread execution test with simulated task latency, retries, and atomic state transitions. |
| **Phase 29** | Visual DAG Canvas Studio (`@unipost/console`) | React Flow interactive graph canvas, custom task nodes, edge condition editor, Dagre auto-layout generator, live run monitoring overlay. | Vitest component tests, React Flow node/edge mutations, and layout round-trip preservation tests. |
| **Phase 30** | Distributed Saga Compensation & End-to-End Hardening | Backward compensation traversal on failure, timeout watchdog timer, dead-letter queue, idempotency key preservation across retry attempts. | End-to-end chaos integration test executing 100 concurrent workflow runs with simulated random node failures. |

---

## 3. Deep Dive Phase Specifications

### Phase 26: Canonical DAG IR Schema & Bidirectional Compiler
- **Objective:** Establish the non-lossy JSON/JSONB format representing any workflow graph, and build the Java Fluent DSL that compiles directly to it.
- **Canonical IR Specifications (`dag-ir-schema-v1.json`)**:
  - `dagKey`: Alphanumeric slug identifier (`order-fulfillment`).
  - `version`: Monotonically increasing schema revision integer.
  - `nodes`: Array of task nodes with `taskKey`, `handlerRef`, `description`, `timeoutMs`, `maxAttempts`, and `inputBindings` (JSONPath expressions referencing parent task outputs).
  - `edges`: Array of directed dependencies with `fromTask`, `toTask`, and optional `condition` (Spring SpEL expression).
  - `layoutMetadata`: Map of `taskKey` to `{ x: number, y: number }` to guarantee visual canvas fidelity upon round-trip edits.
- **PostgreSQL Persistence**:
  - `dag_definitions`: Stores versioned DAG metadata. Partial unique index on `(dag_key, version) WHERE "deletedDate" IS NULL`.
  - `dag_runs`: Stores runtime execution status (`RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED`) with `context_data` JSONB.
  - `task_instances`: Stores individual task nodes within a run with `status` (`PENDING`, `READY`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED`), `input_data`, `output_data`, and optimistic locking `@Version`.

### Phase 27: Topological Cycle Detection & Kahn's Dispatch Engine
- **Objective:** Prevent execution deadlocks by mathematically verifying graph acyclicity prior to run creation, and compute dynamic execution frontiers.
- **Graph Algorithms**:
  - **Acyclicity Guard**: On workflow registration and update, run Kahn's algorithm ($O(V + E)$). If indegree reduction leaves unvisited nodes, extract the cycle path using Tarjan's strongly connected components algorithm and fail-fast with `DagCycleDetectedException`.
  - **Ready-Task Calculation**: When an execution run starts or a task completes, query dependent nodes whose incoming edge requirements are satisfied (all parent nodes in `COMPLETED` status and conditional edge guards evaluate to `true`).
  - **Join Modes**: Support `ALL` (fan-in: wait for all parents) and `ANY` (first completed parent advances execution).

### Phase 28: Distributed Execution & Transactional Outbox Dispatcher
- **Objective:** Execute tasks asynchronously across worker threads without lost updates, split-brain states, or dual-write hazards.
- **Execution Architecture**:
  - When tasks become `READY`, atomically stage tasks into `outbox_events` within the same PostgreSQL transaction.
  - Workers acquire distributed lease locks via Hazelcast (`IMap.lock(taskInstanceId, 30, TimeUnit.SECONDS)`) ensuring exactly-once execution per task attempt.
  - Tasks report execution results (`COMPLETED` or `FAILED`), updating `task_instances` with execution metrics and invoking the next topological iteration.

### Phase 29: Visual DAG Canvas Studio (`@unipost/console`)
- **Objective:** Provide a rich web studio for architects and business operators to compose, visualize, inspect, and monitor DAG workflows.
- **Frontend Components**:
  - `DagCanvas`: React Flow interactive canvas with minimap, controls, and background grid.
  - Custom Nodes: Task type visual cards displaying handler icon, status badge, and retry metrics.
  - Dagre Layout Generator: Automatic hierarchical layout computation for imported code-first definitions lacking coordinates.
  - Live Run Inspector: Real-time execution visualizer coloring nodes dynamically (`green` for completed, `amber` for in-progress, `red` for failed) with inspectable inputs/outputs.

### Phase 30: Distributed Saga Compensation & End-to-End Hardening
- **Objective:** Provide fault-tolerance and self-healing transactions across distributed microservices.
- **Saga Compensation Traversal**:
  - If a task permanently fails and exhausts retry policies, trigger the compensation sequence.
  - Walk the graph backwards from completed tasks, dispatching compensating actions (`compensateHandlerRef`) in reverse topological order.
  - Generate comprehensive execution traces with MDC logging (`[trace_id] [tenant_id] [dag_run_id] [task_key]`).

---

## 4. Architectural Invariants for Iteration 3

1. **Acyclicity Invariant**: Every DAG definition must be proven acyclic via Kahn's algorithm before registration. Cyclic graphs are rejected at compilation.
2. **Zero-Loss Round-Trip Invariant**: Visual edits must never discard programmatic task configurations, and code compilation must preserve visual layout coordinates (`layoutMetadata`).
3. **Transactional Outbox Invariant**: State transitions on `dag_runs` and `task_instances` must be committed in the exact same database transaction as `outbox_events` publication.
4. **Idempotent Task Invariant**: Worker dispatch must be idempotent. Re-delivering a task execution event must not duplicate operations or corrupt state.
5. **No Synthetic Mocks Invariant**: Real execution engines, PostgreSQL queries, and topological sorters must be tested using production classes and Testcontainers.
