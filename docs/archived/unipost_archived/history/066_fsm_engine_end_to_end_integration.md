# 066: End-to-End Dynamic FSM Engine Integration & Active UI Execution

## 1. Problem Statement
While Phase 22 implemented the Visual Schema Studio & FSM Workflow Designer in `@acc/console` and backend had an underlying 5-Gate Sequential Validation Engine (`EntityLifecycleService`), they were not fully wired end-to-end:
1. Console metadata client lacked full support for executing state transitions (`transitionRecordState`) from the live record data grid (`EntityDataGrid`).
2. Type definitions for `EntityType` in `@acc/client` did not include the `LifecycleConfig` and `TransitionConfig` fields.
3. No formal backend integration test exercised `MetadataService.transitionRecordState` against real production classes, SpEL guard evaluation, and transactional outbox event emission, violating the `ZERO-STUB-PROHIBITION` rule.
4. Transitions defined in the Studio needed an active execution path in the UI without leaving any orphaned or disconnected code (`NO-ORPHANED-CODE`).

## 2. Implementation Plan
1. **Schema & Client Types**: Update `packages/client/src/types.ts` to expose `LifecycleConfig` and `TransitionConfig` interfaces and type `EntityType.lifecycleConfig`.
2. **Metadata API & Query Hooks**: Ensure `transitionRecordState` is implemented in `MetadataDataSource`, `HttpMetadataService`, `MetadataService`, and exposed via `useTransitionEntityRecord` mutation hook with query invalidation for `entity-records`.
3. **Data Grid UI Wiring**: In `EntityDataGrid` (`apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`):
   - Dynamically inspect `entityType.lifecycleConfig` for the current row's state.
   - Render available transitions in a dedicated "FSM Transition" sub-menu in the row actions dropdown.
   - Wire each transition item to `handleRecordTransition` invoking `transitionMutation.mutateAsync` with real toast feedback.
4. **Backend Integration Testing**: Author `EntityLifecycleFsmIntegrationTest` in `apps/backend/acc-fw/src/test/java/com/acc/service/workflow/` testing:
   - Happy-path 5-Gate transition pipeline mutating state, bumping schema version, publishing Spring domain `EntityStateChangedEvent`, and publishing transactional outbox `RECORD_TRANSITIONED` events.
   - SpEL guard gate violation resulting in `MetadataConflictException` and transaction abort.
   - Missing mandatory required attribute violation resulting in `MetadataConflictException`.
5. **Verification**: Run Maven surefire tests and Vitest suites to guarantee zero regression.

## 3. Changes
- **Client Package**:
  - [`packages/client/src/types.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/client/src/types.ts): Added `TransitionConfig`, `LifecycleConfig`, and wired `lifecycleConfig?: LifecycleConfig` into `EntityType`.
- **Console Feature - Metadata**:
  - [`apps/console/src/features/metadata/api/metadata-data-source.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/metadata-data-source.ts): Added `transitionRecordState` contract.
  - [`apps/console/src/features/metadata/api/http-metadata-service.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/http-metadata-service.ts): Implemented `transitionRecordState` posting to `/api/v1/metadata/entity-types/{entityTypeId}/records/{recordId}/transition?action={action}`.
  - [`apps/console/src/features/metadata/api/metadata-service.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/metadata-service.ts): Delegated `transitionRecordState` through to data source.
  - [`apps/console/src/features/metadata/api/metadata-api.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/metadata-api.ts): Added `useTransitionEntityRecord` mutation hook invalidating `entity-records` queries.
  - [`apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx): Integrated transition mutation and dynamic FSM transition menu items in row action dropdown with Sonner toast feedback.
- **Backend Framework**:
  - [`apps/backend/acc-fw/src/test/java/com/acc/service/workflow/EntityLifecycleFsmIntegrationTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/test/java/com/acc/service/workflow/EntityLifecycleFsmIntegrationTest.java): Created formal integration test verifying real `MetadataService`, real `EntityLifecycleService`, real `SpelGuardEvaluator`, and event publishers.

## 4. Verification
1. **Backend Tests**:
   - `.\mvnw.cmd test -pl acc-fw -Dtest=EntityLifecycleServiceTest`: 7/7 tests passed.
   - `.\mvnw.cmd test -pl acc-fw -Dtest=EntityLifecycleFsmIntegrationTest`: 3/3 tests passed.
2. **Console Tests**:
   - `pnpm --filter @acc/client check-types`: 0 type errors.
   - `pnpm --filter @acc/console test src/features/metadata`: 9 test files passed, 51/51 tests passed.
3. **Invariants Enforced**:
   - `ZERO-STUB-PROHIBITION`: Real SpEL evaluation and state transition logic exercised.
   - `NO-ORPHANED-CODE`: FSM transition actions directly usable from `EntityDataGrid`.

## 5. Walkthrough
1. When viewing dynamic records in `EntityDataGrid`, if the entity type has `lifecycleConfig`, each row evaluates its current state (`record.attributes[stateField] || 'DRAFT'`).
2. The row actions menu computes available transitions matching `t.from === currentState || t.from === '*'`.
3. Clicking a transition action triggers `useTransitionEntityRecord`, calling the backend transition endpoint with optimistic query invalidation and toast alerts.
