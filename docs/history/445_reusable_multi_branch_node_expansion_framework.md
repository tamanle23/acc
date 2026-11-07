# 445 - Reusable Multi-Branch Node Expansion Framework

## Problem
In Visual DAG Studio, branching nodes (`SWITCH`, `FORK_JOIN`, `DO_WHILE`, `HUMAN`) were constrained to fixed initial template structures. Users could not easily expand a `SWITCH` condition node with additional variable decision cases, nor add parallel branches to a `FORK_JOIN` node, without manual edge wiring, coordinate calculation, and risk of breaking downstream barrier node invariants (`EXCLUSIVE_JOIN` or `JOIN` `joinOn: [...]` lists). Furthermore, branching logic was tightly coupled to individual component implementations instead of an extensible, reusable architectural pattern.

## Plan
1. **Extensible Strategy Pattern Architecture**: Design `MultiBranchStrategy` and `MultiBranchRegistry` in `apps/console/src/features/workflows/components/studio/utils/branch-strategies/` to decouple node-specific branching logic from the ReactFlow canvas engine.
2. **Implement Core Concrete Strategies**:
   - `SwitchBranchStrategy`: Manage `decisionCases`, dedicated `case-${caseKey}` handle IDs, and downstream `EXCLUSIVE_JOIN.joinOn` synchronization.
   - `ForkJoinBranchStrategy`: Manage `forkTasks` parallel matrix, `source-right` concurrent handles, and downstream `JOIN.joinOn` synchronization.
   - `DoWhileBranchStrategy`: Manage `loopOver` steps and loopback wiring.
   - `HumanBranchStrategy`: Manage governance decision outcomes (`approved`, `rejected`, custom escalation outcomes).
3. **Canvas State Hook Integration**:
   - Implement `handleAddNodeBranch` and `handleRemoveNodeBranch` in `useDagStudioState` with symmetrical vertical slotting ($\Delta y = 110\text{px}$), barrier node discovery, downstream push clearance, and undo/redo snapshots.
4. **Visual Canvas Node Card UI**:
   - Add contextual Liquid Glass action pill (`+ Add Case`, `+ Add Branch`, `+ Add Step`, `+ Add Outcome`) with `e.stopPropagation()` in `dag-node.tsx`.
5. **Universal Property Inspector Branch Manager**:
   - Add `BranchManagerSection` in `dag-property-inspector.tsx` Routing tab for managing, renaming, and pruning branches with minimum threshold guards.
6. **Formal Verification**:
   - Unit tests for strategies (`multi-branch-strategies.test.ts`), canvas integration tests (`multi-branch-canvas.test.ts`), full workflow test suite, and TypeScript strict checks.

## Changes

### 1. Multi-Branch Strategy Engine (`apps/console/src/features/workflows/components/studio/utils/branch-strategies/`)
- `types.ts`: Defined `BranchDescriptor`, `MultiBranchStrategy`, `BranchAdditionResult`, and `BranchRemovalResult`.
- `multi-branch-registry.ts`: Implemented singleton `MultiBranchRegistry` providing lookup and registration.
- `strategies/switch-branch-strategy.ts`: Implemented `SwitchBranchStrategy` managing `decisionCases` and `EXCLUSIVE_JOIN.joinOn`.
- `strategies/fork-join-branch-strategy.ts`: Implemented `ForkJoinBranchStrategy` managing `forkTasks` and `JOIN.joinOn`.
- `strategies/do-while-branch-strategy.ts`: Implemented `DoWhileBranchStrategy` managing `loopOver` steps.
- `strategies/human-branch-strategy.ts`: Implemented `HumanBranchStrategy` managing governance outcomes.
- `index.ts`: Exported registry and auto-registered all 4 strategies.
- `multi-branch-strategies.test.ts`: Added 9 comprehensive unit tests verifying branch creation, removal, and barrier synchronization.

### 2. Canvas State Hook (`apps/console/src/features/workflows/components/studio/hooks/use-dag-studio-state.ts`)
- Added `handleAddNodeBranch(nodeId, customBranchName?)`:
  - Recalculates symmetrical vertical positions for existing sibling branches and places new branch symmetrically.
  - Automatically traverses downstream graph to find barrier nodes (`EXCLUSIVE_JOIN` or `JOIN`).
  - Instantiates branch action task node with exact DOM handle IDs (`case-${caseKey}`, `source-right`, `target-left`).
  - Updates downstream barrier node's `joinOn` array to include the new branch's task reference name.
  - Pushes downstream nodes along X-axis to maintain clearance.
  - Records undo/redo history snapshot.
- Added `handleRemoveNodeBranch(nodeId, branchId)`:
  - Prunes branch node and attached edges.
  - Removes task reference from downstream barrier node's `joinOn` array.
  - Re-centers remaining sibling nodes vertically.
- Exposed `handleAddNodeBranch` and `handleRemoveNodeBranch` in return payload.

### 3. Visual Canvas Node Card UI (`apps/console/src/features/workflows/components/studio/canvas/dag-node.tsx` & `visual-dag-studio.tsx`)
- Updated `DagNodeData` to accept `onAddBranch` and `onRemoveBranch`.
- Decorated nodes in `visual-dag-studio.tsx` with `onAddBranch` and `onRemoveBranch`.
- In `dag-node.tsx`, rendered contextual Liquid Glass button pill with `e.stopPropagation()` in footer.

### 4. Property Inspector Branch Manager (`apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx`)
- Added `BranchManagerSection` in Routing tab.
- Displays active branches with status badges, editable branch names, target node references, and delete button guarded by minimum branch threshold.
- Primary `+ Add Branch` button invoking `onAddBranch`.

### 5. Canvas Integration Tests (`apps/console/src/features/workflows/components/studio/canvas/multi-branch-canvas.test.ts`)
- Added 4 integration tests covering `SWITCH` 3rd case addition/removal, `FORK_JOIN` 3rd branch addition, barrier `joinOn` synchronization, and undo/redo history.

## Verification
- **Strategy Unit Tests**: `pnpm --filter @acc/console test "multi-branch-strategies.test.ts"` (9/9 passed).
- **Canvas Integration Tests**: `pnpm --filter @acc/console test "multi-branch-canvas.test.ts"` (4/4 passed).
- **Full Console Workflow Suite**: `pnpm --filter @acc/console test "src/features/workflows"` (28 test files passed, 145/145 tests passed).
- **TypeScript Strict Check**: `pnpm --filter @acc/console exec tsc --noEmit` (0 errors).

## Walkthrough
Detailed architectural patterns, component breakdowns, and layout mechanics are documented in [`apps/console/doc/walkthrough_168.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_168.md) and [`apps/console/doc/implementation_plan_168.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/implementation_plan_168.md).

## Tasks
- [x] Design extensible `MultiBranchStrategy` interface and `MultiBranchRegistry`.
- [x] Implement strategies for `SWITCH`, `FORK_JOIN`, `DO_WHILE`, and `HUMAN`.
- [x] Implement symmetrical vertical slotting and downstream push in `useDagStudioState`.
- [x] Wire barrier node discovery and atomic `joinOn` synchronization.
- [x] Add contextual Liquid Glass `+ Add Branch` pill to canvas node cards.
- [x] Implement universal Property Inspector Branch Manager in Routing tab.
- [x] Author comprehensive unit and integration tests.
- [x] Verify strict TypeScript compilation.

## Enhancement
Future enhancements can register custom AI-driven branching strategies (e.g., dynamic agent consensus routing, multi-model evaluation splits) by implementing `MultiBranchStrategy` and registering it in `MultiBranchRegistry` without modifying the core Visual DAG Studio canvas engine.
