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
- **Phase 3 (Executed)**: God-Component Decomposition (`App.tsx`, `LeftSidebar.tsx`, `ModifierControlStrategies.tsx`) & 60 FPS Timeline Virtualization
  - Extract `ClientExportOrchestrator` (with main-thread yielding and `AbortController` cancellation), `useWorkspaceDnd`, and `ExportProgressModal` from `App.tsx` (692 -> 269 lines).
  - Wrap `ClipItem` in `React.memo` and pass scoped primitive drag props from `TimelineDom.tsx` with `useCallback`-stabilized handlers so stationary clips do not re-render during 60Hz drag moves.
  - Modularize `LeftSidebar.tsx` (1,190 -> 396 lines) into `src/components/sidebar/` (`PresetThumbnails.tsx`, `SidebarCards.tsx`, `SidebarActivityRail.tsx`).
  - Modularize `ModifierControlStrategies.tsx` (1,130 -> 217 lines) into `src/components/inspector/strategies/` (`PrimitiveControlStrategies.tsx`, `RegionsArrayControlStrategy.tsx`, `CompositeGroupControlStrategies.tsx`).
- **Phase 4 (Executed)**: Enterprise UX, Resizable Layout, Sonner Toasts, and `DESIGN.md` / `ROUTE.md` Specs
  - Author missing mandatory workspace specifications `apps/studio/DESIGN.md` (Liquid Glass tokens, color invariants) and `apps/studio/ROUTE.md` (topology, modal hierarchy, keybinding matrix).
  - Integrate `ResizablePanelGroup`, `ResizablePanel`, and `ResizableHandle` in `App.tsx` for dynamic, accessible vertical resizing between the video viewport stage and timeline tracks.
  - Replace blocking `window.alert(...)` modals with non-blocking, accessible `sonner` toast notifications (`toast.success` with "Download Again" action button, `toast.error`).
  - Enforce WCAG 2.2 AA accessibility: add `aria-pressed`, `aria-label`, and `focus-visible:ring-2` across `SettingsModal.tsx`, `TrackHeaderCard.tsx`, `Toolbar.tsx`, and `ViewportControlBar.tsx`.
