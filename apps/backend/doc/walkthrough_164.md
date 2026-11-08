# Backend Walkthrough: Decoupling Task Definitions from Workers & Versioned Catalog

## Overview
This walkthrough summarizes the backend architectural changes implemented in iteration 164 (`master_implementation_plan_iteration_75.md`), establishing first-class versioned Task Definitions in the workflow engine, decoupling worker fleet registrations to capacity/telemetry declarations, and exposing full CRUD & lifecycle APIs.

---

## 1. Database Schema & Migration
- **Liquibase Migration**: Created `apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00021.xml` and registered in `changelog-master.xml`.
- **Table Definition**: `workflow_task_definitions` with composite primary key `(tenant_id, name, version)`, schema fields (`input_schema`, `output_schema`), execution policy columns (`retry_count`, `retry_delay_seconds`, `backoff_rate`, `timeout_seconds`), and audit trail (`published_at_ms`, `published_by`, `changelog_note`).
- **Execution Tracking**: Added `task_def_name` and `task_def_version` to `task_executions`.
- **Embedded Adapters**: Synced `schema-postgres.sql` and `schema-sqlite.sql` with identical table and column additions.

---

## 2. Core Model & Persistence Adapters
- **Model**: `com.acc.workflow.core.model.TaskDefinitionRecord` record with embedded fluent `Builder`, default fallback values, and immutability invariants.
- **Port**: Added task definition lifecycle methods to `PersistencePort`:
  - `saveTaskDefinition(TaskDefinitionRecord)`
  - `getTaskDefinition(tenantId, name, version)`
  - `getLatestActiveTaskDefinition(tenantId, name)`
  - `listTaskDefinitions(tenantId)`
  - `listTaskDefinitionVersions(tenantId, name)`
  - `updateTaskDefinitionStatus(tenantId, name, version, status, publishedAtMs, publishedBy)`
  - `deleteTaskDefinition(tenantId, name, version)`
- **Adapters**:
  - `InMemoryPersistenceAdapter`: Concurrent partitioned ledger supporting draft deletion and status promotions.
  - `PostgresJdbcPersistenceAdapter`: Native SQL execution with JSONB schema storage and composite index lookups.
  - `SqliteJdbcPersistenceAdapter`: Native SQL execution with TEXT JSON string storage.

---

## 3. Application & Controller Layer
- **TaskDefinitionRegistry**:
  - Seeds canonical built-ins (`validateOrder`, `checkInventory`, `chargePayment`, `expressCourier`, `groundPostal`, `cancelCourierBooking`, `publishCmsArticle`).
  - Enforces hard-fork versioning: editing an active task forks a new `DRAFT` with `version = MAX + 1`.
  - Promotes draft to `ACTIVE` while deprecating older active versions.
  - Guards draft deletion: rejects deleting active or deprecated records.
- **TaskDefinitionController** (`/api/v1/workflow/task-definitions`):
  - `GET /`: Lists latest version of all definitions for tenant.
  - `GET /{name}`: Resolves latest active version.
  - `GET /{name}/versions`: Lists complete version history.
  - `GET /{name}/versions/{version}`: Fetches specific version.
  - `POST /`: Creates or forks a draft.
  - `POST /{name}/versions/{version}/publish`: Promotes draft to `ACTIVE`.
  - `DELETE /{name}/versions/{version}`: Deletes a draft version.
- **TaskContractController**:
  - Refactored to fetch dynamic schema contracts directly from `TaskDefinitionRegistry`, falling back to registered workers for legacy compatibility.
- **Worker Host Decoupling**:
  - Added capacity-only constructor to `TaskWorkerDescriptor(taskType, category, concurrencyLimit, leaseDurationSec)`.
  - `SimpleTaskWorkerRegistrar` now registers workers declaring only capacity/capabilities, completely stripped of static JSON schemas.

---

## 4. Verification & Testing
- `PersistenceContractTest`: Verified full persistence lifecycle across `InMemoryPersistenceAdapter` and `SqliteJdbcPersistenceAdapter`.
- `TaskDefinitionRegistryTest`: Verified domain seeding, hard-fork draft generation, status promotion, schema validation, and deletion guards.
- `TaskDefinitionControllerTest`: Verified all Spring MVC REST endpoints with tenant context isolation and authority checks.
- `TaskContractControllerTest`: Verified contract composition merging static schemas and dynamic catalog records.
- Full `workflow-engine` test suite passed: 92/92 tests green.
- Full `acc-ms-aio` reactor compilation passed: BUILD SUCCESS across all 9 modules.
