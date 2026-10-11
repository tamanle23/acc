# 021: WCAG 2.2 AA Compliance - Milestone 3 (Dynamic Features, Data Tables & Schema Builder)

## Date: 2026-10-10

## Description
Executed **Milestone 3** of the WCAG 2.2 AA compliance initiative across `@unipost/console`. This milestone focuses on data table accessibility (`EntityDataGrid`), single-pointer / keyboard drag alternatives for schema field reordering (`SchemaBuilder`), and autocomplete/paste accessibility on auth and OTP forms.

## Changes Implemented

1. **Data Explorer Table Accessibility (`EntityDataGrid`):**
   - Added `scope="col"` to all table header `<th>` elements.
   - Implemented dynamic `aria-sort="ascending" | "descending" | "none"` attributes reflecting TanStack table sorting state.
   - Added accessible `aria-label`s on row action triggers, search clear, facet toggles, active filter chip removal buttons, and pagination triggers.

2. **Accessible Schema Reordering (SC 2.5.7 Dragging Movements):**
   - Added single-pointer / keyboard "Move Up" and "Move Down" action buttons to `AttributeCard` with proper bounding conditions (`isFirst` / `isLast`).
   - Integrated an `aria-live="polite"` region in `SchemaBuilder` to announce attribute position changes to assistive technology users.

3. **Accessible Authentication & OTP (SC 3.3.8 Accessible Authentication - Minimum):**
   - Added explicit `autoComplete` attributes across auth components (`username`, `current-password`, `new-password`, `one-time-code`).
   - Confirmed copy/paste functionality remains uninhibited across all credential and passcode input fields.

## Verification
- `pnpm --filter @unipost/console test`: Passed (22/22 test files, 104/104 tests)
- `pnpm --filter @unipost/console exec vite build --mode web`: Built web bundle successfully

## Next Steps for Milestone 4
- Configure `eslint-plugin-jsx-a11y` in `@unipost/console`.
- Add `vitest-axe` component accessibility assertions to test suites.
- Ensure `pnpm test` runs axe checks with zero violations.
