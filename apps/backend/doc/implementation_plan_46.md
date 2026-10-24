# Implementation Plan 46: Enterprise Hardening & Resilience Architecture for Master Database Schema & Metadata Engine

## Executive Summary
This implementation plan elevates [`docs/master_database_schema_architecture.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/master_database_schema_architecture.md) from a static schema reference to an **Enterprise-Grade, Resilient, and Regression-Free Architectural Master Specification (v1.2.0)**. 
It captures the active, production-grade resilience mechanisms implemented across `apps/backend/unipost-fw` and `@unipost/console` that prevent catastrophic regressions, security exploits, and performance bottlenecks in dynamic metadata execution.

---

## User Review Required
> [!IMPORTANT]
> - **Zero Regression Invariant**: Documenting the strict 6-stage `RecordMutationPipeline` and its dual-mode OCC (`If-Match` + 3-way auto-merge) ensures downstream feature teams do not bypass validation or cause concurrent record overwrites.
> - **ReDoS & Resource Quota Hardening**: Formally specify the 3-tier defense system (1MB payload cap, static nested quantifier pre-flight inspection, 50ms JSON Schema validation budget, and 3000ms database statement timeout) as non-negotiable architectural constraints.
> - **Hybrid Composite Architecture**: Document the dual execution model of `DynamicQueryCompiler` (SQL pushdown via `jsonb_build_object`/`jsonb_agg`) with automatic fallback to `DataLoaderBatchResolver` during SQL execution failures or complex relationship graphs.

---

## Architectural Gaps to Address in `master_database_schema_architecture.md`

| Domain / Engine Component | Current Document State | Actual Monorepo Implementation | Required Architectural Enhancement |
| :--- | :--- | :--- | :--- |
| **Write Plane Mutation Pipeline** | Only simple sequential flow diagram in Section 5. | Dedicated 6-stage `RecordMutationPipeline` with OCC, 3-way merge, payload sizing, FSM initialization, and delete cascades. | Add comprehensive specification of the **6-Stage Record Mutation Pipeline** with exact stage responsibilities and error handling contracts. |
| **Concurrency & OCC Auto-Merge** | Mentioned only as JPA `@Version`. | Dual-mode HTTP ETag OCC (`If-Match` header + body version) with 3-way auto-merge algorithm resolving non-conflicting concurrent edits. | Add formal subsection detailing **Dual-Mode OCC & 3-Way Auto-Merge Algorithm** with conflict detection matrix. |
| **Resource Quotas & ReDoS Defense** | Mentioned briefly in history logs, omitted from master doc. | 3-tier defense: 1MB payload cap, pre-flight ReDoS static analysis (`DANGEROUS_REGEX_PATTERN`), 50ms validation timeout ceiling via `Future.get(50, ms)`, and DB statement timeouts. | Add Section 6: **Enterprise Resilience & Resource Protection (3-Tier Defense-in-Depth)**. |
| **Composite Entity Engine** | Tables defined in Section 3, but query execution omitted. | High-performance SQL pushdown compiler (`DynamicQueryCompiler`) compiling recursive JSON documents via `jsonb_build_object` with automatic fallback to in-memory `DataLoaderBatchResolver`. | Add Section 7: **Composite Virtual Schemas & Hybrid Query Execution Engine**. |
| **Composite Referential Guards** | Absent. | `MetadataService` enforces cycle detection and blocks deleting/archiving base attributes or models referenced in composite specifications. | Document **Composite Dependency & Cycle Detection Invariants**. |
| **Composite Caching Fabric** | Mentioned briefly as Hazelcast. | Composite multi-tenant cache keys (`schema:{tid}:{id}:v{tVer}_s{sVer}`), L1 in-memory `JsonSchema` concurrent maps, and cluster-wide topic invalidation. | Formalize the **Dual-Layer Versioned Caching Fabric**. |

---

## Proposed Changes

### Documentation Layer

#### [MODIFY] [`docs/master_database_schema_architecture.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/master_database_schema_architecture.md)

1. **Header & Document Version**:
   - Bump version to **`1.2.0`**.
   - Update executive overview emphasizing stability, defense-in-depth, and zero-regression runtime guarantees.

