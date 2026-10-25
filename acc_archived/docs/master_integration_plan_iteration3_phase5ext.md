# Master Integration Plan (Iteration 3) Phase 5 Masterpiece: Enterprise VideoFlow NLE & Cross-Platform Three.js Viewport

## 1. Goal Description & Executive Vision
Transform `apps/studio` into an **industry-grade, full-fidelity non-linear video editor (NLE)** that bridges the user's primary pain points and fulfills the complete modern NLE feature matrix:
1. **Hear Real Audio During Playback & Scrubbing**:
   - Multi-track synchronized playback combining `mediabunny` / Web Audio API buffer sources for Dialogue, Sound Effects, and Synthwave BGM with real-time gain ducking and master VU metering.
2. **See Real Visuals (Images & Video Textures)**:
   - **Cross-Platform Three.js Render Pipeline**: Build an isomorphic, cross-platform 3D Scene / Viewport engine that runs identically in browser WebGL (client Studio) and in Bun/Node (server headless export via canvas/headless-gl).
   - Real-time texture loading for background plates (`asset-cyber-city`), holographic character cutouts (`asset-neon-warrior`), and matrix core overlays (`asset-matrix-core`).
3. **Visual Timeline Filmstrips & Waveforms**:
   - Render repeated video/image thumbnail filmstrips inside visual sequence clips on the timeline.
   - Render decoded/synthesized multi-track audio waveform peaks.
4. **Interactive Canvas Transform Box**:
   - Direct on-canvas transform bounding box (8 resize handles, rotation handle, drag-to-position) updating sequence/track style in Video IR.
5. **Inline WYSIWYG Text Editing**:
   - Double-click subtitle / text cues on timeline or canvas to edit text strings in-place.
6. **Timeline Visual Transition Handles**:
   - Visual transition pills (`transition/crossfade`, slide, wipe) bridging adjacent clips.
7. **Clip Sliding & Track Management**:
   - DND horizontal clip sliding along time axis and `+ Add Track` / `Delete Track` controls.
8. **Expanded Sci-Fi Cyberpunk Epic Demo**:
   - Richer modifiers: `vfx/depth3d` with Three.js displacement mesh, `vfx/color_grading`, `overlay/canvas_particles` (matrix rain & sci-fi HUD), `transition/crossfade`, and `editorial/split_edit`.

---

## 2. Cross-Platform Three.js Architecture (Web & Bun/Server Parity)

```
+-------------------------------------------------------------------------+
|                    Cross-Platform Three.js Render Engine                |
|                    (packages/effect-engines or studio/lib)              |
+-------------------------------------------------------------------------+
|                                                                         |
|   +-----------------------+                    +--------------------+   |
|   |   Browser Runtime     |                    |  Bun / Headless    |   |
|   |   (apps/studio)       |                    |  (apps/worker)     |   |
|   +-----------+-----------+                    +---------+----------+   |
|               |                                          |              |
|        (WebGL2 Context)                           (Headless / NodeAV)   |
|               |                                          |              |
|               v                                          v              |
|   +-----------------------------------------------------------------+   |
|   |                     Universal Three.js Scene                    |   |
|   |  - PerspectiveCamera (FOV 45, Aspect Ratio Locked)              |   |
|   |  - Orthographic Plane Quad / Mesh for Video Background          |   |
|   |  - 3D Depth Displaced PlaneGeometry (pts.js + Three.js Mesh)    |   |
|   |  - Particle System for Volumetric Rain / Glitch                 |   |
|   |  - Post-Processing Shader Passes (LUT, Vignette, Exposure)      |   |
|   +-----------------------------------------------------------------+   |
|                                                                         |
+-------------------------------------------------------------------------+
```

### Server vs Client Parity Invariant
- **Client (Studio)**: `THREE.WebGLRenderer({ canvas, alpha: true })` bound to HTML5 `<canvas>`.
- **Server (Worker / IR Master Renderer)**: Pure mathematical projection and GLSL vertex/fragment evaluation or offscreen canvas context with identical coordinate transforms (`DepthMathEngine` + Three.js matrix).

---

## 3. Multi-Track Audio Engine (`mediabunny` + Web Audio API)

- **Decoding & Streaming**:
  - Voiceover (`asset-voice-pilot`), Impact SFX (`asset-laser-impact`), and Synth BGM (`asset-synth-bgm`).
  - Uses `mediabunny` input demuxing and `AudioContext.decodeAudioData` / procedural fallback buffers.
