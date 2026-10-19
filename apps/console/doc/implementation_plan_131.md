# Implementation Plan: Iteration 12 - Enterprise Production Readiness & High-Performance Dynamic Metadata Engine

Iteration 12 transforms the **unipost** enterprise platform into an autonomous, high-performance operational suite by fusing consumer-grade UI/UX ergonomics with resilient backend optimizations, event-driven dynamic entity business workflows, complete zero-stub implementations, and field-level security.

---

## User Review Required

> [!IMPORTANT]
> **Decided Architectural Decisions from `/grill-me` Alignment:**
> 1. **Staging Strategy (UX-First)**: Execute Phase 1 on UI/UX ergonomics first (Command Palette `Cmd+K`, Dynamic Query Builder, Grid Density profiles, Column drag-and-drop, and Shared Team Views) for immediate interactive feedback before proceeding to zero-stub purging, backend indexing, and workflow hooks.
> 2. **PostgreSQL Functional Expression Indexing**: Use `CREATE INDEX CONCURRENTLY ... ((data->>'field')) WHERE "deletedDate" IS NULL` + global GIN index (`jsonb_path_ops`) to eliminate table-locking DDL while providing sub-millisecond query performance at 100,000+ records.
> 3. **Persistent Outbox Workflow Triggers**: Dynamic entity mutations commit events to `UNIPOST_EVENT_PUBLICATIONS` in the same DB transaction via Spring Modulith, providing guaranteed at-least-once delivery to automated DAG workflow dispatchers.
> 4. **Real-Time Notification Pipeline via SSE**: Server-Sent Events stream (`/api/v1/notifications/stream`) combined with TanStack Query cache invalidation for human-in-the-loop approvals and progress alerts.
> 5. **Change Data Capture (CDC) via RFC-6902 JSON Patch**: Compact delta patches in `UNIPOST_RECORD_AUDIT_LOGS` with inline visual diff and one-click rollback in the row inspector drawer.
> 6. **Field-Level Security (FLS)**: Server-side dynamic Jackson serialization redaction with UI lock icons and permission badges.
> 7. **Table View Customization**: Shared Team Views (published by tenant admins) + Personal View Presets synced to user profiles with offline `localStorage` fallback.

---

## Proposed Changes

```mermaid
flowchart TD
    subgraph Phase 1: Professional UI/UX Refinements UX-First
        CP[Command Palette: Cmd+K]
        QB[Multi-Condition Dynamic Query Builder]
        DS[Grid Density 36/48/60px & Col Drag-Drop]
        TV[Shared Team Views & Personal Presets]
        MD[Master-Detail Split Pane Inspector]
    end

    subgraph Phase 2: Zero-Stub Hardening
        Stubs[Purge TypeInformation & BaseModel Stubs]
        Jest[Fix Swallowed Exceptions in JestRepository]
        Context[Multi-Instance WebContext Refactor]
    end

    subgraph Phase 3: Backend Performance Tuning
        ExprIdx[Functional Expression Indexes + GIN]
        Seek[Keyset / Cursor-Based Pagination]
        Loom[Java 21 Loom Virtual Threads]
        NearCache[Hazelcast In-Process Near-Cache]
    end

    subgraph Phase 4: Real Business Workflows
        Outbox[Modulith Persistent Outbox Triggers]
        Inbox[Human-in-the-Loop Approvals Inbox]
        SSE[Server-Sent Events Real-Time Stream]
        DLQ[DLQ Interactive Parameter Edit & Replay]
    end

    subgraph Phase 5: Security, CDC & Verification
        FLS[Server-Side Redaction & UI Badges]
        CDC[RFC-6902 JSON Patch CDC & Rollback]
        E2E[Playwright Dual-Mode Mode 1 & 2 Tests]
    end

    Phase 1 --> Phase 2
    Phase 2 --> Phase 3
    Phase 3 --> Phase 4
    Phase 4 --> Phase 5
```

---

### Phase 1: Professional UI/UX Refinements (`@unipost/console`)

#### [NEW] `apps/console/src/components/command-palette/command-palette.tsx`
- Implements global `Cmd+K` / `Ctrl+K` command search using `cmdk`.
- Fuzzy search across screens, dynamic entity schemas, workflow executions, actions, and theme toggling.
- Styled with Liquid Glass optical presets (`backdrop-blur-2xl bg-white/75 dark:bg-slate-900/80 border border-white/20 dark:border-white/10 shadow-2xl`).

#### [NEW] `apps/console/src/features/metadata/components/data-explorer/query-builder/dynamic-query-builder.tsx`
- Visual recursive query builder with boolean `AND` / `OR` grouping and type-aware operators.
- Serializes criteria to backend specification payload with live table filtering.

#### [MODIFY] `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`
- Add density switcher controls: `Compact` (36px), `Comfortable` (48px), `Spacious` (60px).
- Integrate `@dnd-kit/core` for drag-and-drop column reordering while preserving fixed left `#` and right `Actions` columns.
- Support Shared Team Views (admin published) and Personal Presets with offline `localStorage` fallback.
- Add Master-Detail slide-over row inspector sheet with keyboard navigation (`j` / `k` row traversal).

---

