# 444 - Compound Node Templates & Fast-Start Paired Workflow Engine

## Problem
In workflow orchestration, critical control-flow primitives (`FORK_JOIN`, `DYNAMIC_FORK`, `SWITCH`, `DO_WHILE`, `HUMAN`) cannot execute in isolation:
1. `FORK_JOIN` requires concurrent branches and a downstream `JOIN` barrier (`joinOn: [...]`), without which `AcyclicityGuard` in the backend rejects registration (`Workflow contains FORK_JOIN task but no matching JOIN barrier task`).
2. `SWITCH` routers require branch handlers and convergence into an `EXCLUSIVE_JOIN` merge point, or all paths dead-end.
3. `DO_WHILE` loops require a loop body and back-edge closure returning to `loop-back` as well as a forward `loop-exit` path.
4. `HUMAN` review gates require dedicated `approved` and `rejected` resolution handlers.

Previously, adding any of these nodes left them isolated on canvas, requiring the author to manually drop 4-5 auxiliary nodes, hand-wire 4-6 connectors, and manually configure `joinOn` arrays.

## Plan
1. **Core Template Engine & Factories**:
   - Establish `CompoundTemplateRegistry` following the Open/Closed Principle.
   - Implement modular factories:
     - `ForkJoinTemplateFactory`: Topology 1 (`FORK_JOIN` + 2 branches + `JOIN`) & Topology 2 (`DYNAMIC_FORK` + `JOIN`).
     - `SwitchTemplateFactory`: Topology 3 (`SWITCH` + 2 cases + default + `EXCLUSIVE_JOIN`).
     - `DoWhileTemplateFactory`: Topology 4 (`DO_WHILE` + loop body + loopback edge + `loop-exit`).
     - `HumanTemplateFactory`: Topology 5 (`HUMAN` + approve action + reject terminate).
     - `SagaTemplateFactory`: Topology 6 (Mutating task + bottom compensation handler).
2. **Canvas State Hook Integration**:
   - Integrate `compoundTemplateRegistry` into `handleSplitEdge` and `onDrop`.
   - Implement the **Downstream Node Push Invariant**: automatically shift downstream nodes rightward when inserting wide compound envelopes on short edges to prevent visual collisions.
   - Support instant blank-canvas template spawning in `handleInsertStarterTask`.
3. **UI/UX Cognitive Polish**:
   - Add `Template` visual badges and updated descriptions to `DagPalette` and `DagQuickInsertPopover`.
4. **Comprehensive Verification**:
   - Unit and canvas integration tests across console, sandbox, and backend.

## Changes

### 1. Console Compound Template Infrastructure
- `apps/console/src/features/workflows/components/studio/utils/compound-templates/types.ts`:
  - Defined `CompoundTemplateOptions`, `CompoundTemplateResult`, and `CompoundTemplateFactory` contracts.
- `apps/console/src/features/workflows/components/studio/utils/compound-templates/factories/fork-join-template.ts`:
  - Generates 4-node `FORK_JOIN` + 2 branches + `JOIN` barrier with pre-configured `joinOn` and `forkTasks`, and `DYNAMIC_FORK` + `JOIN` barrier.
- `apps/console/src/features/workflows/components/studio/utils/compound-templates/factories/switch-template.ts`:
  - Generates 5-node `SWITCH` + 2 cases + default + `EXCLUSIVE_JOIN` with matching case handles and `joinOn`.
- `apps/console/src/features/workflows/components/studio/utils/compound-templates/factories/do-while-template.ts`:
  - Generates `DO_WHILE` + loop body with `loop-body` outlet, `isLoopbackEdge: true` return to `loop-back`, and `loop-exit` forwarding.
- `apps/console/src/features/workflows/components/studio/utils/compound-templates/factories/human-template.ts`:
  - Generates `HUMAN` review gate + approved action task + rejected terminate node.
- `apps/console/src/features/workflows/components/studio/utils/compound-templates/factories/saga-template.ts`:
  - Generates mutating task + bottom `compensate` rollback handler.
- `apps/console/src/features/workflows/components/studio/utils/compound-templates/compound-template-registry.ts`:
  - Extensible singleton registry supporting `isCompound(type)` and `create(type, pos, options)`.
- `apps/console/src/features/workflows/components/studio/utils/compound-templates/index.ts`:
  - Barrel export.
