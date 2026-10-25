# Integration Master Plan (Iteration 3)
## Workstream 6: Battle-Tested Distributed Workflow Orchestration Engine (Netflix Conductor OSS, Local-First Architecture & Pure TypeScript Worker SDK)

---

## 1. Executive Summary & Architectural Vision

Iteration 3 advances the UniPost platform from metadata-driven data persistence and visual state machines to a **battle-tested, distributed Workflow Orchestration Engine**. Drawing architectural patterns directly from **Netflix Conductor OSS** and modern **Local-First / Hexagonal Systems**, this engine delivers deterministic execution, zero-loss snapshot isolation, unified multi-cloud/local deployment capabilities, and a **first-class Pure TypeScript Worker SDK (`@acc/worker`)**.

While State Machines (FSM) govern lifecycle state transitions on individual aggregate entities (e.g. `DRAFT -> SUBMITTED -> APPROVED`), enterprise operations require high-throughput multi-step orchestration across distributed systems:
- Parallel task fan-out and synchronization barriers (`FORK_JOIN`, `DYNAMIC_FORK`)
- Conditional branching (`SWITCH`) and deterministic loops (`DO_WHILE`)
- Asynchronous callback deferral (`WAIT`, `callbackAfterSeconds`)
- Relational lease queueing with auto-heartbeat lease extensions
- Automated compensating actions (Distributed Sagas)
- Zero-I/O deterministic decider loops
- **Polyglot Worker Execution**: Native execution of tasks via Java 21 Virtual Threads AND lightweight, cross-platform TypeScript workers (Web, Node.js, Bun, React Native/Mobile, and Edge).

The engine is implemented as a dedicated Maven submodule (`workflow-engine`) within `apps/backend/` and organized around **Hexagonal Architecture (Ports & Adapters)**, strictly separating a 100% deterministic, zero-I/O functional core (`PureDecider`) from pluggable imperative persistence and worker transport adapters. It bridges **code-first developer authoring** with **zero-code visual builder authoring** (`@xyflow/react` in `@acc/console`) via a bidirectional **Canonical Intermediate Representation (IR)**.

```
       +-------------------------------------------------------------------+
       |                       Authoring Interfaces                        |
       |                                                                   |
       |   [ Developer IDE ]            [ Web Canvas (React Flow) ]         |
       |   Java Fluent DSL              Visual Workflow Studio             |
       |   TypeScript Fluent Builder    (Drag, Drop, Connect)              |
       +---------------------------------+---------------------------------+
                                         |
                                         v
       +-------------------------------------------------------------------+
       |             Canonical Workflow Intermediate Representation         |
       |                             (IR / JSONB)                          |
       |   - nodes: Task key, handlerRef, timeout, retries                 |
       |   - nodeTypes: SIMPLE, SWITCH, FORK_JOIN, WAIT, etc.              |
       |   - layoutMetadata: (x, y) coordinates & zoom                     |
       +---------------------------------+---------------------------------+
                                         |
                      Topological Sorter & Acyclicity Verifier
                             (Kahn's Algorithm + Tarjan)
                                         |
                                         v
       +-------------------------------------------------------------------+
       |                   PureDecider (Zero-I/O Core)                     |
       |   - 100% Pure & Deterministic State Machine Evaluator             |
       |   - Strategy Pattern per Node Type                                |
       |   - Emits Sealed Engine Commands                                  |
       +---------------------------------+---------------------------------+
                                         |
                           UnitOfWork & Storage Adapters
               (PostgreSQL RLS SKIP LOCKED / SQLite WAL Local-First)
                                         |
                                         v
       +-------------------------------------------------------------------+
       |             Single-Column Lease Queue (task_queue)                |
       |   - visible_at_epoch_ms governs schedule, lease,                  |
       |     async callback deferrals, and retry backoffs                  |
       +---------------------------------+---------------------------------+
                                         |
                     Pull-Based Worker Transport Port (HTTP / In-Process)
                                         |
                     +-------------------+-------------------+
                     |                                       |
                     v                                       v
       +---------------------------+       +-------------------------------+
       | Java Virtual-Thread Host  |       | Pure TypeScript Worker SDK    |
       | (apps/backend/wf-engine)  |       | (@acc/worker package)     |
       | - Virtual-Thread per Task |       | - Universal (Node/Bun/Browser)|
       | - Semaphore Concurrency   |       | - Promise-based Concurrency   |
       | - Java Middleware Chain   |       | - Composable Async Middleware |
       | - TaskOutcome: Sealed Rec |       | - Discriminated TaskOutcome   |
       +---------------------------+       +-------------------------------+
```

