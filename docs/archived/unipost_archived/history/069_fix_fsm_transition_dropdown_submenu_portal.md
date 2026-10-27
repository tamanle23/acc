# 069: Fix FSM Transition Dropdown Submenu Portal & Feedback

**Date**: 2026-10-14  
**Author**: Lead Systems Architect  
**Category**: fix(console)  
**Scope**: `@acc/console`  

---

## 1. Problem Statement
When hovering over or clicking the "FSM Transition" sub-menu item in the `EntityDataGrid` row actions dropdown menu (`MoreVertical`), the sub-menu was either not visible or showed no actions.

Root causes identified:
1. **Radix UI SubContent Clipping**: In `apps/console/src/components/ui/dropdown-menu.tsx`, `DropdownMenuContent` uses `<DropdownMenuPrimitive.Portal>` and defines `overflow-x-hidden overflow-y-auto`. However, `DropdownMenuSubContent` was rendered without wrapping in `<DropdownMenuPrimitive.Portal>`. As a result, when rendered inside the parent `DropdownMenuContent`, any submenu extending to the side was clipped by `overflow-x-hidden`.
2. **Missing Lifecycle Configs**: Only entity type `1` (`Customer Account`) had `lifecycleConfig` populated in `initialMockEntityTypes`. Entity types `2` (`Cloud Resource Specification`) and `3` (`Deployment Policy`) lacked `lifecycleConfig`.
3. **Empty Submenu Hiding**: In `EntityDataGrid`, when `availableTransitions.length === 0` (e.g. record in terminal or state with no outgoing transitions), the submenu was conditionally hidden, leaving no feedback or context.

---

## 2. Plan
1. **Wrap `DropdownMenuSubContent` in `<DropdownMenuPrimitive.Portal>`**: Update `apps/console/src/components/ui/dropdown-menu.tsx` to render submenus in a top-level document body portal so they are never clipped by the parent's `overflow-x-hidden` container.
2. **Enhance `EntityDataGrid` Submenu UX**: In `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`, render the FSM Transition sub-menu whenever `lifecycle` is present on the entity type, showing available transitions or a clear informative message (`No transitions from '{currentState}'`) when no transitions are eligible.
3. **Seed Lifecycle Configs**: In `apps/console/src/features/metadata/data/mock-metadata.ts`, provide complete `lifecycleConfig` definitions with valid states and transitions for entity types `2` and `3`.
4. **Verification**: Run Vitest test suite in `@acc/console`.

---

## 3. Changes Made
- [`apps/console/src/components/ui/dropdown-menu.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/ui/dropdown-menu.tsx): Wrapped `<DropdownMenuPrimitive.SubContent>` in `<DropdownMenuPrimitive.Portal>`.
- [`apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx): Ensured FSM Transition submenu renders when `lifecycle` is defined, with fallback text if no transitions exist from `currentState`.
- [`apps/console/src/features/metadata/data/mock-metadata.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/data/mock-metadata.ts): Added lifecycle definitions (`PROVISION`, `DECOMMISSION`, `REINSTATE`, `STAGE`, `ENFORCE`, `RETIRE`) for entity types 2 and 3.

---

## 4. Verification
- Ran `pnpm --filter @acc/console test src/features/metadata`:
  - 9 test files passed, 54 tests passed cleanly with 0 failures.

---

## 5. Walkthrough
1. Navigate to Data Explorer in Console.
2. Click the `...` (MoreVertical) button on any record row.
3. Hover over "FSM Transition":
   - The sub-menu opens cleanly without being clipped or hidden.
   - For records in valid states (e.g. `DRAFT`), actionable transitions appear (e.g., `SUBMIT -> to SUBMITTED`, `PROVISION -> to ACTIVE`).
   - If a record is in a terminal or un-transitionable state, the sub-menu displays `No transitions from '<STATE>'`.
