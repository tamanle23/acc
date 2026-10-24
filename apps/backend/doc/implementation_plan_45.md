# Implementation Plan 45: Master Database Schema Architecture Refinement & Synchronization

## Executive Summary
This plan details the comprehensive synchronization and refinement of [`docs/master_database_schema_architecture.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/master_database_schema_architecture.md) to serve as the single source of truth across the Unipost monorepo. It aligns the architectural specification with the recent `UNIPOST_TENANTS` master entity implementation, Liquibase migration unification (`db/changelog-master.xml`), clean elimination of legacy identity tables (`ADDRESS`, `USERPROFILE`, `USERACTIVITY`), and incorporates missing billing control plane tables (`UNIPOST_TENANT_BILLING`, `UNIPOST_TENANT_FEATURES`) alongside UI/UX design tokens and WCAG 2.2 AA accessibility invariants. **File Storage (`UNIPOST_FS_*`) is strictly out of scope and maintained separately.**

---

## Ratified Architectural Decisions (From `/grill-me` Alignment)

> [!IMPORTANT]
> 1. **File Storage Engine (`UNIPOST_FS_*`)**: Strictly **out of scope**. File storage is maintained separately and completely excluded from `docs/master_database_schema_architecture.md` (to be documented independently).
> 2. **Identity & RBAC Naming**: Canonical physical naming convention: strictly use `UNIPOST_IDENTITY_USER`, `UNIPOST_IDENTITY_ROLE`, `UNIPOST_IDENTITY_PERMISSION`, `UNIPOST_IDENTITY_USERROLE`, `UNIPOST_IDENTITY_ROLEPERMISSION` across all text, ER diagrams, and DDL tables.
> 3. **Clean Elimination of Dead Tables**: `ADDRESS`, `USERPROFILE`, and `USERACTIVITY` are permanently removed from all ER diagrams and documentation.
> 4. **Billing & Dynamic Feature Gate Pipeline**: Fully document `UNIPOST_TENANT_BILLING` and `UNIPOST_TENANT_FEATURES` with RLS, payOS VietQR flow, the `@RequireFeature` AOP evaluation aspect, and the `<FeatureGate />` UI token contract.
> 5. **UI/UX Design System & WCAG 2.2 AA**: Fully document the dynamic Form UI Widget token mapping to `@unipost/ui` primitives, Liquid Glass styling metrics, the 5-state component matrix (Default, Loading, Empty, Error, Disabled), and WCAG 2.2 AA accessibility requirements.

---

## Identified Mismatches & Gaps in Current Architecture Specification

| # | Current Document Specification | Actual Monorepo Implementation | Required Architectural Correction |
|---|---|---|---|
| 1 | ER Diagram & Table Registry lists `APP_USER`, `APP_ROLE`, `APP_PERMISSION`, `APP_USERROLE`, `APP_ROLEPERMISSION`. | Actual physical tables are prefixed: `UNIPOST_IDENTITY_USER`, `UNIPOST_IDENTITY_ROLE`, `UNIPOST_IDENTITY_PERMISSION`, `UNIPOST_IDENTITY_USERROLE`, `UNIPOST_IDENTITY_ROLEPERMISSION`. | Update ER diagrams, table definitions, and DDL references to exact `UNIPOST_IDENTITY_*` names. |
| 2 | ER Diagram contains `APP_USER ||--o{ APP_USERACTIVITY : "audited"`. | `USERACTIVITY`, `USERPROFILE`, and `ADDRESS` have been cleanly eliminated. Audit logging is exclusively handled by `UNIPOST_RECORD_AUDIT_LOG` and MDC telemetry. | Remove `APP_USERACTIVITY`, `ADDRESS`, and `USERPROFILE` completely from ER diagram and prose. |
| 3 | Static Control Plane omits `UNIPOST_TENANT_BILLING` and `UNIPOST_TENANT_FEATURES` table schemas and feature gating pipeline. | Active tables in `changelog-000.000.00006.xml` manage commercial subscription status, payOS VietQR checkouts, and dynamic feature entitlement tokens with RLS. | Add comprehensive table schema definitions for `UNIPOST_TENANT_BILLING` and `UNIPOST_TENANT_FEATURES`, plus `@RequireFeature` & `<FeatureGate />` pipeline. |
| 4 | File Storage (`UNIPOST_FS_OBJECT`, `UNIPOST_FS_OBJECTRELATION`) was partially referenced. | Maintained separately; must not clutter the database schema master SSOT. | Strictly omit all FS tables from the persistence architecture document. |
| 5 | Master Migration Topology describes split identity and unipost Liquibase scripts. | Migrations are consolidated: `db/unipost/changelog-master.xml` houses identity baseline + incremental changelogs, linked by root `db/changelog-master.xml`. | Add Section 8 detailing the Unified Liquibase Migration Graph and changelog execution sequence. |
| 6 | Missing UI/UX Design System & 5-State Component Invariants for Metadata and Audit components. | Rule `01-workspace-specific.md` and `ui-ux-design-principles` mandate Liquid Glass tokens, the 5-state matrix (Default, Loading, Empty, Error, Disabled), and WCAG 2.2 AA accessibility for dynamic forms and audit drawers. | Add Section 9 covering UI/UX Design System Integration, Liquid Glass specifications, dynamic form widget mappings, and WCAG 2.2 AA compliance. |

---

## Proposed Changes

### Documentation Layer

#### [MODIFY] [`docs/master_database_schema_architecture.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/master_database_schema_architecture.md)

1. **Section 1: Executive Architecture Summary & Topology Diagram**:
   - Update Mermaid flowchart to reflect `UNIPOST_TENANTS` master entity, `UNIPOST_TENANT_BILLING`, `UNIPOST_TENANT_FEATURES`, and `UNIPOST_IDENTITY_*` (excluding FS).
   - Update version to `1.1.0`.

2. **Section 3.2: Static Control Plane & Resiliency Tables**:
   - Detail `UNIPOST_TENANTS` with `tenant_ref_id` foreign key association to `UNIPOST_WORKSPACES`.
   - Add Table 8: `UNIPOST_TENANT_BILLING` (PayOS customer ID, order code, plan tier, billing cadence, status, expires_at, RLS policies).
   - Add Table 9: `UNIPOST_TENANT_FEATURES` (Feature entitlement tokens, feature_key, is_enabled, expiry, RLS policies).
   - Document `@RequireFeature` aspect and `<FeatureGate />` UI contract.

3. **Section 3.3: Identity, RBAC Matrix & Global Users Control Plane**:
   - Update Mermaid ER Diagram:
     - Rename tables to `UNIPOST_IDENTITY_USER`, `UNIPOST_IDENTITY_ROLE`, `UNIPOST_IDENTITY_PERMISSION`, `UNIPOST_IDENTITY_USERROLE`, `UNIPOST_IDENTITY_ROLEPERMISSION`.
     - Remove `APP_USERACTIVITY`, `USERPROFILE`, and `ADDRESS`.
     - Connect `UNIPOST_IDENTITY_USER` to `UNIPOST_TENANTS` via `owner_user_uid` and multi-tenant assignment.
   - Update table definition tables from `APP_*` to `UNIPOST_IDENTITY_*`.

4. **[NEW] Section 8: Unified Liquibase Master Migration Topology**:
   - Diagram and tabular specification of `db/changelog-master.xml`:
     - Core migration graph: `db/unipost/changelog-master.xml`: Identity baseline (`changelog-identity-00.xml`, tokens, master_data, mock_data) followed by sequential incremental changelogs (`001` through `014`).

5. **[NEW] Section 9: UI/UX Design System & Accessibility Invariants (Console Client Integration)**:
   - **Dynamic Widget Binding**: Mapping `ui_component` tokens (`TEXT_INPUT`, `NUMERIC_INPUT`, `DATE_PICKER`, `DROPDOWN`, `RICH_TEXT`, `SWITCH`, `RELATION_PICKER`) to `@unipost/ui` primitives.
   - **Liquid Glass Aesthetic**: Application of translucent frosted scrims (`bg-white/65`, `backdrop-blur-xl`, `border-white/30`) across dynamic form cards and the `RecordAuditHistoryDrawer`.
   - **5-State Component Matrix**: Explicit state specifications for dynamic metadata screens (Default, Loading skeleton, Empty CTA, Error recovery, Disabled/Read-only).
   - **WCAG 2.2 AA Accessibility Compliance**: Form field label associations (`htmlFor`), keyboard navigation (`Tab`, `Space`, `Enter`, `Escape`), `aria-live="polite"` mutation diff announcements, and minimum 4.5:1 contrast ratios.

---

### Monorepo History & Verification Layer

#### [NEW] [`docs/history/198_master_database_schema_architecture_synchronization.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/history/198_master_database_schema_architecture_synchronization.md)
- Create sequential 3-digit history log entry.

#### [MODIFY] [`docs/history/README.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/history/README.md)
- Add History Entry 198 to the master index.

---

## Verification Plan

### Automated Verification
```bash
# Verify backend compilation
./mvnw test-compile -q

# Run multi-tenant backend test suite
./mvnw test -pl unipost-fw "-Dtest=TenantProvisioningServiceTest,SovereignCustodyAndRlsTest,TenantContextAndAspectTest" -q

# Verify console frontend typescript integrity
pnpm --filter @unipost/console exec tsc --noEmit
```

### Manual Inspection
- Review generated Mermaid diagrams in `docs/master_database_schema_architecture.md` for syntax validity and clean rendering.
- Verify every table name in Section 3 matches physical PostgreSQL table names generated by Liquibase changelogs.
- Ensure zero references to deleted tables (`ADDRESS`, `USERPROFILE`, `USERACTIVITY`) or FS tables.