---

## 2. Non-Negotiable Architectural Invariants (Guardrails)

1. **Zero-I/O Functional Core (`PureDecider`)**:
   - Everything under the core engine package MUST be 100% pure, deterministic, and synchronous.
   - Core classes must NEVER import `java.sql.*`, `javax.sql.*`, network clients, thread pools, Spring annotations, or call `System.currentTimeMillis()` / `Instant.now()` / `UUID.randomUUID()` directly. Pass `long nowEpochMs` and deterministic task IDs explicitly.
   - Core signature: `DecisionResult decide(WorkflowDefinition definition, WorkflowSnapshot snapshot, long nowEpochMs)`.
2. **Memento Pattern for Definition Immutability**:
   - Starting a workflow MUST freeze a serialized JSON snapshot of the `WorkflowDefinition` into the persisted execution record (`definition_snapshot`). In-flight workflows evaluate strictly against their frozen definition, immunizing running jobs from schema mutations.
3. **Open/Closed Node Evaluation (`Strategy + Registry Pattern`)**:
   - No monolithic `switch/if-else` blocks inside `PureDecider`.
   - Every node type (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `DO_WHILE`, `WAIT`) implements `NodeEvaluatorStrategy` registered in `NodeStrategyRegistry`.
4. **Transactional Outbox + Single-Column Lease Queue (`Unit of Work`)**:
   - State updates and queue scheduling occur inside a single atomic transaction (`UnitOfWork`).
   - Relational `task_queue` outbox table uses a single unified `visible_at_epoch_ms` column governing initial scheduling (`now`), worker lease lock (`now + responseTimeoutMs`), async deferral (`now + callbackAfterMs`), and exponential retry backoff (`now + backoffMs`).
   - Supports PostgreSQL `FOR UPDATE SKIP LOCKED` for cloud-native clusters and SQLite WAL mode for local-first/desktop execution. Zero external broker dependency (no mandatory Kafka/Redis/RabbitMQ).
5. **Polyglot Stateless Polling Workers with Symmetric Middleware Chains**:
   - Both Java `WorkerHost` and TypeScript `WorkflowWorkerHost` adhere to the exact same pull-based protocol (`pollBatch`, `reportTaskResult`, `heartbeat`).
   - Execution runs through composable middleware:
     - `SchemaValidationMiddleware` (validates task input/output contracts)
     - `AutoHeartbeatMiddleware` (periodically extends lease timestamp in background during long operations)
     - `ErrorClassificationMiddleware` (differentiates transient retryable errors from terminal failures).
6. **Multi-Tenant RLS & Sovereign Context Preservation**:
   - All workflow definition, execution, and task queue records strictly partition by `tenant_id` and `workspace_id`.
   - W3C traceparent context (`trace_id`, `tenant_id`, `workspace_id`, `task_id`) propagates through every decider step, worker execution log, and outbox event across Java and TypeScript boundaries.
7. **Zero-Synthetic-Mocks & Active Runtime Execution Invariant**:
   - In accordance with monorepo rules, tests must exercise real production classes, real SQLite/PostgreSQL schemas, and real deciders. Golden trace replay suites guarantee zero regressions.

---

## 3. Directory Layouts (Backend & Pure TypeScript SDK)

### 3.1 Backend Module: `apps/backend/workflow-engine/`

