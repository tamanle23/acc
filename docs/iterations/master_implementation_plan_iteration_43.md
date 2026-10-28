# Master Implementation Plan - Iteration 43: Studio High-Performance NLE Engine Upgrade

## 1. Executive Summary & Context

Iteration 43 scales the video editing engine across `@acc/studio`, `@acc/core-web`, and `@acc/ir` from a feature-complete web NLE prototype to an enterprise-grade broadcast editing suite. Following the OPFS streaming cache and 6-suite soak testing established in Iteration 37/42, this iteration eliminates the four primary platform boundaries encountered on modern web browsers when editing multi-track 4K timelines (50+ tracks, 100+ media clips):

1. **DOM & Canvas Density Bottleneck**: Per-clip `WaveSurfer.js` DOM nodes and canvas instances cause severe layout thrashing, composite layer explosion, and GPU context memory exhaustion during zooming and horizontal scrolling.
2. **Audio Thread Scheduling Jitter & GC Latency**: Scheduling audio chunks via `AudioBufferSourceNode` or transferring decoded chunks via `postMessage` creates 5–30ms event loop jitter and garbage collector pauses during interactive scrubbing and multi-speed transport.
3. **WebCodecs Hardware Session Quota Ceiling**: Chromium and WebKit strictly bound active hardware `VideoDecoder` sessions to $\sim 16$ instances per renderer. Multi-track, split-screen, and picture-in-picture (PIP) edits exhaust this quota, causing uncatchable browser crashes or black preview frames.
4. **Editor Ergonomic Friction & Velocity**: High-efficiency editing requires broadcast-standard muscle-memory keyboard workflows: frame-accurate J-K-L shuttle with pitch correction, single-keystroke Blade/Razor splitting across tracks, and automatic gap-closing Ripple Delete.

---

## 2. Decision & Architectural Trade-off Matrices

### Waveform Rendering Strategy
| Dimension | Option A: Per-Clip WaveSurfer DOM Instances (Current) | Option B: Track-Level Virtualized 2D Canvas (Adopted) | Option C: WebGL Multi-Track Instanced Quad Shader |
|---|---|---|---|
| **DOM Overhead** | $O(N)$ DOM nodes, resize observers, canvas wrappers | $O(T)$ where $T = \text{audio tracks}$ ($< 10$ nodes) | 1 master canvas for entire viewport |
| **GPU Memory** | 1 canvas per clip ($50 \times \sim 2\text{ MB} = 100\text{ MB}$) | 1 viewport canvas per track ($\sim 10\text{ MB}$ total) | Single shared WebGL context ($\sim 15\text{ MB}$) |
| **Render Latency** | High (DOM layout thrash on zoom/pan) | Low ($< 1\text{ ms}$ 2D batched paths per frame) | Ultra-low ($< 0.5\text{ ms}$ instanced quads) |
| **Implementation Complexity** | Minimal (existing prototype) | Moderate (pure 2D Canvas frustum slicing) | High (GLSL shaders, vertex buffers, texturing) |
| **Architectural Verdict** | **Deprecated** due to DOM scaling bottleneck | **Adopted for Iteration 43** | Future evolution for 1,000+ clips |

### Real-Time Audio Streaming Strategy
| Dimension | Option A: Chunk Scheduling via `AudioBufferSourceNode` (Current) | Option B: SPSC RingBuffer via `SharedArrayBuffer` + `Atomics` (Adopted) | Option C: Web Worker Transferable `Float32Array` |
|---|---|---|---|
| **Audio Latency** | 50–150ms buffer lead time | $< 3\text{ ms}$ (128-sample real-time pull) | 10–25ms `postMessage` queue jitter |
| **GC Pressure** | High (allocating buffer nodes per chunk) | **Zero (pre-allocated static circular memory)** | Moderate (allocating transfer buffers) |
| **Cross-Origin Security** | Works anywhere | Requires COOP/COEP (with automatic transferable fallback) | Works anywhere |
| **Architectural Verdict** | **Deprecated** for interactive playback | **Adopted with graceful fallback** | Fallback for non-isolated origins |

