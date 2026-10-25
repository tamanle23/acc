# Walkthrough 53: Console Metadata Service Strategy & Mock Engine Enhancement (Phase 2)

## Overview
Implemented the **Strategy Pattern** for the Metadata Management module in `@acc/console`. This decouples the UI from the underlying transport mechanism, enabling smooth switching between direct backend communication (`HttpMetadataService`) and the local-first sandbox engine (`MockMetadataService`), while upgrading models to support versioning, schema version tracking, Draft-07 schema generation, and entity relationships.

## Changes Made

### 1. DTO & Model Synchronization
- **File**: [`apps/console/src/features/metadata/api/types.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/types.ts)
- Added `version?: number` and `schemaVersion?: number` to `EntityType`, `AttributeDefinition`, and `EntityRecord`.
- Defined `RelationshipType`, `EntityRelationship`, and `CompiledSchema` models.
- Defined DTOs for relationship CRUD operations (`CreateRelationshipTypeDto`, `UpdateRelationshipTypeDto`, `CreateEntityRelationshipDto`) and extended `PageRequestParams` with filtering, sorting, and relationship traversal directions (`incoming` | `outgoing` | `both`).

### 2. Strategy Pattern Contract
- **File**: [`apps/console/src/features/metadata/api/metadata-data-source.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/metadata-data-source.ts)
- Established `MetadataDataSource` interface covering all metadata features:
  - Entity types, attributes, records, relationship types, and entity relationships CRUD.
  - Attribute archival, unarchival, and reordering.
  - Server-side compiled schema fetching.

### 3. Concrete Implementations & Strategy Dispatcher
- **HttpMetadataService**: [`apps/console/src/features/metadata/api/http-metadata-service.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/http-metadata-service.ts)
  - Connects directly to backend endpoints (`/v1/metadata/...`) without silencing HTTP errors, allowing standard 400/404/409 error propagation.
- **MockMetadataService**: [`apps/console/src/features/metadata/data/mock-metadata.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/data/mock-metadata.ts)
  - Upgraded sandbox store with optimistic locking conflict detection (throwing 409 status on mismatched versions), schema compilation to Draft-07 format, attribute display ordering, and in-memory relationship stores.
- **MetadataServiceStrategy**: [`apps/console/src/features/metadata/api/metadata-service.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/metadata-service.ts)
  - Seamlessly routes all calls to either `HttpMetadataService` or `MockMetadataService` dynamically based on configuration.

### 4. React Query Hook Integration
- **File**: [`apps/console/src/features/metadata/api/metadata-api.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/metadata-api.ts)
- Refactored all query and mutation hooks (`useEntityTypes`, `useCompiledSchema`, `useCreateAttributeDefinition`, `useRelationshipTypes`, `useRecordRelationships`, etc.) to delegate to `metadataService`.
- Fixed mutation signatures across consumer dialogs like [`AttributeDeleteDialog`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/schema-builder/attribute-delete-dialog.tsx).

## Verification Results
- `pnpm --filter @acc/console build`: **SUCCESS** (TypeScript compilation and Vite production bundles created cleanly without errors).

## Phase 3: Console Schema Preview & Optimistic Locking

