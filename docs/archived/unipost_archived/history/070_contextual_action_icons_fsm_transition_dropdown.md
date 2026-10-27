# 070: Contextual Action Icons and Liquid Glass Styling for FSM Transition Dropdown

**Date**: 2026-10-14  
**Author**: Lead Systems Architect  
**Category**: feat(console)  
**Scope**: `@acc/console`  

---

## 1. Problem Statement
The FSM Transition sub-menu items previously used a single generic checkmark (`CheckCircle2`) icon for all actions regardless of the action semantics (e.g. `SUBMIT`, `APPROVE`, `ACTIVATE`, `SUSPEND`, `ARCHIVE`, `REINSTATE`, `REJECT`). This made it difficult for domain operators to distinguish state transitions at a glance.

---

## 2. Plan
1. **Semantic Action & State Visual Mapping**: Implement a deterministic helper `getTransitionActionVisual(action: string, targetState: string)` that maps transition semantics to specialized Lucide icons and WCAG AA-compliant accent palettes:
   - `SUBMIT` / `SEND`: `Send` (Sky)
   - `APPROVE` / `VERIFY` / `VALIDATE`: `ShieldCheck` (Emerald)
   - `ACTIVATE` / `PROVISION` / `DEPLOY` / `PUBLISH`: `Rocket` (Indigo)
   - `ENFORCE` / `STAGE`: `Zap` (Amber)
   - `SUSPEND` / `PAUSE` / `HOLD`: `PauseCircle` (Amber)
   - `REACTIVATE` / `RESUME` / `REINSTATE`: `RotateCcw` (Teal)
   - `ARCHIVE` / `RETIRE` / `DEPRECATE`: `Archive` (Purple)
   - `REJECT` / `CANCEL` / `TERMINATE` / `DECOMMISSION`: `Ban` (Rose)
   - Fallback: `Play` (Primary)
2. **Liquid Glass Item Layout**:
   - Modern row layout with an icon badge (`p-1 rounded-md bg-muted/60`), bold action label, arrow-prefixed target state sub-label (`ArrowRight`), and a clean monospace state pill badge.
   - Smooth hover micro-interaction (`group-hover:scale-105 transition-transform`).
3. **Verification**: Run Vitest suite across `@acc/console`.

---

## 3. Changes Made
- [`apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx):
  - Imported semantic Lucide icons (`Send`, `ShieldCheck`, `Rocket`, `Zap`, `PauseCircle`, `RotateCcw`, `Archive`, `Ban`, `ArrowRight`).
  - Added `getTransitionActionVisual` helper.
  - Revamped `DropdownMenuItem` rendering in `DropdownMenuSubContent` with contextual icons, arrow connectors, and styled target state badges.

---

## 4. Verification
- Vitest suite executed cleanly:
  - 9 test files passed, 54 tests passed with 0 errors.

---

## 5. Walkthrough
1. In Console, navigate to Data Explorer.
2. Click the `...` menu on any record.
3. Hover over "FSM Transition":
   - Each transition now displays a dedicated icon corresponding to the intent:
     - `SUBMIT` displays a sky paper airplane (`Send`).
     - `APPROVE` displays an emerald security shield (`ShieldCheck`).
     - `ACTIVATE` / `PROVISION` displays an indigo rocket (`Rocket`).
     - `SUSPEND` displays an amber pause badge (`PauseCircle`).
     - `REINSTATE` / `REACTIVATE` displays a teal rewind arrow (`RotateCcw`).
     - `ARCHIVE` / `RETIRE` displays a purple archive box (`Archive`).
     - `DECOMMISSION` displays a rose ban badge (`Ban`).
   - A distinct monospace target state pill is rendered on the right.
