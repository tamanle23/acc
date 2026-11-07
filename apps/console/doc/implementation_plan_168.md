# Implementation Plan 168 - Reusable Multi-Branch & Variable Port Node Expansion Framework

## Goal Description
Implement an extensible, reusable Multi-Branch Node Expansion Framework across Visual DAG Studio in `@acc/console`. This enables dynamic branch and port expansion for `SWITCH` (variable decision cases), `FORK_JOIN` (variable parallel branches), `DO_WHILE` (variable body steps), and `HUMAN` (variable governance outcomes) through both inline 1-click canvas buttons and a unified Property Inspector Branch Manager.

---

## User Review Required
> [!IMPORTANT]
> **Barrier Node Synchronization Invariant**:
> Adding or deleting branches on `SWITCH` or `FORK_JOIN` automatically updates downstream `EXCLUSIVE_JOIN` or `JOIN` `joinOn: [...]` arrays, generates exact handle IDs (`case-${key}`, `source-right`, `target-left`), and recalculates symmetrical vertical node positions.

---

## Proposed Changes

### Phase 1: Multi-Branch Strategy Core (`utils/branch-strategies/`)
- `apps/console/src/features/workflows/components/studio/utils/branch-strategies/types.ts`:
  - `BranchDescriptor`, `MultiBranchStrategy`, `BranchAdditionResult`, `BranchRemovalResult`.
- `apps/console/src/features/workflows/components/studio/utils/branch-strategies/multi-branch-registry.ts`:
  - Singleton `MultiBranchRegistry` supporting registration, lookup, and fallback.
- `apps/console/src/features/workflows/components/studio/utils/branch-strategies/strategies/switch-branch-strategy.ts`:
  - Manages `decisionCases`, generates `case-${caseKey}` handles, and syncs `EXCLUSIVE_JOIN.joinOn`.
- `apps/console/src/features/workflows/components/studio/utils/branch-strategies/strategies/fork-join-branch-strategy.ts`:
  - Manages `forkTasks` matrix, generates `source-right` branch handles, and syncs `JOIN.joinOn`.
- `apps/console/src/features/workflows/components/studio/utils/branch-strategies/strategies/do-while-branch-strategy.ts`:
  - Manages `loopOver` steps and loopback wiring.
- `apps/console/src/features/workflows/components/studio/utils/branch-strategies/strategies/human-branch-strategy.ts`:
  - Manages `approved`, `rejected`, and custom outcome routing.
- `apps/console/src/features/workflows/components/studio/utils/branch-strategies/index.ts`:
  - Module barrel exporting registry and auto-registering strategies on evaluation.

### Phase 2: Canvas State Hook Integration (`use-dag-studio-state.ts`)
- Implement `handleAddNodeBranch(nodeId: string, customBranchName?: string)`:
  - Symmetrical vertical slot calculation ($\Delta y = 110\text{px}$).
  - Barrier node discovery via downstream traversal.
  - New branch action task instantiation.
  - Inbound and outbound edge generation with exact DOM handle IDs.
  - Barrier `joinOn` synchronization.
  - Downstream push clearance ($\Delta x$).
  - Undo/redo snapshot integration.
- Implement `handleRemoveNodeBranch(nodeId: string, branchId: string)`:
  - Branch node and edge pruning.
  - Barrier `joinOn` array cleanup.
  - Symmetrical re-centering of remaining branches.
- Decorate nodes in `visual-dag-studio.tsx` with `onAddBranch` callback.

### Phase 3: Visual Canvas Node Card UI (`dag-node.tsx`)
- Add `onAddBranch?: (nodeId: string) => void` to `DagNodeData`.
- Render subtle Liquid Glass `+ Add Branch` / `+ Add Case` pill on supported multi-branch nodes:
  - Specular border (`border-primary/20 hover:border-primary/50`).
  - Contextual text: `+ Add Case` (`SWITCH`), `+ Add Branch` (`FORK_JOIN`), `+ Add Step` (`DO_WHILE`), `+ Add Outcome` (`HUMAN`).
  - `e.stopPropagation()` preventing node drag or accidental selection.

### Phase 4: Unified Property Inspector Branch Manager (`dag-property-inspector.tsx`)
- Implement `BranchManagerSection` in Routing tab:
  - Displays active branches with badge, editable case name, connected task reference.
  - Inline rename input synchronized with parent `decisionCases`.
  - Delete branch button with disabled state at minimum threshold.
  - Primary button `+ Add Branch` invoking `onAddBranch`.

---

## Verification Plan

### Automated Tests
- Strategy unit tests: `pnpm --filter @acc/console test "multi-branch-strategies.test.ts"`.
- Canvas integration tests: `pnpm --filter @acc/console test "multi-branch-canvas.test.ts"`.
- Full workflow suite: `pnpm --filter @acc/console test "src/features/workflows"`.
- Strict typing: `pnpm --filter @acc/console exec tsc --noEmit`.
