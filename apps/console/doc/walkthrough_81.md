# Walkthrough 81: Directional Edges with Semantic SVG Arrow Markers for FSM Studio

We introduced directional edge connections with arrowheads indicating transition ingress and flow direction across the FSM Workflow Studio.

---

## 1. Problem & Objectives

1. **Flow Ambiguity**: Previously, transition edges rendered as smooth lines with action badges in the middle, but did not render directional arrowheads terminating at the ingress connector ports of target states.
2. **Directional Distinction**: Users needed clear visual confirmation of which direction a transition moves (e.g. forward progress vs backward rejection/rollback vs self-loops).

---

## 2. Changes Made

### A. Arrowhead Markers & Marker Passthrough (`fsm-transition-edge.tsx`)
- Updated `FsmTransitionEdgeComponent` to accept `markerEnd`, `markerStart`, and `style` props.
- Added dynamic fallback marker `url(#fsm-arrow-active)` when an edge is selected, and `url(#fsm-arrow-default)` when idle.
- Added semantic stroke tinting:
  - **Forward transitions**: `oklch(0.62 0.16 260 / 65%)` (slate/sky).
  - **Backward / rollback transitions**: `oklch(0.65 0.20 25 / 75%)` (warm coral/rose).
  - **Active / selected transitions**: `var(--primary)`.

### B. Standard `MarkerType.ArrowClosed` Definition (`fsm-workflow-designer.tsx`)
- In `initialEdges`, configured each edge with `MarkerType.ArrowClosed`:
  ```ts
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
    color: isBackward ? 'oklch(0.65 0.20 25 / 85%)' : 'oklch(0.62 0.16 260 / 80%)',
  }
  ```
- Each directional edge terminates cleanly into its dynamic handle port on the perimeter of the target state card.

---

## 3. Verification

- Ran `pnpm --filter @unipost/console test src/features/metadata`:
  - **9 test files passed**, **55 tests passed** (100% pass rate).
