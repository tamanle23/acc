# Walkthrough 113: Console UI Master-Detail Expandable View & Composite Entity Sidebar Filtering

## 1. Overview & Problem Addressed
When accessing the `/metadata` route in `@acc/console` under offline development / Unified Sandbox mode:
1. The **"Console UI Master-Detail Expandable View"** was not readily discoverable because composite entities (such as `Customer 360 View`) were located on secondary pagination pages of the model rail.
2. Selecting a composite entity defaulted to the `'schema'` view (Schema Builder) rather than the `'data'` tab (Entity Data Grid) where record expansions live.
3. In `initialMockRecords`, child records in `resourceRecords` lacked foreign key values (`account_id`), and `initialMockAttributes` had no attribute definitions mapped for composite entities, resulting in empty grids and empty child collections.
4. Users lacked a fast filter to isolate composite entity models in the sidebar rail.

## 2. Changes Made

### 2.1 Unified Sandbox Mock Engine (`mock-metadata.ts` & `metadata-sandbox-adapter.ts`)
- **Composite Model Schema**: Enriched `customer-360-composite` in `initialMockEntityTypes` with root fields (`name`, `email`, `tier`), Pattern B foreign-key child collection (`cloud_resources` linked via `account_id`), and Pattern C association matrix collection (`policies` linked via `relationship_type_id: 1`).
- **Dynamic Attribute Fallback**: Added synthesis in `getAttributeDefinitions` and `getAttributeDefinition` so composite spec fields are automatically converted to `AttributeDefinition` entries if explicit attribute definitions are omitted.
- **Relational Data Linking**: Seeded `account_id` on compute and storage records (`2001-2050`) matching parent customer accounts (`1001-1050`).
- **Pattern C Graph Seeds**: Seeded 100 relationship edges in `initialMockEntityRelationships` linking customers (`1001-1050`) with compliance and security policies (`3001-3050`).
- **Route Filtering**: Supported `isComposite` query filtering in `/entity-types` GET route handler.

### 2.2 Entities Sidebar Rail (`entity-type-sidebar.tsx`)
- **Composite Entities Switch**: Added a high-affordance Liquid Glass `Switch` labeled "Composite Entities" with an active count badge `COMPOSITE (N)`.
- **Filtering Logic**: Toggling the switch filters the entity rail to only display composite models (`isComposite: true`).
- **Auto-Selection**: When enabled or when the active selection is filtered out, the rail auto-selects the first available composite entity (`Customer 360 View`).
- **Visual Badges**: Added an inline `COMPOSITE` badge to entity items in the list.

### 2.3 Data Explorer & Auto-Expansion (`metadata-feature.tsx` & `entity-data-grid.tsx`)
- **Auto Tab Switch**: In `MetadataFeature`, selecting any composite model automatically sets `activeTab` to `'data'`, immediately presenting the Record Explorer instead of Schema Builder.
- **Auto-Expanded Master-Detail Row**: In `EntityDataGrid`, when a composite entity is active, the first record (`records[0]`) is expanded by default on mount so the user immediately views the `CompositeMasterDetailRow` container.
- **Master-Detail Row Component**: Displays child tabs (`Cloud Resources`, `Policies`), micro-pagination, and `dynamic-sql-pushdown` badge with liquid glass styling.

## 3. Verification
- **Automated Tests**:
  - `src/features/metadata/components/entity-type/entity-type-sidebar.test.tsx`: 3 tests passing (renders models, shows composite count, filters on toggle).
  - `src/features/metadata/components/data-explorer/composite-master-detail-row.test.tsx`: 4 tests passing (Pattern B foreign key rendering, Pattern C association rendering, tab switching, empty state handling).
- **Type Checking**:
  - `pnpm --filter @acc/console exec tsc --noEmit` exited 0 with no errors.
