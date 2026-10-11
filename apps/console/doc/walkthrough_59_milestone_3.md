# Walkthrough - WCAG 2.2 AA Compliance: Milestone 3 (Dynamic Features, Data Tables & Schema Builder)

This walkthrough documents the engineering changes executed to achieve **WCAG 2.2 Level AA compliance** for Milestone 3 across `@unipost/console`.

---

## 1. Summary of Changes

### 1.1 Data Explorer Table Accessibility (`EntityDataGrid`)
- **Table Header Semantics**: Added `scope="col"` to all `<th>` table header elements in `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`.
- **Sort Announcements**: Added dynamic `aria-sort="ascending" | "descending" | "none"` attributes to column headers based on active `sortField` and `sortDirection`.
- **Icon Button Names**: Added descriptive `aria-label` attributes to table actions and control buttons:
  - Row action dropdown triggers: `aria-label={`Actions for record #${row.original.id}`}`
  - Sort header triggers: `aria-label={`Sort by ${attr.name} ...`}`
  - Search clear: `aria-label="Clear search"`
  - Faceted sidebar toggle: `aria-label="Toggle Faceted Search sidebar"`
  - Active filter chip removal: `aria-label={`Remove filter for ${attr.name}`}`
  - Pagination controls: `aria-label="Go to first/previous/next/last page"`

### 1.2 Accessible Schema Reordering (SC 2.5.7 Dragging Movements)
- **Attribute Reorder Actions**: Updated `AttributeCard` (`apps/console/src/features/metadata/components/schema-builder/attribute-card.tsx`) with accessible single-pointer / keyboard `ArrowUp` and `ArrowDown` action buttons.
- **Bounding & State**: Disabled `Move Up` button on the first attribute (`isFirst`) and `Move Down` button on the last attribute (`isLast`).
- **Screen Reader Feedback**: Added an `aria-live="polite"` live status region in `SchemaBuilder` (`apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx`) to announce attribute position changes (e.g. *"Moved field Email up to position 1 of 4"*).

### 1.3 Accessible Authentication & OTP (SC 3.3.8 Accessible Authentication - Minimum)
- **Autocomplete Hints**:
  - `UserAuthForm`: Added `autoComplete="username"` for email input and `autoComplete="current-password"` for password input.
  - `SignUpForm`: Added `autoComplete="username"` for email input and `autoComplete="new-password"` for password/confirm-password inputs.
  - `OtpForm`: Added `autoComplete="one-time-code"` for `InputOTP`.
- **Uninhibited Paste Support**: Confirmed `PasswordInput` passes all standard input props (including `onPaste` and `autoComplete`) through to underlying HTML `<input>` elements without interception.

---

## 2. Verification Results

All automated checks passed with **0 errors**:

1. **Unit & Integration Test Suite**:
   ```bash
   pnpm --filter @unipost/console test
   # Result: Passed 22/22 test files, 104/104 tests
   ```

2. **Production Web Build**:
   ```bash
   pnpm --filter @unipost/console exec vite build --mode web
   # Result: Built web bundle in 2.07s
   ```
