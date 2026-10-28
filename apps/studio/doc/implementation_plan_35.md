# Implementation Plan 35: Studio Enterprise Cleanup & Architecture Modernization

## Overview
Multi-phase initiative to elevate `@acc/studio` (`apps/studio`) to enterprise-grade clean code, strict TypeScript, 60 FPS React 19 performance, shadcn/Tailwind hygiene, and WCAG 2.2 AA compliance.

## Phases
- **Phase 1 (Executed)**: Dead Code & Pipeline Consolidation
  - Remove dead `Sidebar.tsx` (1,317 lines) and unused chat UI primitives (`bubble.tsx`, `message-scroller.tsx`, `questionnaire.tsx`, `trace.tsx`, `use-highlighted-code.ts`).
  - Consolidate fragmented worker folders (`src/lib/worker/`, `src/lib/workers/`, `src/lib/timeline/strategies/`) into `src/renderer/workers/`.
  - Unify `AssetTextureCache` into `src/lib/textures/AssetTextureCache.ts` with `Disposable` support and bounded cache eviction.
  - Prune 12 unused Shiki language grammars from `src/lib/highlighter.tsx`.
- **Phase 2 (Executed)**: Reactive Store (`useSyncExternalStore`) & Strict TypeScript
  - Introduce `studioTypes.ts` (`StudioSequence`, `StudioTrack`, `StudioAssetRecord`, `StudioDragPayload`, frame & track normalization helpers) and `useStudioStore.ts` (`useIRState`, `useIRSelector`, `usePlayheadFrame`, `usePlayheadIsPlaying`).
  - Harden `IRStateManager` with synchronous immutable state transitions on `dispatch`, `undo`, `redo`, `switchTemplate`, and `loadFromJSON`.
  - Fix stale un-subscribed state in `Titlebar.tsx` and `ModifierControlStrategies.tsx`, and fix `App.tsx` linked A/V drop payload schema mismatch.
  - Eliminate `any` sprawl across commands, timeline, preview, inspector, and audio/shuttle modules.
- **Phase 3 (Planned)**: God-Component Decomposition (`App.tsx`, `LeftSidebar.tsx`, `ModifierControlStrategies.tsx`) & 60 FPS Timeline Virtualization
- **Phase 4 (Planned)**: Enterprise UX, Resizable Layout, Sonner Toasts, and `DESIGN.md` / `ROUTE.md` Specs
