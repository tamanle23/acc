# 068: Unified Sandbox FSM Engine Simulation & Active UI Execution

## 1. Problem Statement
With the backend FSM Transition Engine implemented and wired into `@unipost/console`'s `EntityDataGrid`, running the application in **Unified Sandbox Mode** (`VITE_ENABLE_SANDBOX=true` / `pnpm dev:sandbox`) resulted in unhandled 404/400 errors when attempting state transitions on mock records.
Specifically:
1. `metadataSandboxAdapter` lacked a route handler for `POST /entity-types/{id}/records/{recordId}/transition`.
2. `mockMetadataStore` had no `transitionRecordState` method to evaluate lifecycle state transitions.
3. Pre-seeded entity models (such as `Customer Account`) lacked a default `lifecycleConfig` and `status` attribute in mock memory, preventing the UI from computing and displaying transition dropdown actions in `EntityDataGrid`.
4. Role-based transitions in sandbox mode did not respect the active sandbox persona (`admin`, `creator`, `user`, etc.).

## 2. Implementation Plan
1. **Mock Entity Model Lifecycle Seeding**:
   - Update `Customer Account` (`id: '1'`) in `initialMockEntityTypes` with a full production-grade `lifecycleConfig`:
     - States: `['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'SUSPENDED']`.
     - Transitions: `SUBMIT`, `APPROVE` (restricted to `ROLE_ADMIN`, `ROLE_SYSTEM_CUSTODIAN`), `ACTIVATE`, `SUSPEND`, `REACTIVATE`.
   - Add `status` attribute definition to `initialMockAttributes['1']` and populate initial customer records with lifecycle statuses (`DRAFT`, `SUBMITTED`, etc.).
2. **Mock State Machine Implementation**:
   - Implement `MockMetadataService.transitionRecordState(entityTypeId, recordId, action, additionalAttributes)` mirroring backend's 5-Gate Sequential Validation Engine:
     - **Gate 2 (Graph Validity)**: Validates `matchedTransition` against `from` state or wildcard `*`.
     - **Gate 3 (Persona Authority)**: Reads `activePersonaId` from `useSandboxStore`, checks caller roles against `allowed_roles`, throwing HTTP 403 on permission violation.
     - **Gate 4 (Required Attributes)**: Ensures mandatory fields are populated.
     - **Gate 5 (Dynamic Guards)**: Evaluates SpEL/JS expressions against record attributes.
     - **State Mutation**: Updates state attribute, bumps record version, and persists updated timestamps.
3. **Sandbox Route Adapter**:
   - In `metadataSandboxAdapter` (`apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts`), handle `POST /entity-types/:typeId/records/:recordId/transition`.
4. **Stateful In-Memory Reset**:
   - Ensure `mockMetadataStore.resetToInitialState()` cleans and restores pristine FSM lifecycle configs when triggered from `SandboxDock`.
5. **Verification**:
   - Add comprehensive tests in `metadata-workflows.test.ts` (Workflow 6) testing valid transitions, invalid transitions, and role rejection based on persona switching.

## 3. Changes
- **Mock Metadata Store**:
   - [`apps/console/src/features/metadata/data/mock-metadata.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/data/mock-metadata.ts):
     - Added `lifecycleConfig` to `Customer Account`.
     - Added `status` attribute definition and initialized initial customer records with state.
     - Implemented `transitionRecordState` with full 5-Gate validation and persona awareness.
- **Sandbox Adapter**:
   - [`apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts):
     - Routed `/entity-types/:typeId/records/:recordId/transition` to `mockMetadataStore.transitionRecordState`.
- **E2E Workflow Testing**:
   - [`apps/console/src/features/metadata/__tests__/metadata-workflows.test.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/__tests__/metadata-workflows.test.ts):
     - Added `Workflow 6: Unified Sandbox FSM State Machine Transition Engine` suite.

## 4. Verification
- `pnpm --filter @unipost/console test src/features/metadata`: **9/9 test files passed, 54/54 tests passed** (including the 3 new FSM transition and persona authority tests).
- Verified that switching personas from `user` to `admin` in `useSandboxStore` dynamically gates transition execution.
