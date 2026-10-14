# 087: Fix Missing `cn` Utility Import in RecordEditorDialog

## Problem
Opening the Record Editor Dialog resulted in a client-side runtime exception:
`ReferenceError: cn is not defined at record-editor-dialog.tsx:280:32`.

## Root Cause
The 2-column responsive layout enhancement used `cn(...)` to conditionally assign grid column spans for textarea and JSON fields, but `cn` was not imported from `@/lib/utils`.

## Changes
- Modified [`apps/console/src/features/metadata/components/data-explorer/record-editor-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/data-explorer/record-editor-dialog.tsx) to import `cn`.

## Verification
- `tsc --noEmit --project tsconfig.json`: 0 errors.
- `pnpm --filter @unipost/console test src/features/metadata`: 9 test files passed, 56 tests passed.
