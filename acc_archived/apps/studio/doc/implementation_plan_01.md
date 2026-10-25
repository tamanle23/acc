# Implementation Plan 01: Cross-Platform Three.js + pts.js Engine & Isomorphic Audio Pipeline

## Context & Objectives
In this milestone, we resolve the two primary functional gaps in Studio (inaudible audio and blank timeline/canvas clip visuals), while architecting an enterprise-grade, cross-platform 3D visual engine and audio DSP pipeline shared between the Web client (`apps/studio`) and Node/Bun server (`@acc/effect-engines` / `packages/ir`).

Based on our interactive `/grill-me` alignment:
1. **Visual Engine**: `pts.js` serves as the pure mathematical/geometry engine (vector curves, camera splines, mesh displacement topologies), and `Three.js` acts as the scenegraph and shader abstraction. Web uses hardware-accelerated `THREE.WebGLRenderer`, while Node/Bun runs headless rendering via offscreen context/pixel readback for `IIRFrameSink` (`MediabunnyServerSink`), ensuring bit-identical mathematical parity.
2. **Audio Engine**: An isomorphic `Float32 DSP` synthesizer and multi-track mixer generates raw Float32 PCM samples (procedural voice chatter, laser SFX, synthwave BGM) with dynamic ducking. Web plays this via `WebAudioEngine` (`AudioContext` + `AudioBufferSourceNode` + `AnalyserNode` for `MasterAudioMeter`), while Node/Bun feeds the PCM directly into `MediaEngineStrategy` without spawning raw ffmpeg CLI.
3. **Timeline & Viewport Visuals**: `AssetTextureCache` provides real image/video frame decoding and procedural sci-fi filmstrip generation for `Timeline.tsx` and `Preview.tsx`.
4. **Interactive Controls**: Viewport bounding box transform gizmo for direct clip manipulation on the canvas.
5. **Master Demo IR**: Extended multi-asset Sci-Fi Space Combat Epic showcase.

---

## Architecture & System Design

```
+-----------------------------------------------------------------------------------+
|                           Shared Core (@acc/effect-engines)                       |
|                                                                                   |
|  +-----------------------------+       +---------------------------------------+  |
|  |     pts.js Math Engine      |       |      Float32 DSP Audio Engine         |  |
|  | - Spline & Orbital Vectors  |       | - Procedural Audio Synthesizer (BGM/  |  |
|  | - Mesh Displacement Grids   |       |   SFX/Voice Vocoder)                  |  |
|  | - Normal Map Sobel Math     |       | - Multi-Track Float32 Sample Mixer    |  |
|  +--------------+--------------+       +-------------------+-------------------+  |
|                 |                                          |                      |
|                 v                                          v                      |
|  +-----------------------------+       +---------------------------------------+  |
|  |    Three.js Scenegraph      |       |       Universal Audio Frame Data      |  |
|  | - UniversalThreeScene       |       | - Pure Float32Array PCM Buffers       |  |
|  | - Geometry & Shader Uniforms|       | - Dynamic Ducking & Pan Coefficients  |  |
|  +--------------+--------------+       +-------------------+-------------------+  |
+-----------------|------------------------------------------|----------------------+
                  |                                          |
       +----------+----------+                    +----------+----------+
       |                     |                    |                     |
       v                     v                    v                     v
+--------------+      +--------------+     +--------------+      +--------------+
|  Web Client  |      | Server Head- |     |  Web Client  |      | Server Node/ |
| (Studio App) |      | less (Worker)|     | (Studio App) |      | Bun Worker   |
| WebGLRenderer|      | Offscreen RGBA|    | WebAudioEngine|     | Mediabunny   |
| Canvas DOM   |      | Frame Sink   |     | AudioContext |      | Audio Sink   |
+--------------+      +--------------+     +--------------+      +--------------+
```

---

## Detailed Task Breakdown

### Phase 1: Shared Isomorphic 3D Engine (`@acc/effect-engines`)
- **File**: `packages/effect-engines/src/three/UniversalThreeScene.ts`
  - Encapsulate `pts.js` vector maths (`Pt`, `Group`) with `three.js` scenegraph.
  - Compute camera orbital paths, Catmull-Rom camera splines, and 3D depth mesh displacement geometry.
  - Implement shader material uniform binding (time, depth map, relighting normals, lens distortion).
  - Provide isomorphic render loop: `renderToTarget(glContext | canvas, timeSec)`.
