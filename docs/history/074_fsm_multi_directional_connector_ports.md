# 074: Multi-Directional Connector Ports for FSM State Nodes

**Date**: 2026-10-14  
**Author**: Lead Systems Architect  
**Category**: feat(console)  
**Scope**: `@unipost/console`  

---

## 1. Problem Statement
Previously, FSM state nodes had only 2 connector points: one input handle on the Left (`Position.Left`) and one output handle on the Right (`Position.Right`).
When a state had multiple incoming and outgoing transitions (such as rejections returning to `DRAFT`, self-loops, fast-tracks, or concurrent branches), all edges crowded into the exact same 2 anchor points.

---

## 2. Plan
1. **Multi-Point Ingress & Egress Ports**:
   - Upgrade `FsmStateNodeComponent` in `apps/console/src/features/metadata/components/studio/fsm-state-node.tsx` to expose 6 distinct directional connector ports with dedicated handle IDs:
     - **Ingress / Target Handles**:
       - `target-top` (`Position.Top`): Incoming high loops or secondary merges.
       - `target-left` (`Position.Left`): Main incoming forward pipeline transitions.
       - `target-bottom` (`Position.Bottom`): Incoming return, rejection, or revision paths.
     - **Egress / Source Handles**:
       - `source-top` (`Position.Top`): Outgoing self-loops and high arc branches.
       - `source-right` (`Position.Right`): Main forward lifecycle progressions.
       - `source-bottom` (`Position.Bottom`): Outgoing rejections, rollbacks, and fast-tracks.
2. **Intelligent Topological Routing**:
   - In `apps/console/src/features/metadata/components/studio/fsm-workflow-designer.tsx`, calculate topological direction between source and target states:
     - **Forward progressions** (`targetIdx > sourceIdx`) route from `source-right` &rarr; `target-left`.
     - **Reverse / Rejection progressions** (`targetIdx < sourceIdx`) route from `source-bottom` &rarr; `target-bottom`, looping under the main flow cleanly.
     - **Self-loops** (`targetIdx === sourceIdx`) route from `source-top` &rarr; `target-top`.
     - **Parallel forward pathways** alternate between right and top handles.
3. **Verification**: Run Vitest suite across `@unipost/console`.

---

## 3. Changes Made
- [`apps/console/src/features/metadata/components/studio/fsm-state-node.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/fsm-state-node.tsx): Added 6 multi-directional handle ports (`target-top`, `target-left`, `target-bottom`, `source-top`, `source-right`, `source-bottom`) with distinct positioning and hover glows.
- [`apps/console/src/features/metadata/components/studio/fsm-workflow-designer.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/fsm-workflow-designer.tsx): Wired topological direction routing connecting edges to optimal port handles based on state progression order.

---

## 4. Verification
- Ran `pnpm --filter @unipost/console test src/features/metadata`:
  - 9 test files passed, 54 tests passed with 0 errors.

---

## 5. Walkthrough
1. Navigate to **Metadata** &rarr; select model &rarr; **Schema** &rarr; **Visual Studio** &rarr; **FSM Workflow Studio**.
2. Notice how transitions now attach to appropriate sides:
   - Forward progress (`DRAFT` &rarr; `SUBMITTED` &rarr; `APPROVED` &rarr; `PUBLISHED`) flows seamlessly from Right to Left ports.
   - Backward branches (e.g. `REJECT` from `SUBMITTED` &rarr; `DRAFT`) flow out of the bottom port and into the target's bottom port without intersecting forward labels.
   - Secondary parallel transitions use the top ports to avoid crowding.
