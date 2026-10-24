# Integration Master Plan: Iteration 21 - Persistence & Metadata-Driven Database Architecture Synchronization

**Target Systems:**  
- `@unipost/backend` (`apps/backend/unipost-db`, `apps/backend/unipost-fw`, `apps/backend/unipost-ms-aio`)  
- `@unipost/console` (`apps/console/src/features/metadata`, `apps/console/src/core/sandbox`)  
**Lead Systems Architect:** Principal Polyglot Architect, Spring Boot Backend Specialist & UI/UX Systems Specialist  
**Standards:** PostgreSQL 16+ RLS, Liquibase Unified Master, Spring Modulith, React 19, WCAG 2.2 AA, Liquid Glass Design Tokens  
**Reference SSOT:** [`docs/master_database_schema_architecture.md`](master_database_schema_architecture.md)  

---

## 1. Executive Summary & Problem Analysis

Following our comprehensive architectural review across the persistence and database layers of the Unipost monorepo and our `/grill-me` alignment, we identified critical synchronization gaps between the active database implementation and [`docs/master_database_schema_architecture.md`](master_database_schema_architecture.md):

```
+---------------------------------------------------------------------------------------------------+
|                        DATABASE & PERSISTENCE LAYER SYNCHRONIZATION AUDIT                         |
+------------------------------------+--------------------------------+-----------------------------+
| 1. CANONICAL TABLE NAMING & PRUNING| 2. CONTROL PLANE COMPLETION    | 3. UI/UX MATRIX & WCAG 2.2  |
| Document referenced generic APP_*  | Static control plane omitted   | Dynamic metadata inputs and |
| and dead tables (ADDRESS,          | UNIPOST_TENANT_BILLING,        | audit explorers lacked the  |
| USERPROFILE, USERACTIVITY) instead | UNIPOST_TENANT_FEATURES, and   | 5-State Matrix and WCAG 2.2 |
| of UNIPOST_IDENTITY_* physical DDL.| payOS feature gate pipeline.   | AA accessibility rules.     |
+------------------------------------+--------------------------------+-----------------------------+
```

---

## 2. Ratified Architectural Decisions (From `/grill-me` Alignment)

> [!IMPORTANT]
> 1. **File Storage Engine (`UNIPOST_FS_*`)**: Strictly **out of scope**. File storage is maintained separately and completely excluded from `docs/master_database_schema_architecture.md` (to be documented independently).
> 2. **Identity & RBAC Naming**: Canonical physical naming convention: strictly use `UNIPOST_IDENTITY_USER`, `UNIPOST_IDENTITY_ROLE`, `UNIPOST_IDENTITY_PERMISSION`, `UNIPOST_IDENTITY_USERROLE`, `UNIPOST_IDENTITY_ROLEPERMISSION` across all text, ER diagrams, and DDL tables.
> 3. **Clean Elimination of Dead Tables**: `ADDRESS`, `USERPROFILE`, and `USERACTIVITY` are permanently removed from all ER diagrams and documentation.
> 4. **Billing & Dynamic Feature Gate Pipeline**: Fully document `UNIPOST_TENANT_BILLING` and `UNIPOST_TENANT_FEATURES` with RLS, payOS VietQR flow, the `@RequireFeature` AOP evaluation aspect, and the `<FeatureGate />` UI token contract.
> 5. **UI/UX Design System & WCAG 2.2 AA**: Fully document the dynamic Form UI Widget token mapping to `@unipost/ui` primitives, Liquid Glass styling metrics, the 5-state component matrix (Default, Loading, Empty, Error, Disabled), and WCAG 2.2 AA accessibility requirements.

---

## 3. Identified Mismatches & Corrective Actions

| # | Current Document Specification | Actual Monorepo Implementation | Required Architectural Correction |
|---|---|---|---|
| 1 | ER Diagram & Table Registry lists `APP_USER`, `APP_ROLE`, `APP_PERMISSION`, `APP_USERROLE`, `APP_ROLEPERMISSION`. | Actual physical tables are prefixed: `UNIPOST_IDENTITY_USER`, `UNIPOST_IDENTITY_ROLE`, `UNIPOST_IDENTITY_PERMISSION`, `UNIPOST_IDENTITY_USERROLE`, `UNIPOST_IDENTITY_ROLEPERMISSION`. | Update ER diagrams, table definitions, and DDL references to exact `UNIPOST_IDENTITY_*` names. |
| 2 | ER Diagram contains `APP_USER ||--o{ APP_USERACTIVITY : "audited"`. | `USERACTIVITY`, `USERPROFILE`, and `ADDRESS` have been cleanly eliminated. Audit logging is exclusively handled by `UNIPOST_RECORD_AUDIT_LOG` and MDC telemetry. | Remove `APP_USERACTIVITY`, `ADDRESS`, and `USERPROFILE` completely from ER diagram and prose. |
| 3 | Static Control Plane omits `UNIPOST_TENANT_BILLING` and `UNIPOST_TENANT_FEATURES` table schemas and feature gating pipeline. | Active tables in `changelog-000.000.00006.xml` manage commercial subscription status, payOS VietQR checkouts, and dynamic feature entitlement tokens with RLS. | Add comprehensive table schema definitions for `UNIPOST_TENANT_BILLING` and `UNIPOST_TENANT_FEATURES`, plus `@RequireFeature` & `<FeatureGate />` pipeline. |
| 4 | File Storage (`UNIPOST_FS_OBJECT`, `UNIPOST_FS_OBJECTRELATION`) was partially referenced. | Maintained separately; must not clutter the database schema master SSOT. | Strictly omit all FS tables from the persistence architecture document. |
| 5 | Master Migration Topology describes split identity and unipost Liquibase scripts. | Migrations are consolidated: `db/unipost/changelog-master.xml` houses identity baseline + incremental changelogs, linked by root `db/changelog-master.xml`. | Add Section 8 detailing the Unified Liquibase Migration Graph and changelog execution sequence. |
| 6 | Missing UI/UX Design System & 5-State Component Invariants for Metadata and Audit components. | Rule `01-workspace-specific.md` and `ui-ux-design-principles` mandate Liquid Glass tokens, the 5-state matrix (Default, Loading, Empty, Error, Disabled), and WCAG 2.2 AA accessibility for dynamic forms and audit drawers. | Add Section 9 covering UI/UX Design System Integration, Liquid Glass specifications, dynamic form widget mappings, and WCAG 2.2 AA compliance. |