```text
apps/backend/
├── pom.xml                                              # Root Backend POM (includes <module>workflow-engine</module>)
└── workflow-engine/                                     # NEW SUBMODULE
    ├── pom.xml                                          # Submodule POM (Jackson, SQLite-JDBC, SLF4J, JUnit 5, AssertJ)
    └── src/
        ├── main/
        │   ├── java/com/acc/workflow/
        │   │   ├── core/                                # PURE DOMAIN CORE (Zero I/O, Zero JDBC/Framework imports)
        │   │   │   ├── model/
        │   │   │   │   ├── WorkflowDefinition.java      # Immutable Java records for DAG nodes & workflow def
        │   │   │   │   ├── WorkflowSnapshot.java        # Immutable point-in-time state of workflow + tasks
        │   │   │   │   ├── TaskSnapshot.java
        │   │   │   │   ├── TaskStatus.java              # Enum: SCHEDULED, IN_PROGRESS, COMPLETED, FAILED, TIMED_OUT, SKIPPED
        │   │   │   │   ├── WorkflowStatus.java          # Enum: RUNNING, COMPLETED, FAILED, TERMINATED, PAUSED
        │   │   │   │   ├── EngineCommand.java           # Sealed interface for deterministic engine commands
        │   │   │   │   └── DecisionResult.java
        │   │   │   ├── decider/
        │   │   │   │   ├── PureDecider.java             # Deterministic state machine evaluator
        │   │   │   │   ├── NodeStrategyRegistry.java
        │   │   │   │   └── strategy/
        │   │   │   │       ├── NodeEvaluatorStrategy.java
        │   │   │   │       ├── SimpleTaskStrategy.java
        │   │   │   │       ├── SwitchNodeStrategy.java
        │   │   │   │       ├── ForkJoinStrategy.java
        │   │   │   │       ├── DynamicForkStrategy.java
        │   │   │   │       ├── WaitNodeStrategy.java
        │   │   │   │       └── DoWhileStrategy.java
        │   │   │   └── expression/
        │   │   │       └── ParameterResolver.java       # Interpreter pattern for ${workflow.input.x} & ${taskRef.output.y}
        │   │   ├── ports/                               # HEXAGONAL PORTS (Interfaces only)
        │   │   │   ├── PersistencePort.java
        │   │   │   ├── UnitOfWork.java
        │   │   │   └── WorkerTransportPort.java         # pollBatch, reportTaskResult, heartbeat
        │   │   ├── application/                         # IMPERATIVE SHELL (Orchestrates UoW + PureDecider)
        │   │   │   ├── WorkflowEngineService.java       # startWorkflow, reportTaskResult, sweepExpiredLeases
        │   │   │   └── SagaCompensator.java             # Reverse-DAG compensation planner on terminal failure
        │   │   ├── adapters/                            # INFRASTRUCTURE ADAPTERS
        │   │   │   ├── storage/
        │   │   │   │   ├── InMemoryPersistenceAdapter.java
        │   │   │   │   ├── SqliteJdbcPersistenceAdapter.java # Pure JDBC + SQLite WAL mode (Local-First)
        │   │   │   │   └── PostgresJdbcPersistenceAdapter.java # PostgreSQL RLS + FOR UPDATE SKIP LOCKED
        │   │   │   └── transport/
        │   │   │       ├── InProcessTransportAdapter.java
        │   │   │       └── HttpWorkerApiAdapter.java    # Spring MVC endpoints for TypeScript workers
        │   │   └── worker/                              # JAVA WORKER SDK & MIDDLEWARE PIPELINE
        │   │       ├── WorkerHost.java                  # Virtual-thread poller, Semaphore concurrency & adaptive backoff
        │   │       ├── WorkerConfig.java                # Record for taskType, domain, concurrency, poll intervals
        │   │       ├── TaskContext.java                 # Context passed to worker handler (input, attempt, heartbeat, log)
        │   │       ├── TaskOutcome.java                 # Sealed return type (Completed, InProgress, Failed)
        │   │       ├── TaskHandler.java                 # Functional interface for worker tasks
        │   │       ├── WorkerMiddleware.java            # Chain of Responsibility interface & pipeline
        │   │       └── middleware/
        │   │           ├── SchemaValidationMiddleware.java
        │   │           ├── AutoHeartbeatMiddleware.java
        │   │           └── ErrorClassificationMiddleware.java
        │   └── resources/
        │       └── db/
        │           ├── schema-sqlite.sql                # DDL for workflow_executions, task_executions, task_queue
        │           └── schema-postgres.sql              # PostgreSQL DDL with RLS & SKIP LOCKED indexes
        └── test/
            └── java/com/acc/workflow/
                ├── core/
                │   ├── PureDeciderTest.java             # Pure record-in / command-out unit tests (<1ms per test)
                │   └── GoldenTraceReplayTest.java       # Golden trace replay regression suite
                ├── adapters/
                │   ├── PersistenceContractTest.java     # Abstract JUnit 5 contract suite
                │   ├── InMemoryPersistenceTest.java     # Runs contract suite against InMemory adapter
                │   └── SqlitePersistenceTest.java       # Runs contract suite against SQLite WAL adapter
                └── e2e/
                    └── WorkflowLifecycleE2ETest.java    # End-to-end: retries, callbackAfterSeconds, lease recovery
```

