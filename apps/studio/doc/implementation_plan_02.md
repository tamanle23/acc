# Implementation Plan 02: Studio NLE UI Integration & Real-Time Three.js Viewport Controls (Iteration 6)

## 1. Executive Summary & Strategic Objectives
Following the completion of **Iteration 5** (where Depth-Aware Relighting, 3D Camera Splines, and SIMD Particle Shaders were established) and the recent **Studio Modernization** (where `UniversalThreeScene`, `pts.js` vector math, and `UniversalAudioMixer` were introduced), **Iteration 6 is fully applicable and represents the critical bridge** that connects these graphics and simulation capabilities directly into the interactive React 19 Studio UI (`apps/studio`).

This refined plan aligns Iteration 6 with our cross-platform Three.js architecture and advances the history record to task **`219`**:
1. **Native Three.js 3D Viewport Gizmos**: Interactive 3D Light Sphere, Camera Frustum / Focal Plane Wireframe, and Transform Box built directly into `UniversalThreeScene`'s scenegraph with normalized raycasting, toggleable between interactive preview and clean headless export.
2. **Deep Collapsible Inspector Panels in `Sidebar.tsx`**: 4 collapsible sections for Dynamic Relighting, 3D Camera & Rack Focus, Particle VFX & Post-processing, and Audio Ducking & Mixing.
3. **Continuous Coalescing Undo/Redo**: High-frequency slider dragging and gizmo manipulation coalesces into a single atomic undo/redo step in `HistoryManager` via `IRStateManager`.
4. **Unified 60 FPS Three.js Viewport in `Preview.tsx`**: Replaces the isolated 2D quad with `UniversalThreeScene` as the primary WebGL renderer, combining active video textures, Blinn-Phong relighting, Catmull-Rom camera paths, SIMD particles, and 3D interactive gizmos in a single pass.

---

## 2. System Architecture & Component Interaction

```
+---------------------------------------------------------------------------------------+
|                               apps/studio (React 19 NLE)                              |
|                                                                                       |
|  +----------------------------+                     +------------------------------+  |
|  |        Sidebar.tsx         |                     |         Preview.tsx          |  |
|  | - Relighting Accordion     |                     | - THREE.WebGLRenderer        |  |
|  | - 3D Camera & Rack Focus   |                     | - UniversalThreeScene Bridge |  |
|  | - Particle VFX & Post FX   |                     | - 3D Light Sphere Gizmo      |  |
|  | - Audio Ducking & Mixer    |                     | - 3D Focal Plane Wireframe   |  |
|  +--------------+-------------+                     +--------------+---------------+  |
|                 |                                                  |                  |
|                 | Slider Drag (Coalesced)                          | Pointer Raycast  |
|                 v                                                  v                  |
|  +---------------------------------------------------------------------------------+  |
|  |                           IRStateManager (Observable SSOT)                      |  |
|  |   - executeCommand(new UpdateModifierCommand(..., isCoalesced: true))           |  |
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
|  | - Toggleable 3D Gizmo Group   |                 | - Procedural Audio Synths     |  |
|  +-------------------------------+                 +-------------------------------+  |
+---------------------------------------------------------------------------------------+
```

---

## 3. Phased Implementation Roadmap

### Phase 1: Native Three.js 3D Viewport Gizmos (`@acc/effect-engines/client` & `apps/studio`)
- **Objective**: Implement 3D Light indicator sphere, Camera frustum / Focal plane wireframe, and Transform bounding box in `UniversalThreeScene`.
- **Key Deliverables**:
  1. `packages/effect-engines/src/three/UniversalThreeScene.ts`:
     - Add `gizmoGroup: THREE.Group` containing:
       - `lightGizmo`: Glowing mesh sphere indicating 3D light position with distance orbit ring.
       - `focalPlaneGizmo`: Rectangular wireframe grid indicating the active focal plane depth $Z$.
       - `cameraFrustumGizmo`: Wireframe frustum indicating FOV and look-at vector.
     - Add `setGizmosVisible(visible: boolean)` to hide gizmos during final export and frame capture.
     - Add `raycastGizmos(ndcX: number, ndcY: number)` for interactive drag selection.
  2. `autogenerated-tests/studio_threejs_gizmos.test.ts`:
     - Verify gizmo creation, raycast intersection, and visibility toggling.