- **Dynamic Bus Ducking**:
  - While Dialogue is active: BGM gain ramps down to `20%` over `attackMs: 120ms`.
  - When Dialogue finishes: BGM gain recovers over `releaseMs: 250ms`.
- **Playback Synchronization**:
  - `playhead.isPlaying`: triggers synchronized audio buffer nodes starting at `(currentFrame / fps)`.
  - Pause / Scrub: disconnects active audio nodes immediately and triggers micro-pitch scrub feedback.

---

## 4. Proposed Changes

### Component 1: Audio Playback Engine (`apps/studio/src/lib/audio/`)

#### [MODIFY] `apps/studio/src/lib/audio/WebAudioEngine.ts`
- Implement `startPlayback(currentFrame: number, doc: VideoIRDocument)`:
  - Fetches and decodes audio buffers for all active audio tracks.
  - Schedules synchronized audio playback matching global time.
  - Applies real-time dynamic ducking gain envelope on BGM bus.
- Implement `stopPlayback()`:
  - Immediately stops and garbage-collects active buffer sources.

---

### Component 2: Cross-Platform Three.js Viewport & 3D Depth Mesh (`apps/studio/src/lib/three/` & `Preview.tsx`)

#### [NEW] `apps/studio/src/lib/three/UniversalThreeScene.ts`
- Core Three.js scene manager:
  - Orthographic/Perspective camera.
  - Multi-layer plane meshes with texture mapping for background images and video plates.
  - 3D Depth mesh displacement geometry for `vfx/depth3d`.
  - Particle point clouds for `overlay/canvas_particles`.
  - Color grading shader post-process pass (Contrast, Saturation, Exposure, Vignette).

#### [MODIFY] `apps/studio/src/components/Preview.tsx`
- Replace raw WebGL boilerplate with `UniversalThreeScene`.
- Load real textures from `doc.assets`.
- Implement **Interactive Canvas Transform Box**:
  - Click on elements to select and display 8 transform handles and rotation ring.
  - Drag handles to resize or reposition, dispatching `UpdateModifierCommand` or updating sequence transform in the IR.

---

### Component 3: Filmstrip Thumbnails & DND Timeline (`apps/studio/src/components/`)

#### [NEW] `apps/studio/src/components/timeline/FilmstripThumbnail.tsx`
- Renders repeated thumbnail frames across the length of visual sequence clips.

#### [NEW] `apps/studio/src/components/timeline/TransitionHandle.tsx`
- Renders visual transition pills (`crossfade`, `slide`, `wipe`) between adjacent clips.

#### [MODIFY] `apps/studio/src/components/Timeline.tsx`
- Add filmstrip thumbnails inside video/image sequence bars.
- Add transition handles between adjacent clips.
- Implement horizontal clip sliding via pointer drag.
- Add `+ Add Track` button and track deletion menu.

---

### Component 4: WYSIWYG Subtitle & Text Editor (`apps/studio/src/components/`)

#### [NEW] `apps/studio/src/components/inspector/TextCueEditor.tsx`
- In-place text editor for timed text cues (`startOffsetMs`, `endOffsetMs`, `text`).

#### [MODIFY] `apps/studio/src/components/Sidebar.tsx`
- Embed `TextCueEditor` when a subtitle or HUD telemetry sequence is selected.

---

## 5. Verification Plan

### Automated Tests
1. **Audio Engine Playback & Ducking Test**:
   - `bun test autogenerated-tests/studio_audio_engine.test.ts`
   - Validates multi-track audio scheduling, buffer offset calculations, and ducking gain ramps.
2. **Three.js Scene & Math Test**:
   - `bun test autogenerated-tests/studio_three_scene.test.ts`
   - Validates Three.js scene initialization, texture material setup, and displacement math.
3. **Master Suite**:
   - `bun test autogenerated-tests/studio_command_history.test.ts autogenerated-tests/studio_pts_math.test.ts autogenerated-tests/studio_complex_demo.test.ts autogenerated-tests/studio_ir_authoring.test.ts`
4. **Production Build**:
   - `bun run --filter=@acc/studio build`

### Manual Verification
1. Open studio via `bun run --filter=@acc/studio dev --port 3300`.
2. Press `Space` and **verify audible dialogue, laser impact SFX, and ambient synth music**.
3. Verify visual plates (cyber city, holographic character) render as real textures on canvas.
4. Verify repeated filmstrip thumbnails appear inside timeline video clips.
5. Click on an overlay to see the interactive transform bounding box.
6. Double-click a subtitle to edit text in-place.
