# History Entry 198: Master Database Schema Architecture Refinement & Synchronization

## 1. Problem
Following the introduction of the dedicated master `UNIPOST_TENANTS` table, Liquibase unification into `db/acc/`, and the clean eradication of obsolete tables (`ADDRESS`, `USERPROFILE`, `USERACTIVITY`), the primary persistence reference document (`docs/master_database_schema_architecture.md`) had several key synchronization gaps:
1. It listed generic table names (`APP_USER`, `APP_ROLE`, etc.) rather than physical schema names (`UNIPOST_IDENTITY_*`).
2. Obsolete identity tables remained in the Mermaid ER diagram.
3. Static control plane tables (`UNIPOST_TENANT_BILLING`, `UNIPOST_TENANT_FEATURES`) and the dynamic feature gate pipeline (`@RequireFeature` and `<FeatureGate />`) were omitted.
4. The document lacked the unified Liquibase master topology and the UI/UX Design System token mappings, 5-State Component Matrix, and WCAG 2.2 AA accessibility requirements for dynamic metadata.
5. File storage (`UNIPOST_FS_*`) was deemed out of scope and required complete exclusion to be maintained independently.

## 2. Plan
Ratified via `/grill-me` alignment and documented in [`docs/integration_master_plan_iteration21.md`](../integration_master_plan_iteration21.md):
1. Exclude all File Storage (`UNIPOST_FS_*`) tables and maintain them separately.
2. Canonicalize identity table references to `UNIPOST_IDENTITY_*` and purge `ADDRESS`, `USERPROFILE`, and `USERACTIVITY`.
3. Document `UNIPOST_TENANT_BILLING`, `UNIPOST_TENANT_FEATURES`, and the dual-sided Dynamic Feature Gate evaluation pipeline.
4. Add Section 8 detailing the Unified Liquibase Master Topology (`db/changelog-master.xml` -> `db/acc/changelog-master.xml`).
5. Add Section 9 detailing UI/UX Design System integration, Liquid Glass optical specifications, the 5-state component matrix, and WCAG 2.2 AA accessibility invariants.

## 3. Changes
- **Primary Architecture Reference**:
  - Updated [`docs/master_database_schema_architecture.md`](../master_database_schema_architecture.md) (bumped to Version `1.1.0`).
  - Updated Section 1 topology Mermaid diagram.
  - Added Tables 10 & 11 in Section 3.2 (`UNIPOST_TENANT_BILLING`, `UNIPOST_TENANT_FEATURES`, and `@RequireFeature` / `<FeatureGate />` pipeline).
  - Updated Section 3.3 to canonical `UNIPOST_IDENTITY_*` table names and updated Mermaid ER diagram.
  - Added Section 8: Unified Liquibase Master Migration Topology with migration graph and invariants.
  - Added Section 9: UI/UX Design System Integration, Dynamic Form Widget Token Mapping, 5-State Component Matrix, and WCAG 2.2 AA compliance rules.
- **Iteration & App Planning**:
  - Authored [`docs/integration_master_plan_iteration21.md`](../integration_master_plan_iteration21.md).
  - Updated [`apps/backend/doc/implementation_plan_45.md`](../../apps/backend/doc/implementation_plan_45.md).

## 4. Verification
- Backend compilation: `./mvnw test-compile -q` PASSED.
- Multi-tenant backend test suite: `./mvnw test -pl acc-fw "-Dtest=TenantProvisioningServiceTest,SovereignCustodyAndRlsTest,TenantContextAndAspectTest" -q` ran 15/15 tests PASSED (0 failures, 0 errors).
- Console frontend typescript: `pnpm --filter @acc/console exec tsc --noEmit` exited with code 0 (zero errors).
- Specification verification: Verified all Mermaid diagrams render cleanly without syntax errors and all referenced tables match physical PostgreSQL DDL.

## 5. Walkthrough
Refer to [`docs/master_database_schema_architecture.md`](../master_database_schema_architecture.md) as the living single source of truth for the Acc persistence layer.
