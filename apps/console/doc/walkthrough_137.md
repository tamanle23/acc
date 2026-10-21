# Walkthrough 137: Pure Conventional START & END Workflow Boundary Nodes

## Summary
Refactored START and END nodes into pure conventional boundary nodes strictly dedicated to declaring workflow input schema (`workflow.input`) and mapping workflow output payload (`workflow.output`), without any worker bindings, retry policies, execution timeouts, or connector logic.

## Key Changes

### 1. Directional Handle Constraints (`dag-node.tsx`)
- **START Node (`isStartNode: true`)**:
  - Target handle (in-degree) is omitted: incoming edges cannot be connected to START.
  - Source handle (out-degree) is rendered on the right.
  - Dedicated `PlaySquare` emerald icon with `START` badge.
  - Body shows `Workflow Input (N params)` instead of worker timeouts/retries.
- **END Node (`isEndNode: true`)**:
  - Source handle (out-degree) is omitted: outgoing edges cannot emerge from END.
  - Target handle (in-degree) is rendered on the left.
  - Dedicated `StopCircle` purple icon with `END` badge.
  - Body shows `Workflow Output (N mappings)` instead of worker timeouts/retries.

### 2. Dedicated Property Inspector Experience (`dag-property-inspector.tsx`)
- **START Inspector (`isStartNode`)**:
  - Displays "Workflow Start — Input Definition" with an informative explanation banner.
  - Replaces all worker catalog, retry, timeout, saga compensation, and connector tabs with a pure input configuration surface.
  - Uses `VisualJsonEditor` (Tree, Form, and Code modes) to configure `workflow.input`.
  - Provides 1-click copyable expression pills (`${workflow.input.<key>}`).
- **END Inspector (`isEndNode`)**:
  - Displays "Workflow End — Output Definition" with an informative explanation banner.
  - Replaces all worker catalog, retry, timeout, saga compensation, and connector tabs with a pure output mapping surface.
  - Configures termination status (`COMPLETED` or `FAILED`) and completion message.
  - Uses `VisualJsonEditor` to map preceding task outputs into `workflow.output`.
  - Provides 1-click clickable pills of available upstream task outputs (`${task.output.*}`).

### 3. Canvas Initial State & Connection Validation (`visual-dag-studio.tsx`)
- `INITIAL_NODES` now features pure `node-start` (`taskReferenceName: 'workflow_start'`, `NOOP`, `isStartNode: true`) and pure `node-end` (`taskReferenceName: 'workflow_end'`, `TERMINATE`, `isEndNode: true`).
- Intermediate business tasks (`checkInventory`, `routeShipping`, `expressCourier`, `groundPostal`) connect between Start and End.
- `isValidConnection` strictly rejects self-loops, connections targeting START, and connections originating from END.

### 4. Canonical IR Serialization & Invariant Checking (`workflow-ir-converter.ts`)
- `exportToWorkflowIR` preserves boundary flags in `layoutMetadata`.
- `importFromWorkflowIR` automatically restores `isStartNode`, `isEndNode`, and `isPermanent` flags.
- `validateGraphTopology` verifies that the graph has exactly 1 entry node and 1 exit node.

## Verification
- Vitest: 11 test files passed, 50/50 tests passing (100% green).
- TypeScript: `pnpm --filter @unipost/console exec tsc --noEmit` exited `0` with 0 errors.
- Backend: `mvnw.cmd test -pl workflow-engine -q` passed 100%.
