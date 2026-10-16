# Master Integration Plan (Iteration 6): Studio NLE UI Integration & Real-Time Three.js Viewport Controls
## Interactive In-Canvas 2D Vector Staging, Deep 3D Numeric Inspector Panels, Partial Visual Effects & Universal Audio Matrix for `apps/studio`

## 1. Executive Summary & Strategic Objectives

Following the successful execution of **Iteration 5 (Advanced Visual & Core Rendering Engine)**, where Depth-Aware Relighting, 3D Spline Camera Sequencing, and Hardware-Accelerated Particle Shaders were built with bit-identical multi-engine parity, and the recent **Studio Modernization** where `UniversalThreeScene` and `UniversalAudioMixer` were introduced, **Iteration 6 is fully applicable**. It bridges these graphics, simulation, and audio synthesis capabilities directly into the interactive React 19 NLE Studio UI (`apps/studio`).

Based on architectural alignment and user review, **3D viewport gizmos are replaced by a clean, professional dual-plane design**:
1. **Clean Viewport with In-Canvas 2D Vector Transform Layer**:
   - The canvas viewport avoids confusing 3D wireframes/spheres.
   - All 3D parameters (relighting light position $X, Y, Z$, camera eye/target, rack focus focal plane $Z$, particle physics) are manipulated cleanly and accurately through **Deep Numeric Inspector Panels** in the Sidebar.
   - The canvas viewport provides **direct 2D layout and spatial staging**: interactive 8-point bounding boxes, rotation stems, and magnetic snapping for text overlays, vector shapes, PIP clips, and regional partial visual effects.
2. **Dual-Mode Drag-and-Drop Staging & Inline Text Editing**:
   - Drag items from the Sidebar Library and drop them directly onto canvas at cursor $(X, Y)$ coordinates, or single-click to center.
   - Double-click any canvas text item to trigger an inline text editor directly over the text, with simultaneous deep typographic controls in the Inspector.
3. **Hybrid Partial Visual Effects (Regional VFX)**:
   - Regional Blur / Pixelate (privacy box or cinematic depth blur).
   - Spotlight / Radial Relight (circular localized light pool with feather falloff).
   - Regional Glitch / Hologram (RGB split box).
   - Point Particle Emitters (sparks, cosmic dust, magic embers originating from an on-canvas hotspot).
   - Applied either as clip-level masks or as independent timeline overlay tracks.
4. **Smart Magnetic Snapping & Safe Zones**:
   - Real-time magnetic alignment guides to canvas center crosshairs $(X=0.5, Y=0.5)$, borders, and standard safe margins (16:9 & 9:16 vertical video).
   - Shift key to temporarily disable snapping or lock aspect ratio.
5. **Continuous Coalescing History**:
   - Real-time pointer dragging on canvas or sidebar sliders dispatches coalesced `isCoalesced: true` commands, ensuring 60 FPS fluidity while keeping the Undo/Redo stack atomic (1 drag = 1 undo step).
6. **Pure In-Canvas Vector Layer with Zero-Overhead Headless Export**:
   - Transform handles, guides, and selection borders render in an in-canvas vector pass that is instantly hidden (`visible = false`) during `MediabunnyClientSink` export for bit-identical video rendering.

---

## 2. Inviolable Architecture & Guardrail Compliance

> [!IMPORTANT]
> **SSOT, COMMAND PATTERN & CLIENT SAFETY COMPLIANCE**:
> - All UI modifications to sequences, overlay tracks, or modifiers MUST flow through `IRStateManager.getInstance().updateModifier(...)`, `updateClipTransform(...)`, or `executeCommand(...)`.
> - High-frequency pointer dragging MUST coalesce into a single atomic undo step via `CoalescingHistoryStrategy`.
> - `apps/studio` MUST strictly import client-safe modules from `@acc/effect-engines/client` (zero native `.node` or `@napi-rs/canvas` binaries).
> - Zero direct media driver imports (`bun:ffi`, `fluent-ffmpeg`, `mediabunny`). All browser exports flow strictly through `MediabunnyClientSink`.
> - In-canvas selection handles and magnetic guides must NEVER appear in exported video frames or cached thumbnails.

---

## 3. System Architecture & Component Interaction

