# Phase 29 Implementation Plan: Replace @dnd-kit with @neodrag/react in Studio Preview Transform Gizmo (Phase 1)

## 1. Problem Statement
The Canvas Transform Gizmo overlay in `apps/studio/src/components/Preview.tsx` currently wraps 9 drag handles (`nw`, `ne`, `se`, `sw`, `n`, `s`, `e`, `w`, and `body`) in a nested `@dnd-kit` `<DndContext>` with synthetic pointer sensors. 
During continuous resizing, rotating, or repositioning of preview sequences at 60fps, `@dnd-kit` triggers frequent top-level React Context updates and synthetic event propagation, which adds unnecessary overhead and friction on high-refresh displays.

## 2. Proposed Architecture
Migrate the Transform Gizmo subsystem to `@neodrag/react`:
1. **`TransformHandles.tsx`:**
   - Replace `@dnd-kit/core`'s `useDraggable` with `@neodrag/react`'s `useDraggable`.
   - Configure handles with reset position `{ x: 0, y: 0 }` so delta coordinates (`offsetX`, `offsetY`) are cleanly emitted directly to the parent transform calculator.
   - For `TransformBodyDraggable`, preserve double-click cue editing while enabling direct 2D translation.
2. **`TransformGizmoOverlay.tsx`:**
   - Remove `<DndContext>` and `@dnd-kit` sensor imports completely.
   - Pass handle-specific callbacks (`onHandleDragStart`, `onHandleDrag`, `onHandleDragEnd`) through to the handles.
3. **`Preview.tsx`:**
   - Remove `transformSensors` (`PointerSensor`, `useSensors`, `useSensor`).
   - Wire `onHandleDragStart`, `onHandleDrag`, and `onHandleDragEnd` directly into `Gizmo2DTransformation.computeDragTransform`.
   - Update `IRStateManager` with the final modifier transform on release (`onHandleDragEnd`).
4. **UX & Tooltip Protection:**
   - When dragging is active (`isDragging = true`), suppress hover HUDs and prevent tooltip focus theft.

## 3. Verification Plan
- Verify clean compilation with Vite: `pnpm --filter @acc/studio exec vite build`.
- Verify transform handles (resize, rotate, move) function accurately in DOM mode.
