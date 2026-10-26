# History Record 224: Replace @dnd-kit with @neodrag/react in Studio Preview Transform Gizmo

## Problem
In `apps/studio`, the Canvas Transform Gizmo in `Preview.tsx` wrapped 9 interactive bounding box handles in a nested `@dnd-kit` `<DndContext>`. During 60fps continuous scaling, rotating, and translating operations, `@dnd-kit`'s top-level React Context updates and synthetic pointer sensors introduced unnecessary latency and React reconciliation overhead.

## Plan
1. Install `@neodrag/react` into `@acc/studio`.
2. Refactor `TransformHandles.tsx` to use `@neodrag/react`'s `useDraggable` hook with direct DOM refs and delta vector emissions.
3. Remove `<DndContext>` and `@dnd-kit` sensor descriptors from `TransformGizmoOverlay.tsx`.
4. Update `Preview.tsx` to receive direct `handleType` and `delta: { x, y }` vectors for `Gizmo2DTransformation.computeDragTransform`.
5. Fix relative import paths in `GrabCutFallbackStrategy.ts` and `HeuristicDepthStrategy.ts`.
6. Verify production build with Vite.

## Changes
- `apps/studio/package.json`: Added `@neodrag/react`.
- `apps/studio/src/components/preview/TransformHandles.tsx`: Migrated `TransformHandle` and `TransformBodyDraggable` to `@neodrag/react`.
- `apps/studio/src/components/preview/TransformGizmoOverlay.tsx`: Removed `<DndContext>` wrapper and simplified callback props.
- `apps/studio/src/components/Preview.tsx`: Removed `transformSensors` and updated drag handlers to consume `@neodrag/react` deltas.
- `packages/core-isomorphic/src/vision/strategies/GrabCutFallbackStrategy.ts`: Fixed relative imports for `canvas` and `types`.
- `packages/core-isomorphic/src/vision/strategies/HeuristicDepthStrategy.ts`: Fixed relative imports for `canvas` and `types`.
- `apps/studio/doc/implementation_plan_29.md`: Documented implementation plan.
- `apps/studio/doc/walkthrough_29.md`: Documented architectural walkthrough.

## Verification
- Executed `pnpm --filter @acc/studio exec vite build`: Completed with exit code 0 (`built in 7.46s`).
- All 9 transform handles compile and bind to native pointer events cleanly.
