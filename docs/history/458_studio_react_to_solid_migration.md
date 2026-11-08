# 458: Studio Migration from React 19 to SolidJS 1.9

## Problem Statement
In `@acc/studio`, 60fps NLE video editing, real-time playhead needle scrubbing, multi-track audio waveform rendering, and WebGL/WebGPU preview composition were previously tied to React 19. This introduced substantial runtime overhead:
1. **Virtual DOM Diffing Overhead**: 60fps playhead ticks and high-frequency pointer scrubbing triggered reconciler cycles and state updates across composite subtrees.
2. **Heavy Bundle & React Dependencies**: Legacy dependencies included `react`, `react-dom`, `@types/react*`, `lucide-react`, `@dnd-kit/core`, `@dnd-kit/utilities`, and unreferenced Radix UI primitives.
3. **Synthetic Mocks vs Real Engine**: Playhead subscriptions and store hooks utilized `useSyncExternalStore` wrappers requiring frequent shallow equality checks.

## Plan
1. **Package & Build Tooling Migration (Phase 1)**:
   - Replace React dependencies in [`apps/studio/package.json`](../../apps/studio/package.json) with `solid-js` 1.9, `vite-plugin-solid`, `@kobalte/core`, `@corvu/resizable`, `@tanstack/solid-virtual`, `@dnd-kit/solid`, `@dnd-kit/dom`, `@dnd-kit/abstract`, `solid-sonner`, and `lucide-solid`.
   - Configure [`vite.config.ts`](../../apps/studio/vite.config.ts) and [`tsconfig.json`](../../apps/studio/tsconfig.json) for native SolidJS JSX preserving.
2. **Reactive Store & Framework-Agnostic State Machines (Phase 2)**:
   - Rewrite [`useStudioStore.ts`](../../apps/studio/src/lib/ir/useStudioStore.ts) and [`irState.ts`](../../apps/studio/src/lib/ir/irState.ts) into fine-grained SolidJS signal accessors (`useIRState`, `useIRSelector`, `usePlayheadFrame`, `usePlayheadIsPlaying`).
   - Retain [`TimelinePointerStateMachine.ts`](../../apps/studio/src/lib/timeline/TimelinePointerStateMachine.ts) as framework-agnostic vanilla TypeScript.
   - Port [`useShuttleEngine.ts`](../../apps/studio/src/lib/shuttle/useShuttleEngine.ts) to Solid reactive primitives and RAF loop.
   - Refactor [`ThemeProvider.tsx`](../../apps/studio/src/lib/theme/ThemeProvider.tsx) and [`themePresets.ts`](../../apps/studio/src/lib/theme/themePresets.ts) to isolate pure DOM styling operations from JSX.
3. **Core UI Primitives Modernization (Phase 3)**:
   - Convert all 28 core UI primitives in [`apps/studio/src/components/ui/`](../../apps/studio/src/components/ui/) to `@kobalte/core` and `@corvu/resizable` while maintaining full Liquid Glass design system compatibility.
   - Prune 24 dead/unreferenced Shadcn React primitives.
4. **Shell, Viewport, Timeline, Inspector, & Modals Porting (Phases 4–8)**:
   - Port [`LeftSidebar.tsx`](../../apps/studio/src/components/LeftSidebar.tsx), [`Titlebar.tsx`](../../apps/studio/src/components/Titlebar.tsx), and [`SidebarCards.tsx`](../../apps/studio/src/components/sidebar/SidebarCards.tsx) to `@dnd-kit/solid`.
   - Port Preview and Viewport Canvas subsystem (16 components/hooks) with zero-alloc direct canvas context rendering.
   - Port 17 Timeline subsystem components to fine-grained Solid accessors, retain virtual canvas waveform rendering.
   - Port 19 Inspector subsystem components and strategy pattern modifiers (`ModifierControlStrategies.tsx`, `StudioColorGradingInspector.tsx`).
   - Port OPFS explorer, Shiki code viewer, and VideoIR AST Visual Editor & Live Debugger modals.

## Changes

### 1. Build & Dependencies
- `apps/studio/package.json`: Replaced all React packages with SolidJS 1.9 ecosystem dependencies.
- `apps/studio/vite.config.ts`: Configured `solidPlugin()` and optimized chunk split groups.
- `apps/studio/tsconfig.json`: Set `"jsx": "preserve"` and `"jsxImportSource": "solid-js"`.
- `apps/studio/src/main.tsx`: Ported to `render(() => <App />, document.getElementById('root')!)`.

