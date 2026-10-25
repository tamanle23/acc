# Walkthrough 89: Fix Missing `cn` Utility Import in RecordEditorDialog

## 1. Problem
When opening or rendering the Record Editor Dialog in `@acc/console`, the UI crashed with a runtime error:
```
ReferenceError: cn is not defined
    at record-editor-dialog.tsx:280:32
    at Array.map (<anonymous>)
    at RecordEditorDialog (record-editor-dialog.tsx:277:29)
```

## 2. Root Cause
In `apps/console/src/features/metadata/components/data-explorer/record-editor-dialog.tsx`, the recent 2-column responsive layout enhancement used `className={cn(...)}` to conditionally set `col-span-1 md:col-span-2` for textareas and JSON fields. However, the `cn` utility import from `@/lib/utils` was missing from the file's imports.

## 3. Changes Made
- Added `import { cn } from '@/lib/utils';` in [`apps/console/src/features/metadata/components/data-explorer/record-editor-dialog.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/record-editor-dialog.tsx).

## 4. Verification
- TypeScript check: `tsc --noEmit --project tsconfig.json` passed with 0 errors.
- Vitest suite: `pnpm --filter @acc/console test src/features/metadata` passed with 56 tests passing.
