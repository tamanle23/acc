# Walkthrough 156: Cryptographic Merkle Tamper-Evident Audit Trail & Dynamic Entity Access Control Engine

## Overview
Iteration 25 completes the enterprise cryptographic audit trail and dynamic entity permissions gating across `@unipost/backend`, `@unipost/client`, and `@unipost/console`.

## Key Capabilities Delivered

### 1. Cryptographic Forward-Hash Ledger (Backend & Database)
- **Database Partitioning & Evolution**: Created Liquibase migration `changelog-000.000.00018.xml` adding `prev_hash`, `current_hash`, and `signature` columns with index `idx_record_audit_chain` on range-partitioned table `UNIPOST_RECORD_AUDIT_LOG`.
- **Domain Persistence**: Extended `RecordAuditLog.java` and `RecordAuditLogRepository.java`.
- **Merkle Service**: Implemented `AuditMerkleService` & `AuditMerkleServiceImpl` with deterministic SHA-256 calculation `calculateHash(...)` and continuous forward-hash validation `verifyTenantChain(...)`.
- **API Endpoints**: Exposed `/api/v1/system/audit/records`, `/verify`, and `/export` via `AuditController.java`.
- **Backend Tests**: Verified via `AuditMerkleServiceTest` (deterministic hash generation, chain integrity verification, and broken-chain detection).

### 2. Dynamic Entity Permission Gating
- Implemented `useHasPermission` and `useActivePermissions` hooks in `@unipost/console` (`src/features/system/hooks/use-has-permission.ts`).
- Enforced fine-grained permissions (`entity:record:create`, `entity:record:update`, `entity:record:delete`) directly inside `entity-data-grid.tsx` with accessible tooltips and disabled button states.

### 3. Sovereign Audit & Compliance Studio (`/system/audit`)
- Standardized UI using `@/components/data-table` (`audit-studio-table.tsx` and `audit-studio-columns.tsx`).
- Built tenant scoping selector, operation filters, actor search, real-time chain verification button, and detailed JSON diff modal.
- Added navigation links in `sidebar-data.ts` under Sovereign Custody and synchronized `en` and `vi` localization files.

### 4. Unified Sandbox Platform Integration
- Added audit mock endpoints (`/api/v1/system/audit/records`, `/verify`, `/export`) in `system-sandbox-handler.ts`.
- Registered `systemSandboxHandler` into `sandboxRegistry` in `apps/console/src/core/sandbox/index.ts`.

## Verification Results
- **TypeScript**: `tsc --noEmit` exited 0 (clean compilation).
- **Backend Tests**: `./mvnw test -pl unipost-fw -Dtest="AuditMerkleServiceTest,TenantRoleDelegationServiceTest"` passed cleanly (8/8 tests passed).
- **Frontend Unit Tests**: `vitest` passed 6/6 tests (`use-has-permission.test.ts`, `audit-studio.test.tsx`).
- **Playwright E2E & WCAG 2.2 AA**:
  - `e2e/12-sovereign-rbac-matrix.spec.ts`: Passed (0 WCAG violations).
  - `e2e/13-sovereign-audit-studio.spec.ts`: Passed (0 WCAG violations).