### 3.2 Pure TypeScript Worker SDK: `packages/worker/`

Packaged as a lightweight, zero-external-dependency TypeScript package (`@acc/worker`) linked via pnpm workspace (`workspace:*`).

```text
packages/worker/
├── package.json                                         # Package config (@acc/worker, types, exports)
├── tsconfig.json                                        # Extends @acc/typescript-config/base.json
└── src/
    ├── index.ts                                         # Public API export barrel
    ├── types.ts                                         # Pure TypeScript types & Discriminated Unions
    │   ├── TaskStatus.ts                                # 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT'
    │   ├── TaskContext.ts                               # Type-safe context passed to TypeScript worker
    │   ├── TaskOutcome.ts                               # Discriminated union: Completed | InProgress | Failed
    │   └── WorkerConfig.ts                              # Concurrency, pollIntervals, domain, batchSize
    ├── client/
    │   ├── WorkerTransportClient.ts                     # Fetch-based or In-Process client protocol
    │   └── HttpWorkerTransportClient.ts                 # Real HTTP polling client wired to backend endpoints
    ├── host/
    │   ├── WorkflowWorkerHost.ts                        # Master worker host managing concurrency & lifecycle
    │   ├── TaskPoller.ts                                # Adaptive exponential backoff poller per taskType
    │   └── ConcurrencyLimiter.ts                        # In-flight async promise concurrency limiter
    ├── middleware/
    │   ├── Middleware.ts                                # Composable middleware interface
    │   ├── MiddlewarePipeline.ts                        # Chain of responsibility executor
    │   ├── AutoHeartbeatMiddleware.ts                   # Periodic timer triggering heartbeat while task runs
    │   ├── SchemaValidationMiddleware.ts                # Invariant & Zod/JSON Schema validation
    │   └── ErrorClassificationMiddleware.ts             # Maps errors to retryable vs terminal TaskOutcome
    └── __tests__/
        ├── worker-host.test.ts                          # Unit tests verifying registration, polling, shutdown
        ├── middleware.test.ts                           # Middleware execution order & auto-heartbeat timer tests
        └── e2e-worker.test.ts                           # End-to-end task execution with mock transport
```

---

## 4. Pure TypeScript Worker SDK Specifications (`packages/worker/`)

### 4.1 Type-Safe Discriminated Task Outcome (`src/types.ts`)

```typescript
export type TaskStatus = 
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'SKIPPED';

export type TaskOutcome =
  | { status: 'COMPLETED'; output?: Record<string, unknown> }
  | { status: 'IN_PROGRESS'; callbackAfterSeconds: number; partialOutput?: Record<string, unknown> }
  | { status: 'FAILED'; errorMessage: string; retryable: boolean; output?: Record<string, unknown> };

export const TaskOutcome = {
  completed: (output?: Record<string, unknown>): TaskOutcome => ({
    status: 'COMPLETED',
    output: output ?? {},
  }),
  inProgress: (callbackAfterSeconds: number, partialOutput?: Record<string, unknown>): TaskOutcome => ({
    status: 'IN_PROGRESS',
    callbackAfterSeconds,
    partialOutput: partialOutput ?? {},
  }),
  failedRetryable: (errorMessage: string, output?: Record<string, unknown>): TaskOutcome => ({
    status: 'FAILED',
    errorMessage,
    retryable: true,
    output: output ?? {},
  }),
  failedTerminal: (errorMessage: string, output?: Record<string, unknown>): TaskOutcome => ({
    status: 'FAILED',
    errorMessage,
    retryable: false,
    output: output ?? {},
  }),
};
```