- `apps/console/src/features/workflows/components/studio/utils/compound-templates/compound-templates.test.ts`:
  - 7 unit tests verifying node/edge counts, metadata invariants, and topology validity.

### 2. Canvas State Hook Integration
- `apps/console/src/features/workflows/components/studio/hooks/use-dag-studio-state.ts`:
  - In `handleSplitEdge`, added compound template instantiation with BFS downstream node push ($\Delta x$) to prevent visual collisions.
  - In `onDrop`, replaced hardcoded loop drop with `compoundTemplateRegistry.create(...)` and atomic undo snapshots.
  - In `handleInsertStarterTask`, enabled instant blank-canvas compound generation.
- `apps/console/src/features/workflows/components/studio/canvas/compound-canvas-integration.test.ts`:
  - 5 integration tests verifying blank-edge splitting, zero validation errors, downstream coordinate shifting, and canvas drop.

### 3. Visual Palette & Quick-Insert Popover Badges & 1-Click Fast-Start
- `apps/console/src/features/workflows/components/studio/palette/dag-palette.tsx`:
  - Added `isCompound?: boolean` to `PaletteItem`.
  - Added `isCompound: true` and updated descriptions for `FORK_JOIN`, `DYNAMIC_FORK`, `SWITCH`, `DO_WHILE`, `HUMAN`.
  - Rendered amber `Template` badge pill on compound items.
  - Added `onInsertNode` callback to support 1-click insertion from both expanded palette and collapsed rail directly into the active flow.
- `apps/console/src/features/workflows/components/studio/canvas/dag-quick-insert-popover.tsx`:
  - Rendered `Template` badge pill on compound items in quick-insert search results.

### 4. DOM Handle Binding & Canvas Proximity Auto-Connection
- `apps/console/src/features/workflows/components/studio/utils/compound-templates/factories/`:
  - Updated `fork-join-template.ts` and `switch-template.ts` to bind handles to DOM IDs (`source-right`, `target-left`, `loop-exit`) instead of generic `'source'` and `'target'`.
- `apps/console/src/features/workflows/components/studio/hooks/use-dag-studio-state.ts`:
  - Implemented `resolveSourceHandle` and `resolveTargetHandle` to resolve unannotated edges (like `BLANK_WORKFLOW_EDGES`) and specialized node ports (`loop-exit`, `approved`, `case-*`).
  - Implemented `findNearestEdge` using orthogonal point-to-segment distance math ($d \le 140\text{px}$) to automatically detect drop proximity and split edges.
  - Enhanced `onDrop` and added `handleInsertNode` to auto-connect inserted nodes/templates to upstream and downstream pipeline paths instead of leaving disconnected orphan nodes.
  - Added downstream collision clearance shifting for single node insertions as well as compound templates.

---

## Verification
- `pnpm --filter @acc/console test "compound-templates.test.ts"` (7/7 passed).
- `pnpm --filter @acc/console test "compound-canvas-integration.test.ts"` (7/7 passed).
- `pnpm --filter @acc/console test "src/features/workflows"` (26 test files, 132 tests passed).
- `pnpm --filter @acc/console exec tsc --noEmit` (0 errors).
- `pnpm --filter @acc/sandbox test` (11 test files, 103 tests passed).

---

## Walkthrough
Refer to [Walkthrough 167: Compound Node Templates & Fast-Start Paired Workflow Engine](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_167.md).

## Tasks
- [x] Design and implement `CompoundTemplateRegistry` and 5 core compound template factories.
- [x] Integrate template instantiation into `handleSplitEdge`, `onDrop`, and `handleInsertStarterTask`.
- [x] Implement Downstream Node Push Invariant for collision avoidance.
- [x] Add visual `Template` badges to `DagPalette` and `DagQuickInsertPopover`.
- [x] Resolve handle ID mismatches (`source-right`, `target-left`) across compound templates and edge splitting.
- [x] Implement edge proximity detection (`findNearestEdge`) and flow-aware insertion on canvas drop and 1-click palette click.
- [x] Verify full test suites across console, sandbox, and backend.

---

## Enhancement
Future iterations can provide inline `+ Add Branch` and `+ Add Case` floating buttons directly on canvas nodes for even faster interactive branching without opening inspectors.
