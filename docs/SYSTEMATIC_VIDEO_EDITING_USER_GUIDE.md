# Comprehensive User & Developer Guide: Systematic Video Editing Engine

> **System Scope**: ACC (Automated Content Creator) Monorepo
> **Reference Plan**: `docs/SYSTEMATIC_VIDEO_EDITING_ARCHITECTURE_PLAN.md`

---

## 1. System Status & Usage Modes

The **ACC Systematic Video Editing Engine** is fully implemented end-to-end. You can use it in two ways:

1. **End-to-End Declarative Execution (No Code Required)**:
   Provide a folder with media assets and a `story-config.json` configuration file, then invoke the unified CLI:
   ```bash
   bun run cli.ts ./my-story-folder
   ```
2. **Programmatic TypeScript API (For Developers & Pipeline Integrators)**:
   Import domain strategies (`VideoEditPipelineOrchestrator`, `EditingOpFactory`, `SafeZoneManager`, `ColorGradingEngine`) directly into custom TypeScript/Node/Bun microservices.

---

## 2. End-to-End CLI & Declarative JSON Configuration Guide

To create video outputs using the complete engine, create a `story-config.json` file inside your project folder. The `LegacyStoryConfigAdapter` automatically normalizes your configuration into the `ExtendedPipelineIR` v3.1 AST.

```
my-story-folder/
├── images/
│   └── 01.jpg
├── videos/
│   └── 02.mp4
├── voiceover/
│   └── 01.mp3
└── story-config.json
```

### Complete `story-config.json` Reference
Below is an end-to-end JSON configuration demonstrating how all 13 Video Editing Groups are configured declaratively:

```json
{
  "name": "Cinematic Cosmos Story",
  "description": "Demonstrating all 13 Video Editing Groups via JSON config",
  "settings": {
    "platform": "tiktok",
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "container": "mp4",
    "videoCodec": "h264",
    "gpuAcceleration": "auto",
    "fastStart": true,
    "colorSpace": "rec709",
    "targetLoudnessLufs": -14,
    "bgm": {
      "source": "voiceover/bgm.mp3",
      "volume": 0.12,
      "loop": true,
      "autoDucking": true
    },
    "captions": {
      "preset": "tiktok",
      "subtitleMode": "burn",
      "activeWordHighlight": true,
      "wordsPerPhrase": 4,
      "highlightColor": "#00FFFF"
    },
    "depth3d": {
      "enabled": true,
      "mode": "frame_breaker",
      "frameStyle": "card",
      "autoSegment": true,
      "autoDepth": true
    }
  },
  "scenes": [
    {
      "text": "Discover the hidden mysteries of the universe.",
      "image": "images/01.jpg",
      "audio": "voiceover/01.mp3",
      "duration": 4.5,
      "videoOffsetMs": 500,
      "transition": {
        "enabled": true,
        "type": "glitch_dissolve",
        "duration": 1.0
      },
      "captions": [
        { "text": "Discover", "start": 0.0, "end": 0.8 },
        { "text": "the hidden mysteries", "start": 0.8, "end": 2.2 },
        { "text": "of the universe.", "start": 2.2, "end": 4.5 }
      ]
    },
    {
      "text": "Explore deep spatial dimensions and real-time compositing.",
      "video": "videos/02.mp4",
      "duration": 5.0,
      "videoSettings": {
        "shortVideoMode": "loop",
        "volume": 0.8
      }
    }
  ]
}
```

### Invoking via CLI:
```bash
# Render story folder
bun run cli.ts ./my-story-folder

# Render with specific output path & format override
bun run cli.ts run story -c ./my-story-folder --outDir ./exports --format mp4
```

---

## 3. Guide to All 13 Video Editing Groups & Subgroups

### ✂️ Group 1: Cuts & Transitions
* **JSON Config**: Configure scene transitions (`transition.type: "glitch_dissolve" | "fade" | "wipeleft"`) and split edits (`videoOffsetMs: 500` for J-Cuts).
* **CLI Command**: Handled automatically during `bun run cli.ts ./my-story-folder`.
* **Programmatic API**:
  ```typescript
  import { EditingOpFactory, TransitionFactory, FreezeFrameStrategy } from '@acc/effect-engines';

  const jCutStrategy = EditingOpFactory.getCutStrategy('j_cut', { offsetMs: 500 });
  const transition = TransitionFactory.getTransition('glitch_dissolve');
  const freezeFilter = FreezeFrameStrategy.generateFFmpegFreezeFrameFilter({ freezeAtMs: 1000, durationMs: 2000 });
  ```

---

### ⏱️ Group 2: Pacing & Timing
* **JSON Config**: Beat sync montage and Bezier speed ramps (`speedRamp: [{ "timeMs": 0, "value": 1.0 }, { "timeMs": 1000, "value": 0.25 }]`).
* **Programmatic API**:
  ```typescript
  import { MontageBeatSync, SpeedRampStrategy, SmashCutStrategy } from '@acc/effect-engines';

  const cuts = MontageBeatSync.calculateBeatCuts(beats, clipPaths);
  const speed = SpeedRampStrategy.evaluateSpeedAtTime(keyframes, 500);
  const smash = new SmashCutStrategy();
  ```

