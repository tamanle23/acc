# Studio Implementation Plan 52: Multi-Tier Modifier Hierarchy, Standalone Generator Sequence Invariants, Universal Transform Whitelisting, and Preview/Headless Rendering Parity

**Document Status:** Complete, Aligned & Ready for Execution  
**Companion Master Plan:** [`docs/iterations/master_implementation_plan_iteration_59.md`](file:///mnt/c/Users/Admin/workspace/git/acc/docs/iterations/master_implementation_plan_iteration_59.md)  
**Target:** `packages/ir/src/plugins/ModifierPluginRegistry.ts`, `packages/ir/src/schema/VideoIRSchemaValidator.ts`, `packages/ir/src/renderer/shared/IRCanvasCompositor.ts`, `apps/studio/src/components/RightSidebar.tsx`, `apps/studio/src/components/inspector/SequenceInspector.tsx`, `apps/studio/src/components/inspector/TrackInspector.tsx`, `apps/studio/src/components/inspector/ProjectInspector.tsx`, `apps/studio/src/lib/ir/irState.ts`  
**Standards:** Principal Systems Architect, Enterprise Clean Coder, Zero-Stub Prohibition, WAI-ARIA / Liquid Glass UI  

---

## 1. Executive Summary & Problem Formulation

In Studio and the core Video IR pipeline, modifiers can be applied at three structural levels:
1. **Sequence Level**: Clip-space operations localized to a single sequence instance over `[startFrame, endFrame]`.
2. **Track Level**: Stream-space operations aggregated across all sequences on a track over `[0, totalFrames]`.
3. **Timeline Level**: Master composite operations over the entire flattened project canvas.

A critical ambiguity exists around **Standalone Modifiers** (`targetScope: 'standalone'`, e.g. `time_space/*`, `overlay/hologram_hud`, `overlay/canvas_particles`, `generator/solid_backdrop`):
- Standalone modifiers are **Source Providers** (Phase 1), not clip-space video filters.
- When placed on the timeline, they constitute their own independent sequence (typically an `overlay` sequence without an asset file).
- When a sequence acts as a standalone generator, it must **never** be permitted to accept arbitrary footage filters (e.g. `vfx/depth3d`, `vfx/camera_3d`, `vfx/color_grading`, `vfx/auto_reframe`, `vfx/partial`) or competing secondary standalone generators.
- A standalone sequence must **only** be allowed to accept a strict whitelist of universal canvas modifiers:
  - `transform`: Universal 2D affine spatial placement (X, Y, Scale, Rotation, Opacity, Anchor). Mandatory and universal for any visual entity in the canvas.
  - `motion/gsap`: Keyframe/curve interpolation for transform coordinates.
  - `overlay/blend_mode`: Composite blend mode (`screen`, `multiply`, `add`, `overlay`).
  - `transition/*`: Clip boundary transitions.

---

## 2. Implementation Roadmap

### Phase 1: Core Type & Schema Validator Hardening (`packages/ir`)
- Add declarative capability fields to `ModifierPlugin`: `isUniversal?: boolean`, `supportedTrackTypes: readonly TrackType[]`, `instancePolicy?: 'single' | 'multiple'`.
- Define `STANDALONE_SEQUENCE_ALLOWED_MODIFIERS` derived directly from `isUniversal === true`.
- In `VideoIRSchemaValidator.ts`:
  - Enforce `count(targetScope === 'standalone') <= 1` per sequence.
  - For any sequence containing a standalone generator, validate that all other attached modifiers have `isUniversal === true` (or belong to `STANDALONE_SEQUENCE_ALLOWED_MODIFIERS`).
  - Reject footage-dependent modifiers on standalone sequences.

### Phase 2: Registry Dynamic Entity Checking & SSOT Manifest (`packages/ir`)
- Update `ModifierPluginRegistry`:
  - Implement `getCapabilityMatrix()` to dynamically compile the taxonomy matrix from registered plugins without hardcoded lists.
  - Update `isModifierAllowedOnEntity(modType, targetCtx)`:
    - Pass `hasStandaloneGenerator: boolean` and `existingModifierTypes: string[]` in `targetCtx`.
    - Disallow secondary standalone generators if one already exists.
    - Disallow footage modifiers if `hasStandaloneGenerator` is true.

### Phase 3: Studio Inspector Filter Synchronization (`apps/studio`)
- In `RightSidebar.tsx`:
  - Detect if `selectedSeq` contains a standalone generator.
  - Query `registry.isModifierAllowedOnEntity` directly (no hardcoded string sets) to filter `relevantModifiers` to universal tools.
  - Maintain clean isolation between Sequence, Track, and Timeline effect dropdown menus.
- In `SequenceInspector.tsx`:
  - Promote the primary standalone generator card to the top with a `Standalone Generator Clip` badge.
  - Keep the universal `transform` section directly below it for in-canvas manipulation.

### Phase 4: Compositor & Headless Parity (Deterministic Integer Frame Clock) (`packages/ir`)
- In `IRCanvasCompositor.ts`:
  - Enforce **Deterministic Integer Frame Clock** ($t \in \mathbb{N}$) driven by `DeterministicAudioClock` and playhead integer steps (never loose `requestAnimationFrame`).
  - Standalone generator executes its `renderClipSpace` procedurally in Phase 1.
  - Universal `transform` applies 2D matrix transformation in Phase 2.
  - Track blend mode and opacity apply in Phase 3.
  - Master timeline bloom/glare apply in Phase 4.
- In `IRMasterRenderer.ts`:
  - Guarantee identical frame hash evaluation between preview and headless modes via `FrameBackpressureLock`.

### Phase 5: Automated Verification & Documentation
- Author formal contract test suite `autogenerated-tests/modifier_plugin_contract_audit.test.ts` to audit all registered plugins and enforce matrix consistency on CI.
- Author functional test suite `autogenerated-tests/standalone_generator_hierarchy_and_whitelist.test.ts`.
- Document walkthrough in `apps/studio/doc/walkthrough_52.md`.
- Register history entry in `docs/history/`.

---

## 3. Formal Verification Matrix

| Verification Vector | Target Component | Success Assertion |
| :--- | :--- | :--- |
| **TV-52-1: Standalone Single Source** | `VideoIRSchemaValidator.ts` | Schema error emitted if sequence has $> 1$ standalone generator. |
| **TV-52-2: Footage VFX Prohibition** | `ModifierPluginRegistry.ts` | `vfx/depth3d`, `vfx/camera_3d` rejected on standalone sequences. |
| **TV-52-3: Universal Whitelist Acceptance** | `ModifierPluginRegistry.ts` | `transform`, `motion/gsap`, `overlay/blend_mode`, transitions accepted on standalone sequences. |
| **TV-52-4: Studio Add Effect Dropdown** | `RightSidebar.tsx` | Dropdown displays only whitelisted modifiers for standalone sequences. |
| **TV-52-5: Headless Parity** | `IRMasterRenderer.ts` | Standalone generator + transform + master bloom renders identically in headless and preview modes. |