### WebCodecs Hardware Decoder Management
| Dimension | Option A: Unbounded `Input` / `VideoDecoder` per Clip (Current) | Option B: Playhead-Proximity Decoder Quota Pool (Adopted) | Option C: Single Worker Decoder with Sequential Seek |
|---|---|---|---|
| **Concurrent Limit** | Crashes / drops frames beyond 16 clips | Strictly caps hardware decoders at $\le 8$ | Exactly 1 hardware decoder |
| **Multi-Track Preview** | Unstable on multi-track transitions | Smooth PIP & transitions via leased slots | Cannot preview PIP/overlays simultaneously |
| **Fallback Strategy** | None (black frame on quota crash) | OPFS-cached poster frames & thumbnails | Dropped frames on seek queue lag |
| **Architectural Verdict** | **Violates browser invariants** | **Adopted for Iteration 43** | Insufficient for multi-track NLE |

---

## 3. Subsystem Architecture & Topology

```mermaid
graph TD
    subgraph UI_Presentation_Layer["Timeline & Viewport Presentation Layer (apps/studio)"]
        TimelineHost["Timeline.tsx / TimelineDom.tsx"]
        TrackCanvas["TrackWaveformVirtualCanvas\n(Single 2D Canvas per Track, Viewport-Sized)"]
        ToolbarControl["Toolbar.tsx & TransportHUD"]
        CommandDispatcher["TimelineCommandDispatcher\n(RazorCutCommand, RippleDeleteCommand)"]
        HotkeysEngine["useTimelineHotkeys & useShuttleEngine\n(J-K-L, Blade C, Split S, Ripple Shift+Del)"]
    end

    subgraph Audio_DSP_Pipeline["Audio Processing & DSP Pipeline"]
        Mixer["UniversalAudioMixer (@acc/ir)\nMulti-Track Non-Blocking Synthesis"]
        Engine["WebAudioEngine.ts\nMaster Clock & Gain/Analyser Coordination"]
        SPSC["SharedArrayRingBuffer\n(Lock-Free SharedArrayBuffer + Atomics)"]
        Worklet["SpscAudioWorkletProcessor\n(Dedicated Real-Time Audio Thread)"]
    end

    subgraph Video_Worker_Engine["Video Decoding & Preview Worker (preview.worker.ts)"]
        DecoderPool["WebCodecsDecoderPool\n(Hardware Session Quota Cap: <= 8)"]
        PriorityScorer["Playhead Proximity Priority Scorer\nP(clip) = f(frame, distance, track)"]
        WorkerReader["MediabunnyWorkerReader\n(Active Hardware Lease)"]
        PosterFallback["OPFS Poster Frame Storage\n(Zero-Memory Thumbnail Fallback)"]
    end

    TimelineHost --> TrackCanvas
    TimelineHost --> ToolbarControl
    ToolbarControl --> HotkeysEngine
    HotkeysEngine --> CommandDispatcher
    HotkeysEngine --> Engine

    Engine --> Mixer
    Mixer --> SPSC
    SPSC --> Worklet

    TimelineHost -.->|Playhead & Visibility Updates| DecoderPool
    DecoderPool --> PriorityScorer
    DecoderPool --> WorkerReader
    DecoderPool --> PosterFallback
```

---

## 4. Deep Architectural Specifications & Invariants

### 4.1 Timeline Waveform Virtualization (Unified 2D Canvas Lane)

#### Mathematical Frustum Culling & Viewport Projection
Given:
- $X_{\text{scroll}}$: Horizontal scroll offset of the timeline in pixels.
- $W_{\text{viewport}}$: Visible timeline width in pixels.
- $S_{px}$: Pixels per frame scale factor ($\text{pxPerFrame} = \text{zoomScale} \times \text{baseScale}$).
- $\text{DPR}$: Device pixel ratio (`window.devicePixelRatio || 1`).

