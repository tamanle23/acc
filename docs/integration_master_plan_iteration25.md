# Integration Master Plan: Iteration 25 - Cryptographic Merkle Audit Studio, Dynamic Entity Access Control & Full-Stack Verification

**Target Systems:**  
- `@unipost/backend` (`apps/backend/unipost-db`, `apps/backend/unipost-fw`, `apps/backend/unipost-ms-aio`)  
- `@unipost/client` (`packages/client/src/contracts/metadata.ts`, `packages/client/src/contracts/system.ts`)  
- `@unipost/console` (`apps/console/src/features/metadata`, `apps/console/src/features/system`, `apps/console/src/core/sandbox`)  
**Lead Systems Architect:** Principal Polyglot Architect, Database Architect & Operations Specialist, TypeScript Architect & UI/UX Systems Specialist  
**Design & Usability Standards:** Nielsen-Norman Usability Heuristics, WCAG 2.2 AA, Liquid Glass Design Tokens, 5-State Component Matrix  
**Architectural Framework:** Clean Architecture, Domain-Driven Design (DDD), Modular Monolith with Outbox & Cryptographic Merkle Auditing  
**Execution Sequence (Post-Grill Consensus):** **Track C (Primary Feature Scope) ──► Track B (Deep E2E & WCAG Verification) ──► Track A (Backend Testcontainers & Liquibase Hardening)**  
**Reference SSOT:** [`docs/master_database_schema_architecture.md`](master_database_schema_architecture.md) (v1.5.0)  

---

## 1. Executive Summary & Core Architectural Invariants

Following our comprehensive design grilling, Iteration 25 executes the sequential delivery of **Track C (Feature Track)**, followed by **Track B (Playwright E2E & WCAG 2.2 AA QA)**, and completes with **Track A (Backend Testcontainers & Liquibase Invariants)**.

### Architectural Invariants & User Alignment (Post-Grill Decisions):
1. **Execution Pipeline Order**: `Track C -> Track B -> Track A`. Build the features first, verify via deep browser automation and accessibility audits, and finally harden with live database Testcontainers.
2. **Cryptographic Forward-Hash Ledger on `UNIPOST_RECORD_AUDIT_LOG`**:
   - Each audit record is mathematically linked to the previous record in that tenant via SHA-256 (`current_hash = SHA256(prev_hash + tenant_id + record_id + version + operation + delta + created_at)`).
   - Guarantees immediate detection of row mutation, row deletion, or fraudulent insertion without centralized blockchain overhead.
3. **High-Performance Verification Strategy**:
   - **Checkpoint-Anchored + Windowed Verification**: Normal UI verification operates in 5–20ms by verifying the filtered date range or visible batch against trusted periodic checkpoint anchors. Deep full scans are reserved for explicit compliance bundle exports.
4. **Dynamic Entity Access Control**:
   - Gated via a dedicated client hook `useHasPermission(code: string)` aggregating assigned roles and ad-hoc overrides.
   - Prohibited actions in `entity-data-grid.tsx` (e.g., `+ New Record`, `Delete Record`) are rendered in a **disabled state with clear contextual tooltips** (e.g., `"Requires entity:record:create permission"`), accompanied by strict HTTP 403 enforcement at the backend API layer.
5. **Audit Studio Custody & Placement**:
   - Dedicated full-page route `/system/audit` in `@unipost/console` built using the standardized `@/components/data-table` component.
   - **Custody Barrier**: Placed exclusively under **Sovereign Custody (`ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`)** in `sidebar-data.ts`. Sovereign Custodians can inspect audit logs fleet-wide across all tenants with a tenant filter, run mathematical integrity verification, and export signed compliance packages (`platform:compliance:export`). Tenant Admins continue using the contextual row-level `RecordAuditHistoryDrawer` inside the Data Explorer.