### 2. Reactive Store & Core Libs
- `apps/studio/src/lib/ir/useStudioStore.ts`: Built Solid signal-backed reactive bridge over `IRStateManager` and `PlayheadController`.
- `apps/studio/src/lib/shuttle/useShuttleEngine.ts`: Fine-grained Solid reactivity for shuttle physics.
- `apps/studio/src/lib/theme/ThemeProvider.tsx` & `themePresets.ts`: Decoupled DOM token mutations from JSX for headless test compatibility; explicitly bound in-scope imports and `ThemeContextValue` interface for reliable runtime hydration.
- `apps/studio/src/lib/dnd/useWorkspaceDnd.ts`: Implemented `@dnd-kit/solid` drag-and-drop primitives.
- `apps/studio/src/lib/commands/SplitSequenceCommand.ts`: Ensured relational DAG integrity with `{ after: id }`.

### 3. UI Primitives (`src/components/ui/*`)
- Rewrote 28 active primitives: `button`, `badge`, `card`, `separator`, `input`, `textarea`, `label`, `resizable`, `sonner`, `dialog`, `tabs`, `tooltip`, `popover`, `slider`, `switch`, `select`, `accordion`, `scroll-area`, `toggle`, `hover-card`, `dropdown-menu`, `context-menu`, `checkbox`, `progress`, `alert`, `alert-dialog`, `skeleton`, `collapsible`, `radio-group`, `avatar`, `spinner`.
- Pruned 24 obsolete unreferenced primitives.

### 4. Workspace Shell & Viewport Subsystems
- `apps/studio/src/components/Titlebar.tsx`, `LeftSidebar.tsx`, `RightSidebar.tsx`: Solid component trees.
- `apps/studio/src/components/Preview.tsx`: Viewport container with HUD overlays, Transform Gizmo, safe guides, and text editor.
- `apps/studio/src/components/preview/*`: ViewportCanvasLayer, StagingDropTargetOverlay, LightGizmoOverlay, TelemetryCompanionCard.

### 5. Timeline Subsystem
- `apps/studio/src/components/Timeline.tsx`, `TimelineDom.tsx`, `DroppableTrackLane.tsx`, `ClipItem.tsx`, `ClipDragProxy.tsx`, `TrimHandle.tsx`, `TransitionBlock.tsx`, `AudioWaveform.tsx`, `WaveSurferWaveform.tsx`, `TrackWaveformVirtualCanvas.tsx`.

### 6. Dynamic Inspector & VFX Modifier Strategies
- `apps/studio/src/components/inspector/*`: PropertySearchFilter, ModifierControlStrategies, ParameterControls, StudioColorGradingInspector, DynamicModifierInspector, TrackInspector, ProjectInspector, SequenceInspector.

### 7. Debugger & Diagnostic Modals
- `apps/studio/src/components/debugger/IrVisualEditorModal.tsx`: Visual VideoIR tree editor, Shiki viewer, and DAG diagnostic engine.
- `apps/studio/src/components/debugger/irJsonAnalyzer.ts`: Pure diagnostic analyzer isolated for unit test suites.
- `apps/studio/src/components/debugger/opfs/*`: OPFS Explorer tree, file previewer, and hex viewer.

## Verification
- **Zero React Imports**: Automated check across all 100+ files in `apps/studio/src` confirmed 0 occurrences of `from 'react'`, `from "react"`, `lucide-react`, `@dnd-kit/core`, or `@radix-ui`.
- **Production Build**: `pnpm --filter @acc/studio build` succeeded with exit code 0 (transformed 3,056 modules in 27.21s).
- **Architecture Test Suite**: `autogenerated-tests/studio_solid_migration_architecture.test.ts` passed (7/7 passed).
- **Component & Theme Test Suites**:
  - `studio_phase2_reactive_store_and_types.test.ts`: 7/7 passed.
  - `studio_theme_tokens.test.ts`: 3/3 passed.
  - `studio_20_theme_presets_and_responsive_layout.test.ts`: 21/21 passed.
  - `studio_liquid_glass_theme.test.ts`: 6/6 passed.
  - `studio_theme_unification.test.ts`: 5/5 passed (2,454 expect assertions).
  - `studio_visual_json_editor.test.ts`: 6/6 passed.
  - `studio_json_debugger_roundtrip.test.ts`: 3/3 passed.
  - `studio_ir_authoring.test.ts`: 7/7 passed.
  - `studio_move_sequence_command.test.ts`: 3/3 passed.
  - `studio_pts_math.test.ts`: 3/3 passed.

## Walkthrough
1. **Fine-Grained Reactivity**: Components subscribe to specific properties via Solid accessors without re-rendering parent tree branches during high-frequency timeline operations.
2. **Framework-Agnostic Core**: VideoIR DAG manipulations, timeline pointer interactions, and audio mixing stay isolated in vanilla TypeScript, ensuring high performance and longevity.
3. **Liquid Glass Cohesion**: Complete visual parity with all 20 curated themes, optical glass finishes, and responsive LOD tiers preserved.
