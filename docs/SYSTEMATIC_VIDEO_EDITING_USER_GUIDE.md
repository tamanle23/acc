# Comprehensive User & Developer Guide: Systematic Video Editing Engine

> **Target Audience**: Content Creators, Video Editors, Software Engineers, & Pipeline Integrators
> **System Scope**: ACC (Automated Content Creator) Monorepo
> **Reference Plan**: `docs/SYSTEMATIC_VIDEO_EDITING_ARCHITECTURE_PLAN.md`

---

## 1. Introduction & System Overview

The **ACC (Automated Content Creator)** Systematic Video Editing Engine is a high-performance, code-driven video production framework built on **Bun**, **`bun:ffi` Zero-Copy FFmpeg C-Bindings**, `@napi-rs/canvas` procedural graphics, and an **isolated Python gRPC AI Subsystem**.

It codifies the **13 foundational video production technique groups** into maintainable, deterministic TypeScript abstractions using established software design patterns (**Adapter, Strategy, Factory, Facade, Decorator, Command, Middleware, Flyweight**).

---

## 2. Quick Start & Basic Execution

### 2.1. Executing a Video Project via Unified CLI
You can execute video production projects directly via the unified ACC CLI:

```bash
# Render a generative storytelling video project
bun run cli.ts run story -c ./sample-story

# Shorthand compatibility execution
bun run cli.ts ./sample-story
```

### 2.2. Programmatic Execution in TypeScript
To process and render video timelines programmatically using the `EditingPipelineOrchestrator`:

```typescript
import { EditingPipelineOrchestrator } from '@acc/cli';

const orchestrator = new EditingPipelineOrchestrator();

const result = await orchestrator.processAndRender({
  name: 'My Cinematic Short',
  settings: {
    platform: 'tiktok',
    width: 1080,
    height: 1920,
    fps: 30,
    bgm: {
      source: 'assets/bgm.mp3',
      volume: 0.15,
      autoDucking: true,
    },
  },
  scenes: [
    {
      text: 'Discover the secrets of the cosmos',
      image: 'images/space.jpg',
      duration: 4,
      captions: [
        { text: 'Discover', start: 0, end: 1.0 },
        { text: 'the secrets', start: 1.0, end: 2.5 },
        { text: 'of the cosmos', start: 2.5, end: 4.0 },
      ],
    },
  ],
}, {
  outputDir: './exports',
  autoSafeZones: true,
});

console.log(`Rendered output saved to: ${result.exportResult.outputPath}`);
```

---

## 3. Comprehensive Guide to All 13 Video Editing Groups & Subgroups

### ✂️ Group 1: Cuts & Transitions

#### 1.1 Standard Cuts, J/L-Cut Split Edits, & Freeze Frame
J-Cuts start audio before the video appears, L-Cuts allow audio to continue into the next scene, and Freeze Frames hold a video on a single frame.

* **Split Edits**:
```typescript
import { EditingOpFactory } from '@acc/effect-engines';

const jCutStrategy = EditingOpFactory.getCutStrategy('j_cut', { offsetMs: 600 });
const cutCalc = jCutStrategy.calculateCut(chunk);
```

* **Freeze Frame Strategy**:
```typescript
import { FreezeFrameStrategy } from '@acc/effect-engines';

const freezeFilter = FreezeFrameStrategy.generateFFmpegFreezeFrameFilter({
  freezeAtMs: 1200,
  durationMs: 2000,
});
```

#### 1.2 Transitions via `TransitionFactory`
Apply seamless scene transitions (`fade`, `wipeleft`, `wiperight`, `dissolve`, `glitch_dissolve`).

```typescript
import { TransitionFactory } from '@acc/effect-engines';

const transition = TransitionFactory.getTransition('glitch_dissolve');
const filterStr = transition.generateFFmpegXfadeFilter('v_scene0', 'v_scene1', 'v_out', 4.0, 1.0);
```

#### 1.4 Cutaway B-roll Overlays
Overlay supplementary B-roll footage on Layer 1 while A-roll dialogue continues on Layer 0.

```typescript
import { CutawayOverlayCommand } from '@acc/effect-engines';

const cutawayCmd = new CutawayOverlayCommand({
  primaryClipId: 'interview_clip_1',
  brollSourcePath: 'broll/city_timelapse.mp4',
  startMs: 1500,
  durationMs: 3000,
});

const filterStr = cutawayCmd.generateFFmpegOverlayFilter();
```

---

### ⏱️ Group 2: Pacing & Timing

#### 2.1 Montage Beat Sync
Automatically sync clip cuts to background music beat transients.

