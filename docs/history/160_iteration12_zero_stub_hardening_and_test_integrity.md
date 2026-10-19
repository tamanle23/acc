# 160. Iteration 12: Zero-Stub Hardening, Hook Integrity & Multi-Tier Verification Fixes

**Date:** 2026-10-19  
**Status:** Complete  
**Scope:** `@unipost/console`, `@unipost/backend` (`unipost-fw`)  

---

## 1. Problem
During rigorous skeptical review of commit `eff4683` (Iteration 12), multiple critical issues were discovered:
1. **Failing Vitest Suite**: `a11y.test.tsx` crashed with `Error: No QueryClient set, use QueryClientProvider to set one` because `SearchProvider` rendered `CommandPalette`, which unconditionally invoked `useEntityTypes()` and TanStack Query without a QueryClient context check.
2. **React Hook Order Violation**: In `master-detail-row-inspector.tsx`, `useRecordAuditLogs` and `useRestoreRecordVersion` were called after an early `if (!record) return null;` condition, violating React's Rules of Hooks.
3. **WCAG & A11y Violations**: In `table-views-popover.tsx`, non-interactive clickable `div` elements with nested `button` elements were used for preset selection, triggering `jsx-a11y` errors, along with disallowed `autoFocus`.
4. **Swallowed Exceptions in Backend**: In `JestRepository.java`, 6 methods (`deleteByQuery`, `partiallyUpdate(ID, Map)`, `partiallyUpdate(ID, T)`, `partiallyUpdate(Map)`, `partiallyUpdateMap`, and `search`) caught `IOException` and returned `false`/empty without throwing `ElasticsearchOperationException`.
5. **Silent Event Loss in Outbox**: In `RecordMutationPipeline.java`, `applicationEventPublisher` was an unannotated setter without Spring injection or `ApplicationEventPublisherAware`, causing all dynamic entity mutation outbox events to be silently dropped in production runtime.

---

## 2. Plan
1. Make `CommandPalette` defensive against missing `QueryClientProvider` via `QueryClientContext` guard, and isolate entity queries in a dedicated sub-component.
2. Fix hook ordering in `MasterDetailRowInspector` by moving hooks to the top level before conditional branch logic.
3. Replace accessible buttons for preset items in `table-views-popover.tsx`, remove `autoFocus`, and clean ESLint rules across touched Phase 1-5 console files.
4. Replace all 6 swallowed `IOException` blocks in `JestRepository.java` with `ElasticsearchOperationException`.
5. Implement `ApplicationEventPublisherAware` in `RecordMutationPipeline.java` and add unit test verifying event publication on record mutations.
6. Re-run complete backend (`mvn test`) and console (`vitest run`, `eslint`) test suites.

---

## 3. Changes Made

### Frontend (`@unipost/console`)
- `apps/console/src/components/command-palette/command-palette.tsx`: Added `QueryClientContext` check, moved entity queries into `CommandPaletteEntitySection`, cleaned unused imports, removed any types.
- `apps/console/src/components/__tests__/a11y.test.tsx`: Added `CommandPalette` mock alongside `CommandMenu`.
- `apps/console/src/features/metadata/components/data-explorer/master-detail-row-inspector.tsx`: Hoisted React hooks above early return, replaced `any` types with strict types, removed unused icon imports.
- `apps/console/src/features/metadata/components/data-explorer/table-views-popover.tsx`: Standardized preset list items with accessible button primitives and aria-labels, removed `autoFocus`, cleaned unused imports.
- `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`: Removed unused imports/parameters, cleaned scroll region accessibility.
- `apps/console/src/features/metadata/components/data-explorer/query-builder/dynamic-query-builder.tsx`: Removed unused `Layers` import.
- `apps/console/src/features/workflows/approvals/approvals-inbox.tsx`: Removed `console.warn` and synchronous `setSseConnected` call in catch block.
- `apps/console/src/features/workflows/approvals/__tests__/approvals-inbox.test.tsx`: Removed unused `vi` import.

### Backend (`@unipost/backend`)
- `apps/backend/unipost-fw/src/main/java/com/unipost/cache/jest/JestRepository.java`: Replaced all 6 swallowed `IOException` catch blocks with `ElasticsearchOperationException`.
- `apps/backend/unipost-fw/src/main/java/com/unipost/service/RecordMutationPipeline.java`: Implemented `ApplicationEventPublisherAware` and annotated `setApplicationEventPublisher` with `@Autowired(required = false)`.
- `apps/backend/unipost-fw/src/test/java/com/unipost/service/RecordMutationPipelineTest.java`: Added unit test `testApplicationEventPublisher_FiresMutationEventOnCreate` asserting event publication on entity mutation.

---

## 4. Verification Record
- **Console Unit Suites**: `pnpm --filter @unipost/console test:run` -> **70 files passed, 324 tests passed (100% pass)**.
- **Console ESLint**: `npx eslint ...` on all touched files -> **0 errors**.
- **Backend Test Suite**: `node mvnw.cjs -pl unipost-fw test` -> **326 tests run, 0 failures, 0 errors**.
- **RecordMutationPipeline Tests**: `RecordMutationPipelineTest` -> **19 tests run, 0 failures, 0 errors**.