```
+──────────────────────────────────────────────────────────────────────────────────────────+
|                    ITERATION 25 FULL-STACK ARCHITECTURAL BLUEPRINT                       |
+──────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                          |
| 1. DYNAMIC ENTITY ACCESS CONTROL ENGINE (Track C - Part 1)                               |
|    [User Context] ──► useHasPermission('entity:record:create')                           |
|                        ├── TRUE:  '+ New Record' enabled                                 |
|                        └── FALSE: Button disabled + Tooltip: "Requires permission"       |
|    [Backend] PUT/POST/DELETE /api/v1/metadata/records/* ──► @PreAuthorize check          |
|                                                                                          |
| 2. CRYPTOGRAPHIC FORWARD-HASH AUDIT LEDGER (Track C - Part 2)                            |
|    UNIPOST_RECORD_AUDIT_LOG (PostgreSQL 16 Partitioned Table)                            |
|    ├── id, tenant_id, record_id, entity_type_id, operation, actor, delta                 |
|    ├── prev_hash (SHA-256 of preceding row in tenant sequence)                          |
|    ├── current_hash (SHA-256 of prev_hash + payload + timestamp)                        |
|    └── signature (HMAC-SHA256 cluster key)                                              |
|                                                                                          |
| 3. SOVEREIGN AUDIT & COMPLIANCE STUDIO (/system/audit) (Track C - Part 3)               |
|    ├── Dedicated Sovereign route via standardized @/components/data-table               |
|    ├── Live Search, Date Range Filter, Actor & Operation Badges                          |
|    ├── Integrity Verification: 5-20ms windowed verification badge (Shield Check)        |
|    └── Signed Compliance Bundle Exporter (.json/.csv evidence archive)                  |
|                                                                                          |
| 4. ENTERPRISE PLAYWRIGHT E2E & WCAG 2.2 AA SUITE (Track B)                               |
|    ├── Deep Role Delegation & Override Journey (Flow 12 expansion)                       |
|    ├── Dynamic Grid Permission Tooltip & Disabled Action Audit                           |
|    └── Full Axe Core WCAG 2.2 AA audit on /system/audit and dialogs                     |
|                                                                                          |
| 5. TESTCONTAINERS POSTGRESQL 16 HARDENING & LIQUIBASE ROLLBACK (Track A)                 |
|    ├── Liquibase changelog 18 rollback verification                                      |
|    └── Real PostgreSQL RLS & Testcontainers slice suite for delegation & audit          |
+──────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Phase-by-Phase Technical Specifications

### Phase 1: Track C - Core Feature Implementation

#### 1.1 Database Evolution: Liquibase `changelog-000.000.00018.xml`
Extend existing partitioned table `UNIPOST_RECORD_AUDIT_LOG`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
  xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
                      http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-3.4.xsd">

    <changeSet id="add-merkle-forward-hash-to-audit-log-18" author="antigravity">
        <comment>Add prev_hash, current_hash, and signature to UNIPOST_RECORD_AUDIT_LOG for cryptographic forward-hash chaining</comment>
        
        <addColumn tableName="UNIPOST_RECORD_AUDIT_LOG">
            <column name="prev_hash" type="VARCHAR(64)"/>
            <column name="current_hash" type="VARCHAR(64)"/>
            <column name="signature" type="VARCHAR(512)"/>
        </addColumn>

        <sql dbms="postgresql">
            CREATE INDEX IF NOT EXISTS idx_record_audit_chain 
                ON UNIPOST_RECORD_AUDIT_LOG (tenant_id, id ASC);
        </sql>
    </changeSet>

</databaseChangeLog>
```

#### 1.2 Backend Service & Controller Layer
1. **`RecordAuditLog.java`**: Add fields `prevHash`, `currentHash`, and `signature`.
2. **`AuditMerkleService.java`**:
   - `String calculateRowHash(String prevHash, RecordAuditLog row)`: Computes SHA-256 digest over row fields.
   - `AuditVerificationResult verifyTenantChain(String tenantId, Long fromId, Long toId)`: Windowed verification comparing expected hashes with stored hashes.
3. **`AuditController.java` (`/api/v1/system/audit`)**:
   - `GET /api/v1/system/audit/records`: Paginated audit log search with filters for `tenantId`, `actor`, `operation`, `fromDate`, `toDate`.
   - `POST /api/v1/system/audit/verify`: Triggers windowed or checkpointed mathematical integrity verification.
   - `GET /api/v1/system/audit/export`: Exports cryptographically signed compliance bundle.
