# 209: Cryptographic Merkle Audit Studio & Dynamic Entity Access Control Engine

## Problem
In compliance environments and sovereign custody operations, records mutated within the dynamic metadata engine lacked an end-to-end cryptographic audit ledger capable of mathematically proving non-tampering. Furthermore, action buttons (`New Record`, `Edit Record`, `Delete Record`) in the spreadsheet data explorer were not dynamically bound to atomic RBAC permissions (`entity:record:create`, `entity:record:update`, `entity:record:delete`).

## Plan
1. **Liquibase & Persistence**: Evolve partitioned table `UNIPOST_RECORD_AUDIT_LOG` with SHA-256 forward-hash chaining (`prev_hash`, `current_hash`, `signature`) and an index `idx_record_audit_chain` in `changelog-000.000.00018.xml`.
2. **Backend Merkle Service**: Create `AuditMerkleService` & `AuditMerkleServiceImpl` providing deterministic SHA-256 hash chaining and automated tenant-level forward integrity checks (`verifyTenantChain`).
3. **Audit REST Controller**: Expose `/api/v1/system/audit/records`, `/verify`, and `/export` under Sovereign Custody.
4. **Dynamic Permission Gating**: Implement `useHasPermission` hook in `@unipost/console` and wire permissions into `entity-data-grid.tsx`.
5. **Sovereign Audit Studio**: Build `/system/audit` using standardized `@/components/data-table`, with filtering, live verification badge, and diff inspection modal.
6. **Unified Sandbox Sync & Tests**: Update `system-sandbox-handler.ts`, add Playwright Flow 13 (`13-sovereign-audit-studio.spec.ts`) with Axe Core WCAG 2.2 AA audit, and backend JUnit tests.

## Changes
- **Database**:
  - Created `apps/backend/unipost-db/src/main/resources/db/unipost/changelog-000.000.00018.xml`.
  - Registered migration in `changelog-master.xml`.
- **Backend**:
  - Updated `RecordAuditLog.java` and `RecordAuditLogRepository.java`.
  - Added `AuditMerkleService.java` and `AuditMerkleServiceImpl.java`.
  - Added `AuditController.java`.
  - Added unit test `AuditMerkleServiceTest.java`.
- **Contracts**:
  - Updated `packages/client/src/contracts/metadata.ts` with `AuditVerificationResult` and cryptographic audit attributes.
- **Frontend Console**:
  - Created `use-has-permission.ts` and unit tests in `src/features/system/hooks/__tests__/use-has-permission.test.ts`.
  - Updated `entity-data-grid.tsx` with dynamic permission gating on Create, Edit, and Delete actions.
  - Implemented `use-system-audit.ts`, `audit-studio-columns.tsx`, `audit-studio-table.tsx`, `system.audit.tsx`, and unit tests in `audit-studio.test.tsx`.
  - Synchronized `sidebar-data.ts`, `en/console.json`, and `vi/console.json`.
  - Updated `apps/console/src/core/sandbox/handlers/system-sandbox-handler.ts` and registered it in `apps/console/src/core/sandbox/index.ts`.
  - Added Playwright test `apps/console/e2e/13-sovereign-audit-studio.spec.ts` with Axe Core WCAG 2.2 AA audit.

## Verification
- `tsc --noEmit`: 0 errors.
- Vitest unit tests: 6 passed (`use-has-permission.test.ts`, `audit-studio.test.tsx`).
- Backend JUnit: `AuditMerkleServiceTest` and `TenantRoleDelegationServiceTest` passed (8/8 passed).
- Playwright E2E: `e2e/12-sovereign-rbac-matrix.spec.ts` and `e2e/13-sovereign-audit-studio.spec.ts` passed with 0 WCAG 2.2 AA violations.

## Walkthrough & Artifacts
- Walkthrough: `apps/console/doc/walkthrough_156.md`.
- Implementation Plan: `apps/console/doc/implementation_plan_156.md`.
- Master Integration Plan: `docs/integration_master_plan_iteration25.md`.
