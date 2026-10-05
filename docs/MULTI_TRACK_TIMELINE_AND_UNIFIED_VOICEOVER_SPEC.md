# 🏛️ Architectural Specification: Multi-Track Timeline & Unified Voiceover Architecture

**Document Version**: 1.0.0  
**Target Subsystems**: `@acc/core`, `@acc/effect-engines`, `@acc/cli`  
**Status**: Approved Architectural Standard  
**Document ID**: `docs/MULTI_TRACK_TIMELINE_AND_UNIFIED_VOICEOVER_SPEC.md`

---

## 1. Executive Overview & Problem Context

Historically, video assembly in automated story generators operated under a **Per-Scene Coupled Audio Model**:
- Each scene required its own independent audio voiceover slice (`scene1.mp3`, `scene2.mp3`).
- The scene duration was bound to that specific slice.
- Transitions between scenes required complex padding and audio crossfades that risked chopping the head or tail of speech.
- Subtitle alignment was fragmented into micro-slices, causing accumulative drift across multiple scenes.
- Sound effects (SFX) were difficult to position across transition boundaries or coordinate with background music ducking.

### The Professional NLE Paradigm
In modern Non-Linear Editing systems (DaVinci Resolve, Adobe Premiere Pro, Apple Final Cut Pro, CapCut), video production frequently operates in **Master Audio Timeline Mode**:
1. **Sovereign Timebase**: A continuous, uncut master voiceover narration (`settings.audioTrack`) dictates the master clock from $t = 0.0\text{s}$ to $t = \text{totalDuration}$.
2. **Visual Decoupling**: Visuals (static images, 3D pop-out scenes, B-roll video clips) are placed onto the **Video Track** as discrete clips with explicit cut durations (`scenes[].duration`). Re-timing an image cut does not alter or re-encode the narration track.
3. **Multi-Track Sound Effects (SFX)**: Acoustic events (whooshes, stingers, foley, UI impacts) live on independent audio sub-tracks and automatically route into the sidechain ducking DSP graph to attenuate background music without muffling the narration.
4. **Single Source of Truth (SSOT) Captions**: A unified Whisper caption timeline spans the full master voiceover without segmentation or container round-off error.

---

## 2. Multi-Track Timeline Architecture Blueprint

```mermaid
flowchart TD
    subgraph Data Sources [story-config.json Inputs]
        MA[settings.audioTrack (Master Voiceover)]
        SC[scenes[]: Image, 3D Depth, B-Roll Video]
        SFX_G[settings.sfx (Global SFX)]
        SFX_S[scenes[].sfx (Scene-relative SFX)]
        BGM[settings.bgm (Background Music)]
        CAP[captions[] (Unified Timeline)]
    end

    subgraph Track Registry [TimelineEngine Tracks]
        T_AUDIO[Track 'audio': MasterAudioTimingStrategy]
        T_VIDEO[Track 'video': VideoClipTimingStrategy]
        T_SFX[Track 'sfx': SoundEffectsTimelineStrategy]
        T_CAP[Track 'caption': BoundedAcousticCaptionStrategy]
    end

    MA --> T_AUDIO
    SC --> T_VIDEO
    SFX_G & SFX_S --> T_SFX
    CAP --> T_CAP

    subgraph Timeline Engine [Core Single Source of Truth]
        T_AUDIO & T_VIDEO & T_SFX & T_CAP --> TE[TimelineEngine.getTrackState(trackId, t)]
    end

    subgraph Per-Frame Render Pipeline [Time t Evaluation]
        TE -->|Active Scene & Local Frame| V_RENDER[FFISceneEngine / renderDepth3DScene]
        TE -->|Active Phrase & Word Highlight| C_RENDER[drawCanvasCaptionsFromSnapshot]
        V_RENDER & C_RENDER --> ENC[FFIVideoEncoder (Zero-Copy Canvas to H.264/HEVC)]
    end

    subgraph Audio Mixing Pipeline [FFmpeg Filtergraph DSP]
        MA -->|Track 0:a| REMUX[Master Voice Remux Pass]
        T_SFX -->|adelay & amix| SFX_MIX[SFX Composite Bus]
        REMUX & SFX_MIX --> SC_DUCK[AudioDuckingDSP: Sidechain Compressor]
        BGM --> SC_DUCK
        SC_DUCK --> OUT_AUDIO[Final Synchronized Audio Stream]
    end

    ENC & OUT_AUDIO --> FINAL[Final Video Deliverable (.mp4)]
```