### Schema preview
- [`schema-json-preview.tsx`](file:///C:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/schema-builder/schema-json-preview.tsx) now shows the backend's compiled schema via `useCompiledSchema` (`GET /v1/metadata/entity-types/{id}/schema`) with a `schemaVersion` badge. It fetches only while the dialog is open. The client-side compiler was removed.
- `schema-builder.tsx` passes `entityTypeId` instead of `attributes`.

### Optimistic locking (409)
- New [`conflict-banner.tsx`](file:///C:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/conflict-banner.tsx): `isConflictError` (axios `response.status` or mock `status` 409) and `ConflictBanner` ("This record has been modified by another user. Please reload the latest changes." plus a Refresh button).
- `entity-type-dialog.tsx`, `attribute-dialog.tsx`, `record-editor-dialog.tsx`: updates send the current `version`. On 409 the banner appears; Refresh refetches the latest item, repopulates the form and adopts its version so the next save succeeds.

### Verification
- `pnpm --filter @acc/console build`: success.

## Phase 4: Server-Side Record Filtering & Sorting

### Enhancements
- **Server-side Search & Filtering**:
  - Implemented 300ms debounced search in [`entity-data-grid.tsx`](file:///C:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx) targeting active schema attributes (`filter[<attr>][contains]=<query>`).
  - Added clear button (`X`) to quickly reset the filter input and reset to page 1.
  - Expanded filter operators in [`mock-metadata.ts`](file:///C:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/data/mock-metadata.ts) to handle `contains`, `like`, `ne`, and `in` identically to Spring Data JPA `EntityRecordSpecifications`.
- **Column Header Sorting**:
  - Connected table column header clicks to toggle server sorting through `sort=field,asc|desc`.
  - Added visual sort direction indicators (`ArrowUp`, `ArrowDown`, and hover `ArrowUpDown`).
  - Added active sort badge with quick-clear button to reset sort state.
- **Strict Server Pagination**:
  - Configured `useReactTable` to render server records directly without client-side slicing.
  - Bound pagination controls to `recordsResponse.totalElements` and `recordsResponse.totalPages`.

### Verification
- `pnpm --filter @acc/console build`: **BUILD SUCCESS** (TypeScript and Vite build cleanly verified).

## Phase 5: Structured 400 Error Mapping & Inline Field Validation

### Enhancements
- **Backend Error Mapping**:
  - Aligned client error parsing with backend Spring `ResponseWrapper` and `SchemaValidationService` format: `{ errors: [{ code: "VALIDATION_ERROR", detail: "<fieldKey>", message: "..." }] }`.
  - Strip leading `attributes.` or `$.` prefixes from error detail/field paths in [`record-editor-dialog.tsx`](file:///C:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/record-editor-dialog.tsx).
  - Populates inline field errors alongside a high-level summary alert banner.
- **Dynamic Field Component Visual Cues**:
  - Enhanced [`dynamic-field-renderer.tsx`](file:///C:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/dynamic-fields/dynamic-field-renderer.tsx) to attach active error styling (`border-destructive/80 focus-visible:ring-destructive/40 focus:border-destructive shadow-[0_0_8px_rgba(239,68,68,0.25)]`) across text, textarea, number, select, multiselect, datepicker, json_editor, and relation_picker controls when validation errors are present.
- **Form Interactivity**:
  - Clears individual field errors immediately when the user edits or corrects that field value.

### Verification
- `pnpm --filter @acc/console build`: **BUILD SUCCESS** (verified clean build in 550ms).

## Phase 6: Relationships UI & Edge Management

### Enhancements
- **Workspace Tab Navigation**:
  - Added 3rd tab (`Relationships`) to [`MetadataFeature`](file:///C:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/metadata-feature.tsx) alongside `Schema Builder` and `Data Explorer`.
  - Added localized i18n keys for tab navigation in English and Vietnamese (`locales/en/console.json` and `locales/vi/console.json`).
- **Relationship Types Manager (`relationship-types-manager.tsx`)**:
  - Interactive grid displaying all incoming and outgoing edge schema definitions associated with the active entity model.
  - Directional flow badges, cardinality indicators (`1:1`, `1:N`, `N:1`, `N:N`), and full CRUD controls.
- **Relationship Type Modals**:
  - `RelationshipTypeDialog`: Modal for creating and editing relationship edge models (source/target selector, name, auto-slugging `rel_system_name`, cardinality, and description).
  - `RelationshipTypeDeleteDialog`: Confirmation dialog for unlinking/removing relationship types.
- **Record Relationships Inspector (`record-relationships-inspector.tsx`)**:
  - Dedicated inspector modal accessible directly from the `EntityDataGrid` row action menu (`View Relationships`).
  - Displays all inbound and outbound edges linked to the specific record.
  - Allows instant edge creation and deletion with live target record lookup.
- **Dynamic Field `relation_picker` Upgrades**:
  - Upgraded `RelationPickerControl` in `dynamic-field-renderer.tsx` to automatically populate dropdown choices with target entity records when `targetEntityTypeId` is defined.

### Verification
- `pnpm --filter @acc/console build`: **BUILD SUCCESS** (TypeScript compilation and Vite bundle creation verified cleanly in 599ms).