### 4.2 TypeScript `TaskContext` Interface

```typescript
export interface TaskContext<TInput = Record<string, unknown>> {
  readonly taskId: string;
  readonly workflowId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly taskType: string;
  readonly referenceName: string;
  readonly domain: string;
  readonly attempt: number;
  readonly input: TInput;
  readonly traceparent?: string;

  /** Appends a timestamped log to the remote task execution audit trail */
  log(message: string): void;
  getLogs(): readonly string[];

  /** Manually signals to the engine that the task is still processing, extending the lease */
  heartbeat(): Promise<void>;

  /** AbortSignal triggered if the task lease expires or the worker host shuts down */
  readonly signal: AbortSignal;
}
```

### 4.3 Task Handler & Worker Configuration

```typescript
export type TaskHandler<TInput = Record<string, unknown>> = (
  context: TaskContext<TInput>
) => Promise<TaskOutcome> | TaskOutcome;

export type SimpleTaskHandler<TInput = Record<string, unknown>, TOutput = Record<string, unknown>> = (
  context: TaskContext<TInput>
) => Promise<TOutput> | TOutput;

export interface WorkerConfig {
  taskType: string;
  domain?: string;
  maxConcurrency?: number;       // Default: 10
  basePollIntervalMs?: number;   // Default: 100ms
  maxPollIntervalMs?: number;    // Default: 3000ms
  pollBatchSize?: number;        // Default: 5
  autoHeartbeatIntervalMs?: number; // Default: 10000ms (10s)
}
```

### 4.4 High-Ergonomics `WorkflowWorkerHost` API

```typescript
export class WorkflowWorkerHost {
  constructor(private readonly transport: WorkerTransportClient) {}

  /** Register task handler with full Conductor control (TaskOutcome) */
  register<TInput = Record<string, unknown>>(
    config: WorkerConfig,
    handler: TaskHandler<TInput>
  ): this;

  /** Register ergonomic shorthand returning output object directly */
  registerSimple<TInput = Record<string, unknown>, TOutput = Record<string, unknown>>(
    taskType: string,
    handler: SimpleTaskHandler<TInput, TOutput>,
    options?: Partial<WorkerConfig>
  ): this;

  /** Attach composable middleware (Validation, Heartbeat, Metrics) */
  use(middleware: WorkerMiddleware): this;

  /** Start background polling loops across all registered task types */
  start(): Promise<void>;

  /** Graceful shutdown: ceases polling and awaits in-flight promises */
  shutdown(timeoutMs?: number): Promise<void>;
}
```

### 4.5 Auto-Heartbeat & Concurrency Controls
- **Adaptive Polling Delay**: When a poll returns `tasks.length > 0`, the poller immediately schedules the next batch (`0ms` delay) to drain queues rapidly. When empty, backoff scales exponentially from `basePollIntervalMs` to `maxPollIntervalMs`.
- **Async Concurrency Limiter**: Limits active concurrent task executions per `taskType` using an internal promise queue, preserving backpressure without starving the Node/Browser event loop.
- **AutoHeartbeatMiddleware**: Spawns an interval timer every `autoHeartbeatIntervalMs` that sends `POST /api/v1/workflow/tasks/{taskId}/heartbeat` while the handler promise is pending. On task completion, the timer is cleared immediately.

---

## 5. Iteration 3 Scope & Phase Breakdown (Phases 26 – 30)

