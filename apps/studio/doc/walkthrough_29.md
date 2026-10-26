# Phase 29 Walkthrough: Replace @dnd-kit with @neodrag/react in Studio Preview Transform Gizmo (Phase 1)

## Overview
Successfully migrated the Canvas Transform Gizmo subsystem from `@dnd-kit` to `@neodrag/react`. The gizmo handles (top-left, top-right, bottom-left, bottom-right, top-center, bottom-center, middle-left, middle-right, rotation knob, and the central body translation container) now use native pointer events and lightweight `@neodrag/react` refs, eliminating top-level React Context re-renders on every mouse move.

## Changes Made
1. **Installed `@neodrag/react`**:
   - Added `@neodrag/react` to `@acc/studio` dependencies.
2. **`apps/studio/src/components/preview/TransformHandles.tsx`**:
   - Replaced `@dnd-kit/core`'s `useDraggable` with `@neodrag/react`'s `useDraggable`.
   - Wired `TransformHandle` and `TransformBodyDraggable` to attach directly to DOM refs via `handleRef` and `bodyRef`.
   - Configured custom `transform: () => ''` to prevent Neodrag from applying local transforms on corner handles while allowing delta coordinates (`offsetX`, `offsetY`) to feed `Gizmo2DTransformation.computeDragTransform`.
   - Maintained 3px threshold activation constraint to preserve click and double-click actions (such as subtitle cue editing).
3. **`apps/studio/src/components/preview/TransformGizmoOverlay.tsx`**:
   - Removed `<DndContext>` and sensor descriptor overhead.
   - Simplified props by replacing `transformSensors`, `onTransformDragStart`, `onTransformDragMove`, and `onTransformDragEnd` with typed `onHandleDragStart`, `onHandleDrag`, and `onHandleDragEnd` callbacks.
4. **`apps/studio/src/components/Preview.tsx`**:
   - Cleaned up unused `@dnd-kit/core` imports (`DndContext`, `PointerSensor`, `useSensors`, `useSensor`).
   - Replaced the synthetic drag handlers with direct delta vector handlers (`handleTransformDragMove` taking `handleType` and `delta: { x, y }`).

## Verification
- Verified production build via `pnpm --filter @acc/studio exec vite build`:
  - 2,214 modules transformed.
  - Zero TypeScript compilation or Rollup bundling errors (`built in 7.46s`).