2. **Section 5: Dynamic Metadata Execution Lifecycle & Write Plane**:
   - Re-architect Section 5 into **The 6-Stage Record Mutation Pipeline**:
     - **Stage 1 (Payload Cap & Ingestion)**: Strict 1MB payload ceiling checking before JSON parsing.
     - **Stage 2 (OCC & ETag Validation)**: Dual-mode ETag extraction from `If-Match` header with 3-way auto-merge resolution.
     - **Stage 3 (Schema Defaults & FSM State Binding)**: Automatic default values application and declarative lifecycle transition rules.
     - **Stage 4 (Referential Integrity & Tenant Blindness)**: Validating inbound foreign references against target `UNIPOST_ENTITIES` within current tenant scope.
     - **Stage 5 (Declarative Delete Cascades)**: Enforcement of `RESTRICT`, `CASCADE`, and `SET_NULL` across Pattern B JSONB attributes and Pattern C graph edges.
     - **Stage 6 (Audit Ledger & Transactional Outbox)**: Atomic JSON delta computation, insertion into monthly-partitioned `UNIPOST_RECORD_AUDIT_LOG`, outbox event dispatch, and Spring application event publishing.
   - Insert detailed Mermaid sequence diagram covering all 6 stages.

3. **[NEW] Section 6: Enterprise Resilience & Defense-in-Depth (3-Tier Resource Protection)**:
   - **Tier 1 (Network & Concurrency)**: Tenant Token-Bucket rate limiting (HTTP 429 Retry-After).
   - **Tier 2 (Schema Complexity & ReDoS Defense)**:
     - Pre-flight static regex inspection rejecting catastrophic nested quantifiers (`(\\(.*[+*]\\)[+*]|\\([a-zA-Z0-9_\\[\\]|-]+[+*]\\)[+*])`).
     - Computational timeout ceiling: Sandboxed JSON Schema validation capped to a strict **50ms computational budget** via `validationExecutor.submit()`.
     - Attribute quotas: Capped at maximum 100 dynamic attributes per entity model.
   - **Tier 3 (Database Statement & Connection Pool Protection)**:
     - 3000ms database statement timeout (`SET LOCAL statement_timeout = '3000ms'`).
     - Connection pool isolation ensuring slow analytical queries do not starve transactional threads.

4. **[NEW] Section 7: Composite Virtual Schemas & Hybrid Query Execution Engine**:
   - **Architecture**: Virtual aggregation without physical record duplication.
   - **Primary SQL Pushdown (`DynamicQueryCompiler`)**: Compiling multi-level entity hierarchies into a single PostgreSQL JSON aggregation query (`jsonb_build_object` + `jsonb_agg`).
   - **Resilient Fallback (`DataLoaderBatchResolver`)**: In-memory batched N+1 resolution kicking in automatically if pushdown encounters SQL syntax limits, deep recursion, or execution timeouts.
   - **Compile-Time Cycle Detection & Dependency Protection**: Rejecting circular tree paths (`parent -> child -> parent`) and blocking deletion or archival of base attributes actively referenced in composite specs.

5. **Section 8: Composite Caching Fabric & Dual-Layer Versioning**:
   - Format: `schema:{tenant_id}:{entity_type_id}:v{tenantVer}_s{systemVer}`.
   - L1 parsed `JsonSchema` memory cache + L2 distributed Hazelcast cache with cluster-wide eviction topics.

6. **Sections 9, 10, 11**:
   - Shift operational runbook, unified Liquibase topology, and UI/UX design matrix down with clean numbering.

---

### Monorepo History & Verification Layer

#### [NEW] [`apps/backend/doc/implementation_plan_46.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/doc/implementation_plan_46.md)
- App-scoped implementation plan tracking this architectural refinement.

#### [NEW] [`docs/history/200_enterprise_metadata_resilience_and_pipeline_architecture.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/history/200_enterprise_metadata_resilience_and_pipeline_architecture.md)
- Milestoned sequential 3-digit history log entry.

#### [MODIFY] [`docs/history/README.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/history/README.md)
- Register Entry 200 in the history index.

---

## Verification Plan

### Automated Verification
```bash
# 1. Verify backend compilation
./mvnw test-compile -q

# 2. Run backend metadata & resilience tests
./mvnw test -pl unipost-fw "-Dtest=RecordMutationPipelineTest,SchemaValidationServiceTest,CompositeRecordServiceTest" -q

# 3. Verify console frontend type safety
pnpm --filter @unipost/console exec tsc --noEmit

# 4. Verify console metadata unit test suite
pnpm --filter @unipost/console test src/features/metadata/
```

### Manual Inspection
- Verify all Mermaid sequence and flowchart diagrams render cleanly.
- Verify complete consistency between Java classes (`RecordMutationPipeline`, `SchemaValidationService`, `DynamicQueryCompiler`) and the master architecture specification.