The visible timeline frame interval $[F_{\text{start}}, F_{\text{end}}]$ is calculated deterministically:
$$F_{\text{start}} = \max\left(0, \left\lfloor \frac{X_{\text{scroll}}}{S_{px}} \right\rfloor\right), \quad F_{\text{end}} = \left\lceil \frac{X_{\text{scroll}} + W_{\text{viewport}}}{S_{px}} \right\rceil$$

An audio clip $C_k$ on track $T_j$ with timeline boundaries $[C_k.\text{startFrame}, C_k.\text{endFrame}]$ is drawn if and only if:
$$[C_k.\text{startFrame}, C_k.\text{endFrame}] \cap [F_{\text{start}}, F_{\text{end}}] \neq \emptyset$$

#### Source-Trimmed Peak Sampling Formulation
When an audio clip has been trimmed with in-point offset $T_{\text{in}} = C_k.\text{sourceStartTimeSec}$ and sample rate $R_{\text{sample}} = 44,100\text{ Hz}$:
For any horizontal screen pixel $x \in [\max(X_{\text{scroll}}, C_k.\text{startX}), \min(X_{\text{scroll}} + W_{\text{viewport}}, C_k.\text{endX})]$:
$$\text{clipLocalTimeSec}(x) = T_{\text{in}} + \frac{x - C_k.\text{startX}}{S_{px} \times \text{FPS}}$$
The corresponding multi-resolution LOD pyramid decimation level is chosen via $S_{px}$, guaranteeing that only 1 peak is sampled every 2 physical pixels, completely preventing overdraw.

#### Sub-Pixel Batch Path Drawing & Viewport-Anchored Canvas DOM
- **DOM Container**: Inside each `DroppableTrackLane.tsx`, a sticky canvas wrapper is mounted:
  `style={{ position: 'sticky', left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}`.
- **Physical Canvas Backing Store**: Sized strictly to $W_{\text{viewport}} \times \text{DPR}$ by $H_{\text{lane}} \times \text{DPR}$.
- **Rendering Routine**:
```typescript
const dpr = window.devicePixelRatio || 1;
ctx.save();
ctx.scale(dpr, dpr);
ctx.clearRect(0, 0, viewportWidth, laneHeight);

ctx.beginPath();
ctx.strokeStyle = trackColor;
ctx.lineWidth = 1.5;
ctx.lineCap = 'round';

const barSpacing = Math.max(2, Math.floor(2 * dpr));
for (let x = drawStartPx; x < drawEndPx; x += barSpacing) {
  const peak = samplePyramidPeak(clip, x, pxPerFrame);
  const amplitudePx = peak * (laneHeight * 0.42);
  ctx.moveTo(x, centerY - amplitudePx);
  ctx.lineTo(x, centerY + amplitudePx);
}
ctx.stroke();
ctx.restore();
```

---

### 4.2 Lock-Free SPSC AudioWorklet (`SharedArrayBuffer` + `Atomics`)

#### Memory Layout
The shared memory block is allocated once during engine bootstrap:
$$\text{Total Buffer Size} = 64\text{ bytes (Header)} + (44,100 \times 5 \times 4 \times 2)\text{ bytes (Stereo Payload)} = 1,764,064\text{ bytes} \approx 1.68\text{ MB}$$

```
[Offset 0..63]: Control Block (Int32Array view)
  - Index 0: READ_POINTER (Updated by AudioWorkletProcessor)
  - Index 1: WRITE_POINTER (Updated by UniversalAudioMixer on Main / Worker Thread)
  - Index 2: CAPACITY_SAMPLES (220,500 samples)
  - Index 3: STATE_FLAGS (0 = Normal, 1 = Underflow, 2 = Seek Reset)

[Offset 64..882,063]:        Channel 0 / Left (Float32Array view, 220,500 elements)
[Offset 882,064..1,764,063]:   Channel 1 / Right (Float32Array view, 220,500 elements)
```