---

### 🎵 Group 3: Audio Editing
* **JSON Config**: Enable automatic sidechain music ducking under voiceover via `"settings.bgm.autoDucking": true`.
* **Programmatic API**:
  ```typescript
  import { AudioDuckingDSP } from '@acc/core';
  import { SoundEffectFactory } from '@acc/effect-engines';

  const duckingFilter = AudioDuckingDSP.buildSidechainFilterGraph('a_narration', 'a_bgm', 'a_out');
  const footstepSFX = SoundEffectFactory.createFoleyPreset('footsteps', 1200);
  ```

---

### 🎨 Group 4: Visual & Effects
* **JSON Config**: Color grading and 3D LUT look-up tables (`"colorGrading": { "lutPath": "luts/cyberpunk.cube", "contrast": 1.1 }`).
* **Programmatic API**:
  ```typescript
  import { ColorGradingEngine, VignetteDecorator } from '@acc/effect-engines';

  const colorEngine = new ColorGradingEngine();
  const filterStr = colorEngine.generateFFmpegFilter({ lutPath: 'luts/cyberpunk.cube', contrast: 1.1 });
  ```

---

### 🖼️ Group 5: Compositing & Spatial Layout
* **JSON Config**: Multi-viewport layout modes (`pip` Picture-in-Picture, `split_screen`, green screen `chromaKey`).
* **Programmatic API**:
  ```typescript
  import { EditingOpFactory, ChromaKeyCompositorStrategy, DoubleExposureCompositorStrategy } from '@acc/effect-engines';

  const pipStrategy = EditingOpFactory.getCompositorStrategy('pip', { scale: 0.35 });
  const chromaFilter = ChromaKeyCompositorStrategy.generateFFmpegChromaKeyFilter({ keyColorHex: '0x00FF00' });
  const doubleExpFilter = DoubleExposureCompositorStrategy.generateFFmpegBlendFilter('v0', 'v1', 'v_out', 'screen');
  ```

---

### 🔠 Group 6: Typography & Motion Graphics
* **JSON Config**: Preset dynamic captions (`tiktok`, `neon-glow`, `cinematic`) with word-level karaoke highlighting.
* **Programmatic API**:
  ```typescript
  import { LowerThirdFactory, KineticTypography, TrackingCalloutEngine } from '@acc/effect-engines';

  LowerThirdFactory.renderLowerThirdToCanvas(ctx, { name: 'Dr. Jane Doe', title: 'Chief Quantum Physicist' });
  const springScales = KineticTypography.generatePopInSequence(15, 30);
  ```

---

### ⚙️ Group 7: Workflow & Multicam
* **JSON Config**: Proxy editing (`useProxies: true`) and multicam angle synchronization.
* **Programmatic API**:
  ```typescript
  import { MulticamFacade, ProxyAssetManager, TextBasedEditingEngine } from '@acc/core';

  const syncedAngles = MulticamFacade.syncAllCameraAngles(refAngle, [targetAngle]);
  const cuts = TextBasedEditingEngine.calculateTimelineCutsFromDeletedWords(wordTokens);
  ```

---

### 🤖 Group 8: AI-Powered & Generative Editing
* **JSON Config**: Auto-reframe 16:9 to 9:16 (`"autoReframe": { "targetAspectRatio": "9:16" }`), AI B-roll generation, and voice isolation.
* **Programmatic API**:
  ```typescript
  import { AutoReframeStrategy } from '@acc/effect-engines';
  import { GenerativeAIFacade, VoiceIsolationEngine } from '@acc/core';

  const crop = autoReframe.calculateCropForSubject(subjectBox);
  const voiceFilter = VoiceIsolationEngine.generateFFmpegVoiceIsolationFilter();
  ```

---

### 📤 Group 9: Mastering & Delivery
* **JSON Config**: Target platform safe zones (`platform: "tiktok" | "reels" | "shorts"`) and Rec.709 HDR tone mapping.
* **Programmatic API**:
  ```typescript
  import { SafeZoneManager } from '@acc/effect-engines';
  import { ToneMappingEngine } from '@acc/core';

  const inSafeZone = SafeZoneManager.isBoxInSafeZone(box, 'tiktok');
  const toneMapFilter = ToneMappingEngine.generateFFmpegToneMapFilter();
  ```

---

### 🐉 Group 10: VFX & CGI Integration
* **JSON Config**: SAM 2 cutout and Depth Anything v2 metric depth 3D pop-out (`"depth3d": { "enabled": true, "mode": "frame_breaker" }`).
* **Programmatic API**:
  ```typescript
  import { CleanPlateEngine, MatchmoveVisionFacade } from '@acc/core';

  const delogoFilter = CleanPlateEngine.generateFFmpegInpaintFilter({ x: 100, y: 100, width: 50, height: 50 });
  ```

