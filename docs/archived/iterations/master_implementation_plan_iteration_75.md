# Master Implementation Plan - Iteration 75: Decouple Task Definitions from Task Workers & Versioned Task Definition Catalog

## 1. Executive Summary
This master plan decouples **Task Definitions** (design-time specification of schemas, contracts, and execution policies) from **Task Workers** (runtime compute nodes that poll and execute tasks), establishing:
1. **First-Class Versioned Task Definition Entity (`workflow_task_definitions`)**: Persisted in PostgreSQL, SQLite, and InMemory adapters with an Append-Only Ledger, composite primary key `(tenant_id, name, version)`, and lifecycle states (`DRAFT`, `ACTIVE`, `DEPRECATED`, `ARCHIVED`).
2. **Hard Fork Progression Semantics**: `ACTIVE` task definitions are strictly immutable. Modifying an active task automatically forks into a new `DRAFT` version (`version = MAX + 1`).
3. **Worker Capacity-Only Telemetry**: `WorkerRegistry` is stripped of task schema dictation. Workers register only execution capacity and SemVer capability declarations (`supportedTaskCapabilities`).
4. **Engine Queue & Routing Decoupling**: Tasks carry `taskDefName` and pinned `taskDefVersion`. The engine decider validates schemas against the authoritative database catalog, routing tasks only to workers with matching capability and available concurrency permits.
5. **Console Visual DAG Studio Dynamic Catalog Integration**: Dynamic palette category for catalog tasks, pinned version badges, and an in-canvas Schema Diff upgrade modal.
6. **Zero-Regression Offline Sandbox**: Mock persistence repository in `@acc/sandbox` ensuring 100% offline development parity.

---

## 2. Trade-Off Matrices

| Architectural Option | Evaluated Alternative | Selected Decision | Core Justification & Trade-Off |
| :--- | :--- | :--- | :--- |
| **Persistence Schema** | In-place mutable table (`tenant_id, name`) | **Append-Only Ledger (`tenant_id, name, version`)** | **Selected:** Prevents schema drift and breaking runtime execution for ongoing or historical workflows. Trade-off: Slightly higher storage, requires explicit version resolution query. |
| **Worker Registration** | Workers announce input/output schemas | **Workers register capacity & SemVer capability only** | **Selected:** Decouples schema contract authority from worker deployment/boot order. Workers become disposable compute nodes; schemas are centrally managed. |
| **Workflow Node Linkage** | Name-only floating reference (`validateOrder`) | **Pinned Exact Version (`validateOrder@1`) with Upgrade Badge** | **Selected:** Guarantees deterministic execution replay. Workflows will never break unexpectedly when a worker or developer publishes a new task schema version. |
| **Version Progression** | In-place editing of active versions | **Hard Fork with DRAFT Sandbox** | **Selected:** Pure immutability for active contracts. Edits safely fork to next draft; promotion deprecates older versions without deleting history. |
| **Schema Validation Authority** | Worker-side validation | **Engine Decider Pre/Post Validation** | **Selected:** Protects workers from malicious or malformed payloads and protects workflow context from invalid worker return values. |

---

## 3. Mermaid Topology

```mermaid
flowchart TD
    subgraph DesignCatalog["1. Design-Time: Versioned Task Definition Catalog"]
        Dev[Platform / Workflow Engineer] -->|1. Create / Fork New Version| TaskDefAPI["TaskDefinitionController\n/api/v1/workflow/task-definitions"]
        TaskDefAPI --> TaskDefService["TaskDefinitionRegistry"]
        TaskDefService --> TaskDefDB[("workflow_task_definitions Table\nPK: (tenant_id, name, version)\nStatus: DRAFT | ACTIVE | DEPRECATED | ARCHIVED")]
        TaskDefDB --> Studio["Visual DAG Studio (Console)\nPalette & Quick-Insert Popover"]
    end

    subgraph WorkflowAuthoring["2. Workflow Authoring with Version Pinning"]
        Studio -->|2. Drop Task (Sets taskDefName='validateOrder', taskDefVersion=1)| Canvas[DAG Canvas Node: validateOrder@1]
        Studio -.->|Check for Upgrades (v2 Available)| UpgradeBadge["Node Upgrade Badge & Schema Diff Modal"]
        Canvas -->|3. Save Workflow Definition (Pins Task v1)| WFDefAPI["WorkflowDefinitionController\n/api/v1/workflow/definitions"]
        WFDefAPI --> WFDB[("workflow_definitions Table")]
    end

    subgraph RuntimeFleet["3. Runtime: Capacity & Capability Registration"]
        Worker["Worker Host\n(Java VThreads / External Worker)"] -->|4. Register Capacity & Capability\nworkerId, supportedTasks: {validateOrder: ['1.*']}, concurrency: 10| FleetAPI["WorkerFleetController / Registry\nPOST /api/v1/workflow/workers/heartbeat"]
        FleetAPI --> WorkerPool["Active Worker Fleet (Capacity & Capability Only)"]
        WFEngine["Workflow Engine PureDecider"] -->|5. Validate inputSchema against TaskDef v1 & Enqueue| TaskQueue[("task_queue (SCHEDULED)\nIncludes taskDefName & taskDefVersion")]
        WorkerPool -->|6. Match Permits + SemVer Capability & Lease Task| Worker
        Worker -->|7. Report Result & Validate outputSchema against TaskDef v1| WFEngine
    end
```