| Phase | Milestone Title | Target Deliverables | Verification Mechanism |
| :---: | :--- | :--- | :--- |
| **Phase 26** | **Submodule Setup, Canonical Workflow IR & Zero-I/O PureDecider** | `apps/backend/workflow-engine` POM, `workflow-ir-schema-v1.json`, Memento snapshots, sealed `EngineCommand`s, immutable models, pure state machine decider core. | Pure JUnit 5 record-in / command-out unit test suite executing in <1ms without mocks or Spring context. |
| **Phase 27** | **Conductor Node Strategies, Topological Frontiers & Parameter Resolver** | `NodeStrategyRegistry` implementing `SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, and `DO_WHILE`; Kahn's topological frontier calculation; Tarjan cycle detection; JSONPath / SpEL `ParameterResolver`. | Cycle detection tests asserting cycle path traces; parameter resolution tests evaluating `${workflow.input.*}` and `${taskRef.output.*}`; branch resolution tests. |
| **Phase 28** | **Hexagonal Engine, Single-Column Lease Queue & Storage Adapters** | Hexagonal ports (`PersistencePort`, `UnitOfWork`, `WorkerTransportPort`); `WorkflowEngineService`; atomic single-column lease queue (`visible_at_epoch_ms`); dual storage adapters (`PostgresJdbcPersistenceAdapter` with RLS/SKIP LOCKED and `SqliteJdbcPersistenceAdapter` with WAL mode); lease sweeper for automatic timeout recovery. | Multi-threaded lease contention contract test suite run against both SQLite WAL and PostgreSQL Testcontainers; worker crash lease recovery test. |
| **Phase 29** | **Polyglot Worker SDKs (Java Virtual-Thread & Pure TypeScript `@acc/worker`) & Distributed Saga** | Java Virtual-Thread `WorkerHost`; **Pure TypeScript `@acc/worker`** package with `WorkflowWorkerHost`, middleware chain, adaptive polling, and auto-heartbeat; reverse topological Saga compensator. | Java and TypeScript test suites verifying worker registration, lease extensions via auto-heartbeat, `TaskOutcome.inProgress` deferrals, retry backoffs, and reverse Saga compensation. |
| **Phase 30** | **Visual React Flow Studio, Unified Sandbox Simulator & Chaos Replay Suite** | Visual Workflow Studio in `@acc/console` with custom Conductor nodes (`SWITCH`, `FORK_JOIN`, `WAIT`); live execution overlay; Unified Sandbox platform workflow adapter; Golden Trace Replay regression suite (100 concurrent chaos runs with random task failures). | Vitest component tests in `@acc/console`; Golden trace replay suite verifying 100% deterministic state reproduction; full production build pass. |

---

## 6. Deep Dive Phase Specifications & Verification Gates

### Phase 26: Submodule Setup, Canonical Workflow IR & Zero-I/O PureDecider
- **Submodule Creation**: Add `<module>workflow-engine</module>` to `apps/backend/pom.xml`. Configure `workflow-engine/pom.xml` inheriting backend parent with Jackson, SQLite-JDBC, SLF4J, JUnit 5, and AssertJ.
- **Canonical IR Specifications (`workflow-ir-schema-v1.json`)**:
  - `workflowKey`: Alphanumeric slug identifier (e.g. `order-fulfillment-pipeline`).
  - `version`: Monotonically increasing revision integer.
  - `tasks`: Array of workflow tasks with `taskReferenceName`, `taskType` (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `WAIT`, etc.), `inputParameters`, `timeoutSeconds`, `retryCount`, `retryDelaySeconds`, and `backoffRate`.
  - `layoutMetadata`: Canvas coordinates (`x`, `y`) and layout node state for round-trip fidelity between visual builder and code DSL.
- **Deterministic Domain Models**:
  - `WorkflowDefinition`, `WorkflowSnapshot`, `TaskSnapshot`, `TaskStatus`, `WorkflowStatus`.
- **Zero-I/O `PureDecider`**:
  - Pure function: `DecisionResult decide(WorkflowDefinition definition, WorkflowSnapshot snapshot, long nowEpochMs)`.
  - Zero imports of `java.sql.*`, `Instant.now()`, or external frameworks.
- **Verification Gate 26**:
  - Pure JUnit 5 record-in / command-out unit test suite executing in <1ms without mocks or Spring context.
  - `mvn test -pl workflow-engine` passes 100%.

### Phase 27: Conductor Node Strategies, Topological Frontiers & Parameter Resolver
- **Node Evaluator Strategies (`NodeEvaluatorStrategy`)**:
  - `SimpleTaskStrategy`: Handles basic worker task dispatch, retry policy calculations (exponential/fixed backoff), and terminal error transitions.
  - `SwitchNodeStrategy`: Evaluates dynamic condition expressions against `decisionCases` and schedules matching branch tasks or `defaultCase`.
  - `ForkJoinStrategy`: Concurrently schedules parallel branch lists and enforces a synchronization barrier at the `JOIN` node until all required branches reach `COMPLETED`.
  - `DynamicForkStrategy`: Dynamically spins up parallel task instances based on a runtime array payload.
  - `WaitNodeStrategy`: Pauses execution until an absolute epoch timestamp or external signal/webhook resume command.
  - `DoWhileStrategy`: Evaluates loop conditions, maintaining loop iteration indices and guarding against infinite loops with a max iteration ceiling.
- **Topological & Cycle Guard Engine**:
  - Kahn's algorithm verifies graph acyclicity upon workflow registration/update.
  - Tarjan's strongly connected components algorithm extracts explicit cycle path traces upon cycle detection.
- **Parameter Resolution (`ParameterResolver`)**:
  - Resolves `${workflow.input.x}` and `${<taskRef>.output.y}` paths across nested JSON structures and arrays prior to task scheduling.
- **Verification Gate 27**:
  - Cycle detection tests asserting cycle path traces; parameter resolution tests evaluating `${workflow.input.*}` and `${taskRef.output.*}`; branch resolution tests.
  - `mvn test -pl workflow-engine` passes 100%.

### Phase 28: Hexagonal Engine, Single-Column Lease Queue & Storage Adapters
- **Relational Hybrid Schema**:
  - Tables: `workflow_executions`, `task_executions`, `task_queue` with composite multi-tenant index on `(tenant_id, task_type, domain, visible_at_epoch_ms, priority DESC)`.
- **Single-Column Lease Mechanism**:
  - Atomic poll via `SELECT ... WHERE tenant_id = ? AND task_type = ? AND domain = ? AND visible_at_epoch_ms <= ? ORDER BY priority DESC, visible_at_epoch_ms ASC LIMIT ? FOR UPDATE SKIP LOCKED` (or SQLite indexed query in WAL mode).
  - Atomically sets `visible_at_epoch_ms = now + responseTimeoutMs` and assigns `lease_owner`.
- **Hexagonal Ports & Storage Adapters**:
  - `PersistencePort` & `UnitOfWork` contracts.
  - `PostgresJdbcPersistenceAdapter`: Multi-tenant RLS-aware PostgreSQL adapter with `FOR UPDATE SKIP LOCKED`.
  - `SqliteJdbcPersistenceAdapter`: Pure JDBC SQLite adapter with `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;`.
  - `InMemoryPersistenceAdapter`: Thread-safe in-memory adapter for unit testing.
  - `HttpWorkerApiAdapter`: Exposes `/api/v1/workflow/tasks/poll`, `/api/v1/workflow/tasks/{id}/result`, `/api/v1/workflow/tasks/{id}/heartbeat` for remote and TypeScript workers.
- **Imperative Shell (`WorkflowEngineService`)**:
  - Orchestrates transactions, triggers `PureDecider`, and runs background lease sweeping (`sweepExpiredTasks`) to detect hung workers and re-queue timed-out tasks.
- **Verification Gate 28**:
  - Multi-threaded lease contention contract test suite run against both SQLite WAL and PostgreSQL Testcontainers; worker crash lease recovery test.
  - `mvn test -pl workflow-engine` passes 100%.

### Phase 29: Polyglot Worker SDKs (Java & Pure TypeScript `@acc/worker`) & Distributed Saga
- **Java Virtual-Thread Worker SDK**:
  - Virtual thread execution via `Executors.newVirtualThreadPerTaskExecutor()`.
  - Per-task-type concurrency limits enforced by `Semaphore(maxConcurrency)`.
  - Java Middleware Chain (`SchemaValidationMiddleware`, `AutoHeartbeatMiddleware`, `ErrorClassificationMiddleware`).
- **Pure TypeScript Worker SDK (`packages/worker/`)**:
  - Standalone monorepo package `@acc/worker`.
  - `WorkflowWorkerHost` supporting `register()` and `registerSimple()`.
  - Async promise concurrency limiter with adaptive exponential backoff polling.
  - TypeScript middleware pipeline with `AutoHeartbeatMiddleware`, `SchemaValidationMiddleware`, and `ErrorClassificationMiddleware`.
  - Full W3C `traceparent` propagation and contextual audit logging.
- **Distributed Saga Compensation**:
  - On unrecoverable task failure, the engine computes the reverse topological execution path of all completed tasks with registered `compensateHandlerRef` actions.
  - Sequentially dispatches compensation tasks to rollback side-effects with full MDC execution auditing.
- **Verification Gate 29**:
  - Vitest test suite in `packages/worker/` testing registration, adaptive polling, heartbeat extension, and graceful shutdown.
  - Java test suite in `workflow-engine/` testing Virtual-Thread worker host and Saga rollback.
  - Cross-language integration test where a TypeScript worker completes task A and a Java worker completes task B in the same workflow.

### Phase 30: Visual React Flow Studio, Unified Sandbox Simulator & Chaos Replay Suite
- **Visual Workflow Studio (`@acc/console`)**:
  - Expand React Flow canvas architecture to support the full Conductor node catalog (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `WAIT`, `DO_WHILE`).
  - Interactive property inspectors for input bindings, retry backoffs, and condition expressions.
  - Live execution monitoring overlay: nodes dynamically color-coded by execution state (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `TIMED_OUT`) with real-time log drawer.
  - Dagre auto-layout with animated layout transitions.
- **Unified Sandbox Engine Integration (`@acc/sandbox`)**:
  - Implement `workflowSandboxHandler` registered in `sandboxRegistry`.
  - In-memory simulation of decider cycles, task leases, and mock worker polling.
  - Zero network mocks; full integration with `SandboxDock` state resets and active tenant switching.
- **Chaos Verification & Golden Trace Replay Suite**:
  - `GoldenTraceReplayTest.java`: Replays historical execution traces against `PureDecider` verifying deterministic outputs.
  - Chaos integration test running 100 concurrent workflow executions with simulated random worker terminations, network partitions, and lease expiration recoveries.
- **Verification Gate 30**:
  - Vitest component tests in `@acc/console`; Golden trace replay suite verifying 100% deterministic state reproduction; full production build pass.

---

## 7. Architectural Invariants Summary

| # | Invariant | Description |
| :-: | :--- | :--- |
| **1** | **Zero-I/O Functional Core** | `PureDecider` is 100% pure and deterministic. No I/O, no system clocks, no network calls. |
| **2** | **Memento Immutability** | `definition_snapshot` freezes workflow JSON at start time. Running executions are immune to schema drift. |
| **3** | **Single-Column Lease Queue** | `visible_at_epoch_ms` governs dispatch, lease locks, async callbacks, and retry backoff. |
| **4** | **Transactional Outbox** | State transitions and queue events commit inside the exact same `UnitOfWork` database transaction. |
| **5** | **Zero-Loss Visual Round-Trip** | Visual builder edits and code DSL preserve all node attributes and `layoutMetadata` coordinates. |
| **6** | **Polyglot Worker Parity** | Java Virtual-Thread workers and Pure TypeScript (`@acc/worker`) workers share identical protocol, middleware, and outcome semantics. |
| **7** | **Zero Synthetic Mocks** | Production classes, real SQLite WAL/PostgreSQL schemas, and real deciders are tested without artificial test doubles. |
| **8** | **Multi-Tenant Context** | Every workflow, execution, task, and log is strictly partitioned by `tenant_id` and `workspace_id`. |