```typescript
import { MontageBeatSync } from '@acc/effect-engines';

const beatCuts = MontageBeatSync.calculateBeatCuts(
  [
    { timestampMs: 500, intensity: 0.9 },
    { timestampMs: 1200, intensity: 1.0 },
    { timestampMs: 1800, intensity: 0.8 },
  ],
  ['broll/01.mp4', 'broll/02.mp4', 'broll/03.mp4']
);
```

#### 2.2 Speed Ramping & Bezier Frame Interpolation
Create dynamic speed ramps (e.g. $1\text{x} \to 0.25\text{x} \to 2.0\text{x}$).

```typescript
import { SpeedRampStrategy } from '@acc/effect-engines';

const keyframes = [
  { timeMs: 0, value: 1.0 },
  { timeMs: 1000, value: 0.25 },
  { timeMs: 2000, value: 2.0 },
];

const speedAt500ms = SpeedRampStrategy.evaluateSpeedAtTime(keyframes, 500);
const filterStr = SpeedRampStrategy.generateFFmpegSetPtsFilter(speedAt500ms);
```

---

### 🎵 Group 3: Audio Editing

#### 3.1 Sidechain Audio Ducking & EBU R128 LUFS Normalization
Automatically lower background music volume under speech and normalize output to $-14\text{ LUFS}$.

```typescript
import { AudioDuckingDSP } from '@acc/core';

const duckingFilter = AudioDuckingDSP.buildSidechainFilterGraph('a_narration', 'a_bgm', 'a_out', {
  attenuationDb: -18,
  attackMs: 20,
  releaseMs: 250,
});

const loudnormFilter = AudioDuckingDSP.buildEBUR128LoudnessFilter(-14.0);
```

#### 3.2 Foley & Sound Design Presets
Instantiate Foley and SFX markers using `SoundEffectFactory`.

```typescript
import { SoundEffectFactory } from '@acc/effect-engines';

const footstepsMarker = SoundEffectFactory.createFoleyPreset('footsteps', 1200);
const whooshMarker = SoundEffectFactory.createFoleyPreset('whoosh', 2500);
```

---

### 🎨 Group 4: Visual & Effects

#### 4.1 Color Correction & 3D LUTs
Apply tetrahedral 3D Look-Up Tables (`.cube`) and contrast/saturation adjustments.

```typescript
import { ColorGradingEngine } from '@acc/effect-engines';

const colorEngine = new ColorGradingEngine();
const filterStr = colorEngine.generateFFmpegFilter({
  contrast: 1.12,
  saturation: 1.20,
  exposure: 0.05,
  lutPath: 'assets/luts/cyberpunk.cube',
});
```

#### 4.2 Parametric Vignette Masking & Decorators
Wrap frame renderers with vignette or parametric vector masks.

```typescript
import { VignetteDecorator } from '@acc/effect-engines';

const decoratedProducer = new VignetteDecorator(baseProducer);
decoratedProducer.renderFrame(canvasCtx, 1080, 1920, frameIndex);
```

---

### 🖼️ Group 5: Compositing & Spatial Layout

#### 5.1 Picture-in-Picture (PiP) & Split Screen
Layout multiple video streams on a single canvas.

```typescript
import { EditingOpFactory } from '@acc/effect-engines';

const pipStrategy = EditingOpFactory.getCompositorStrategy('pip', {
  scale: 0.35,
  corner: 'bottom_right',
});

const layout = pipStrategy.composeLayout(1080, 1920, [
  { id: 'layer_main', isPrimary: true },
  { id: 'layer_pip' },
]);
```

#### 5.2 Chroma Key Green Screen & Homography Screen Replacement
Remove green screen backgrounds or corner-pin videos onto device screens.

```typescript
import { ChromaKeyCompositorStrategy, HomographyCompositorStrategy } from '@acc/effect-engines';

const chromaFilter = ChromaKeyCompositorStrategy.generateFFmpegChromaKeyFilter({
  keyColorHex: '0x00FF00',
  similarity: 0.18,
});

const matrix = HomographyCompositorStrategy.calculate3x3HomographyMatrix(srcQuad, dstQuad);
```

#### 5.3 Double Exposure Blending
Blend two video layers together using `screen`, `multiply`, or `overlay` blend modes.

```typescript
import { DoubleExposureCompositorStrategy } from '@acc/effect-engines';

// Apply blend mode on 2D Canvas
DoubleExposureCompositorStrategy.applyDoubleExposureBlend(canvasCtx, 'screen', 0.85);

// Generate FFmpeg blend filter
const blendFilter = DoubleExposureCompositorStrategy.generateFFmpegBlendFilter('v0', 'v1', 'v_out', 'screen');
```

---

### 🔠 Group 6: Typography & Motion Graphics

#### 6.1 Lower Thirds & Tracking Call-outs
Render glassmorphic speaker nameplates and target tracking call-out lines.

