# Implementation Plan 02: Studio NLE UI Integration & Real-Time Three.js Viewport Controls (Iteration 6)
## Interactive In-Canvas 2D Vector Staging, Deep 3D Numeric Inspector Panels, Partial Visual Effects & Universal Audio Matrix

## 1. Executive Summary & Strategic Objectives
Following the completion of **Iteration 5** and **Studio Modernization**, **Iteration 6 connects these graphics, simulation, and audio synthesis capabilities directly into the interactive React 19 Studio UI (`apps/studio`)**.

Based on architectural alignment:
1. **Clean Viewport & Pure In-Canvas 2D Vector Layer**:
   - 3D viewport gizmos (spheres, wireframes) are omitted to eliminate viewport clutter.
   - 3D scene parameters (relighting $X, Y, Z$, camera eye/target, focal plane $Z$, particle physics) are edited accurately through **Deep Numeric Inspector Panels** in the Sidebar.
   - The canvas viewport provides **direct 2D layout and spatial staging**: interactive 8-point bounding boxes, rotation stems, and magnetic snapping for text overlays, vector shapes, PIP clips, and regional partial visual effects.
2. **Dual-Mode Drag-and-Drop Staging & Inline Text Editing**:
   - Drag items from the Sidebar Library directly onto the canvas at cursor $(X, Y)$, or single-click to center.
   - Double-click canvas text for inline typing, paired with deep typography styling in the Inspector.
3. **Hybrid Partial Visual Effects (Regional VFX)**:
   - Regional Blur / Pixelate, Spotlight / Radial Relight, Regional Glitch, Point Particle Emitters (clip-level masks or timeline overlay tracks).
4. **Smart Magnetic Snapping & Safe Zones**:
   - Real-time magnetic alignment guides to canvas center crosshairs $(X=0.5, Y=0.5)$, borders, and standard safe margins (16:9 & 9:16).
5. **Continuous Coalescing History**:
   - High-frequency pointer dragging on canvas or sidebar sliders dispatches coalesced `isCoalesced: true` commands to ensure 60 FPS fluidity with atomic undo/redo steps.
6. **Pure In-Canvas Vector Layer with Zero-Overhead Headless Export**:
   - Transform handles and guidelines automatically hide during `MediabunnyClientSink` export for bit-identical video rendering.

---

## 2. System Architecture & Component Interaction

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

## 3. Phased Implementation Roadmap

### Phase 1: In-Canvas 2D Vector Transform & Direct Staging Layer (`@acc/effect-engines/client` & `apps/studio`)
- **Key Deliverables**:
  1. `packages/effect-engines/src/three/CanvasTransformOverlay.ts`:
     - 2D overlay mesh/sprite group in `UniversalThreeScene`:
       - Selection bounding box with 8 scale/stretch handles and top rotation stem.
       - Magnetic alignment guidelines (center crosshairs, 16:9 and 9:16 safe zones).
       - Normalized coordinate projection between mouse events and video bounds.
     - `setOverlayVisible(visible: boolean)` to suppress handles during headless export.
  2. `apps/studio/src/components/Preview.tsx`:
     - Pointer event lifecycle (`pointerdown`, `pointermove`, `pointerup`) tracking selected element.
     - Dispatches coalesced `UpdateClipTransformCommand` to `IRStateManager`.
  3. `autogenerated-tests/studio_canvas_transform.test.ts`:
     - Verify handle raycasting, aspect-ratio locked scaling, rotation math, and magnetic snapping.

### Phase 2: Deep Collapsible Inspector Panels (`apps/studio/src/components/Sidebar.tsx`)
- **Key Deliverables**:
  1. `apps/studio/src/components/Sidebar.tsx`:
     - **Dynamic Relighting Section**: Light position sliders $(X, Y, Z)$, Color Picker presets, Diffuse, Specular, Shininess exponent, Rim intensity.
     - **3D Camera & Lens Section**: Camera Eye $(X, Y, Z)$, Target $(X, Y, Z)$, FOV, Roll angle, Focal Distance, Focal Range, Bokeh Blur Radius.
     - **Particle VFX & Post FX Section**: Presets, Particle Count, Gravity, Drag, Turbulence; Bloom, Chromatic Aberration, Anamorphic Flare.
     - **Typography & Vector Styling Section**: Font family, weight, tracking, font size, fill color, stroke, shadow, karaoke glow, border radius.
     - **Audio Ducking & Sound Matrix Section**: Ducking volume, Slew rate, Stereo Pan, Sound preset selection.
  2. Pointer change lifecycle with `isCoalesced: true` updating `IRStateManager`.

### Phase 3: Library Drag-and-Drop Staging, Inline Text Editing & Partial VFX Catalog (`apps/studio`)
- **Key Deliverables**:
  1. **Drag-and-Drop Staging**:
     - Sidebar Library panel containing draggable preset cards:
       - **Text**: Titles, Lower Thirds, Badges, Callout Tags.
       - **Shapes**: Rectangles, Rounded Boxes, Circles, Arrows.
       - **Partial VFX**: Regional Blur/Pixelate, Spotlight/Radial Relight, Regional Glitch, Point Particle Emitters.
     - Drag-and-drop placement at cursor $(X, Y)$ + single-click center insert.
  2. **Inline Canvas Text Editing**:
     - Double-click canvas text opens inline editor for immediate typing.
  3. **Partial Visual Effects Execution**:
     - Render regional masks and localized effects (clip-mask or overlay track) inside `UniversalThreeScene`.
  4. `autogenerated-tests/studio_partial_vfx_staging.test.ts`:
     - Verify drag-drop placement, inline text update, and partial VFX mask rendering.

### Phase 4: Master Integration, End-to-End Test Suite & Archival
- **Key Deliverables**:
  1. `autogenerated-tests/studio_iteration6_e2e.test.ts`:
     - End-to-end test loading demo project, staging text and shapes via drag-drop, adjusting 3D relighting and camera via numeric inspector, testing undo/redo coalescing, and verifying headless export parity.
  2. Documentation & Archival:
     - Document in `docs/history/221_master_integration_plan_iteration6_canvas_staging.md`.
     - Index in `docs/history/README.md`.
     - Update `apps/studio/doc/walkthrough_02.md`.

---

## 4. Verification & Acceptance Criteria
- [ ] **Zero 3D Gizmo Clutter**: Canvas viewport remains clean; all 3D lighting, camera, and particle parameters are managed through Sidebar numeric controls.
- [ ] **Interactive 2D Transform Overlay**: Selecting any text, shape, clip, or partial VFX item shows an 8-point bounding box with top rotation stem.
- [ ] **Smart Magnetic Snapping**: Snaps to canvas center and 16:9 / 9:16 safe-zone margins with visible guidelines during drag.
- [ ] **Dual Drag-and-Drop Staging**: Dragging presets from library drops them at cursor $(X, Y)$; single-clicking centers them.
- [ ] **Inline Text Editing**: Double-clicking canvas text opens an inline editor for typing without navigating away from the viewport.
- [ ] **Partial Visual Effects Suite**: Regional blur, spotlight relight, regional glitch, and point particle emitters render accurately as clip masks or overlay tracks.
- [ ] **Undo/Redo Coalescing**: Dragging bounding box handles or sidebar sliders creates exactly 1 undo history step upon pointer release.
- [ ] **Clean Headless Export**: Exported video frames render without any transform handles, guidelines, or selection outlines.
- [ ] **100% Test Pass Rate**: All unit and e2e tests in `autogenerated-tests/` pass with zero regressions.
- [ ] **Production Build Verified**: `bun run studio:build` compiles cleanly with zero native binary leaks in the Vite bundle.
