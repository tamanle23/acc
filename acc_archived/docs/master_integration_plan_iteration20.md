# Master Integration Plan - Iteration 20: Dynamic Schema-Driven Modifier Inspector & Visual VideoIR JSON Debugger

## Goal Description
Transition Studio's modifier inspection from hardcoded panels to an extensible, **Schema-Driven Dynamic Inspector Architecture** governed by [`ModifierPluginRegistry`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/ModifierPluginRegistry.ts), with full replacement across all modifier types. Simultaneously, create an interactive **Visual VideoIR JSON Editor & Live Debugger** in Studio with real-time schema validation and zero external dependencies.

---

## Key Architecture & Design Decisions (Aligned from Interview)

1. **Schema Source of Truth**:
   - Parameter schemas are defined directly on each `ModifierPlugin` inside [`packages/ir/src/plugins/`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/) via an optional `schema: ModifierParameterSchema` contract.
   - Core engine, CLI, and Studio share this single source of truth without duplicated definitions.
2. **Two-Tier Strategy for Complex Modifiers**:
   - Generic Strategy-based form controls for standard fields (sliders, switches, dropdowns, text, color).
   - Custom visual sub-widgets for specialized domains:
     - `vfx/partial`: Interactive normalized $(x, y)$ coordinate pad with region cards and type selectors.
     - `transform`: Retains dedicated motion preset & lifecycle easing controls (`EasingCurveSelector`, `Motion Preset & Lifecycle`).
     - `overlay/canvas_particles`: Preset picker + physics sliders + collapsible post-processing shader controls.
     - `overlay/hologram_hud`: Cybernetic telemetry controls (ring radius, scanline density, rotation speed, glitch).
     - `text/style`: Active-word karaoke glowing state and platform safe-zone badges.
3. **Pure Monorepo Lightweight JSON Debugger**:
   - Zero additional dependencies (`@monaco-editor` or `codemirror` avoided to protect bundle size).
   - Features: Syntax-highlighted line-numbered editor, collapsible JSON tree navigator, live `VideoIRSchemaValidator.validate(parsedJson)` status badge, and DAG topology diagnostics.
4. **Explicit 'Apply to Studio' Button**:
   - Editing in the JSON modal is safe and isolated until the user explicitly clicks "Apply to Studio".
   - Dispatches an undoable command (`LoadProjectCommand` / `irState.loadFromJSON`) to `IRStateManager` with full state preservation.
5. **Full Replacement with Regression-Free Preservation**:
   - Decomposes the 3,200+ line `RightSidebar.tsx` into modular subcomponent controllers while preserving all existing exports (`ALL_AVAILABLE_MODIFIERS`, `AVAILABLE_MODIFIERS`, `PARTICLE_PRESET_DEFAULTS`, `getSectionIdForModifierType`, `formatTimecode`) and DOM guardrail contracts (`AccordionTrigger` actions prop, Rule 229) to ensure 100% test compatibility.

---

## Architectural Workflow & Design Patterns

```
                                +-----------------------------+
                                |    ModifierPluginRegistry   |
                                |  (IR Master Plugin Single SSOT)
                                +--------------+--------------+
                                               | supplies plugins & declarative schemas
                                               v
                                +-----------------------------+
                                |   DynamicModifierInspector  |
                                |   (Multi-Tier Accordion)    |
                                +--------------+--------------+
                                               |
                     +-------------------------+-------------------------+
                     | resolves controls via Strategy Pattern            |
                     v                                                   v
      +-----------------------------+                     +-----------------------------+
      | Standard Control Strategies |                     | Domain Sub-Widget Adapters  |
      | - NumberControlStrategy     |                     | - PartialVFXRegionPad       |
      | - SwitchControlStrategy     |                     | - ParticleShaderControls    |
      | - SelectControlStrategy     |                     | - EasingCurveSelector       |
      | - ColorControlStrategy      |                     | - KaraokeWordGlowControls   |
      +--------------+--------------+                     +--------------+--------------+
                     |                                                   |
                     +-------------------------+-------------------------+
                                               | dispatches via Command Pattern
                                               v
                                +-----------------------------+
                                |    UpdateModifierCommand    |
                                | (IRStateManager Undo/Redo)  |
                                +-----------------------------+
```

---

## Proposed Changes

### Phase 1: Parameter Schema Contract & Declarations in `@acc/ir`

#### [MODIFY] [`packages/ir/src/plugins/ModifierPluginRegistry.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/ModifierPluginRegistry.ts)
Add declarative parameter schema types:
```typescript
export type ParamFieldType =
  | 'number'
  | 'boolean'
  | 'string'
  | 'select'
  | 'color'
  | 'curve'
  | 'regions_array'
  | 'group';

export interface ParamFieldDescriptor {
  key: string;
  label: string;
  type: ParamFieldType;
  description?: string;
  defaultValue?: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: Array<{ label: string; value: string | number }>;
  fields?: Record<string, ParamFieldDescriptor>;
  group?: string;
}

export interface ModifierParameterSchema {
  fields: Record<string, ParamFieldDescriptor>;
  groups?: Array<{ id: string; label: string }>;
}

export interface ModifierPlugin<TParams = Record<string, unknown>> {
  readonly type: string;
  readonly defaultTarget?: SequenceType | SequenceType[];
  readonly targetScope: 'track' | 'sequence' | 'master' | 'audio' | 'both';
  readonly targetPhase?: PluginTargetPhase;
  readonly schema?: ModifierParameterSchema;
  // ...
}
```

