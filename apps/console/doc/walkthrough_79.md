# Walkthrough 79: Dynamic Lifecycle-Driven Connector Ports & Smooth Transitions for FSM Workflow Studio

We implemented dynamic port generation based on each state's incoming and outgoing lifecycle transitions, replaced fixed port counts, and smoothed out transition bezier curves with clear non-overlapping action badges.

---

## 1. Problem & Objectives

1. **Fixed Port Limitations**: FSM state nodes previously used a static count of ports (e.g. 2 or 6), forcing multiple transitions to bunch up or enter/exit identical coordinate points, producing visual clutter.
2. **Action Badge Collisions**: Multiple actions exiting the same node or traveling between the same pair of states overlapped, obscuring triggers and guard conditions.
3. **Transition Curves**: Curves needed natural distance-proportional bezier curvature so transitions route smoothly without snapping or crossing cards clumsily.

---

## 2. Changes Made

### A. Dynamic Lifecycle-Driven Connector Ports (`fsm-state-node.tsx`)
- Introduced `DynamicHandleConfig` specifying individual port ID, type (`source` / `target`), perimeter position (`Position.Top`, `Position.Right`, `Position.Bottom`, `Position.Left`), percentage offset along the card edge (`offsetPct`), and trigger metadata.
- Replaced hardcoded handle lists with dynamically mapped `incomingHandles` and `outgoingHandles` on each `FsmStateNodeComponent`.
- Styled handles with translucent Liquid Glass borders, hover rings, and smooth scale transitions.

### B. Natural Distance-Proportional Curvature & Staggered Action Badges (`fsm-transition-edge.tsx`)
- Replaced fixed curvature with Euclidean distance-proportional bezier curvature math:
  $$\text{curvature} = \min\left(0.75, \max\left(0.15, \frac{\text{dist}}{900} + \text{offsetFactor}\right)\right)$$
- Self-loops route cleanly over top ports with elevated loop curvature ($0.65+$).
- Backward / rollback transitions route underneath via bottom ports.
- Parallel transitions compute staggered 2D label offsets (`labelXOffset`, `labelYOffset`) so action badges never overlap.
- Action badges feature semantic Lucide action icons (`Send`, `ShieldCheck`, `Rocket`, `Zap`, `Ban`), multi-action stack counters (`1/2`, `2/2`), and high-contrast Liquid Glass pill styling (`backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 border-white/50`).

### C. Topology-Aware Port Distribution (`fsm-workflow-designer.tsx`)
- In `initialNodes`, inspected `initialTransitions` for each state:
  - Distributed forward outgoing transitions evenly along `Position.Right`.
  - Distributed backward/rollback transitions evenly along `Position.Bottom`.
  - Distributed self-loops along `Position.Top`.
  - Distributed incoming forward transitions along `Position.Left`, rollback incoming along `Position.Bottom`, and loops along `Position.Top`.
  - Spaced offsets evenly: $\text{offsetPct}_i = \text{round}\left(\frac{i + 1}{\text{count} + 1} \times 100\right)$.
- In `initialEdges`, bound each transition's `sourceHandle` and `targetHandle` directly to `source-${t.id}` and `target-${t.id}`.

---

## 3. Verification

- Ran `pnpm --filter @acc/console test src/features/metadata`:
  - **9 test files passed**, **54 tests passed** (including all FSM Studio designer and visual schema suite tests).
