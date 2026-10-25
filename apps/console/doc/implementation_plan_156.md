# Implementation Plan 156: Iteration 25 Full-Stack Execution Strategy

- **Iteration Plan Reference**: [`docs/integration_master_plan_iteration25.md`](../../../docs/integration_master_plan_iteration25.md)
- **Status**: Grilled & Approved Execution Blueprint
- **Execution Pipeline**: **Track C (Feature Scope) ──► Track B (E2E & WCAG QA) ──► Track A (Backend Hardening)**
- **Lead Systems Architect**: Principal Polyglot Architect, Database Architect & Operations Specialist, TypeScript Architect & UI/UX Systems Specialist

---

## 1. Context & Architectural Consensus

Following the grill session, all key architectural decisions for **Iteration 25** have reached alignment:

1. **Sequential Execution Pipeline**:
   - `Track C`: Cryptographic Forward-Hash Ledger (`UNIPOST_RECORD_AUDIT_LOG`), Dynamic Entity Access Control in `entity-data-grid.tsx`, and Sovereign Audit & Compliance Studio (`/system/audit`).
   - `Track B`: Playwright E2E coverage for deep role delegation workflows, dynamic grid permission tooltips, and WCAG 2.2 AA audit across the new studio.
   - `Track A`: Backend PostgreSQL 16 Testcontainers suite validating Liquibase changelog 17 and 18, hash calculations, and security isolation.
2. **Cryptographic Forward-Hash Ledger**:
   - SHA-256 forward-hash chaining on `UNIPOST_RECORD_AUDIT_LOG` (`prev_hash`, `current_hash`, `signature`) providing mathematical tamper-evidence for record mutations.
   - **Performance Guarantee**: Checkpoint-anchored and windowed verification ensuring UI checks complete in 5–20ms without scanning millions of rows.
3. **Dynamic Entity Access Control**:
   - Centralized hook `useHasPermission(code: string)` aggregating role assignments and ad-hoc overrides.
   - In `entity-data-grid.tsx`, unauthorized actions are rendered **disabled with contextual tooltips** (e.g. `"Requires entity:record:create permission"`), with corresponding backend HTTP 403 API protection.
4. **Audit Studio Placement & Custody**:
   - Route `/system/audit` built using the standardized `@/components/data-table`.
   - Accessible **exclusively under Sovereign Custody (`ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`)** in `sidebar-data.ts` for fleet-wide inspection, mathematical verification, and signed compliance bundle export.

---

## 2. Deliverables & Verification Sequence

### Phase 1: Track C (Feature Implementation)
1. **Database & Contracts**:
   - Liquibase `changelog-000.000.00018.xml` adding `prev_hash`, `current_hash`, `signature` to `UNIPOST_RECORD_AUDIT_LOG`.
   - Update `RecordAuditLog` and `AuditVerificationResult` in `packages/client/src/contracts/metadata.ts`.
2. **Backend Engine**:
   - `AuditMerkleService`: SHA-256 forward-hash computation and windowed verification.
   - `AuditController`: REST endpoints `/api/v1/system/audit/records`, `/api/v1/system/audit/verify`, `/api/v1/system/audit/export`.
3. **Frontend Integration**:
   - `useHasPermission.ts` hook.
   - Wire permission checks with tooltips into `entity-data-grid.tsx`.
   - Build `/system/audit` with `@/components/data-table`, integrity badge, and compliance exporter.
   - Add Sovereign navigation item to `sidebar-data.ts`.
   - Register Unified Sandbox handlers for `/api/v1/system/audit`.

### Phase 2: Track B (Playwright E2E & WCAG 2.2 AA)
1. Expand `12-sovereign-rbac-matrix.spec.ts` for tenant role delegation, ad-hoc overrides, and disabled grid actions.
2. Create `13-sovereign-audit-studio.spec.ts` verifying audit ledger, integrity verification trigger, and compliance export.
3. Execute Axe Core WCAG 2.2 AA accessibility audit.

### Phase 3: Track A (Testcontainers Hardening)
1. Execute Liquibase migrations and rollback tests on PostgreSQL 16 Testcontainer.
2. Sliced tests for `AuditMerkleServiceIT` and `TenantRoleDelegationControllerIT`.