### Phase 2: Complete Zero-Stub Hardening (`@unipost/backend`)

#### [DELETE] `apps/backend/unipost-fw/src/main/java/org/springframework/data/util/TypeInformation.java`
- Remove stub class; configure Springdoc OpenAPI 3.1 to skip Spring Data introspection cleanly.

#### [MODIFY] `apps/backend/unipost-fw/src/main/java/com/unipost/service/BaseModelService.java`
- Fully implement base model persistence, audit timestamps, and tenant security; eliminate `// TODO Auto-generated method stub`.

#### [MODIFY] `apps/backend/unipost-fw/src/main/java/com/unipost/cache/jest/JestRepository.java`
- Replace swallowed exceptions with typed `ElasticsearchOperationException` and contextual logging.

#### [MODIFY] `apps/backend/unipost-fw/src/main/java/com/unipost/fw/context/WebContext.java`
- Refactor single-instance thread-local state to support multi-instance cluster deployments and virtual thread hand-offs.

---

### Phase 3: Backend Performance Tuning & Indexing (`@unipost/backend`)

#### [MODIFY] `apps/backend/unipost-fw/src/main/resources/db/migration/V12__dynamic_indexing_and_audit.sql`
- Add global GIN indexing: `CREATE INDEX idx_entity_records_gin ON UNIPOST_ENTITY_RECORDS USING gin (data jsonb_path_ops);`.
- Add programmatic creation of PostgreSQL functional expression indexes for attributes flagged as `indexed: true`.

#### [MODIFY] `apps/backend/unipost-fw/src/main/java/com/unipost/service/metadata/MetadataRecordService.java`
- Implement keyset/cursor-based pagination (`seek` method) for sub-millisecond query performance on tables exceeding 100,000 records.
- Implement selective projection queries (`jsonb_build_object`).

#### [MODIFY] `apps/backend/unipost-fw/src/main/java/com/unipost/config/HazelcastConfig.java` & `AsyncExecutionConfig.java`
- Configure Near-Cache with `in-memory-format: OBJECT` and local invalidation listeners.
- Enable Java 21 Project Loom virtual thread per-task executors for workflow step dispatches.

---

### Phase 4: Dynamic Workflows & Real-Life E2E Workflows

#### [NEW] `apps/backend/unipost-fw/src/main/java/com/unipost/service/metadata/workflow/EntityWorkflowTriggerDispatcher.java`
- Spring Modulith persistent outbox listener on `EntityRecordMutatedEvent`; dispatches automated DAG `WorkflowExecution`.

#### [NEW] `apps/console/src/features/workflows/approvals/approvals-inbox.tsx`
- Human-in-the-loop approval inbox listing pending workflow review tasks with dynamic entity context diffs.

#### [NEW] `apps/backend/unipost-fw/src/main/java/com/unipost/controller/NotificationSseController.java`
- Server-Sent Events (SSE) notification stream (`/api/v1/notifications/stream`) pushing approval events and execution progress.

#### [MODIFY] `apps/console/src/features/system/dlq/dlq-inspector-sheet.tsx`
- Interactive JSON payload parameter editing and partial step re-execution with exponential backoff.

---

### Phase 5: Security, CDC & Dual-Mode E2E Verification

#### [MODIFY] `apps/backend/unipost-fw/src/main/java/com/unipost/service/metadata/serialization/FieldLevelSecuritySerializer.java`
- Server-side dynamic serialization redaction based on user tenant roles.

#### [MODIFY] `apps/backend/unipost-fw/src/main/java/com/unipost/service/metadata/MetadataRecordService.java`
- Record RFC-6902 JSON Patch on mutations in `UNIPOST_RECORD_AUDIT_LOGS`; implement rollback endpoint.

#### [NEW] `apps/console/src/features/metadata/components/data-explorer/record-history-drawer.tsx`
- Visual before/after diff viewer with one-click "Revert to this version".

---

## Verification Plan

### Automated Tests
```bash
# 1. Monorepo Quality Gates (Lint & Typecheck)
pnpm lint
pnpm --filter @unipost/console check-types

# 2. Console & UI Unit Tests
pnpm --filter @unipost/console test:run

# 3. Backend Unit & Modulith Contract Tests
pnpm --filter @unipost/backend test

# 4. Playwright Dual-Mode E2E Workflows (Mode 1 Sandbox & Mode 2 Live Backend)
pnpm test:e2e
```

### Manual Verification
1. **Command Palette (`Cmd+K`)**: Press shortcut from any screen, search for an entity type, jump directly to its Data Explorer, and toggle visual theme.
2. **Dynamic Query Builder**: Build a compound filter (`status == 'ACTIVE' AND totalAmount > 1000`) and verify table updates smoothly.
3. **Density Profiles & Column Drag**: Switch between Compact, Comfortable, and Spacious; drag columns to reorder and verify persistence in Shared Team Views / Personal Presets.
4. **Approval Inbox & SSE**: Trigger an entity update that spawns an approval task; verify it streams via SSE into Approvals Inbox; test DLQ payload editing and step retry.
5. **CDC Time-Travel Rollback**: Edit a record twice, inspect the JSON Patch diff in the history drawer, and revert to the original version.