#### Split Circular Wraparound Math (Critical Invariant)
Because audio chunks are written in variable block sizes ($N$ samples) while the audio thread reads in fixed 128-sample blocks, pointer wraparound across `CAPACITY_SAMPLES` must be handled with split boundary copies:

1. **Producer Split Write**:
   If `writePtr + N > capacity`:
   - First slice: write $L_1 = \text{capacity} - \text{writePtr}$ samples into `[writePtr .. capacity - 1]`.
   - Second slice: write $L_2 = N - L_1$ samples into `[0 .. L_2 - 1]`.
   - Advance pointer: `nextWritePtr = L_2`.
   Else:
   - Write $N$ samples into `[writePtr .. writePtr + N - 1]`.
   - Advance pointer: `nextWritePtr = writePtr + N`.

2. **Consumer Split Read (`AudioWorkletProcessor.process`)**:
   If `readPtr + 128 > capacity`:
   - First slice: copy $R_1 = \text{capacity} - \text{readPtr}$ samples into `output[0..R_1 - 1]`.
   - Second slice: copy $R_2 = 128 - R_1$ samples into `output[R_1 .. 127]`.
   - Advance pointer: `nextReadPtr = R_2`.
   Else:
   - Copy 128 samples into `output[0..127]`.
   - Advance pointer: `nextReadPtr = readPtr + 128`.

#### Memory Barrier Ordering & Atomics Semantics
JavaScript `Atomics` operations only operate on integer typed arrays (`Int32Array`), not `Float32Array`. To guarantee data integrity without race conditions:
- **Producer (Release Barrier)**:
  1. Load consumer `readPtr` with `Atomics.load(control, READ_POINTER)`.
  2. Write audio data to planar `Float32Array` channels.
  3. **Release Store**: `Atomics.store(control, WRITE_POINTER, nextWritePtr)`. This guarantees all float samples are globally committed in memory before the updated write pointer is published.
- **Consumer (Acquire Barrier)**:
  1. **Acquire Load**: `writePtr = Atomics.load(control, WRITE_POINTER)`. Guarantees all samples written prior to this pointer update are visible to the audio worklet thread.
  2. Copy 128 samples from `Float32Array` views into Web Audio output channels.
  3. Update consumer pointer: `Atomics.store(control, READ_POINTER, nextReadPtr)`.

#### Dual-Transport Architecture (COOP/COEP Fallback)
```typescript
export interface IAudioStreamTransport {
  write(left: Float32Array, right: Float32Array): number;
  reset(): void;
  dispose(): void;
}
```
- **`SharedArrayBufferTransport` (Primary)**: Zero-copy, zero-GC, $< 3\text{ ms}$ latency when `crossOriginIsolated === true`.
- **`MessagePortTransferableTransport` (Fallback)**: Automatically engaged if `typeof SharedArrayBuffer === 'undefined'` or `crossOriginIsolated === false`. Transfers pre-allocated Float32 buffers via `port.postMessage([left, right], [left.buffer, right.buffer])`.

---

### 4.3 WebCodecs Hardware Decoder Quota Pool

#### Priority Scoring Formulation
To ensure that hardware decoders are assigned strictly to visible, active video tracks near the playhead:

$$
P(C_k) = \begin{cases}
  10,000 - (\text{trackIndex} \times 100) & \text{if } F_{\text{playhead}} \in [C_k.\text{start}, C_k.\text{end}] \land \neg \text{track.isMuted} \\
  1,000 - \frac{|F_{\text{playhead}} - C_k.\text{start}|}{\text{FPS}} \times 50 & \text{if within } \pm 3 \text{ seconds of playhead} \\
  10 & \text{if visible on screen but outside active scrub window} \\0 & \text{if track is hidden / muted or clip is off-screen}
\end{cases}
$$

