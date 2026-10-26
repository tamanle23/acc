# Master Integration Plan - Iteration 34: Seamless Audio-Visual Parity (Integrating UniversalAudioMixer into IRPreviewEngine)

## 1. Context & Motivation

- Currently, `IRMasterRenderer` is the master offline/export renderer in `@acc/ir`. It combines both:
  1. **Visual Engine**: Rasterizes frames deterministically using `IRCanvasCompositor`.
  2. **Audio Engine**: Holds `UniversalAudioMixer` to mix all audio tracks, apply dynamic voice ducking, perform soft-limiting on the master bus, and export synchronized WAV/PCM.
- Meanwhile, in the client app (`@acc/studio`):
  - `IRPreviewEngine` handles only visual canvas rendering.
  - `WebAudioEngine` independently manages `UniversalAudioMixer`, synchronizing from `irState`, handling audio playback, VU metering, and scrub audio bursts.
- **The Architectural Objective**:
  To achieve complete feature and architectural parity between `IRPreviewEngine` and `IRMasterRenderer`, `IRPreviewEngine` must natively encapsulate audio mixing through `UniversalAudioMixer`.
  `WebAudioEngine` will no longer maintain a redundant standalone audio mixer or parse IR tracks on its own; instead, it delegates all timeline audio DSP to `IRPreviewEngine.getAudioMixer()` or `IRPreviewEngine.renderAudioSlice()`.

---

## 2. Parity Comparison: `IRMasterRenderer` vs `IRPreviewEngine`

| Capability | `IRMasterRenderer` (Offline / Export) | `IRPreviewEngine` (Interactive Preview) |
| :--- | :--- | :--- |
| **Visual Composition** | Discrete frame loop $t \in [0, N-1]$ via `IRCanvasCompositor` | Random-access discrete frame `renderFrame(t, ctx)` via `IRCanvasCompositor` |
| **Motion Evaluation** | Deterministic Motion Resolver | Deterministic Motion Resolver (`evaluateSequenceMotion`) |
| **Modifier Plugins** | `ModifierPluginRegistry` | `ModifierPluginRegistry` |
| **Audio Core Engine** | `UniversalAudioMixer` (`mixTimeline()`) | **NEW**: `UniversalAudioMixer` (`mixSlice()`, `syncTimeline()`) |
| **Hardware Output Sink** | Video file / pipe via `IVideoEncoderSink` | Screen via `CanvasRenderingContext2D` / `OffscreenCanvas` |
| **Audio Hardware Sink** | Encoded `.wav` file / FFmpeg audio stream | `WebAudioEngine` (`AudioBufferSourceNode` Master Bus / Web Audio API) |

---

## 3. Proposed Unified Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          IRPreviewEngine                               │
│                                                                        │
│   ├── Visual Composition:                                              │
│   │     └── renderFrame(frame, ctx, options): PreviewFrameResult       │
│   │                                                                    │
│   └── Audio Composition (Parity with IRMasterRenderer):                │
│         ├── getAudioMixer(): UniversalAudioMixer                       │
│         ├── syncTimeline(timeline: ResolvedTimeline): void             │
│         └── renderAudioSlice(timeSec, durationSec): DecoupledAudioMix  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
       [Visual Output Pipeline]        [Live Audio Output Pipeline]
       - OffscreenCanvas in Worker     - WebAudioEngine in Studio
       - Viewport Canvas in Preview    - Master Bus: Gain -> Analyser -> Out
                                       - Consecutive Scheduled Audio Chunks
```

---

## 4. Key Design Decisions for Regression-Free Integration

### 1. Single Source of Truth for Audio Tracks
`IRPreviewEngine` receives `timeline: ResolvedTimeline`. It automatically configures its internal `UniversalAudioMixer`:
- Iterates over all audio tracks and sequences.
- Extracts start time, duration, volume, pan, dynamic ducking modifiers, and audio sources.
- Whenever `previewEngine.syncTimeline(timeline)` is called, the audio mixer is updated in synchronization with the visual interval tree.

### 2. Clean Delegation in `WebAudioEngine`
`WebAudioEngine` becomes the **hardware audio driver / playback transport**:
- Receives audio slices by calling `previewEngine.renderAudioSlice(startSec, durationSec)`.
- Connects the returned Float32 PCM to Web Audio API (`AudioBufferSourceNode -> masterGain -> analyser -> destination`).
- Eliminates duplicate audio parsing logic in `WebAudioEngine.ts` (over 120 lines of track parsing deleted and consolidated into `@acc/ir`).

### 3. Worker Compatibility
Because `IRPreviewEngine` is isomorphic and pure TypeScript:
- In Node / Server (`IRMasterRenderer`), audio mixes to disk/stream.
- In Web Worker (`preview.worker.ts`), `IRPreviewEngine` can run both visual compositing and audio chunk generation without DOM dependencies.
- In Main Thread (`WebAudioEngine`), it can also run directly or request pre-rendered audio slices.

---

## 5. Next Steps

1. **Phase 1**: Add audio synchronization and `renderAudioSlice()` to `IRPreviewEngine` in `@acc/ir`.
2. **Phase 2**: Refactor `WebAudioEngine` in `@acc/studio` to consume `IRPreviewEngine`'s audio mixer instead of maintaining its own duplicate parser.
3. **Phase 3**: Add parity test `autogenerated-tests/ir_preview_master_renderer_audio_parity.test.ts` verifying that `IRPreviewEngine.renderAudioSlice()` and `IRMasterRenderer.getAudioMixer()` generate 100% bit-identical PCM for the same timeline segment.
