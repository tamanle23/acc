# 447 - Refactor Human Approval Node to Atomic In-Line Review Gate

## Problem
In previous iterations, the `HUMAN` approval task was modeled as a compound, multi-branching construct that spawned dedicated child nodes for `Process Approval` (`SIMPLE`) and `Reject & Terminate` (`TERMINATE`), along with an inline `+ Add Outcome` button and dual `approved` / `rejected` output handles. This conflicted with the runtime execution lifecycle in `WorkflowEngineService.java`, where a rejected approval terminates directly at the human task without requiring a separate node, an approved task completes and continues execution forward to the next task in the pipeline, and an escalated task remains on hold on the human task itself waiting for another reviewer.

## Plan
1. **Remove Multi-Branch Semantics**: Remove `HumanBranchStrategy` from `MultiBranchRegistry` and strip `+ Add Outcome` button from `dag-node.tsx`.
2. **Remove Compound Template**: Remove `HumanTemplateFactory` from `CompoundTemplateRegistry` and set `isCompound: false` in `dag-palette.tsx` so adding a human review node adds a single atomic node without dedicated child nodes.
3. **Consolidate Output Ports**: Remove dual `approved` and `rejected` handles in `dag-node.tsx`, replacing them with a single standard `source-right` output handle for continuing to the next node on approval.
4. **Enrich Visual & Inspector Configuration**:
   - Add reviewer role, SLA, and lifecycle policy summary to the canvas node card.
   - Add `Escalation Role / Target` input and an Execution Lifecycle card in `dag-property-inspector.tsx`.
5. **Verify Suite**: Verify with targeted Vitest runs, full workflow test suite (28 test files), and TypeScript strict compilation.

## Changes

### 1. Canvas Node Card (`apps/console/src/features/workflows/components/studio/canvas/dag-node.tsx`)
- Extended `HumanTaskParams` with `escalationRole?: string`.
- Removed `|| data.taskType === 'HUMAN'` from `onAddBranch` action button check.
- Removed dual handles (`approved` and `rejected`), allowing `HUMAN` to use the standard `source-right` port.
- Added in-line body summary displaying `Role`, `Policy: Approve → Next`, and `Reject stops · Escalate holds`.

### 2. State & Resolution Hook (`apps/console/src/features/workflows/components/studio/hooks/use-dag-studio-state.ts`)
- Removed `taskType === 'HUMAN'` override in `resolveSourceHandle` so edges default cleanly to `'source-right'`.

### 3. Registry & Palette Normalization
- `dag-palette.tsx`: Updated `isCompound: false` and revised description to `"Reviewer approval gate: continues on approve, stops on reject, holds on escalate"`.
- `compound-templates/compound-template-registry.ts`: Removed `HumanTemplateFactory` from default registration.
- Pruned `compound-templates/factories/human-template.ts` and `compound-templates/index.ts`.
- `branch-strategies/index.ts`: Removed `HumanBranchStrategy` from self-registration.
- Pruned `branch-strategies/strategies/human-branch-strategy.ts`.

### 4. Property Inspector (`apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx`)
- Added `Escalation Role / Target` input field.
- Added Execution Lifecycle documentation card.

### 5. Automated Tests
- Updated `dag-node.test.tsx` to assert single standard `source-right` handle and review gate summary.
- Updated `compound-templates.test.ts` to assert `isCompound('HUMAN') === false`.
- Updated `multi-branch-strategies.test.ts` to assert `multiBranchRegistry.supports('HUMAN') === false`.

## Verification
- Targeted unit & integration tests: `pnpm --filter @acc/console test "multi-branch-strategies.test.ts" "compound-templates.test.ts" "dag-node.test.tsx" "multi-branch-canvas.test.ts"` (4 files, 30 tests passed).
- Full console workflow test suite: `pnpm --filter @acc/console test "src/features/workflows"` (28 files, 144 tests passed).
- TypeScript strict check: `pnpm --filter @acc/console exec tsc --noEmit` (0 errors).

## Walkthrough
Detailed architecture and implementation decisions are documented in [`apps/console/doc/walkthrough_169.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_169.md) and [`apps/console/doc/implementation_plan_169.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/implementation_plan_169.md).

## Tasks
- [x] Remove `+ Add Outcome` button from `dag-node.tsx`
- [x] Remove dual approved/rejected handles and wire standard `source-right` port
- [x] Unregister and prune `HumanBranchStrategy`
- [x] Unregister and prune `HumanTemplateFactory`
- [x] Set `isCompound: false` in `dag-palette.tsx`
- [x] Add escalation role and lifecycle guide in `dag-property-inspector.tsx`
- [x] Update test expectations and verify test suite

## Enhancement
Future enhancements can connect the visual review gate with live SSE WebSocket execution feeds to highlight active review assignees and real-time SLA countdown timers on the canvas card during workflow execution.