#### State Transition Machine & Quota Recovery Ladder
```mermaid
stateDiagram-v2
    [*] --> IdleUnallocated: Clip Added to Project
    IdleUnallocated --> HardwareLeased: High Priority (Playhead Near / Visible)
    HardwareLeased --> IdleUnallocated: Quota Exceeded (Lowest Priority Evicted via dispose())
    IdleUnallocated --> PosterFallback: Low Priority / Headless (Read OPFS Poster)
    HardwareLeased --> Disposed: Clip Removed from Timeline
    PosterFallback --> Disposed: Asset Deleted
```

#### QuotaExceededError Auto-Recovery Ladder
If `VideoDecoder.configure()` throws `QuotaExceededError` due to OS GPU driver limits:
1. Trap error in `WebCodecsDecoderPool`.
2. Automatically reduce maximum hardware decoder ceiling: $\text{cap} \leftarrow \max(2, \text{cap} - 2)$.
3. Immediately evict the lowest-priority leased reader (`reader.evictHardwareDecoder()`).
4. Re-attempt decode configuration on high-priority track.
5. Inactive tracks fall back to OPFS-cached poster frames (`ContentCacheRegistry.get('opfs')`).

---

### 4.4 Professional NLE Editing Workflows

#### Linked A/V Track Ripple Invariant
When deleting clip $C_{\text{target}}$ on track $T_{\text{target}}$ with starting frame $S$ and duration $D = C_{\text{target}}.\text{durationFrames}$:
1. **Find Linked Clips**: If $C_{\text{target}}$ has a companion linked audio or video clip ($C_{\text{linked}}.\text{linkId} === C_{\text{target}}.\text{linkId}$), delete both clips simultaneously.
2. **Track Shift**:
   For each track $T \in \text{AffectedTracks}$:
   - Remove target clip.
   - For all clips $C_i \in T$ where $C_i.\text{startFrame} > S$:
     $$C_i.\text{startFrame} \leftarrow C_i.\text{startFrame} - D$$
     $$C_i.\text{endFrame} \leftarrow C_i.\text{endFrame} - D$$
3. **Multi-Track Ripple All**:
   If `rippleAllUnlockedTracks === true`: apply $-D$ shift to all unlocked tracks at or after $S$. Locked tracks ($T.\text{isLocked} === true$) are strictly immune and maintain clip positions.
4. **Command Inversion for Undo/Redo**:
   `RippleDeleteCommand` stores the deleted clip references and shifted clip IDs with their exact original frame positions, guaranteeing bit-identical state restoration on `undo()`.

#### J-K-L Transport & Pitch-Preserving Audio
- **$1\times, 2\times$ Forward/Reverse**: Audio is synthesized with `playbackRate = speed` and `preservesPitch = true`.
- **$\ge 4\times$ Shuttle**: Audio output is muted (`gain.gain.value = 0`) to prevent high-frequency transducer clipping, and optional discrete 10-frame metronome clicks ("scrub chirps") provide acoustic timeline distance feedback.
- **K + L / K + J Step Scrubbing**: Holding K while tapping L or J advances playback by exactly 1 frame or runs at $0.5\times$ slow-motion.

---

## 5. Concrete Code Contracts & Method Signatures

### 5.1 `TrackWaveformVirtualCanvas` Interface
```typescript
// apps/studio/src/components/timeline/TrackWaveformVirtualCanvas.tsx
export interface TrackWaveformVirtualCanvasProps {
  trackId: string;
  clips: readonly TimelineClip[];
  viewportWidth: number;
  laneHeight: number;
  scrollLeft: number;
  pxPerFrame: number;
  fps: number;
  trackColor?: string;
}

export const TrackWaveformVirtualCanvas: React.FC<TrackWaveformVirtualCanvasProps>;
```

