# History Log 130: Automated Testing Phase 3 - Console & Sandbox >=90% Coverage Sprint

## Problem
In Phase 3 of the testing master plan ([`docs/integration_master_plan_iteration7.md`](../integration_master_plan_iteration7.md)), the client and simulation layers required comprehensive unit and component integration testing:
1. `@unipost/sandbox` lacked formal test suites covering all mock domain handlers, interceptor adapters, store manager, and reset registry, and had no automated coverage threshold enforcement.
2. `@unipost/console` lacked unit tests for core store layers (`useMetadataUiStore`, `useSpringAuthStore`) and component integration tests for critical workflow and schema views (`record-editor-dialog`, `composite-rollup-builder`, `schema-builder`, `entity-data-grid`).
3. Running test suites surfaced a subtle infinite re-render loop in `visual-dag-studio.tsx` due to unmemoized workflow version calculations.

## Plan
1. **Fix Production Bug**: Memoize `workflowVersions` in `visual-dag-studio.tsx` and guard `setNodes` inside the diff status `useEffect`.
2. **`@unipost/sandbox` Unit Suites & Threshold Gates**:
   - Write comprehensive unit tests for all domain handlers, repositories, interceptor adapters, and store manager.
   - Configure `@vitest/coverage-v8` in `packages/sandbox/vitest.config.ts` with hard thresholds: lines 90%, statements 90%, functions 90%, branches 70%.
3. **`@unipost/console` Unit & Integration Suites**:
   - Write unit tests for `use-metadata-ui-store.ts` and `use-spring-auth-store.ts`.
   - Write integration tests for `record-editor-dialog.tsx`, `composite-rollup-builder.tsx`, `schema-builder.tsx`, and `entity-data-grid.tsx`.
   - Verify all 62 test files in `apps/console` pass cleanly.
4. **Archival & Commit**: Write `apps/console/doc/walkthrough_118.md`, record history in `docs/history/130_*.md`, update index, and stage/commit.

## Changes
- **`apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`**: Memoized `workflowVersions` and guarded `setNodes` against no-op diff updates to prevent infinite render cycles.
- **`packages/sandbox/vitest.config.ts`**: Configured `@vitest/coverage-v8` with 90% lines, statements, functions, and 70% branch thresholds.
- **`packages/sandbox/src/handlers/users-sandbox-handler.ts`**: Enhanced `UsersSandboxRepository.create` to auto-generate identifiers and timestamps if omitted.
- **`packages/sandbox/src/__tests__/sandbox-core.test.ts`**: Added tests for JWT decoding, expiration buffering, simulation decorators, reset registry, store manager, registry priority/clear, and axios/fetch interceptors.
- **`packages/sandbox/src/__tests__/sandbox-engine.test.ts`**: Added coverage for getters, active persona, and `isDev` production guard.
- **`packages/sandbox/src/handlers/__tests__/`**: Added complete suites for `auth-sandbox-handler`, `billing-sandbox-handler`, `dlq-sandbox-handler`, `workflow-sandbox-handler`, `system-workspace-users`, and `apps-chats-widgets`.
- **`apps/console/src/features/metadata/store/__tests__/use-metadata-ui-store.test.ts`**: Added 13 tests for multi-tenancy, RBAC guards, tab fallbacks, per-model grid state preservation, and 8 dialog lifecycles.
- **`apps/console/src/features/spring-auth/__tests__/use-spring-auth-store.test.ts`**: Added 6 tests for JWT decoding, session persistence, token expiration, hydration flags, and logout.
- **`apps/console/src/features/metadata/components/data-explorer/__tests__/record-editor-dialog.test.tsx`**: Added 4 integration tests for create/edit modes, schema form validation, dry-run checks, and OCC versioning.
- **`apps/console/src/features/metadata/components/studio/composite/__tests__/composite-rollup-builder.test.tsx`**: Added 3 integration tests for empty state, adding rollup with defaults, updating functions/fields, and removal.
- **`apps/console/src/features/metadata/components/schema-builder/__tests__/schema-builder.test.tsx`**: Added 6 integration tests for loading state, schema header, field quotas, search filtering, visual studio mode toggle, and dialog triggers.
- **`apps/console/src/features/metadata/components/data-explorer/__tests__/entity-data-grid.test.tsx`**: Added 4 integration tests for record cells, search input, "New Record" dialog trigger, and schema drift warnings.

## Verification
1. `pnpm --filter @unipost/sandbox test:coverage`:
   - Statements: 91.65% ($\ge 90\%$)
   - Functions: 93.60% ($\ge 90\%$)
   - Lines: 91.65% ($\ge 90\%$)
   - Branches: 72.78% ($\ge 70\%$)
   - 94 tests in 9 files, 100% passed with hard gate satisfied.
2. `pnpm --filter @unipost/console test`:
   - 296 tests across 62 test files, 100% passed in under 12s.
3. `pnpm --filter @unipost/console check-types` & `pnpm --filter @unipost/sandbox check-types`: Clean typechecks.

## Tasks
- [x] Fix visual DAG studio infinite re-render loop
- [x] Build comprehensive test suites across all `@unipost/sandbox` domain handlers
- [x] Configure Vitest v8 90% hard gate in `packages/sandbox/vitest.config.ts`
- [x] Build store unit tests for `useMetadataUiStore` and `useSpringAuthStore`
- [x] Build component integration tests for `record-editor-dialog`, `composite-rollup-builder`, `schema-builder`, and `entity-data-grid`
- [x] Verify all 390 tests pass cleanly across console and sandbox packages
- [x] Write paired walkthrough artifact and history log

## Enhancement
Phase 4 will implement the complete 10-spec suite of Golden E2E Browser Journeys (`apps/console/e2e/`) with AxeBuilder WCAG 2.2 AA audits.
