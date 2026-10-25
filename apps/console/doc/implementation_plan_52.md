# Implementation Plan - Metadata SchemaBuilder & Metadata Management Module Modernization

## 1. Executive Summary & Investigation Findings

An in-depth architectural audit of the Metadata Management module in `@acc/console` revealed that the current implementation is an early-stage prototype with critical feature gaps, architectural violations, and incomplete backend integration:

### 1.1 Key Deficiencies Identified
1. **Architectural & Folder Structure Violations:**
   - Metadata code is scattered across `src/components/SchemaBuilder.tsx`, `EntityDataGrid.tsx`, `DynamicEntityEditor.tsx`, `DynamicFieldRenderer.tsx`, and `src/hooks/useMetadataApi.ts`, `useDynamicSchema.ts`, `useDynamicEntity.ts`.
   - Lacks a unified domain feature folder (`src/features/metadata/`) adhering to `@acc/console`'s feature architecture (`api/`, `components/`, `data/`, `store/`, `index.tsx`).
   - Route `src/routes/_authenticated/metadata/index.tsx` contains inline monolithic UI without `<Header>`, `<Main>`, breadcrumbs, search, or state isolation.
2. **SchemaBuilder Prototype Gaps (`SchemaBuilder.tsx`):**
   - Only 50 lines of static presentation.
   - Non-functional "Add Field" and "Trash2" delete buttons (no click handlers, no dialogs, no mutations).
   - No field edit sheet/dialog or attribute configuration panel.
   - Missing essential attribute attributes: `dataType` (`STRING`, `INTEGER`, `BOOLEAN`, `JSON`, `DATE`, `RELATIONSHIP`), system name auto-slugging/validation, default values, option builder for enums/selects, and archive toggling (`isArchived`).
   - No drag-and-drop or order indexing for schema field layout.
   - No live JSON Schema Draft-07 preview or synchronization check against backend compiler (`SchemaValidationService.java`).
3. **Dynamic Form & Field Rendering Deficiencies (`DynamicEntityEditor.tsx` & `DynamicFieldRenderer.tsx`):**
   - Relies on dummy mock fetchers in `useDynamicSchema.ts` and `useDynamicEntity.ts` rather than live backend endpoints.
   - Submit handler is a simple `console.log` stub.
   - Ignores `react-hook-form` and `zod` runtime validation; lacks dynamic schema compilation from attribute constraints.
   - Field renderer only supports `text`, `textarea`, and `select`. Missing `number`, `boolean/switch`, `date/calendar`, `multiselect`, `json/code`, and entity relation lookups.
4. **Data Explorer Limitations (`EntityDataGrid.tsx`):**
   - Basic TanStack table without server-side pagination, sorting, or search filtering.
   - Zero record CRUD operations: cannot create, edit, or delete entity records.
   - Unformatted cell values for non-primitive types.
5. **API & Data Client Incompleteness (`useMetadataApi.ts`):**
   - Uses raw, unauthenticated `axios.create()` rather than the shared authenticated `springApiClient` with JWT interceptors, silent refresh, and dev sandbox mocking.
   - Missing all mutations (`createEntityType`, `updateEntityType`, `deleteEntityType`, `createAttributeDefinition`, `updateAttributeDefinition`, `deleteAttributeDefinition`, `createEntityRecord`, `updateEntityRecord`, `deleteEntityRecord`).
   - Types are mostly `any`; missing TypeScript types mirroring Spring Modulith domain contracts (`EntityType`, `AttributeDefinition`, `EntityRecord`, `EntityRelationship`).
6. **Design Standards & Internationalization Gaps:**
   - Employs flat opaque gray/white backgrounds (`bg-gray-50/50`, `bg-white`) violating the mandatory **Liquid Glass** aesthetic (`backdrop-blur-xl`, frosted scrims, specular border tokens `border-white/30 dark:border-white/10`).
   - Hardcoded English strings; missing i18n keys in `apps/console/src/locales/{en,vi}/console.json` and missing route entries in `apps/console/ROUTE.md`.

---

## 2. Target Architecture & Module Design

The Metadata module will be restructured into a modular feature package at `apps/console/src/features/metadata/`:

```
apps/console/src/features/metadata/
├── api/
│   ├── metadata-api.ts             # React Query hooks for EntityTypes, Attributes, Records & Relationships
│   └── types.ts                    # Strong TS models for EntityType, AttributeDefinition, EntityRecord, etc.
├── components/
│   ├── entity-type/
│   │   ├── entity-type-sidebar.tsx # Frosted glass list with search & add button
│   │   ├── entity-type-dialog.tsx  # Create / Edit EntityType modal
│   │   └── entity-type-actions.tsx # Context dropdown (edit, delete, export schema)
│   ├── schema-builder/
│   │   ├── schema-builder.tsx      # Interactive canvas with drag/reorder, search, add field
│   │   ├── attribute-card.tsx      # Frosted glass card per field with badges & quick actions
│   │   ├── attribute-dialog.tsx    # Sheet/Dialog for field name, systemName, type, validation, options
│   │   ├── attribute-delete-dialog.tsx
│   │   └── schema-json-preview.tsx # Real-time Draft-07 JSON Schema modal
│   ├── data-explorer/
│   │   ├── entity-data-grid.tsx    # Paginated, sortable TanStack table with Liquid Glass styling
│   │   ├── record-editor-dialog.tsx# Dynamic modal with React Hook Form + Zod schema generator
│   │   ├── record-delete-dialog.tsx
│   │   └── data-table-toolbar.tsx  # Search, filter, export, and 'New Record' button
│   ├── dynamic-fields/
│   │   ├── dynamic-field-renderer.tsx # Dispatches to specific field component
│   │   ├── text-field.tsx
│   │   ├── number-field.tsx
│   │   ├── boolean-field.tsx
│   │   ├── date-field.tsx
│   │   ├── select-field.tsx
│   │   ├── json-field.tsx
│   │   └── relation-field.tsx
│   └── metadata-dialogs.tsx        # Centralized dialog manager
├── data/
│   ├── field-types.ts              # Supported UI components, data types, and default configs
│   ├── mock-metadata.ts            # Sandbox fallback data for offline/demo development
│   └── schema.ts                   # Zod schemas for forms
├── store/
│   └── use-metadata-ui-store.ts    # Zustand store: activeEntityTypeId, activeTab, modal states
└── index.tsx                       # Feature root wrapping Header + Main + Liquid Glass split view
```

---

## 3. Phased Implementation Roadmap

### Phase 1: Foundation, Types & Authenticated API Layer
- **Goal:** Establish domain types, wire endpoints to `springApiClient`, and support mock sandbox fallback.
- **Tasks:**
  1. Define full TypeScript models in `src/features/metadata/api/types.ts`:
     - `EntityType` (`id`, `name`, `systemName`, `description`, `createdDate`, `updatedDate`)
     - `AttributeDefinition` (`id`, `entityTypeId`, `name`, `systemName`, `dataType`, `uiComponent`, `isRequired`, `isArchived`, `options`, `defaultValue`)
     - `EntityRecord` (`id`, `entityTypeId`, `tenantId`, `attributes`, `createdDate`, `updatedDate`)
     - `DataType` (`STRING`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `DATE`, `DATETIME`, `JSON`, `RELATIONSHIP`)
     - `UiComponentType` (`text`, `textarea`, `number`, `switch`, `select`, `multiselect`, `datepicker`, `json_editor`, `relation_picker`)
  2. Implement React Query API hooks in `src/features/metadata/api/metadata-api.ts`:
     - EntityTypes: `useEntityTypes`, `useCreateEntityType`, `useUpdateEntityType`, `useDeleteEntityType`
     - Attributes: `useAttributeDefinitions`, `useCreateAttributeDefinition`, `useUpdateAttributeDefinition`, `useDeleteAttributeDefinition`
     - Records: `useEntityRecords`, `useCreateEntityRecord`, `useUpdateEntityRecord`, `useDeleteEntityRecord`
  3. Wire API to `springApiClient` (`/api/v1/metadata/...`) with sandbox mock support for dev mode.
  4. Create Zustand UI store (`use-metadata-ui-store.ts`) for modal open states, selected entity type ID, and active tab (`schema` vs `data`).

### Phase 2: Liquid Glass SchemaBuilder Redesign & Field Configurator
- **Goal:** Transform `SchemaBuilder` into an enterprise schema architect tool.
- **Tasks:**
  1. **Field Registry & Catalog (`field-types.ts`):**
     - Define component metadata: icon, friendly name, compatible data types, option schemas (choices, min, max, regex, relation entity type).
  2. **SchemaBuilder View (`schema-builder.tsx` & `attribute-card.tsx`):**
     - Liquid Glass card layout (`backdrop-blur-xl bg-white/45 dark:bg-slate-900/45 border border-white/30`).
     - Search & filter fields by name/systemName/type.
     - Attribute card displaying: Name, System Name pill, UI Component icon + badge, Required tag, Archived status, options summary.
     - Action buttons: Edit, Duplicate, Archive, Delete.
  3. **Attribute Dialog (`attribute-dialog.tsx`):**
     - Multi-tab or organized modal using `react-hook-form` + `zod`:
       - *General Tab:* Display Name, System Name (auto-slugged with custom override), Data Type, UI Component selector with visual preview.
       - *Validation Tab:* Required checkbox, Default value input, Min/Max limits, Regex pattern validator.
       - *Options Tab:* Dynamic key-value or item list builder for `select`/`multiselect` choices, or target EntityType picker for `relation`.
  4. **Delete & Archive Dialog (`attribute-delete-dialog.tsx`):**
     - Confirmation dialog with warning about existing records depending on the field.
  5. **Schema JSON Previewer (`schema-json-preview.tsx`):**
     - Client-side compile to JSON Schema Draft-07 (mirroring Spring `SchemaValidationService.java`) with copy-to-clipboard and syntax highlighting.