---

## 4. Detailed Architectural Specifications & Changes

### 4.1. Topology Diagram & Executive Summary Update
- Update Version to `1.1.0`.
- Update Mermaid topology flowchart in Section 1 to include:
  - `UNIPOST_TENANTS` master catalog entity.
  - `UNIPOST_TENANT_BILLING` & `UNIPOST_TENANT_FEATURES`.
  - Canonical `UNIPOST_IDENTITY_*` tables.
  - (Exclude any FS references).

### 4.2. Static Control Plane & Multi-Tenancy Hierarchy
- Refine Section 3.2 to detail the strict referential binding:
  - `UNIPOST_TENANTS` (master root organization).
  - `UNIPOST_WORKSPACES` (environments with `tenant_ref_id` foreign key referencing `UNIPOST_TENANTS.id`).
- Add Table 8 schema: `UNIPOST_TENANT_BILLING` (tenant_id PK, payos_customer_id, current_order_code, plan_tier, billing_cadence, status, amount_paid, expires_at).
- Add Table 9 schema: `UNIPOST_TENANT_FEATURES` (id PK, tenant_id, feature_key, is_enabled, expires_at, unique index `uk_tenant_feature_active`).
- Document the Dynamic Feature Gate Evaluation Pipeline:
  - Backend `@RequireFeature("key")` AOP annotation checking `UNIPOST_TENANT_FEATURES` with Hazelcast L2 cache.
  - Frontend `<FeatureGate feature="key" fallback={<PayOsUpgradeCard />}>` conditional rendering.

### 4.3. Canonical Identity & RBAC Matrix
- Update Section 3.3 Mermaid ER Diagram:
  - Replace `APP_*` with `UNIPOST_IDENTITY_*`.
  - Remove `APP_USERACTIVITY`, `ADDRESS`, and `USERPROFILE`.
  - Associate `UNIPOST_IDENTITY_USER` with `UNIPOST_TENANTS` via owner custody.
- Update table schema tables from generic `APP_*` to physical `UNIPOST_IDENTITY_*`.

### 4.4. Unified Liquibase Master Migration Topology
- Add Section 8 detailing the single source of truth for database migrations:
  - Root: `db/changelog-master.xml`
    - Core migration graph: `db/unipost/changelog-master.xml` (Identity baseline `changelog-identity-00.xml`, tokens, master_data, mock_data followed by sequential incremental changelogs `000.000.00001.xml` through `000.000.00014.xml`).

### 4.5. UI/UX Design System Integration & WCAG 2.2 AA Compliance
- Add Section 9 detailing front-end binding for dynamic metadata:
  - **Dynamic Form Widgets**: Map `ui_component` tokens (`TEXT_INPUT`, `NUMERIC_INPUT`, `DATE_PICKER`, `DROPDOWN`, `RICH_TEXT`, `SWITCH`, `RELATION_PICKER`) to `@unipost/ui` primitives.
  - **Liquid Glass Aesthetics**: Enforce frosted translucent scrims (`bg-white/65`, `backdrop-blur-xl`, `border-white/30 dark:border-white/10`) on dynamic forms and `RecordAuditHistoryDrawer`.
  - **5-State Component Matrix**: Explicit specs for Default, Loading (skeletons), Empty (CTA), Error (recovery message), and Disabled/Read-only states.
  - **WCAG 2.2 AA Accessibility**: Strict label associations (`htmlFor`), keyboard operability, polite live region announcements (`aria-live="polite"`), and 4.5:1 text contrast.

---

## 5. Verification & Testing Strategy

1. **Backend Verification**:
   - Run `./mvnw test-compile -q` to guarantee backend compilation integrity.
   - Run targeted test suites: `./mvnw test -pl unipost-fw "-Dtest=TenantProvisioningServiceTest,SovereignCustodyAndRlsTest,TenantContextAndAspectTest" -q`.
2. **Frontend Type Verification**:
   - Run `pnpm --filter @unipost/console exec tsc --noEmit` to verify type safety.
3. **Specification Quality Verification**:
   - Validate Mermaid diagrams for zero syntax warnings.
   - Cross-check 100% of table and column names against actual SQL DDL scripts.