```
+---------------------------------------------------------------------------------------+
|                               apps/studio (React 19 NLE)                              |
|                                                                                       |
|  +----------------------------+                     +------------------------------+  |
|  |        Sidebar.tsx         |                     |         Preview.tsx          |  |
|  | - Library (Drag-Drop / Add)|                     | - THREE.WebGLRenderer        |  |
|  |   * Titles, Lower Thirds   |                     | - UniversalThreeScene Bridge |  |
|  |   * Rectangles, Shapes     |                     | - In-Canvas Transform Layer  |  |
|  |   * Partial VFX & Emitters |                     |   * 8-Point Bounding Box     |  |
|  | - Deep 3D Inspector:       |                     |   * Top Rotation Stem        |  |
|  |   * Relight X, Y, Z, Phong |                     |   * Magnetic Snapping Guides |  |
|  |   * Camera Spline & Lens   |                     |   * Inline Canvas Text Input |  |
|  |   * Particle SIMD Physics  |                     |   * Partial VFX Region Handle|  |
|  |   * Universal Audio Mixer  |                     | - 0 FPS Idle / 60 FPS Scrub  |  |
|  +--------------+-------------+                     +--------------+---------------+  |
|                 |                                                  |                  |
|                 | Slider Drag (Coalesced)                          | Canvas Drag      |
|                 v                                                  v                  |
|  +---------------------------------------------------------------------------------+  |
|  |                           IRStateManager (Observable SSOT)                      |  |
|  |   - executeCommand(new UpdateModifierCommand(..., isCoalesced: true))           |  |
|  |   - executeCommand(new UpdateClipTransformCommand(..., isCoalesced: true))       |  |
|  |   - HistoryManager with CoalescingHistoryStrategy                               |  |
|  +-----------------------------------------+---------------------------------------+  |
+--------------------------------------------|------------------------------------------+
                                             |
                                             v
+---------------------------------------------------------------------------------------+
|                         Shared Core (@acc/effect-engines/client)                      |
|                                                                                       |
|  +-------------------------------+                 +-------------------------------+  |
|  |      UniversalThreeScene      |                 |      UniversalAudioMixer      |  |
|  | - Blinn-Phong Sobel Relight   |                 | - Multi-Track Sample Mixer    |  |
|  | - Catmull-Rom Camera Spline   |                 | - Dynamic Auto-Ducking (75%)  |  |
|  | - SIMD Particle Warp Tunnel   |                 | - Stereo Panning & Peak/RMS   |  |
|  | - In-Canvas Vector Overlay    |                 | - Procedural Audio Synths     |  |
|  | - Export Mode (Gizmos Hidden) |                 |                               |  |
|  +-------------------------------+                 +-------------------------------+  |
+---------------------------------------------------------------------------------------+
```

---

## 4. Phased Implementation Roadmap

### Phase 1: In-Canvas 2D Vector Transform & Direct Staging Layer (`@acc/effect-engines/client` & `apps/studio`)
- **Objective**: Implement an interactive 2D vector selection layer directly in `UniversalThreeScene` / `Preview.tsx` with 8-point bounding boxes, rotation stems, and magnetic snapping.
- **Key Deliverables**:
  1. `packages/effect-engines/src/three/CanvasTransformOverlay.ts`:
     - Lightweight 2D overlay mesh/sprite group in `UniversalThreeScene`:
       - Selection bounding box with 8 scale/stretch handles and top rotation stem.
       - Magnetic alignment guidelines (horizontal/vertical center crosshairs, border safe zones for 16:9 and 9:16).
       - Normalized coordinate projection between mouse events and video canvas bounds.
     - `setOverlayVisible(visible: boolean)` to suppress handles during headless export.
  2. `apps/studio/src/components/Preview.tsx`:
     - Canvas pointer event lifecycle (`pointerdown`, `pointermove`, `pointerup`) tracking selected clip/overlay.
     - Dispatches coalesced `UpdateClipTransformCommand` to `IRStateManager`.
  3. `autogenerated-tests/studio_canvas_transform.test.ts`:
     - Verify handle raycasting, aspect-ratio locked scaling, rotation math, and magnetic snapping.