### Phase 3: Dynamic Form Engine & Custom Field Renderers
- **Goal:** Robust data creation and editing with schema validation.
- **Tasks:**
  1. **Dynamic Zod Schema Generator (`schema-generator.ts`):**
     - Function `buildZodSchema(attributes: AttributeDefinition[])` that converts attribute rules into a live `z.object({...})` validation schema.
  2. **Specialized Field Renderers (`dynamic-fields/*`):**
     - `text-field.tsx` & `textarea-field.tsx`: Clean inputs with character counts and floating labels.
     - `number-field.tsx`: Stepper controls, min/max guards.
     - `boolean-field.tsx`: Radix Switch with active status badges.
     - `date-field.tsx`: Calendar picker (`react-day-picker`) with ISO-8601 formatting.
     - `select-field.tsx` & `multiselect-field.tsx`: Radix Select & tag pills.
     - `json-field.tsx`: Monospace code block with JSON syntax validation.
     - `relation-field.tsx`: Async combobox querying target entity records.
  3. **Record Editor Dialog (`record-editor-dialog.tsx`):**
     - Modal rendering dynamic form fields with real-time error states, Reset button, and Submit mutation.

### Phase 4: Data Explorer & Entity Types Navigation Redesign
- **Goal:** High-density, interactive data exploration and entity management.
- **Tasks:**
  1. **Entity Type Sidebar (`entity-type-sidebar.tsx`):**
     - Search bar for quick filtering of entity models.
     - Liquid Glass frosted rail with count badges (e.g. `12 records`, `8 fields`).
     - "+ New Entity Type" button triggering `entity-type-dialog.tsx`.
  2. **Entity Data Grid Modernization (`entity-data-grid.tsx`):**
     - TanStack Table with dynamic columns generated from active `AttributeDefinition`s.
     - Server-side pagination controls (Page size selector: 10, 25, 50, 100; Next/Prev buttons).
     - Column sorting, global text search, column visibility toggle.
     - Row actions dropdown: Edit Record, View Raw JSON, Delete Record.
  3. **Bulk Actions & Export:**
     - Export records to JSON or CSV.

### Phase 5: Routing, Internationalization & Documentation
- **Goal:** Monorepo rule compliance, i18n parity, and living documentation synchronization.
- **Tasks:**
  1. Refactor `src/routes/_authenticated/metadata/index.tsx` to mount `src/features/metadata/index.tsx` with TanStack route search schema.
  2. Add translations to `apps/console/src/locales/en/console.json` and `apps/console/src/locales/vi/console.json` under namespace `metadata`:
     - Entity types, schema builder, field types, validation errors, dialog titles, actions.
     - Synchronize `sidebar.items.metadata` key in both locales.
  3. Update `apps/console/ROUTE.md` (add `/metadata` blueprint and route registry row).
  4. Update `apps/console/DESIGN.md` (document SchemaBuilder and Data Explorer Liquid Glass specs).
  5. Run linting and typecheck (`pnpm --filter @acc/console check-types` and `pnpm --filter @acc/console lint`).

---

## 4. Verification Plan

### Automated Checks
- `pnpm --filter @acc/console check-types`
- `pnpm --filter @acc/console lint`
- `pnpm --filter @acc/console build`

### Manual & Interactive Test Scenarios
1. **Entity Type Management:**
   - Create a new Entity Type (`Order`, `Customer`).
   - Edit name & description; verify changes reflect in sidebar.
2. **Schema Building:**
   - Add attributes across diverse types: `string` (Title), `number` (Price), `boolean` (IsActive), `date` (PlacedAt), `select` (Status: pending/fulfilled/cancelled).
   - Edit existing attribute; toggle `isRequired` on/off.
   - Open JSON Schema Preview; verify Draft-07 format matches backend compiler logic.
   - Delete an attribute; confirm dialog prompts for confirmation.
3. **Dynamic Form & Data Explorer:**
   - Open "New Record" dialog in Data Explorer; test validation triggers on required fields.
   - Save record; verify table re-fetches and displays new record row with properly formatted cells.
   - Edit existing record; verify fields pre-populate with current values and save successfully.
4. **Liquid Glass & Theme:**
   - Switch between Light and Dark mode; verify frosted glass translucency, specular borders, and text contrast compliance.
   - Switch language between English and Vietnamese; verify all labels dynamically localize.
