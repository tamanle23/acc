# Walkthrough 167 - Compound Node Templates & Fast-Start Paired Workflow Engine

## Architectural Root Cause & Decision
In distributed workflow systems (e.g. Netflix Conductor OSS, BPMN 2.0), control flow primitives are fundamentally bipartite or compound:
1. **Parallel Execution**: A `FORK_JOIN` cannot execute without a matching `JOIN` barrier task whose `joinOn` lists the terminal tasks of each branch.
2. **Conditional Routing**: A `SWITCH` router branching into multiple cases requires an `EXCLUSIVE_JOIN` merge point so that whichever single case completes unblocks downstream execution without deadlocking.
3. **Iterative Loops**: A `DO_WHILE` loop requires an internal body task pipeline and back-edge closure to `loop-back`, along with a forward `loop-exit` path.
4. **Human Review**: A `HUMAN` review gate requires dual resolution paths (`approved` and `rejected`).

Previously, adding any of these nodes left them isolated on canvas, requiring the author to manually drop 4-5 auxiliary nodes, hand-wire 4-6 connectors, and manually configure `joinOn` arrays.

To eliminate this friction and prevent invalid graph states, we implemented the **Compound Node Template Engine** in `@acc/console`.

---

## Changes Implemented

### 1. Extensible Factory Architecture (`utils/compound-templates/`)
- **`types.ts`**:
  - Defined strict TypeScript contracts: `CompoundTemplateOptions`, `CompoundTemplateResult`, `CompoundTemplateFactory`.
- **`compound-template-registry.ts`**:
  - Singleton `compoundTemplateRegistry` supporting Open/Closed Principle (OCP) extension.
- **`factories/fork-join-template.ts`**:
  - Implements **Topology 1** (`FORK_JOIN` + 2 parallel `SIMPLE` branches + `JOIN` barrier with pre-configured `joinOn`) and **Topology 2** (`DYNAMIC_FORK` + `JOIN` barrier).
- **`factories/switch-template.ts`**:
  - Implements **Topology 3** (`SWITCH` + 2 condition cases + 1 default case + `EXCLUSIVE_JOIN` merge node with `joinOn`).
- **`factories/do-while-template.ts`**:
  - Implements **Topology 4** (`DO_WHILE` + `Loop Step 1` body + loopback edge with `isLoopbackEdge: true` + `loop-exit` forwarding).
- **`factories/human-template.ts`**:
  - Implements **Topology 5** (`HUMAN` + `approved` action + `rejected` terminate node with `status: FAILED`).
- **`factories/saga-template.ts`**:
  - Implements **Topology 6** (`MUTATING_TASK` + bottom `compensate` rollback handler).

### 2. Canvas State Hook Integration (`use-dag-studio-state.ts`)
- **`handleSplitEdge`**:
  - Intercepts edge-splitting when inserting compound nodes.
  - Implements the **Downstream Node Push Invariant**: if clearance between source and target is less than template envelope width, automatically shifts downstream descendant nodes rightward ($\Delta x$), preventing visual node collision.
  - Rewires inbound edge to template primary entry node and outbound edge from template exit node.
- **`onDrop`**:
  - When dragging and dropping a compound node onto the canvas, automatically generates and appends the complete compound node cluster and internal edges.
- **`handleInsertStarterTask`**:
  - Enables instant 1-click fast-start from a blank workflow directly into a fully-wired, valid parallel fork or switch structure.

### 3. Cognitive UI/UX Affordances (`dag-palette.tsx` & `dag-quick-insert-popover.tsx`)
- Added `Template` visual badges and updated descriptions to highlight auto-paired bundles in `DagPalette`.
- Surfaced `Template` badges in `DagQuickInsertPopover` search list.

---

## Verification
- **Compound Templates Unit Tests**:
  - `compound-templates.test.ts`: 7/7 tests passed verifying node counts, edge counts, `joinOn` arrays, and handle mappings.
- **Canvas Integration Tests**:
  - `compound-canvas-integration.test.ts`: 5/5 tests passed verifying edge splitting, blank canvas fast-start, downstream collision push, and canvas drop.
- **Console Workflow Suite**:
  - `pnpm --filter @acc/console test "src/features/workflows"`: 26 test files passed, 130 tests passed.
- **Console TypeScript Strict Typing**:
  - `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
- **Unified Sandbox Parity**:
  - `pnpm --filter @acc/sandbox test`: 11 test files passed, 103 tests passed.
- **Backend Workflow Engine**:
  - `pnpm --filter @acc/backend exec node mvnw.cjs -pl workflow-engine test`: 74 tests passed, 0 failures.