4. **Dynamic Record Permission Enforcement**:
   - Annotate `RecordMutationPipeline` and record controller endpoints with `@PreAuthorize("hasAuthority('entity:record:create')")`, `@PreAuthorize("hasAuthority('entity:record:delete')")`, etc.

#### 1.3 Shared Contract Update (`packages/client`)
Update `RecordAuditLog` interface in `packages/client/src/contracts/metadata.ts`:
```typescript
export interface RecordAuditLog {
  id: string | number;
  tenantId?: string;
  entityTypeId: string | number;
  recordId: string | number;
  version: number;
  operation: 'CREATE' | 'UPDATE' | 'PATCH' | 'SOFT_DELETE' | 'RESTORE';
  oldAttributes?: Record<string, unknown> | null;
  newAttributes?: Record<string, unknown> | null;
  delta?: Record<string, { old: unknown; new: unknown }> | null;
  changedBy?: string | null;
  prevHash?: string | null;
  currentHash?: string | null;
  signature?: string | null;
  createdAt: string;
}

export interface AuditVerificationResult {
  tenantId: string;
  verifiedCount: number;
  intact: boolean;
  tamperedIndex?: number | null;
  latestHash: string;
  verifiedAt: string;
}
```

#### 1.4 Frontend Permission Engine & Dynamic Grid Integration (`@unipost/console`)
1. **`useHasPermission(permissionCode: string)` Hook**:
   - Located in `apps/console/src/features/system/hooks/use-has-permission.ts`.
   - Checks active user permissions from `useAuthStore` and Unified Sandbox persona (`useSandboxStore`).
2. **`entity-data-grid.tsx` Permission Gating**:
   - "+ New Record": Wrapped in Tooltip. If `!canCreate`, disabled with `"Requires entity:record:create permission"`.
   - "Edit Record": Disabled if `!canUpdate`.
   - "Delete Record": Disabled if `!canDelete` with destructive styling subdued.
   - "Audit History & Ledger": Hidden or disabled if `!canReadAudit`.
3. **Sovereign Audit & Compliance Studio (`/system/audit`)**:
   - Route: `apps/console/src/routes/_authenticated/system.audit.tsx`.
   - High-density view using standardized `@/components/data-table`.
   - Toolbar: Tenant switcher (Sovereign scope), live search, operation filter pills (`CREATE`, `UPDATE`, `PATCH`, `DELETE`, `RESTORE`), date range picker.
   - Integrity Badge: Green pulse `ShieldCheck` for verified chain; alert state for broken links.
   - "Verify Integrity" button: executes `useVerifyAuditChain` hook (sub-20ms).
   - "Export Compliance Package" button: downloads signed audit bundle.
4. **Navigation Integration (`sidebar-data.ts`)**:
   - Added to Sovereign Custody navigation group under `/system/audit` with icon `ShieldCheck` and badge `ROOT`.

---

### Phase 2: Track B - Enterprise Playwright E2E & WCAG 2.2 AA Multi-State QA

1. **Deep Delegation Journey Spec Expansion (`e2e/12-sovereign-rbac-matrix.spec.ts`)**:
   - Scenario 1: Tenant Admin (`admin` persona) delegates role and attaches ad-hoc override `entity:record:delete = false`.
   - Scenario 2: Switch to member persona (`user`), navigate to Data Explorer, verify "Delete Record" is disabled with explanatory tooltip.
   - Scenario 3: Verify last-admin demotion prevention soft-lock dialog.
2. **Audit Studio Spec (`e2e/13-sovereign-audit-studio.spec.ts`)**:
   - Scenario 1: Authenticate as `system` (Sovereign Custodian), navigate to `/system/audit`.
   - Scenario 2: Verify audit logs display in `DataTable` with operation badges, actor tags, and hashes.
   - Scenario 3: Click "Verify Integrity", verify green intact status badge renders within timeout.
   - Scenario 4: Export compliance evidence package and verify payload.
3. **WCAG 2.2 AA Multi-State Accessibility Audit**:
   - Run Axe Core on `/system/audit` across Default, Filtering, and Verified states.
   - Verify keyboard navigability, focus indicators, and ARIA live announcements.

---

### Phase 3: Track A - Backend Testcontainers PostgreSQL Invariants & Liquibase CI Hardening