### 5.2 `SharedArrayRingBuffer` Interface
```typescript
// apps/studio/src/lib/audio/SharedArrayRingBuffer.ts
export interface SharedArrayRingBufferConfig {
  sampleRate?: number; // default: 44100
  capacitySeconds?: number; // default: 5
}

export class SharedArrayRingBuffer implements IAudioStreamTransport {
  constructor(config?: SharedArrayRingBufferConfig);
  public static isSupported(): boolean;
  public getSharedBuffer(): SharedArrayBuffer;
  public write(left: Float32Array, right: Float32Array): number;
  public read(outLeft: Float32Array, outRight: Float32Array, blockSize?: number): number;
  public reset(): void;
  public getAvailableRead(): number;
  public getAvailableWrite(): number;
  public dispose(): void;
}
```

### 5.3 `WebCodecsDecoderPool` Interface
```typescript
// apps/studio/src/renderer/workers/WebCodecsDecoderPool.ts
export interface DecoderLease {
  clipId: string;
  reader: MediabunnyWorkerReader;
  priorityScore: number;
  lastUsedTimestamp: number;
}

export class WebCodecsDecoderPool {
  public static getInstance(): WebCodecsDecoderPool;
  public setMaxHardwareDecoders(limit: number): void;
  public acquireLease(clipId: string, reader: MediabunnyWorkerReader, priority: number): Promise<boolean>;
  public releaseLease(clipId: string): void;
  public updatePriorities(playheadFrame: number, fps: number, activeTracks: string[]): void;
  public evictLowestPriority(): boolean;
  public clear(): void;
}
```

### 5.4 `RippleDeleteCommand` Interface
```typescript
// apps/studio/src/lib/timeline/commands/RippleDeleteCommand.ts
export class RippleDeleteCommand implements TimelineCommand {
  public readonly id = 'RIPPLE_DELETE_COMMAND';
  public readonly name = 'Ripple Delete Clip';
  constructor(
    private readonly targetClipId: string,
    private readonly rippleAllUnlocked: boolean = false
  );
  public execute(state: IRState): IRState;
  public undo(state: IRState): IRState;
}
```

---

## 6. Implementation Roadmap & Phased Deliverables

```mermaid
gantt
    title Iteration 43: Studio High-Performance Engine Upgrade
    dateFormat  YYYY-MM-DD
    section Phase 1: Virtual Waveforms
    TrackWaveformVirtualCanvas Component     :p1_1, 2026-10-28, 1d
    LOD Pyramid Viewport Slicing             :p1_2, after p1_1, 1d
    ClipItem DOM Cleanup                     :p1_3, after p1_2, 1d
    section Phase 2: WebCodecs Pool
    WebCodecsDecoderPool Manager             :p2_1, after p1_3, 1d
    Reader Eviction & OPFS Poster Sync       :p2_2, after p2_1, 1d
    section Phase 3: SPSC AudioWorklet
    SharedArrayRingBuffer + Atomics          :p3_1, after p2_2, 1d
    SpscAudioWorkletProcessor                :p3_2, after p3_1, 1d
    WebAudioEngine Integration               :p3_3, after p3_2, 1d
    section Phase 4: Pro NLE Shortcuts
    RippleDeleteCommand & Razor Cut          :p4_1, after p3_3, 1d
    J-K-L Pitch-Corrected Transport          :p4_2, after p4_1, 1d
    Integration & Soak Stress Tests          :p4_3, after p4_2, 1d
```

### Phase 1: Timeline Waveform Virtualization
- **Files**:
  - `apps/studio/src/components/timeline/TrackWaveformVirtualCanvas.tsx` (New)
  - `apps/studio/src/components/timeline/DroppableTrackLane.tsx` (Update)
  - `apps/studio/src/components/timeline/ClipItem.tsx` (Update)
- **Concrete Changes**:
  - Implement `TrackWaveformVirtualCanvas` rendering a single HTML5 `<canvas>` sized to track viewport width.
  - Wire frustum culling against `scrollLeft` and `timelineWidth`.
  - Deprecate per-clip `WaveSurfer` container instantiation in `ClipItem.tsx`.

### Phase 2: WebCodecs Hardware Decoder Quota Pool
- **Files**:
  - `apps/studio/src/renderer/workers/WebCodecsDecoderPool.ts` (New)
  - `apps/studio/src/renderer/workers/MediabunnyWorkerReader.ts` (Update)
  - `apps/studio/src/renderer/workers/preview.worker.ts` (Update)
