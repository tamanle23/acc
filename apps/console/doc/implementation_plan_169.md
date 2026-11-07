# Implementation Plan 169 - Refactor Human Approval Node to Atomic In-Line Review Gate

## Goal Description
Refactor the `HUMAN` approval task in `@acc/console` Visual DAG Studio from a pseudo-branching compound construct into an atomic, in-line governance review gate aligned with Netflix Conductor OSS and enterprise human task lifecycles:
1. **Execution Lifecycle**:
   - **Approve**: Workflow execution continues along the single outbound connection to the next node.
   - **Reject**: Workflow execution terminates and stops directly at the human node (`TaskStatus.FAILED`). No dedicated reject termination node.
   - **Escalate**: Workflow execution remains on hold on the human node (`TaskStatus.WAITING_FOR_APPROVAL`), reassigning to the escalation reviewer role without branching to extra nodes.
2. **Topology & Studio Cleanup**:
   - Eliminate dedicated approval, rejection, and escalation nodes from compound templates.
   - Remove `HUMAN` from `compoundTemplateRegistry` (atomic single-node insertion).
   - Remove `HUMAN` from `MultiBranchRegistry` and remove `+ Add Outcome` button from node cards.
   - Replace dual approved/rejected port handles with a standard `source-right` outbound handle.

---

## User Review Required
> [!IMPORTANT]
> **Atomic Review Gate Invariant**:
> Human review nodes no longer spawn or connect to separate child nodes for approve/reject. Rejection halts execution at the node itself, while approval continues linear execution to downstream workflow tasks.

---

## Proposed Changes

### Visual DAG Canvas (`apps/console/src/features/workflows/components/studio/canvas/`)
- `dag-node.tsx`:
  - Extend `HumanTaskParams` with `escalationRole?: string`.
  - Remove `|| data.taskType === 'HUMAN'` from the multi-branch quick action button (`onAddBranch`).
  - Remove separate `approved` and `rejected` handles; fallback to standard `source-right` port.
  - Render an informative review gate body summary (Role, Policy: Approve $\rightarrow$ Next, Reject stops, Escalate holds).

### Hook & Handle Resolution (`apps/console/src/features/workflows/components/studio/hooks/`)
- `use-dag-studio-state.ts`:
  - In `resolveSourceHandle`, remove special casing that returned `'approved'` for `HUMAN` tasks.

### Template & Strategy Registries (`apps/console/src/features/workflows/components/studio/utils/`)
- `palette/dag-palette.tsx`:
  - Set `isCompound: false` for `HUMAN` and update description.
- `compound-templates/compound-template-registry.ts` & `index.ts`:
  - Unregister `HumanTemplateFactory` so `isCompound('HUMAN')` returns `false`.
  - Prune dead factory `human-template.ts`.
- `branch-strategies/index.ts`:
  - Unregister `HumanBranchStrategy` from `multiBranchRegistry`.
  - Prune dead strategy `human-branch-strategy.ts`.

### Property Inspector (`apps/console/src/features/workflows/components/studio/inspectors/`)
- `dag-property-inspector.tsx`:
  - Add `Escalation Role / Target` input field.
  - Display clear Execution Lifecycle governance guide card.

---

## Verification Plan

### Automated Unit & Integration Tests
- `pnpm --filter @acc/console test "multi-branch-strategies.test.ts" "compound-templates.test.ts" "dag-node.test.tsx" "multi-branch-canvas.test.ts"`
- `pnpm --filter @acc/console test "src/features/workflows"`
- Strict type checking: `pnpm --filter @acc/console exec tsc --noEmit`