---

## 4. Mathematical & Algorithmic Specifications

1. **Worker Capacity Invariant**:
   $$\text{AvailablePermits}(w, t) = \text{concurrencyLimit}(w) - \text{activeLeases}(w, t)$$
   Workers only pull work when $\text{AvailablePermits}(w, t) > 0$. The worker payload contains zero schema definitions.

2. **SemVer Capability Matching**:
   $$\text{CanRoute}(w, t) \iff \text{AvailablePermits}(w, t) > 0 \land \text{SatisfiesSemVer}(t.\text{taskDefVersion}, w.\text{capabilities}[t.\text{taskDefName}])$$
   Where:
   $$\text{SatisfiesSemVer}(v, \text{spec}) \iff (v = \text{spec}) \lor (\text{spec} = \text{"*"}) \lor (v \in [v_{\text{min}}, v_{\text{max}}))$$

3. **Schema Authority Invariant**:
   $$\text{Schema}_{\text{effective}}(t) = \text{TaskDefinitionRegistry}.\text{resolve}(t.\text{tenantId}, t.\text{taskDefName}, t.\text{taskDefVersion}).\text{inputSchema}$$
   The engine validates resolved parameters against the authoritative `TaskDefinitionRecord` stored in the system, never against worker-supplied attributes.

4. **Hard Fork Version Progression Invariant**:
   $$\text{ForkVersion}(T) = \max_{r \in T}(\text{version}(r)) + 1$$
   $$\forall r \in T: \text{status}(r) = \text{ACTIVE} \implies \text{isImmutable}(r) = \text{true}$$

---

## 5. Concrete File & Class Signatures

### Backend
1. **`changelog-000.000.00021.xml`**:
   - Table `workflow_task_definitions` with `(tenant_id, name, version)` primary key.
   - Nullable `task_def_name` and `task_def_version` columns added to `task_executions`.
2. **`TaskDefinitionRecord.java`**:
   ```java
   public record TaskDefinitionRecord(
       String taskDefId,
       String tenantId,
       String name,
       int version,
       WorkflowVersionStatus status,
       String description,
       int retryCount,
       int retryDelaySeconds,
       double backoffRate,
       int timeoutSeconds,
       Map<String, Object> inputSchema,
       Map<String, Object> outputSchema,
       String changelogNote,
       Long publishedAtMs,
       String publishedBy,
       long createdAtMs,
       long updatedAtMs,
       String createdBy
   ) {}
   ```
3. **`PersistencePort.java`**:
   ```java
   void saveTaskDefinition(TaskDefinitionRecord record);
   Optional<TaskDefinitionRecord> getTaskDefinition(String tenantId, String name, int version);
   Optional<TaskDefinitionRecord> getLatestActiveTaskDefinition(String tenantId, String name);
   List<TaskDefinitionRecord> listTaskDefinitions(String tenantId);
   List<TaskDefinitionRecord> listTaskDefinitionVersions(String tenantId, String name);
   void updateTaskDefinitionStatus(String tenantId, String name, int version, WorkflowVersionStatus status, Long publishedAtMs, String publishedBy);
   ```
4. **`TaskDefinitionRegistry.java`**:
   - Central registry and life-cycle manager for task definitions with in-memory caching and persistent backing.
   - Built-in domain task seeding (`validateOrder`, `checkInventory`, `chargePayment`, `expressCourier`, `groundPostal`, `cancelCourierBooking`).
5. **`TaskDefinitionController.java`**:
   - REST endpoints at `/api/v1/workflow/task-definitions`.
