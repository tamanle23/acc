# 085: Enhance Domain Blueprint Catalog & Metadata Dialog Responsiveness

## Problem
The Domain Blueprint Catalog modal was constrained to `max-w-4xl max-h-[85vh]`, which felt narrow on high-resolution desktop and ultrawide screens. This cramped the 2-column card grid and the new Split Inspector view. Similarly, the Template Preview, Record Editor, JSON Schema Viewer, and Raw JSON modals were constrained to narrow widths.

## Plan
1. Expand `BlueprintGalleryDialog` to `max-w-6xl w-[95vw] h-[88vh]`.
2. Adapt the Card Grid to responsive 3 columns on large displays (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
3. Make `BlueprintSplitView` and `BlueprintGraphCanvas` fluid in height and width.
4. Scale up `TemplatePreviewModal`, `RecordEditorDialog` (with responsive 2-column dynamic fields), `SchemaJsonPreview`, and `RawJsonDialog`.

## Changes
- Modified [`apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx).
- Modified [`apps/console/src/features/metadata/components/blueprint-gallery/blueprint-split-view.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-split-view.tsx).
- Modified [`apps/console/src/features/metadata/components/blueprint-gallery/template-preview-modal.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/template-preview-modal.tsx).
- Modified [`apps/console/src/features/metadata/components/blueprint-gallery/blueprint-graph-canvas.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-graph-canvas.tsx).
- Modified [`apps/console/src/features/metadata/components/data-explorer/record-editor-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/data-explorer/record-editor-dialog.tsx).
- Modified [`apps/console/src/features/metadata/components/schema-builder/schema-json-preview.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/schema-builder/schema-json-preview.tsx).
- Modified [`apps/console/src/features/metadata/components/data-explorer/raw-json-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/data-explorer/raw-json-dialog.tsx).
- Modified [`apps/console/src/features/metadata/components/entity-type/entity-type-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/entity-type/entity-type-dialog.tsx).

## Verification
- `tsc --noEmit --project tsconfig.json`: 0 errors.
- `pnpm --filter @unipost/console test src/features/metadata`: 9 test files passed, 56 tests passed.