1. **Liquibase Rollback & Migration Verification**:
   - Execute full migration chain including `changelog-000.000.00017.xml` and `changelog-000.000.00018.xml` on PostgreSQL 16 Testcontainer.
   - Execute Liquibase rollback tests verifying clean drop of added columns.
2. **Audit Merkle & Delegation Testcontainers Slice**:
   - `AuditMerkleServiceIT`: Verify sequential hash calculation, tampering injection detection, and windowed verification performance.
   - `TenantRoleDelegationControllerIT`: Exercise MockMvc endpoints with PostgreSQL RLS active, verifying cross-tenant isolation and 403 barriers.

---

## 3. Concrete Deliverables & File Tree

```
apps/backend/
├── unipost-db/src/main/resources/db/unipost/
│   ├── changelog-master.xml                           # [MODIFY] Include changelog 18
│   └── changelog-000.000.00018.xml                   # [NEW] Add prev_hash, current_hash, signature to AUDIT_LOG
├── unipost-fw/src/main/java/com/unipost/
│   ├── domain/metadata/
│   │   └── RecordAuditLog.java                       # [MODIFY] Add prevHash, currentHash, signature fields
│   ├── service/
│   │   ├── AuditMerkleService.java                   # [NEW] SHA-256 forward-hash & verification service
│   │   └── impl/AuditMerkleServiceImpl.java          # [NEW] Implementation of Merkle ledger
│   └── controller/
│       └── AuditController.java                      # [NEW] REST controller for /api/v1/system/audit
packages/client/
└── src/contracts/
    └── metadata.ts                                   # [MODIFY] Evolve RecordAuditLog & add AuditVerificationResult
apps/console/
├── src/
│   ├── routes/_authenticated/
│   │   └── system.audit.tsx                          # [NEW] Sovereign Audit & Compliance Studio route
│   ├── components/layout/data/
│   │   └── sidebar-data.ts                           # [MODIFY] Add Audit Studio under Sovereign Custody
│   ├── features/
│   │   ├── system/
│   │   │   ├── hooks/
│   │   │   │   └── use-has-permission.ts             # [NEW] Central permission check hook
│   │   │   ├── audit/
│   │   │   │   ├── audit-studio-table.tsx            # [NEW] DataTable-based audit ledger
│   │   │   │   ├── audit-verification-badge.tsx      # [NEW] Visual integrity indicator & trigger
│   │   │   │   └── compliance-export-dialog.tsx      # [NEW] Signed evidence bundle exporter
│   │   │   └── api/
│   │   │       └── use-system-audit.ts               # [NEW] Hooks for audit queries and verification
│   │   └── metadata/components/data-explorer/
│   │       └── entity-data-grid.tsx                  # [MODIFY] Wire useHasPermission for create/update/delete
│   ├── core/sandbox/
│   │   └── handlers/
│   │       └── system-sandbox-handler.ts             # [MODIFY] Support /api/v1/system/audit & hash verification
│   └── locales/
│       ├── en/console.json                           # [MODIFY] Add audit studio & permission tooltip strings
│       └── vi/console.json                           # [MODIFY] Sync Vietnamese translations
└── e2e/
    ├── 12-sovereign-rbac-matrix.spec.ts              # [MODIFY] Deep delegation & override user flows
    └── 13-sovereign-audit-studio.spec.ts             # [NEW] Audit studio verification & WCAG AA spec
```

---

## 4. Verification & Validation Protocol

```bash
# 1. Frontend Compilation & Linting
pnpm --filter @unipost/console exec tsc --noEmit

# 2. Frontend Unit & Integration Tests
pnpm --filter @unipost/console exec vitest run src/features/system/hooks/__tests__/use-has-permission.test.ts src/features/system/audit/__tests__/audit-studio.test.tsx

# 3. Playwright E2E Specs (Flow 12 & Flow 13)
pnpm --filter @unipost/console exec playwright test e2e/12-sovereign-rbac-matrix.spec.ts e2e/13-sovereign-audit-studio.spec.ts

# 4. Backend JVM Compilation & Sliced Testcontainers Suite
mvn test-compile -pl unipost-fw
mvn test -pl unipost-fw -Dtest=AuditMerkleServiceTest,TenantRoleDelegationServiceTest -q
```