- **Export & Types**: Wire into `packages/effect-engines/src/index.ts`.

### Phase 2: Isomorphic Float32 DSP Audio Engine (`@acc/effect-engines`)
- **File**: `packages/effect-engines/src/audio/ProceduralAudioSynthesizer.ts`
  - High-fidelity DSP synthesis in pure TypeScript Float32Array:
    - `synthBGM(timeSec, durationSec, sampleRate)`: Ambient sci-fi synthwave drone and chord pads.
    - `synthLaserSFX(timeSec, durationSec, sampleRate)`: Frequency-swept exponential chirp + resonant filter.
    - `synthPilotVoice(timeSec, durationSec, sampleRate)`: Formant-filtered vocoder speech pattern (radio telemetry).
- **File**: `packages/effect-engines/src/audio/UniversalAudioMixer.ts`
  - Mixes multiple audio tracks at given `timeSec` with per-track volume, pan, and dynamic voice ducking.
  - Pure Float32 math with zero DOM or OS dependencies.

### Phase 3: Studio Web Audio & Master VU Meter Integration (`apps/studio`)
- **File**: `apps/studio/src/lib/audio/WebAudioEngine.ts`
  - Upgraded to instantiate Web Audio `AudioContext`.
  - Connects `UniversalAudioMixer` to `AudioBufferSourceNode` or dynamic AudioBuffer chunks.
  - Integrates `AnalyserNode` for real-time RMS & Peak decibel measurement fed to `MasterAudioMeter.tsx`.
  - Audible scrubbing: scrubs emit micro-chatter synthesized audio packets.
  - Playback: plays audible background music, pilot chatter, and laser SFX during playback.

### Phase 4: Filmstrip Visual Thumbnails & Canvas Textures (`apps/studio`)
- **File**: `apps/studio/src/lib/textures/AssetTextureCache.ts`
  - Decodes real image/video assets into cached HTMLImageElement / ImageBitmap.
  - For mock/procedural IDs (`asset-space-nebula`, `asset-cockpit-hud`, etc.), procedurally renders high-fidelity canvas filmstrip thumbnails and Three.js textures.
- **File**: `apps/studio/src/components/timeline/FilmstripThumbnail.tsx`
  - Displays repeated thumbnail slices inside timeline sequence clips, giving true NLE visual aesthetics.
- **File**: `apps/studio/src/components/Preview.tsx`
  - Connects `UniversalThreeScene` with Three.js `WebGLRenderer` on the viewport canvas.
  - Binds active layer textures (background nebula, cockpit HUD, text overlays).
  - Implements Interactive Transform Gizmo (bounding box with drag-to-translate and corner handles to resize/rotate).

### Phase 5: Multi-Asset Sci-Fi Space Combat Demo IR
- **File**: `apps/studio/src/lib/ir/complexSciFiDemoIR.ts`
  - Expand to include realistic tracks:
    1. Background Video / 3D Nebula mesh displacement
    2. Midground Cockpit / Space Cruiser HUD
    3. VFX Laser Burst & Particle shockwaves
    4. 3D Extruded Text & Holographic Mission Status
    5. Audio Voiceover (Pilot Radio) with auto-ducking
    6. Audio SFX (Laser cannon burst)
    7. Audio BGM (Cyberpunk / Sci-Fi Synthwave)

### Phase 6: Automated Verification & Test Suite
- `autogenerated-tests/isomorphic_three_pts.test.ts`: Test pts.js math + Three.js scenegraph buffer generation.
- `autogenerated-tests/isomorphic_audio_dsp.test.ts`: Test Float32 procedural synthesis and multi-track mixing with ducking.
- `autogenerated-tests/studio_texture_cache.test.ts`: Test procedural filmstrip texture generation and LRU caching.
- Build verification: `bun run --filter=@acc/studio build` exits 0.

---

## Verification Plan
1. `bun test autogenerated-tests/isomorphic_three_pts.test.ts`
2. `bun test autogenerated-tests/isomorphic_audio_dsp.test.ts`
3. `bun test autogenerated-tests/studio_texture_cache.test.ts`
4. `bun run --filter=@acc/studio build`
5. End-to-end browser check: audible playback, visible filmstrip thumbnails, interactive 3D WebGL preview.
