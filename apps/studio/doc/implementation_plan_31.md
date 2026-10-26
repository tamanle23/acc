# Phase 31 Implementation Plan: Complete Elimination of @dnd-kit and Implementation of StagingDragManager (Phase 3)

## 1. Problem Statement
With Preview Transform Gizmo (Phase 1) and Timeline Clips & Trimming (Phase 2) successfully transitioned to `@neodrag/react`, the final remaining `@dnd-kit` usage was the global staging pipeline:
- Dragging preset templates and vault media assets from `LeftSidebar.tsx`.
- Dropping into the canvas viewport in `Preview.tsx` or onto track lanes in `DroppableTrackLane.tsx`.
- The root `<DndContext>` and `<DragOverlay>` in `App.tsx`.
- Unused dependencies `@dnd-kit/core` and `@dnd-kit/utilities` in `apps/studio/package.json`.

## 2. Proposed Architecture
1. **`StagingDragManager.ts`**:
   - Create an enterprise singleton and observer managing cross-container staging drag sessions.
   - Implement spatial point-in-elements hit-testing (`document.elementsFromPoint`) matching `[data-drop-zone="canvas-viewport"]` and `[data-track-lane-id]`.
   - Provide magnetic snapping and track compatibility checks.
   - Expose React hook `useStagingDrag()` for zero-re-render component subscriptions.
2. **`LeftSidebar.tsx`**:
   - Refactor `DraggablePresetCard` and `DraggableAssetCard` to use `@neodrag/react`.
   - Connect `onDragStart`, `onDrag`, and `onDragEnd` directly to `StagingDragManager`.
3. **`Preview.tsx` & `DroppableTrackLane.tsx`**:
   - Remove `@dnd-kit`'s `useDroppable` completely.
   - Use `useStagingDrag()` to dynamically highlight active drop zones with Liquid Glass styling.
4. **`App.tsx`**:
   - Remove `<DndContext>` and `<DragOverlay>`.
   - Implement direct GPU-positioned drag ghost overlay.
   - Connect `StagingDragManager.setDropHandler` to sequence insertion logic.
5. **Package Cleanup**:
   - Remove `@dnd-kit/core` and `@dnd-kit/utilities` from `package.json`.

## 3. Verification Plan
- Unit test `StagingDragManager` with Bun test suite (`staging_drag_manager.test.ts`).
- Verify production build with Vite (`pnpm --filter @acc/studio exec vite build`).