6. **`TaskContractController.java`**:
   - Refactored to fetch contracts directly from `TaskDefinitionRegistry`.

### Console UI
1. **`task-definition-api.ts`**: React Query client hooks for `/api/v1/workflow/task-definitions`.
2. **`dag-palette.tsx`**: Dynamic category rendering for Catalog Task Definitions.
3. **`dag-node.tsx`**: Visual upgrade badge when newer active version exists.
4. **`task-version-diff-modal.tsx`**: Schema comparison and 1-click upgrade.

---

## 6. Phased Roadmap

- **Phase 1: Persistence Layer & Storage Adapters**:
  - Liquibase changelog 21.
  - Updates to `schema-postgres.sql` and `schema-sqlite.sql`.
  - Create `TaskDefinitionRecord.java`.
  - Add methods to `PersistencePort.java`.
  - Implement in `PostgresJdbcPersistenceAdapter`, `SqliteJdbcPersistenceAdapter`, and `InMemoryPersistenceAdapter`.
- **Phase 2: Task Definition Registry & Backend REST Controllers**:
  - Implement `TaskDefinitionRegistry.java` with domain seeding and hard fork semantics.
  - Create `TaskDefinitionController.java`.
  - Refactor `TaskContractController.java` to use `TaskDefinitionRegistry`.
  - Strip schemas from `WorkerRegistry.java` and `TaskWorkerDescriptor`, transitioning to capability declarations.
  - Refactor `SimpleTaskWorkerRegistrar.java`.
- **Phase 3: Engine Execution Models & Queue Routing**:
  - Update `TaskDefinition.java` with `taskDefName` and `taskDefVersion`.
  - Update `TaskSnapshot.java` with `taskDefName` and `taskDefVersion`.
  - Update `SimpleTaskStrategy.java` to validate against authoritative `TaskDefinitionRegistry` schemas.
- **Phase 4: Unified Sandbox Handlers**:
  - Add `workflowTaskDefinitionsRepo` to `packages/sandbox/src/handlers/workflow-handler.ts`.
  - Wire mock routes for task definitions.
- **Phase 5: Console UI Visual DAG Studio Integration**:
  - Create `task-definition-api.ts`.
  - Update `dag-palette.tsx` and `dag-quick-insert-popover.tsx`.
  - Implement version badge and `task-version-diff-modal.tsx` in `dag-node.tsx`.
- **Phase 6: Verification, Testing & Git Archival**:
  - Run surefire tests on backend.
  - Run vitest tests on console and sandbox.
  - Create history doc `461_decouple_task_definitions_from_workers_and_versioned_catalog.md` and commit.

---

## 7. Formal Verification Matrix (`/autogenerated-tests/`)

| Test Suite | File Path | Objective |
| :--- | :--- | :--- |
| **Task Definition Persistence** | `TaskDefinitionPersistenceTest.java` | Verify SQLite, Postgres, InMemory CRUD, version ordering, and unique constraints. |
| **Hard Fork Lifecycle** | `TaskDefinitionRegistryTest.java` | Verify mutating an active version forks a new draft (v2), immutability of v1. |
| **Worker Capacity Telemetry** | `WorkerRegistryDecouplingTest.java` | Verify workers register capacity & capabilities without supplying schemas. |
| **Contract Resolution Offline** | `TaskContractControllerTest.java` | Verify `/api/v1/tasks/contracts` returns contracts when worker fleet is empty. |
| **Sandbox Offline Parity** | `workflow-handler.test.ts` | Verify mock API handles task definition queries and forking in dev sandbox. |
| **Studio Upgrade Badge** | `dag-node-upgrade-badge.test.tsx` | Verify UI badge displays when `latestActiveVersion > node.taskDefVersion`. |

---

## 8. Risk & Rollback Mitigations

1. **Risk: Legacy Workflows Missing `taskDefName`**:
   - *Mitigation*: Fallback logic defaults `taskDefName` to `taskReferenceName` or `domain`, and defaults `taskDefVersion` to `1` or latest `ACTIVE`.
2. **Risk: Missing Worker for Pinned Version**:
   - *Mitigation*: Task remains in `SCHEDULED` state with clear diagnostic logging; execution does not crash.
3. **Risk: Database Migration Failure on Older Postgres/SQLite**:
   - *Mitigation*: Migration uses standard SQL syntax with `IF NOT EXISTS` and backwards-compatible nullable column additions.