#### [MODIFY] Modifier Plugins in `packages/ir/src/plugins/`
Attach complete schemas to:
- `vfx/partial` ([`PartialVFXPlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/vfx/PartialVFXPlugin.ts)): `regions` array (type, x, y, width, height, radius, intensity, color)
- `audio/filter` ([`FilterModifierPlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/audio/FilterModifierPlugin.ts)): `filterType`, `cutoffHz`, `q`
- `audio/pan` ([`PanModifierPlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/audio/PanModifierPlugin.ts)): `stereoPan`
- `audio/volume` ([`VolumeModifierPlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/audio/VolumeModifierPlugin.ts)): `volume`, `fadeInSec`, `fadeOutSec`, `fadeCurve`, `muted`
- `editorial/transition_crossfade` / `transition/crossfade` ([`TransitionCrossfadePlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/editorial/TransitionCrossfadePlugin.ts)): `durationFrames`, `overlapTarget`
- `vfx/color_grading` ([`ColorGradingPlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/vfx/ColorGradingPlugin.ts)): `contrast`, `saturation`, `exposure`, `temperature`, `tint`, `vignette`
- `overlay/hologram_hud` ([`HologramHUDPlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/overlay/HologramHUDPlugin.ts)): `ringRadiusNorm`, `scanlineDensity`, `color`, `rotationSpeed`, `glitchIntensity`
- `overlay/canvas_particles` ([`CanvasParticleOverlayPlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/overlay/CanvasParticleOverlayPlugin.ts)): `type`, `intensity`, `speed`, `opacity`, `particleCount`, `shaders`

---

### Phase 2: Dynamic Inspector Engine & Form Controls in `apps/studio`

#### [NEW] [`apps/studio/src/components/inspector/DynamicModifierInspector.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/DynamicModifierInspector.tsx)
- Coordinates schema resolution and delegates to the appropriate Strategy / Sub-Widget.
- Handles modifier resets (`actions` prop on `AccordionTrigger`), parameter cloning, and debounced dispatch to `IRStateManager.updateModifier()`.

#### [NEW] Form Control Strategies:
- [`apps/studio/src/components/inspector/controls/NumberControlStrategy.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/controls/NumberControlStrategy.tsx)
- [`apps/studio/src/components/inspector/controls/SelectControlStrategy.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/controls/SelectControlStrategy.tsx)
- [`apps/studio/src/components/inspector/controls/SwitchControlStrategy.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/controls/SwitchControlStrategy.tsx)
- [`apps/studio/src/components/inspector/controls/ColorControlStrategy.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/controls/ColorControlStrategy.tsx)
- [`apps/studio/src/components/inspector/controls/PartialVFXControlStrategy.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/controls/PartialVFXControlStrategy.tsx) (interactive 2D pad for localized VFX)

#### [MODIFY] [`apps/studio/src/components/RightSidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/RightSidebar.tsx)
- Delegate modifier accordion contents to `DynamicModifierInspector`.
- Retain all static exports and contract markers for test suites (`PARTICLE_PRESET_DEFAULTS`, `ALL_AVAILABLE_MODIFIERS`, `getSectionIdForModifierType`, `formatTimecode`, `AccordionTrigger actions=...`).

---

### Phase 3: Visual VideoIR JSON Editor & Live Debugger

#### [NEW] [`apps/studio/src/components/debugger/VisualIRJsonDebuggerModal.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/debugger/VisualIRJsonDebuggerModal.tsx)
- Full-featured lightweight modal dialog with:
  1. **Split-Screen Workspace**:
     - **Code Editor**: Raw JSON textarea with line numbers, search, beautify, and error underline highlights.
     - **Tree View & Diagnostics**: Visual collapsible tree showing tracks, sequences, and active modifiers, plus DAG compilation status.
  2. **Real-time Live Validation**:
     - Instant linting via `VideoIRSchemaValidator.validate(doc)` on change.
     - Lists exact schema violations with line references.
  3. **Safe Apply Workflow**:
     - "Apply to Studio" button updates `IRStateManager` via undoable command.
     - "Revert" button discards edits.
     - Copy JSON & Export file actions.

#### [MODIFY] [`apps/studio/src/components/Titlebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Titlebar.tsx)
- Add a **"{ } JSON Debugger"** button to the Titlebar.
- Add `Ctrl+Shift+J` keyboard listener to toggle the debugger modal.

---

## Verification Plan

### Automated Test Suite
```powershell
# 1. New schema registry & parameter metadata unit tests
bun test autogenerated-tests/modifier_schema_registry.test.ts

# 2. Existing Studio inspector, HUD, and Motion tests
bun test autogenerated-tests/studio_context_aware_inspector.test.ts
bun test autogenerated-tests/studio_phase4_inspector_hud_particles.test.ts
bun test autogenerated-tests/studio_phase5_easing_sidebar.test.ts
bun test autogenerated-tests/studio_phase6_motion_timeline.test.ts

# 3. Full Studio regression & E2E suite
bun test autogenerated-tests/studio_complex_demo.test.ts autogenerated-tests/studio_three_audio_wiring.test.ts autogenerated-tests/studio_phase7_master_e2e_hardening.test.ts
```

### Manual Verification
1. Launch Studio (`bun run --cwd apps/studio dev`).
2. Select any sequence on the 12-track demo project (e.g. `seq-cyber-spotlight` with `vfx/partial` or `seq-ai-dispatch-comm` with `audio/filter`).
3. Verify RightSidebar displays interactive controls for every modifier dynamically.
4. Drag sliders (e.g. adjust audio cutoff Hz or spotlight radius $(x, y)$) &rarr; confirm timeline preview renders changes in real time.
5. Click **"{ } JSON Debugger"** or press `Ctrl+Shift+J` &rarr; verify the debugger modal opens, shows green valid status, permits edits, and clicking "Apply to Studio" updates the timeline seamlessly.