---

## 3. Data Models & Interface Contracts

All interfaces are formally defined in [`packages/core/src/types.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/core/src/types.ts):

### 3.1 Master Audio Track Configuration (`AudioTrackConfig`)
```typescript
export interface AudioTrackConfig {
  /** Path to the master voiceover audio file (.mp3, .wav, .m4a, .flac) */
  source: string;
  /** Volume multiplier (0.0 to 2.0, default: 1.0) */
  volume?: number;
  /** Primary timeline clock mode */
  timeBase?: 'master';
}
```

### 3.2 Sound Effects Configuration (`SFXClipConfig`)
```typescript
export interface SFXClipConfig {
  /** Path to SFX audio file (.wav, .mp3) */
  source: string;
  /** Start time offset in seconds (relative to scene start if under scenes[], or global timeline if in settings.sfx) */
  time?: number;
  /** Optional duration in seconds to trim SFX (default: full clip duration) */
  duration?: number;
  /** Volume multiplier (0.0 to 2.0, default: 1.0) */
  volume?: number;
  /** Whether this SFX triggers BGM sidechain ducking (default: true) */
  duckBgm?: boolean;
}
```

### 3.3 Timeline Strategy & Snapshot Interfaces
```typescript
export interface ITimelineTrack<TItem = any, TSnapshot = any> {
  readonly id: string;
  readonly type: 'caption' | 'video' | 'audio' | 'overlay' | 'sfx';
  items: TItem[];
  strategy: ITimelineStrategy<TItem, TSnapshot>;
  duration: number;
  timeOffset?: number;
}

export interface ITimelineStrategy<TItem = any, TSnapshot = any> {
  readonly strategyId: string;
  evaluate(items: TItem[], localTimeSec: number, trackConfig?: any): TSnapshot;
}

export interface SFXTrackSnapshot {
  activeClips: SFXClipConfig[];
  isEmittingAudio: boolean;
}

export interface MasterAudioTrackSnapshot {
  isPlaying: boolean;
  timeSec: number;
  duration: number;
  volume: number;
}
```

---

## 4. Timeline Strategies Implementation

### 4.1 SoundEffectsTimelineStrategy
Located in [`packages/core/src/timeline/SoundEffectsTimelineStrategy.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/core/src/timeline/SoundEffectsTimelineStrategy.ts):
- Performs pure, zero-allocation temporal queries for active sound cues at frame time $t$.
- Evaluates whether clips fall into the active emission window $[ \text{time}, \text{time} + \text{duration} )$.
- Returns an immutable `SFXTrackSnapshot` to guide renderer sidechains and audio mix graphs.

### 4.2 MasterAudioTimingStrategy
Located in [`packages/core/src/timeline/MasterAudioTimingStrategy.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/core/src/timeline/MasterAudioTimingStrategy.ts):
- Manages the absolute timeline clock.
- Ensures playback boundaries are strictly enforced without timing slip.

---

## 5. Pipeline Orchestrator Integration

In [`apps/cli/src/pipelines/04-generative-story/VideoEditPipelineOrchestrator.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/cli/src/pipelines/04-generative-story/VideoEditPipelineOrchestrator.ts):

### 5.1 Scene Duration Resolution in Master Audio Mode
When `settings.audioTrack` is configured, scenes do not rely on individual audio files. Each scene's duration is resolved via:
```typescript
export function getSceneDuration(scene: ResolvedSceneConfig, audioDuration?: number): number {
  if (scene.duration !== undefined && scene.duration > 0) {
    return scene.duration; // Explicit pacing on visual track
  }
  if (audioDuration && audioDuration > 0) {
    return audioDuration; // Fallback to per-scene audio if present
  }
  return 3.0; // Default fallback
}
```

### 5.2 Remuxing Master Voiceover Track
When visual scenes are concatenated (via zero-copy `FFIConcatMuxer` or transition `xfade`), the master voiceover track is remuxed directly:
```typescript
ffmpeg()
  .input(currentVideoPath)
  .input(masterAudioPath)
  .outputOptions([
    '-map 0:v:0',
    '-map 1:a:0',
    '-c:v copy',
    `-af volume=${vol}`,
    `-c:a ${config.settings.audioCodec}`,
    `-b:a ${config.settings.audioBitrate}`,
    '-shortest',
  ])
  .output(masterVoicePath);
```

