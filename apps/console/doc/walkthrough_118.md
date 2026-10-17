# Walkthrough 118: Phase 3 Console & Sandbox >=90% Coverage Sprint

## Executive Overview
Under the `/goal` directive for **Phase 3** of the testing master plan ([`docs/integration_master_plan_iteration7.md`](../../../docs/integration_master_plan_iteration7.md)), we implemented comprehensive unit and component integration test suites across `@unipost/sandbox` (`packages/sandbox`) and `@unipost/console` (`apps/console`), enforced automated coverage verification gates, and resolved production infinite-loop and contract regressions discovered during test execution.

---

## 1. Key Accomplishments

### A. `@unipost/sandbox` (100% Domain Handlers & Hard 90% Gate)
1. **Configured Vitest V8 Coverage & Hard Gate**:
   - Integrated `@vitest/coverage-v8` in `packages/sandbox/vitest.config.ts`.
   - Set hard failure thresholds:
     ```ts
     thresholds: {
       lines: 90,
       functions: 90,
       statements: 90,
       branches: 70,
     }
     ```
2. **Comprehensive Test Suites**:
   - `src/__tests__/sandbox-core.test.ts`: JWT decoding, buffer expiration, simulation decorator fault injection/latency, `SandboxResetRegistry`, `SandboxStoreManager`, `SandboxRegistry` priority and clear, Axios and Fetch interceptor adapters.
   - `src/__tests__/sandbox-engine.test.ts`: Request dispatching, getters, persona resolution, and `isDev` production guard.
   - `src/handlers/__tests__/auth-sandbox-handler.test.ts`: Login, token refresh, logout, persona decoding, and RBAC authorization.
   - `src/handlers/__tests__/billing-sandbox-handler.test.ts`: VietQR PayOS generation, subscription overrides, and telemetry.
   - `src/handlers/__tests__/dlq-sandbox-handler.test.ts`: Poison task injection, fleet aggregation, re-drive, and discard.
   - `src/handlers/__tests__/workflow-sandbox-handler.test.ts`: Catalog CRUD, execution units, approvals (claim, unclaim, resolve), hot migration dry-run and batch execution, tamper-evident hash chain verification.
   - `src/handlers/__tests__/system-workspace-users.test.ts`: Fleet tenants, assume-tenant tokens, RBAC permissions, workspaces lifecycle, and users CRUD.
   - `src/handlers/__tests__/apps-chats-widgets.test.ts`: Integrations OAuth, chat conversations, barcode lookup, reverse geocoding, and signature verification.
3. **Coverage Verification**:
   - **Statements: 91.65%** ($\ge 90\%$)
   - **Functions: 93.60%** ($\ge 90\%$)
   - **Lines: 91.65%** ($\ge 90\%$)
   - **Branches: 72.78%** ($\ge 70\%$)
   - **94 tests in 9 files**, 100% green passing!

---

### B. `@unipost/console` (Store & Component Integration Testing)
1. **Critical Infinite Loop Bug Discovered & Fixed**:
   - Location: `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`.
   - Cause: Unmemoized `workflowVersions` calculation combined with un-guarded `setNodes` inside the version diff overlay `useEffect`.
   - Fix: Memoized `workflowVersions = useMemo(...)` and added identity guard `if (!nds.some(n => n.data.diffStatus !== undefined)) return nds;`.
2. **Store Unit Test Suites**:
   - `src/features/metadata/store/__tests__/use-metadata-ui-store.test.ts`: 13 tests covering multi-tenancy context, RBAC restrictions, tab fallbacks, per-model data grid state preservation, and 8 dialog open/close lifecycles.
   - `src/features/spring-auth/__tests__/use-spring-auth-store.test.ts`: 6 tests covering JWT decoding, session persistence, token expiration, hydration flags, and logout.
3. **Component Integration Test Suites**:
   - `src/features/metadata/components/data-explorer/__tests__/record-editor-dialog.test.tsx`: Create mode, schema dynamic form validation, server-authoritative dry-run validation, edit mode with OCC versioning.
   - `src/features/metadata/components/studio/composite/__tests__/composite-rollup-builder.test.tsx`: Empty state when children missing, empty rollups state, adding rollup with defaults, updating alias/function/field, removing rollups.
   - `src/features/metadata/components/schema-builder/__tests__/schema-builder.test.tsx`: Loading state, schema header, field quota badge, search filtering, visual studio mode toggle, dialog triggers.
   - `src/features/metadata/components/data-explorer/__tests__/entity-data-grid.test.tsx`: Row attribute rendering, search input, "New Record" dialog trigger, and schema drift warning.
4. **Console Test Suite Status**:
   - **296 tests across 62 test files**, all 100% passing.
   - Store & core feature coverage: `features/metadata/store` (96.47%), `features/spring-auth/store` (100%), `features/metadata/components/studio/composite/composite-rollup-builder.tsx` (91.3%), `features/settings` (100%).

---

## 2. Verification Command Summary
```bash
# Verify @unipost/sandbox with 90% hard gate
pnpm --filter @unipost/sandbox test:coverage

# Verify @unipost/console test suite
pnpm --filter @unipost/console test
```
All suites pass with 0 failures.