---

### 🗄️ Group 11: Interactive Media & DAM
* **JSON Config**: Interactive branching decision nodes (`"interactiveNodes": [{ "timestampMs": 3000, "options": [...] }]`).
* **Programmatic API**:
  ```typescript
  import { WidgetExporter } from '@acc/exporters';
  import { MetadataArchiver } from '@acc/core';

  const { htmlPath } = WidgetExporter.exportInteractiveWidget(extendedIR, { outputDir: './widget' });
  const metadataArgs = MetadataArchiver.generateFFmpegMetadataArgs(extendedIR);
  ```

---

### 🥽 Group 12: Immersive & Spatial Media
* **JSON Config**: 360 VR stitching, stereoscopic 3D side-by-side export for Apple Vision Pro, and Ambisonic B-Format 3D spatial audio.
* **Programmatic API**:
  ```typescript
  import { EquirectangularStitcher } from '@acc/effect-engines';
  import { SpatialAudioAmbisonicsEngine } from '@acc/core';
  import { SpatialVideoExporter } from '@acc/exporters';

  const v360Filter = EquirectangularStitcher.generateFFmpegV360Filter({ inputProjection: 'dual_fisheye' });
  const ambisonicFilter = SpatialAudioAmbisonicsEngine.generateFFmpegAmbisonicBFormatFilter({ azimuthDeg: 45, elevationDeg: 0 });
  ```

---

### 🎬 Group 13: Virtual Production & Real-Time Compositing
* **JSON Config**: 24/7 continuous RTMP live stream broadcasting (`bun run cli.ts stream ambient --rtmp <url>`).
* **Programmatic API**:
  ```typescript
  import { ZeroCopyRTMPStreamStrategy } from '@acc/exporters';
  import { MoCapVTubeFacade } from '@acc/effect-engines';

  const rtmpStream = new ZeroCopyRTMPStreamStrategy({ rtmpUrl: 'rtmp://localhost/live', width: 1920, height: 1080, fps: 30 });
  rtmpStream.startStream();
  rtmpStream.pushRgbaFramePointer(frameBufferPointer);
  ```

---

## 4. Software Design Pattern Reference Architecture

The engine is built on 8 core software design patterns for maximum maintainability and zero regressions:

| Pattern | Class / Interface | Location | Function |
| :--- | :--- | :--- | :--- |
| **Adapter** | `LegacyStoryConfigAdapter` | `@acc/ir` | Normalizes `story-config.json` into `ExtendedPipelineIR` AST v3.1 |
| **Facade** | `EditingEngineFacade`, `IPCFacade`, `MulticamFacade` | `@acc/core` | Provides simple APIs hiding FFI C-pointers and IPC gRPC details |
| **Strategy** | `ICutStrategy`, `ICompositorStrategy`, `ITransitionStrategy` | `@acc/effect-engines` | Hot-swappable algorithms for cuts, spatial layouts, and transitions |
| **Factory** | `EditingOpFactory`, `TransitionFactory`, `SoundEffectFactory` | `@acc/effect-engines` | Centralized instantiation of strategies based on IR metadata |
| **Decorator** | `EffectDecorator`, `VignetteDecorator`, `AudioDuckingDecorator` | `@acc/effect-engines` | Wraps frame producers and filter graphs to chain visual & audio effects |
| **Command** | `RenderTimelineCommand`, `ApplyColorGradingCommand`, `BurnSubtitleCommand` | `@acc/core` | Transactional execution units with memory & CPU cost estimation |
| **Middleware**| `EditingStageRunner`, `IEditingStageMiddleware` | `@acc/core` | Stage execution chain with defensive fault isolation error boundaries |
| **Flyweight** | `ModelHandleRegistry`, `AssetContext` | `@acc/core` | Caches heavy AI models and asset buffers with LRU memory eviction |

---

## 5. Troubleshooting & Performance

1. **Shared FFmpeg C-Libraries**:
   On Ubuntu/Linux systems, install shared FFmpeg development packages:
   ```bash
   sudo apt update && sudo apt install libavcodec-dev libavformat-dev libswscale-dev libavfilter-dev libswresample-dev ffmpeg
   ```
2. **VRAM Memory Budgeting**:
   Configure VRAM budget limits on `ModelHandleRegistry`:
   ```typescript
   import { ModelHandleRegistry } from '@acc/core';

   const registry = ModelHandleRegistry.getInstance();
   registry.setVRAMBudgetMB(4096); // Restrict to 4GB VRAM
   await registry.releaseInactiveModels(30000); // Evict models idle for >30s
   ```
3. **Running Test Verification**:
   Execute the full systematic editing test suite (32/32 tests):
   ```bash
   bun test autogenerated-tests/systematic_editing_engine.test.ts
   ```
