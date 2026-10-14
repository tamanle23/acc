# Walkthrough 80: FSM Workflow Studio Auto Layout Engine & Force Refresh Button

We implemented an intelligent Auto Layout system with three distinct aesthetic layout modes (Staggered Flow, Linear DAG, and Compact Matrix) and an elevated Liquid Glass "Auto Layout" force refresh button.

---

## 1. Problem & Objectives

1. **Manual Node Drag Clutter**: When users drag nodes around or start with complex multi-transition state machines, nodes can end up unaligned, tangled, or off-center.
2. **Need for Instant Beauty & Restructuring**: Users needed a one-click "Auto Layout" / Force Refresh action that reorganizes cards into clean geometric coordinates and smoothly re-centers the viewport with animated `fitView`.
3. **Multiple Workflow Scenarios**: Different workflows benefit from different geometric arrangements:
   - **Staggered Flow**: Alternates vertical tiers ($y = 110$ vs $210$) to grant breathing room for parallel and rollback transition arcs.
   - **Linear DAG**: Clean single-line pipeline ideal for sequential approvals.
   - **Compact Matrix**: 2D grid ideal for large state graphs (10+ states) on smaller screens.

---

## 2. Changes Made

### A. Layout Computation Engine (`fsm-workflow-designer.tsx`)
- Created `computeLayoutCoordinates(states, mode)`:
  - **`stagger`**: Distributes states horizontally ($x = 80 + i \times 240$) with alternating vertical elevation ($y = i \% 2 == 0 ? 110 : 210$).
  - **`dag`**: Linear baseline ($y = 160$) with generous horizontal spacing ($x = 80 + i \times 260$) for smooth bezier curves.
  - **`compact`**: Computes grid columns ($cols = \min(3, \max(2, \lceil\sqrt{total}\rceil))$) and distributes nodes into rows and columns ($x = 80 + col \times 280, y = 90 + row \times 160$).

### B. Force Refresh Auto Layout Action & Animated FitView
- Created `handleForceAutoLayout(mode)`:
  - Recomputes and updates all node coordinates in state.
  - Triggers a smooth animated camera zoom/pan:
    ```ts
    reactFlowInstanceRef.current.fitView({
      padding: 0.28,
      duration: 600,
    });
    ```
  - Displays transient spin animation on the refresh icon while computing.

### C. Liquid Glass Top-Right Action Bar
- Added a floating toolbar in the top-right corner of the React Flow canvas:
  - Segmented layout mode selector: **Staggered** (`Layers`), **Linear DAG** (`GitFork`), and **Compact** (`LayoutGrid`).
  - Elevated glass action button: **Auto Layout** with `Sparkles` and `RotateCw` icons (`variant="glass"`).

---

## 3. Verification

- Added unit tests in `visual-schema-studio.test.tsx` verifying:
  - Rendering of all layout mode buttons (`Staggered`, `Linear DAG`, `Compact`).
  - Rendering of the `Auto Layout` force refresh button.
  - Triggering of force auto-layout and mode switching without errors.
- Vitest suite results:
  - **9 test files passed**, **55 tests passed** (100% pass rate).
