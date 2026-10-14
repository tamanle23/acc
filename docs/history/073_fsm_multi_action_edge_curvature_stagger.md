# 073: Multi-Action Edge Curvature Stagger & Stack Visuals for FSM Studio

**Date**: 2026-10-14  
**Author**: Lead Systems Architect  
**Category**: feat(console)  
**Scope**: `@unipost/console`  

---

## 1. Problem Statement
When a state node in the FSM Workflow Studio has multiple outgoing transitions or multiple actions connecting the same pair of nodes (e.g. `SUBMIT`, `REJECT`, `FAST_TRACK`, `APPROVE`), the React Flow edges and their label pills overlapped directly on top of each other, creating visual clutter and unreadable edge badges.

---

## 2. Plan
1. **Parallel Edge Grouping & Indexing**:
   - In `apps/console/src/features/metadata/components/studio/fsm-workflow-designer.tsx`, group transitions sharing the same `(sourceState, targetState)` pair.
   - Inject `multiIndex` and `multiTotal` metadata into each edge's data packet.
2. **Symmetrical Curvature Fan-Out**:
   - In `apps/console/src/features/metadata/components/studio/fsm-transition-edge.tsx`, compute a dynamic curvature offset based on the edge index:
     `curvature = Math.max(0.12, Math.min(0.65, 0.3 + (multiIndex - (multiTotal - 1) / 2) * 0.16))`.
   - Separate bezier arcs symmetrically so parallel edges curve gracefully without overlapping.
3. **Staggered Label Positioning & Stack Counter**:
   - Offset label `Y` position proportionally to keep event badges from colliding (`(multiIndex - (multiTotal - 1) / 2) * 32`).
   - Add contextual action icons (e.g. `Send`, `ShieldCheck`, `Rocket`, `Zap`, `Ban`) inside edge label pills.
   - Display a clean multi-action stack indicator (`1/2`, `2/2`, etc.) when multiple edges share a pathway.
4. **Verification**: Run Vitest suite across `@unipost/console`.

---

## 3. Changes Made
- [`apps/console/src/features/metadata/components/studio/fsm-transition-edge.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/fsm-transition-edge.tsx):
  - Dynamic curvature fan-out algorithm.
  - Staggered label positioning along perpendicular axis.
  - Action icons (`Send`, `ShieldCheck`, `Rocket`, `Zap`, `Ban`, `Archive`) mapped dynamically.
  - Added stack badge indicator (`<Layers className="h-2 w-2" /> index/total`).
- [`apps/console/src/features/metadata/components/studio/fsm-workflow-designer.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/fsm-workflow-designer.tsx):
  - Grouped transitions by source-target pair and indexed parallel edges.
  - Enriched `DEFAULT_FSM_TRANSITIONS` with multi-path actions (`REJECT`, `FAST_TRACK`).

---

## 4. Verification
- Vitest suite executed cleanly:
  - 9 test files passed, 54 tests passed with 0 errors.

---

## 5. Walkthrough
1. Navigate to **Metadata** &rarr; select model &rarr; **Schema** &rarr; **Visual Studio** &rarr; **FSM Workflow Studio**.
2. Notice the multi-action pathways (e.g. from `SUBMITTED` with both `APPROVE`, `REJECT`, and `FAST_TRACK`):
   - Edges fan out gracefully with varied bezier curvatures without clumping.
   - Action badges are staggered vertically so all transition events remain 100% visible and clickable.
   - Each transition badge displays its contextual action icon and stack position counter (`1/3`, `2/3`, `3/3`).