- **Concrete Changes**:
  - Implement `WebCodecsDecoderPool` with `MAX_HARDWARE_DECODERS = 8`.
  - Add `evictHardwareDecoder()` and `reacquireHardwareDecoder()` to `MediabunnyWorkerReader`.
  - Register OPFS poster frame generator during asset import.

### Phase 3: Lock-Free AudioWorklet SPSC RingBuffer
- **Files**:
  - `apps/studio/src/lib/audio/SharedArrayRingBuffer.ts` (New)
  - `apps/studio/src/lib/audio/worklets/SpscAudioWorkletProcessor.ts` (New)
  - `apps/studio/src/lib/audio/WebAudioEngine.ts` (Update)
- **Concrete Changes**:
  - Implement `SharedArrayRingBuffer` using `SharedArrayBuffer` and `Atomics`.
  - Register `SpscAudioWorkletProcessor` in Web Audio context.
  - Seamlessly fall back to transferable buffers when `crossOriginIsolated === false`.

### Phase 4: Professional NLE Broadcast Editing Workflows
- **Files**:
  - `apps/studio/src/lib/timeline/commands/RippleDeleteCommand.ts` (New)
  - `apps/studio/src/lib/shuttle/useShuttleEngine.ts` (Update)
  - `apps/studio/src/components/Timeline.tsx` (Update)
- **Concrete Changes**:
  - Implement `RippleDeleteCommand` registered with `TimelineCommandDispatcher`.
  - Add J-K-L speed doubling ($1\times \to 2\times \to 4\times$) and K+L / K+J half-speed stepping.
  - Bind `C` (Blade cursor), `S` / `Cmd+K` (Playhead slice), and `Shift+Delete` (Ripple Delete).

---

## 7. Formal Verification Matrix

| Capability | Test Target | Verification Criteria & Invariants |
|---|---|---|
| **Virtual Waveform** | `autogenerated-tests/track_waveform_virtual_canvas.test.ts` | $< 50$ DOM nodes across 100 audio clips; viewport slice boundaries bit-identical to pyramid |
| **Decoder Quota Pool** | `autogenerated-tests/webcodecs_decoder_pool.test.ts` | Active hardware decoders strictly $\le 8$ under 30-clip stress; zero `QuotaExceededError` events |
| **SPSC Audio RingBuffer** | `autogenerated-tests/shared_array_ring_buffer.test.ts` | Zero sample loss across 1,000,000 samples; atomic pointer wrapping without memory leaks |
| **Ripple Delete** | `autogenerated-tests/timeline_ripple_delete.test.ts` | Precise gap closure across single and multi-track timelines; locked track immunity; undo/redo symmetry |

---

## 8. Rollback & Risk Mitigation Strategy

1. **SharedArrayBuffer Inavailability (COOP/COEP)**:
   - *Risk*: Environments lacking Cross-Origin Isolation headers block `SharedArrayBuffer`.
   - *Mitigation*: The `WebAudioEngine` detects `window.crossOriginIsolated` and automatically switches to transferable `Float32Array` buffers with the existing `UniversalAudioStreamWorklet`.
2. **Hardware Decoder Starvation on Multi-Cam Transitions**:
   - *Risk*: A rapid transition across 4 simultaneous 4K video tracks could exceed available GPU decoder throughput.
   - *Mitigation*: The `WebCodecsDecoderPool` automatically drops frame rate on background tracks ($15\text{ FPS}$ keyframe decodes) while keeping the foreground track at pristine $60\text{ FPS}$.
3. **Canvas HiDPI Blurring during Zoom**:
   - *Risk*: Scaling canvas styles without syncing physical backing store produces blurry waveform bars.
   - *Mitigation*: Backing store dimensions are multiplied by `devicePixelRatio`, while CSS size is pinned to CSS pixels.