```typescript
import { LowerThirdFactory, TrackingCalloutEngine } from '@acc/effect-engines';

// Render Lower Third
LowerThirdFactory.renderLowerThirdToCanvas(ctx, {
  name: 'Dr. Jane Doe',
  title: 'Chief Quantum Physicist',
  stylePreset: 'cinematic',
});

// Render Tracking Call-out
TrackingCalloutEngine.renderTrackingCallout(ctx, {
  labelText: 'Quantum Core v2',
  targetPoint: { x: 540, y: 700 },
  boxOffset: { x: 80, y: -60 },
});
```

#### 6.3 Kinetic Typography (Spring Physics)
Animate text entry with spring physics ($F = -kx - cv$).

```typescript
import { KineticTypography } from '@acc/effect-engines';

const popInScales = KineticTypography.generatePopInSequence(15, 30, {
  stiffness: 220,
  damping: 14,
  mass: 1.0,
});
```

---

### ⚙️ Group 7: Workflow & Multicam

#### 7.1 Multicam Waveform Alignment
Synchronize multiple camera feeds using audio cross-correlation.

```typescript
import { MulticamFacade } from '@acc/core';

const synchronizedAngles = MulticamFacade.syncAllCameraAngles(cameraA, [cameraB, cameraC]);
console.log(`Camera B offset: ${synchronizedAngles[0].offsetMs}ms`);
```

#### 7.2 Proxy Asset Manager & 7.4 Text-Based Transcript Editing
Edit with lightweight 720p proxies during preview and calculate timeline cuts directly from deleted transcript words.

```typescript
import { ProxyAssetManager, TextBasedEditingEngine } from '@acc/core';

// Proxy Asset Manager
const proxyManager = new ProxyAssetManager();
proxyManager.registerAsset('scene_1', '4k_originals/scene1.mp4', 'proxies/scene1_720p.mp4');
proxyManager.setProxyMode(true);
const previewPath = proxyManager.getResolvedPath('scene_1');

// Text-Based Editing Engine
const wordTokens = [
  { word: 'Welcome', startMs: 0, endMs: 500, deleted: false },
  { word: 'um', startMs: 500, endMs: 900, deleted: true },
  { word: 'everyone', startMs: 900, endMs: 1400, deleted: false },
];
const retainedRanges = TextBasedEditingEngine.calculateTimelineCutsFromDeletedWords(wordTokens);
```

---

### 🤖 Group 8: AI-Powered & Generative Editing

#### 8.1 Auto-Reframe (16:9 to 9:16) & Voice Isolation
Convert horizontal video to vertical format while keeping focal subjects centered and remove background audio noise.

```typescript
import { AutoReframeStrategy } from '@acc/effect-engines';
import { VoiceIsolationEngine } from '@acc/core';

// Auto-Reframe 16:9 to 9:16
const autoReframe = new AutoReframeStrategy({
  sourceWidth: 1920,
  sourceHeight: 1080,
  targetAspectRatio: '9:16',
});
const cropRect = autoReframe.calculateCropForSubject({ x: 1200, y: 200, width: 300, height: 600 });

// Voice Isolation & Audio Noise Removal Filter
const voiceIsoFilter = VoiceIsolationEngine.generateFFmpegVoiceIsolationFilter({
  noiseSuppressionDb: -21,
  highpassHz: 80,
});
```

---

### 📤 Group 9: Mastering & Delivery

#### 9.1 TikTok / Reels / Shorts Safe Zones
Ensure text and captions avoid platform UI occlusion zones.

```typescript
import { SafeZoneManager } from '@acc/effect-engines';

const inSafeZone = SafeZoneManager.isBoxInSafeZone(
  { x: 100, y: 1750, width: 400, height: 100 },
  'tiktok'
);
```

#### 9.2 HDR to Rec.709 Tone Mapping
Convert Rec.2020 HDR footage to web-compliant Rec.709 using Hable tone mapping.

```typescript
import { ToneMappingEngine } from '@acc/core';

const toneMapFilter = ToneMappingEngine.generateFFmpegToneMapFilter({
  inputColorSpace: 'hdr10',
  targetColorSpace: 'rec709',
  algorithm: 'hable',
});
```

---

### 🐉 Group 10: VFX & CGI Integration

#### 10.2 Clean Plate Wire Removal & Matchmove
Remove unwanted wires/logos or reconstruct 3D camera tracks.

```typescript
import { CleanPlateEngine, MatchmoveVisionFacade } from '@acc/core';

const delogoFilter = CleanPlateEngine.generateFFmpegInpaintFilter({ x: 100, y: 100, width: 50, height: 50 });
const cameraTracks = await MatchmoveVisionFacade.calculate3DCameraTrajectory('footage.mp4');
```

---

### 🗄️ Group 11: Interactive Media & DAM

#### 11.1 Interactive Branching Video Exporter
Export non-linear branching video trees as standalone HTML5 Web Component widgets.