### 5.3 Multi-Track SFX Mixing Pass
All sound effects (both global and per-scene with cumulative timeline offsets) are compiled into a unified FFmpeg audio filtergraph:
```typescript
allSfxClips.forEach((clip, idx) => {
  const inputIdx = idx + 1;
  const delayMs = Math.round(clip.time * 1000);
  const delayedOut = sfxGraph.createStreamLabel(`sfx_d_${idx}`);
  sfxGraph.addNode({
    inputs: [`${inputIdx}:a`],
    filter: `volume=${clip.volume},adelay=${delayMs}|${delayMs}`,
    outputs: [delayedOut],
  });
  delayedSfxLabels.push(delayedOut);
});

sfxGraph.addNode({
  inputs: ['0:a', ...delayedSfxLabels],
  filter: 'amix',
  options: {
    inputs: 1 + delayedSfxLabels.length,
    duration: 'first',
    dropout_transition: 2,
  },
  outputs: [finalAudioOut],
});
```

### 5.4 DSP Sidechain Ducking Priority Bus
When background music (`settings.bgm`) is applied:
1. The combined voiceover + SFX stream serves as the sidechain detector (`fg_sc`).
2. When voice narration or heavy SFX (explosions, whooshes) fires, BGM is automatically ducked (`-24dB`, 10ms attack, 300ms release).
3. The `amix` duration is bound to `first` (the primary narrative stream), ensuring the video terminates cleanly without running indefinitely into the looped BGM.

---

## 6. Specification Examples in `story-config.json`

### Example A: Master Voiceover Mode with Multi-Track SFX
```json
{
  "$schema": "./schema/story-config.schema.json",
  "name": "Single_Voiceover_Story",
  "settings": {
    "platform": "tiktok",
    "audioTrack": {
      "source": "voiceover/master_narration.mp3",
      "volume": 1.0
    },
    "bgm": {
      "source": "music/ambient_lofi.mp3",
      "volume": 0.12,
      "autoDucking": true
    },
    "captions": {
      "preset": "tiktok",
      "subtitleMode": "burn",
      "activeWordHighlight": true
    }
  },
  "scenes": [
    {
      "image": "images/scene1.png",
      "duration": 4.5,
      "transition": { "type": "fade", "duration": 0.8 },
      "depth3d": { "enabled": true, "mode": "parallax_25d" },
      "sfx": [
        { "source": "sfx/whoosh.wav", "time": 0.0, "volume": 0.7 }
      ]
    },
    {
      "image": "images/scene2.png",
      "duration": 5.2,
      "depth3d": { "enabled": true, "mode": "frame_breaker" },
      "sfx": [
        { "source": "sfx/door_creak.mp3", "time": 1.2, "volume": 0.8, "duckBgm": true }
      ]
    },
    {
      "video": "broll/forest.mp4",
      "duration": 6.0,
      "videoSettings": { "volume": 0.0 }
    }
  ],
  "captions": [
    { "text": "Ngày", "start": 0.12, "end": 0.45 },
    { "text": "xửa", "start": 0.46, "end": 0.72 },
    { "text": "ngày", "start": 0.73, "end": 0.98 },
    { "text": "xưa...", "start": 0.99, "end": 1.40 }
  ]
}
```

---

## 7. Verification & Invariant Protocol

To prevent any regressions across future updates, the following test invariants are enforced in [`autogenerated-tests/sfx_and_master_audio_timeline.test.ts`](file:///c:/Users/Admin/workspace/git/acc/autogenerated-tests/sfx_and_master_audio_timeline.test.ts):

1. **Acoustic Event Isolation**:
   - For any SFX clip with interval $[t_s, t_e)$, when $t < t_s$ or $t \ge t_e$, `snapshot.isEmittingAudio === false` and `snapshot.activeClips.length === 0`.
   - When $t \in [t_s, t_e)$, `snapshot.isEmittingAudio === true` and the active clip matches the registered sound cue.
2. **Master Timeline Boundary Invariance**:
   - When $t \le \text{totalDuration}$, `masterSnapshot.isPlaying === true`.
   - When $t > \text{totalDuration}$, `masterSnapshot.isPlaying === false`.
3. **Zero-Regression Frame Loop Invariance**:
   - Audio and SFX timeline evaluations operate purely via primitive mathematics without cloning Buffers or instantiating temporary JS typed arrays in per-frame loops.
