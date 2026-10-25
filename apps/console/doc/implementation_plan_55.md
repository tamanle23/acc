# Implementation Plan 55 - Metadata Workspace Tabs Architecture, URL Synchronization & State Preservation

Scope: `@acc/console` (Metadata Feature, Router, Zustand Store, EntityDataGrid).

---

## 1. Executive Summary & Problem Analysis

In `@acc/console`, the active entity model workspace contains three core tabs:
1. **Schema Builder** (`schema`)
2. **Data Explorer** (`data`)
3. **Connected Edges** (`relationships`)

While functional, the current tab implementation faces three critical usability and architectural limitations:

### A. Viewport Squeezing & Mobile Tab Crushing
- **Issue**: The `<TabsList>` is currently rendered as an inline child (`shrink-0`) of the top model banner.
- **Flaws on Smaller Screens**:
  - When the screen width narrows or when an entity model has a long title and description, the tabs fight for horizontal space with the title text.
  - On mobile devices, the tab list can get cramped or push the title off-screen.
- **Target Resolution**: Re-architect the tab container into an adaptive, responsive tab bar:
  - On mobile (`< sm`): Renders as a full-width auto-balanced grid (`w-full grid grid-cols-3 p-1`) or horizontal scrollable pill bar, placed either underneath the title or as a dedicated sticky sub-header.
  - On tablet & desktop (`sm+`): Aligns cleanly alongside or below the model banner as an inline pill group with glassmorphic styling.

### B. Lack of URL Query Parameter Synchronization (Deep Linking & Browser History)
- **Issue**: The current route search schema in `routes/_authenticated/metadata/index.tsx` only defines `tab: z.enum(['schema', 'data']).optional()`, missing `'relationships'`. Furthermore, the active tab and selected model ID in `useMetadataUiStore` are stored purely in memory and do not synchronize with the URL.
- **Impact**:
  - Refreshing the browser resets the view back to the default tab and model.
  - Users cannot bookmark or share links to specific views (e.g. `https://app.acc.io/metadata?model=ent_deployment_policy&tab=relationships`).
  - Browser Back/Forward buttons do not navigate through previously viewed tabs or models.
- **Target Resolution**:
  - Update `metadataSearchSchema` in TanStack Router to accept `tab: z.enum(['schema', 'data', 'relationships'])` and `model: z.string()`.
  - Implement bidirectional synchronization between TanStack Router search params and `useMetadataUiStore`.

### C. State Loss on Tab Switching (Keep-Alive / Filter Persistence)
- **Issue**: When switching between tabs (e.g. from *Data Explorer* to *Schema Builder* and back to *Data Explorer*), `EntityDataGrid` unmounts completely, resetting:
  - Search filter input (`searchFilter`)
  - Active page number (`page`)
  - Page size (`pageSize`)
  - Active column sort field & direction (`sortField`, `sortDirection`)
- **Impact**: Frustrating experience when users need to check a schema attribute and return to their filtered dataset.
- **Target Resolution**:
  - Lift the grid filter and pagination state for the active model into `useMetadataUiStore` (or retain per-model grid state in the store).
  - When returning to the *Data Explorer* tab, the grid instantly resumes with the user's previously active search filter, page number, and sort order.

---

## 2. Technical Architecture & Component Changes

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 URL Search Params                                      │
│                 (?model=ent_customer_account&tab=data&q=Acme)                          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Bidirectional Sync
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                useMetadataUiStore                                      │
│  - selectedEntityTypeId: string                                                        │
│  - activeTab: 'schema' | 'data' | 'relationships'                                      │
│  - gridStateByModel: Record<modelId, { search, page, pageSize, sortField, sortDir }>   │
└─────────────────────┬─────────────────────┼─────────────────────┬──────────────────────┘
                      │                     │                     │
                      ▼                     ▼                     ▼
             [ Adaptive TabsList ]   [ SchemaBuilder ]    [ EntityDataGrid ]
            - Mobile: grid-cols-3                         - Restores search & page
            - Desktop: inline-flex                        - Auto-syncs state on change
```

### File Deliverables

#### 1. Router Search Schema (`apps/console/src/routes/_authenticated/metadata/index.tsx`)
- Update `metadataSearchSchema`:
  ```ts
  const metadataSearchSchema = z.object({
    model: z.string().optional(),
    tab: z.enum(['schema', 'data', 'relationships']).optional(),
  });
  ```

#### 2. Zustand Store Extension (`apps/console/src/features/metadata/store/use-metadata-ui-store.ts`)
- Add `gridStateByModel: Record<string, GridState>` with getter and updater methods:
  - `setGridState(modelId, partialState)`
  - `getGridState(modelId)`
- Retain search filter, page, pageSize, and sort preferences per entity model.

#### 3. Metadata Feature Adaptive Tab Header (`apps/console/src/features/metadata/components/metadata-feature.tsx`)
- Implement bidirectional URL search param sync using TanStack Router's `useSearch()` and `useNavigate({ search: ... })`.
- Separate the model title banner from the tab switcher when on small viewports:
  - Make `<TabsList>` full width on mobile (`w-full grid grid-cols-3 sm:w-auto sm:inline-flex`).
  - Add smooth transition indicators and responsive layout padding.

#### 4. EntityDataGrid State Binding (`apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`)
- Bind `searchFilter`, `page`, `pageSize`, `sortField`, and `sortDirection` to the model's persisted state in `useMetadataUiStore`.
- Switching between *Schema Builder*, *Data Explorer*, and *Connected Edges* preserves existing query filters and pagination without resetting to page 1.

---

## 3. Step-by-Step Implementation Roadmap

1. **Step 1: Router Schema & Route Alignment**
   - Update `apps/console/src/routes/_authenticated/metadata/index.tsx` to validate `tab: 'schema' | 'data' | 'relationships'` and `model: string`.
2. **Step 2: Store Grid State Persistence**
   - Add `gridStateByModel` to `useMetadataUiStore` to cache data grid preferences (search, sorting, pagination) by entity model ID.
3. **Step 3: Responsive Tab Bar Redesign in `MetadataFeature`**
   - Refactor tab layout to be fully responsive: stacks as a full-width 3-column pill bar on mobile, and an elegant right-aligned or standalone pill group on desktop.
4. **Step 4: URL Search Param Synchronization**
   - Sync `selectedEntityTypeId` and `activeTab` with TanStack Router query parameters.
   - Support browser Back/Forward buttons and deep-linking directly into any tab.
5. **Step 5: Grid State Restoration in `EntityDataGrid`**
   - Initialize and save grid state (page, search, sort) to the store per model, providing seamless keep-alive behavior when toggling tabs.

---

## 4. Verification & Acceptance Criteria

1. **Type & Build Verification**:
   - `pnpm --filter @acc/console build` compiles cleanly with zero TypeScript or Vite bundle errors.
2. **Automated Unit & Flow Tests**:
   - `pnpm --filter @acc/console test` passes all tests with new test cases covering:
     - URL search param serialization and tab switching.
     - Grid state preservation across tab switches.
3. **Mobile & Desktop Responsiveness**:
   - At `< 640px` (mobile viewport), the 3 tabs expand to fill 100% width cleanly (`grid-cols-3`) without clipping or horizontal overflow.
   - At `>= 640px` (desktop viewport), tabs sit neatly beside/below the model header with Liquid Glass styling.
4. **Deep-linking & Navigation**:
   - Navigating to `/metadata?model=3&tab=relationships` automatically selects model `#3` and opens the *Connected Edges* tab.
   - Clicking between tabs updates the URL query parameter without page reload.
   - Browser back button successfully returns to the previously active tab.