### Phase 2: Deep Collapsible Inspector Panels (`apps/studio/src/components/Sidebar.tsx`)
- **Objective**: Expose all 3D lighting, camera, particle, and typography parameters in dedicated collapsible inspector panels with live coalesced history.
- **Key Deliverables**:
  1. `apps/studio/src/components/Sidebar.tsx`:
     - **Dynamic Relighting Section**: Light position sliders $(X, Y, Z)$, Color Picker presets (Warm Tungsten, Cold Cyber Blue, Sunset Amber, Toxic Acid), Diffuse, Specular, Shininess exponent, Rim intensity.
     - **3D Camera & Lens Section**: Camera Eye $(X, Y, Z)$, Target $(X, Y, Z)$, FOV ($15^\circ - 120^\circ$), Roll angle, Focal Distance, Focal Range, Bokeh Blur Radius.
     - **Particle VFX & Post FX Section**: Presets (`cyber_sparks`, `cosmic_dust`, `matrix_rain`), Particle Count ($100 - 20,000$), Gravity, Drag, Turbulence; Bloom threshold, Chromatic Aberration offset, Anamorphic Flare.
     - **Typography & Vector Styling Section**: Font family, weight, tracking, font size, fill color, stroke, shadow, karaoke active glow, border radius.
     - **Audio Ducking & Sound Matrix Section**: Ducking volume ($0.0 - 1.0$), Slew rate, Stereo Pan, Sound preset selection (`pilot_vocoder`, `laser_cannon`, `synthwave_drone`).
  2. Pointer change lifecycle with `isCoalesced: true` updating `IRStateManager`.

### Phase 3: Library Drag-and-Drop Staging, Inline Text Editing & Partial VFX Catalog (`apps/studio`)
- **Objective**: Build the drag-and-drop staging pipeline, inline text editing on canvas, and comprehensive partial visual effects library.
- **Key Deliverables**:
  1. **Drag-and-Drop Staging**:
     - Sidebar Library panel containing draggable preset cards:
       - **Text**: Titles, Lower Thirds, Badges, Callout Tags.
       - **Shapes**: Rectangles, Rounded Boxes, Circles, Arrows.
       - **Partial VFX**: Regional Blur/Pixelate, Spotlight/Radial Relight, Regional Glitch, Point Particle Emitters.
     - HTML5 Drag-and-Drop / Pointer Drop: Dropping onto the canvas places the element at exact mouse $(X, Y)$ normalized coordinates; single-clicking inserts at viewport center.
  2. **Inline Canvas Text Editing**:
     - Double-clicking text overlay opens an inline input directly over the canvas text for immediate typing, blurring to commit to `VideoIR`.
  3. **Partial Visual Effects Execution**:
     - Render regional masks and localized effects (clip-mask or overlay track) inside `UniversalThreeScene`.
  4. `autogenerated-tests/studio_partial_vfx_staging.test.ts`:
     - Verify drag-drop placement, inline text update, and partial VFX mask rendering.

### Phase 4: Master Integration, End-to-End Test Suite & Archival
- **Objective**: Full roundtrip verification, zero regressions, and archival.
- **Key Deliverables**:
  1. `autogenerated-tests/studio_iteration6_e2e.test.ts`:
     - End-to-end test loading demo project, staging text and shapes via drag-drop, adjusting 3D relighting and camera via numeric inspector, testing undo/redo coalescing, and verifying headless export parity.
  2. Documentation & Archival:
     - Document in `docs/history/221_master_integration_plan_iteration6_canvas_staging.md`.
     - Index in `docs/history/README.md`.
     - Update `apps/studio/doc/walkthrough_02.md`.

---

## 5. Verification & Acceptance Criteria

- [ ] **Zero 3D Gizmo Clutter**: Canvas viewport remains clean and uncluttered; all 3D lighting, camera, and particle parameters are managed through Sidebar numeric controls.
- [ ] **Interactive 2D Transform Overlay**: Selecting any text, shape, clip, or partial VFX item shows an 8-point bounding box with top rotation stem.
- [ ] **Smart Magnetic Snapping**: Snaps to canvas center and 16:9 / 9:16 safe-zone margins with visible guidelines during drag.
- [ ] **Dual Drag-and-Drop Staging**: Dragging presets from library drops them at cursor $(X, Y)$; single-clicking centers them.
- [ ] **Inline Text Editing**: Double-clicking canvas text opens an inline editor for typing without navigating away from the viewport.
- [ ] **Partial Visual Effects Suite**: Regional blur, spotlight relight, regional glitch, and point particle emitters render accurately as clip masks or overlay tracks.
- [ ] **Undo/Redo Coalescing**: Dragging bounding box handles or sidebar sliders creates exactly 1 undo history step upon pointer release.
- [ ] **Clean Headless Export**: Exported video frames render without any transform handles, guidelines, or selection outlines.
- [ ] **100% Test Pass Rate**: All unit and e2e tests in `autogenerated-tests/` pass with zero regressions.
- [ ] **Production Build Verified**: `bun run studio:build` compiles cleanly with zero native binary leaks in the Vite bundle.