```typescript
import { WidgetExporter } from '@acc/exporters';

const { htmlPath, jsonPath } = WidgetExporter.exportInteractiveWidget(extendedIR, {
  outputDir: './interactive_output',
  autostart: true,
});
```

---

### 🥽 Group 12: Immersive & Spatial Media

#### 12.1 360 Video Stitching, Stereoscopic Spatial Video, & Ambisonics
Process 360 VR dual fisheye lenses, export stereoscopic 3D for Apple Vision Pro, or encode Higher-Order Ambisonics (HOA) B-Format 3D audio.

```typescript
import { EquirectangularStitcher } from '@acc/effect-engines';
import { SpatialAudioAmbisonicsEngine } from '@acc/core';
import { SpatialVideoExporter } from '@acc/exporters';

const v360Filter = EquirectangularStitcher.generateFFmpegV360Filter({ inputProjection: 'dual_fisheye', yawDeg: 10 });
const stereoFilter = SpatialVideoExporter.generateStereoscopicFFmpegFilter({ outputDir: '/tmp', eyeDisparityPx: 64 });
const ambisonicFilter = SpatialAudioAmbisonicsEngine.generateFFmpegAmbisonicBFormatFilter({ azimuthDeg: 45, elevationDeg: 0 });
```

---

### 🎬 Group 13: Virtual Production & Real-Time Compositing

#### 13.1 Zero-Copy RTMP Live Streaming & VTubing
Stream RGBA canvas buffer pointers directly to FFmpeg zero-copy memory or animate VTuber avatar meshes.

```typescript
import { ZeroCopyRTMPStreamStrategy } from '@acc/exporters';
import { MoCapVTubeFacade } from '@acc/effect-engines';

const rtmpStream = new ZeroCopyRTMPStreamStrategy({
  rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/key',
  width: 1920,
  height: 1080,
  fps: 30,
});

rtmpStream.startStream();
rtmpStream.pushRgbaFramePointer(canvasFrameBufferPointer);

// VTuber Avatar Animation
MoCapVTubeFacade.renderAvatarFrameFromLandmarks(ctx, {
  mouthOpenRatio: 0.8,
  eyeBlinkLeft: false,
  eyeBlinkRight: false,
  headRotation: { pitch: 0, yaw: 0, roll: 5 },
});
```

---

## 4. Design Pattern Summary & Programmatic Contracts

| Pattern | Interface / Class | Function in Architecture |
| :--- | :--- | :--- |
| **Adapter** | `LegacyStoryConfigAdapter` | Adapts legacy `story-config.json` into `ExtendedPipelineIR` AST v3.1 |
| **Facade** | `EditingEngineFacade`, `IPCFacade`, `MulticamFacade` | Provides simple unified APIs hiding FFI C-pointers and IPC gRPC calls |
| **Strategy** | `ICutStrategy`, `ICompositorStrategy`, `ITransitionStrategy`, `IAudioDSPStrategy` | Hot-swappable algorithms for cuts, layouts, transitions, and audio DSP |
| **Factory** | `EditingOpFactory`, `TransitionFactory`, `LowerThirdFactory`, `SoundEffectFactory` | Centralized instantiation of editing strategies based on IR metadata |
| **Decorator** | `EffectDecorator`, `VignetteDecorator`, `AudioDuckingDecorator` | Wraps frame producers and filter graphs to chain visual & audio effects |
| **Command** | `RenderTimelineCommand`, `ApplyColorGradingCommand`, `BurnSubtitleCommand` | Transactional execution units with memory & CPU cost estimation |
| **Middleware** | `EditingStageRunner`, `IEditingStageMiddleware` | Pipeline execution chain with defensive fault isolation error boundaries |
| **Flyweight** | `ModelHandleRegistry`, `AssetContext` | Caches heavy AI models and immutable asset buffers in memory |

---

## 5. Troubleshooting & Performance Tips

1. **Shared FFmpeg C-Libraries**:
   Ensure native FFmpeg development headers are installed on Linux/Ubuntu:
   ```bash
   sudo apt update && sudo apt install libavcodec-dev libavformat-dev libswscale-dev libavfilter-dev libswresample-dev ffmpeg
   ```
2. **VRAM Memory Budgeting**:
   Use `ModelHandleRegistry` to configure VRAM memory limits and trigger LRU eviction:
   ```typescript
   import { ModelHandleRegistry } from '@acc/core';

   const registry = ModelHandleRegistry.getInstance();
   registry.setVRAMBudgetMB(4096); // Restrict active models to 4GB VRAM
   await registry.releaseInactiveModels(30000); // Evict models idle for >30s
   ```
3. **Running Test Verification**:
   Execute the systematic video editing engine test suite:
   ```bash
   bun test autogenerated-tests/systematic_editing_engine.test.ts
   ```
