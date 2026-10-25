# Task 020: SYSTEM Tenant (Sovereign Root Custodian) — Full Architecture & Core Implementation (Phases 1–4)

## Problem Statement
The multi-tenant architecture previously treated the `SYSTEM` tenant with identical database RLS constraints, leading to the **PostgreSQL RLS Write Paradox**:
1. When `SYSTEM` attempted to bootstrap canonical schemas, `UNIPOST_ENTITY_TYPES` rejected row insertion because RLS policies evaluated `WITH CHECK (tenant_id = current_setting('app.current_tenant_id'))`.
2. As a consequence, `SYSTEM` was unable to author system-level entities, perform cross-tenant data plane auditing, or execute ephemeral impersonation (`Assume-Tenant`).
3. Furthermore, platform administrators lacked dedicated cockpits for fleet management, unconstrained quota overrides ($\infty$), commercial tier promotion, soft kill-switches, and declarative RBAC permission matrix governance.

## Execution Plan & Implementation Steps
- **Phase 1: DB & Backend Tenancy Core**:
  - Liquibase migration `changelog-000.000.00007.xml` in `apps/backend/acc-db` registered in `changelog-master.xml` resolving PostgreSQL RLS Write Paradox.
  - Refactored `TenantContextHolder.java` with Dual-Context Principal (`actorTenantId` vs. `effectiveTenantId`, `setDualContext()`, `isImpersonating()`, `isSovereignActor()`).
  - Updated `TenantSessionAspect.java` setting `SET LOCAL app.is_system_custodian = 'true'` when actor is `SYSTEM`.
  - Added caller-aware guards in `MetadataService.java` allowing `SYSTEM` to mutate canonical schemas while commercial tenants remain blocked.
- **Phase 2: Sovereign Control APIs & Fleet DTOs**:
  - Implemented 10 DTOs in `com.acc.system.dto` (`FleetTenantSummaryDto`, `CreateTenantRequest`, `UpdateTenantStatusRequest`, `OverrideSubscriptionRequest`, `UpdateTenantQuotasRequest`, `AssumeTenantRequest`, `AssumeTenantTokenResponse`, `RoleWithPermissionsDto`, `UpdateRolePermissionsRequest`, `GlobalUserListItemDto`, `LockUserRequest`).
  - Created `SystemFleetService.java` for fleet operations, telemetry computation, quota overrides, and signed Assume-Tenant tokens.
  - Implemented `SystemFleetController.java` with Spring Security `@PreAuthorize` guards for fleet management.
  - Added JUnit test suite `SystemFleetControllerTest.java` (10/10 PASS).
- **Phase 3: Unified Sandbox Platform Integration**:
  - Created `src/core/sandbox/handlers/system-sandbox-handler.ts` implementing `SandboxRouteHandler` (`priority: 98`, matcher `/api/v1/system`).
  - Added `system` persona to `DEFAULT_SANDBOX_PERSONAS` in `sandbox-store.ts` (`roles: ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_SYSTEM_CUSTODIAN']`, `defaultTenantId: 'SYSTEM'`).
  - Wired `mockFleetStore.reset()` into master `SandboxDock` reset pipeline.
  - Created typed TanStack Query hook library `src/features/system/api/use-system-fleet.ts`.
  - Added test suite `system-sandbox.test.ts` (7/7 PASS).
- **Phase 4: Dedicated Sovereign UI Cockpits**:
  - Created `AssumeTenantBar` mounted at the top of `AuthenticatedLayout` alerting active delegated sessions with one-click exit.
  - Created `FleetTenantsTable` with multi-filter controls, live telemetry dials, and row actions.
  - Created `CreateTenantModal`, `SubscriptionOverrideDrawer`, `QuotaTuningDrawer` (with $\infty$ switches), and `SuspendTenantDialog`.
  - Created `RbacMatrixGrid`, `RoleDefinitionModal`, and `UserMembershipDrawer` with universal user lockouts.
  - Configured dedicated routes `/system/tenants` and `/system/roles`.
  - Added test suite `sovereign-cockpit-ui.test.tsx` (3/3 PASS).
- **Phase 5: Navigation, Living Specifications & i18n**:
  - Integrated Sovereign Custody into `sidebar-data.ts` restricted to `ROLE_SYSTEM_CUSTODIAN`.
  - Added sovereign context option (👑 Sovereign Platform) in `profile-switcher.tsx`.
  - Synchronized `apps/console/ROUTE.md` (Section 3.9 Sovereign Custody Fleet & RBAC Matrix) and `apps/console/DESIGN.md` (Amber Liquid Glass styling tokens).
  - Synchronized bilingual locales `locales/en/console.json` and `locales/vi/console.json`.
- **Phase 6: Comprehensive Verification & Sovereign Test Suites**:
  - Authored `SovereignCustodyAndRlsTest.java` validating dual-context tenancy flags, session aspect SQL execution (`SET LOCAL app.is_system_custodian = 'true'`), and caller-aware mutation/deletion overrides on canonical schemas vs. standard commercial tenant rejection (`MetadataConflictException`).
  - Executed all backend and console test suites end-to-end with 100% pass rate.

## Verification & Test Results
- Backend (`mvn test`):
  - `SovereignCustodyAndRlsTest`: 4/4 PASS.
  - `TenantContextAndAspectTest`: 6/6 PASS.
  - `SystemFleetControllerTest`: 10/10 PASS.
  - Total backend tests: 20/20 PASS.
- Console Frontend (`vitest run src/core/sandbox src/features/system`):
  - `system-sandbox.test.ts`: 7/7 PASS.
  - `sovereign-cockpit-ui.test.tsx`: 3/3 PASS.
  - Full sandbox & system test suite: 9 test files passed (56/56 tests PASS).

