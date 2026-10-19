# Walkthrough 124: Remediation of Iteration 11 WCAG 2.2 AA Warnings, ARIA Attributes & Backend RFC-7807 Standardization

## 1. Overview
This remediation round systematically audited the prior attempt of Iteration 11 remaining phases and resolved latent defects across accessibility, UI table semantics, and backend error handling:
- **Radix UI Dialog Description Warnings**: Fixed improper explicit `id` and `aria-describedby` overrides on `SheetContent` and `SheetDescription` across `DlqInspectorSheet`, `TenantUsersDrawer`, and `TenantWorkspacesDrawer` that broke Radix UI's internal `context.descriptionId` resolution and produced runtime warning logs.
- **WAI-ARIA Table Header `aria-sort`**: Upgraded TanStack `@/components/data-table` to supply compliant WAI-ARIA `aria-sort="none"` for sortable unsorted columns, alongside `"ascending"` and `"descending"`, matching W3C specifications.
- **Unique Descriptive Row Action `aria-label`s**: Resolved generic "Open menu" labels by introducing unique identifiers in `users/components/data-table-row-actions.tsx`, `dlq-columns.tsx`, and `user-membership-drawer.tsx`.
- **DataTableToolbar ARIA Semantics**: Added `role="toolbar"` and `aria-label="Table toolbar"` to `DataTableToolbar` ensuring `has-[div[role="toolbar"]]` selectors properly match on mobile viewports.
- **Backend RFC-7807 Standardization**: Hardened `apps/backend/unipost-fw/src/main/java/com/unipost/fw/exceptionhandling/GlobalExceptionHandler.java` to return HTTP 403 Forbidden on access denials, HTTP 500 Internal Server Error with sanitized fallback messages on uncaught exceptions, and HTTP 400 Bad Request on message conversion errors, backed by formal unit tests in `GlobalExceptionHandlerTest.java`.

---

## 2. Changes Made

### Frontend Accessibility & UI Ergonomics (`apps/console`)
- `apps/console/src/features/dlq/components/dlq-inspector-sheet.tsx`:
  - Removed custom `aria-describedby="dlq-inspector-sheet-desc"` and `id="dlq-inspector-sheet-desc"`. Radix automatically assigns and connects `context.descriptionId`.
- `apps/console/src/features/system/tenants/tenant-users-drawer.tsx`:
  - Removed custom `aria-describedby="tenant-users-drawer-desc"` and `id="tenant-users-drawer-desc"`.
- `apps/console/src/features/system/tenants/tenant-workspaces-drawer.tsx`:
  - Removed custom `aria-describedby="tenant-workspaces-drawer-desc"` and `id="tenant-workspaces-drawer-desc"`.
- `apps/console/src/components/data-table/data-table.tsx`:
  - Checked `header.column.getCanSort?.()` and set `aria-sort="none"` when column is sortable and not yet sorted.
- `apps/console/src/components/data-table/toolbar.tsx`:
  - Added `role="toolbar"` and `aria-label="Table toolbar"`.
- `apps/console/src/features/users/components/data-table-row-actions.tsx`:
  - Added unique `aria-label={`Actions for user ${row.original.username}`}`.
- `apps/console/src/features/dlq/components/dlq-columns.tsx`:
  - Added unique `aria-label={`Inspect DLQ task ${item.taskId}`}`, `aria-label={`Replay DLQ task ${item.taskId}`}`, and `aria-label={`Actions for DLQ task ${item.taskId}`}`.
- `apps/console/src/features/system/roles/user-membership-drawer.tsx`:
  - Added unique `aria-label={`Inspect user ${u.username}`}` and `aria-label={u.locked ? ... : ...}`.

### Backend Error Handling (`apps/backend`)
- `apps/backend/unipost-fw/src/main/java/com/unipost/fw/exceptionhandling/GlobalExceptionHandler.java`:
  - Standardized `handleAccessDeniedException` to return `HttpStatus.FORBIDDEN` (403).
  - Standardized `handleRuntimeException` and `handleThrowable` to return `HttpStatus.INTERNAL_SERVER_ERROR` (500) and safe non-null fallback messages.
  - Standardized `handleHttpMessageConversionException` to return `HttpStatus.BAD_REQUEST` (400).
  - Standardized `handleBusinessException` default server-side status to 500 and client-side status to 400.
- `apps/backend/unipost-fw/src/test/java/com/unipost/fw/exceptionhandling/GlobalExceptionHandlerTest.java`:
  - Created 6 unit tests verifying all status codes and error structures.

---

## 3. Verification Record

1. **Vitest Unit & Component Suite**:
   - `pnpm --filter @unipost/console test`: 65 test files passed (309/309 tests passing), with 0 Radix dialog warnings.
2. **Backend Modulith & Unit Suite**:
   - `node mvnw.cjs -pl unipost-fw test -Dtest=GlobalExceptionHandlerTest`: 6/6 tests passing (BUILD SUCCESS).
   - `pnpm --filter @unipost/backend test:sandbox`: 33/33 tests passing (BUILD SUCCESS).
   - `pnpm --filter @unipost/backend test:modulith`: 1/1 architectural tests passing (BUILD SUCCESS).
3. **Playwright Mode 1 Autonomous E2E**:
   - `pnpm test:e2e`: 15/15 tests passing in 41.2s.
4. **`tekgo-ui` Lint**:
   - `pnpm --filter tekgo-ui lint`: 0 warnings, 0 errors.