### Phase 2: Deep Collapsible Inspector Panels (`apps/studio/src/components/Sidebar.tsx`)
- **Objective**: Expose all graphics, camera, particle, and audio parameters with live coalesced slider history.
- **Key Deliverables**:
  1. `apps/studio/src/components/Sidebar.tsx`:
     - **Dynamic Relighting Section**: Light position sliders $(X, Y, Z)$, Color Picker presets (Warm Tungsten, Cold Cyber Blue, Sunset Amber, Toxic Acid), Diffuse, Specular, Shininess exponent, Rim intensity.
     - **3D Camera & Lens Section**: Mode (`orbit`, `dolly_zoom`, `bezier_spline`), Camera Eye $(X, Y, Z)$, Target $(X, Y, Z)$, FOV ($15^\circ - 120^\circ$), Roll angle, Focal Distance, Focal Range, Bokeh Blur Radius.
     - **Particle VFX & Post FX Section**: Presets (`cyber_sparks`, `cosmic_dust`, `matrix_rain`), Particle Count ($100 - 20,000$), Gravity, Drag, Turbulence; Bloom threshold, Chromatic Aberration offset, Anamorphic Flare.
     - **Audio Ducking & Sound Matrix Section**: Ducking volume ($0.0 - 1.0$), Slew rate, Stereo Pan, Sound preset selection (`pilot_vocoder`, `laser_cannon`, `synthwave_drone`).
  2. Pointer down/change/up lifecycle wiring to `IRStateManager.getInstance().updateModifier(seqId, type, params)` with continuous coalescing.

### Phase 3: Unified Viewport Pipeline in `Preview.tsx` (`apps/studio`)
- **Objective**: Seamlessly connect `UniversalThreeScene` as the primary WebGL renderer in `Preview.tsx`.
- **Key Deliverables**:
  1. `apps/studio/src/components/Preview.tsx`:
     - Render active sequence textures from `AssetTextureCache` inside `UniversalThreeScene`.
     - Update shader uniforms (relighting, lens distortion, camera matrices) on every frame and slider change.
     - Handle pointer events on the canvas: drag light position in 3D, drag focal plane, or rotate camera.
  2. `autogenerated-tests/studio_relighting_gizmo.test.ts`:
     - Verify that dragging gizmos updates the underlying `VideoIRDocument` and triggers real-time uniform updates.

### Phase 4: Master Integration, End-to-End Test Suite & Archival
- **Objective**: Full roundtrip verification, zero regressions, and archival.
- **Key Deliverables**:
  1. `autogenerated-tests/studio_iteration6_e2e.test.ts`:
     - End-to-end test loading `complexSciFiDemoIR`, adjusting relighting, 3D camera, particles, and audio ducking, verifying schema validity and undo/redo history.
  2. Documentation & Archival:
     - Document in `docs/history/219_master_integration_plan_iteration6.md`.
     - Index in `docs/history/README.md`.
     - Update `apps/studio/doc/walkthrough_02.md`.
     - Update `docs/master_integration_plan_iteration6.md` with the finalized architecture.

---

## 4. Verification & Acceptance Criteria
1. **Zero Heap Allocation in Hot Drag Loops**: Manipulating gizmos and sliders does not allocate transient objects in render paths.
2. **Undo/Redo Coalescing**: Dragging a slider or 3D gizmo for multiple seconds creates exactly 1 undo step.
3. **Bit-Identical Export Parity**: Exported video frames render without gizmos and match server-side IR rendering.
4. **100% Test Pass Rate**: All tests in `autogenerated-tests/` pass cleanly.
5. **Clean Production Build**: `bun run --filter=@acc/studio build` exits 0 with zero Node.js binary leaks.
