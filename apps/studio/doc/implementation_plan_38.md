# Implementation Plan - Iteration 38: Studio High-Performance NLE Engine Upgrade

Comprehensive architectural blueprint for Timeline Waveform Virtualization, Lock-Free AudioWorklet RingBuffer, WebCodecs Hardware Decoder Pooling, and Professional NLE Editing Workflows.

---

## 1. Executive Summary & Objective

Apps/Studio is transitioning from a feature-complete web NLE prototype to an enterprise-grade, low-latency editing suite capable of smoothly handling 50+ tracks, hundreds of media assets, and 4K multi-cam timelines.

This plan addresses the 4 primary scalability bottlenecks identified during the system-wide memory and lifecycle audit:
1. **DOM & Canvas Thrashing in Timeline**: Replace per-clip `WaveSurfer` DOM instances with a single virtualized 2D Canvas lane powered by `WaveformLODPyramid`.
2. **Audio Scrubbing Latency & GC Pauses**: Implement a lock-free Single-Producer Single-Consumer (SPSC) circular RingBuffer using `SharedArrayBuffer` and `Atomics` with an `AudioWorkletProcessor`.
3. **WebCodecs Hardware Quota Exhaustion**: Build a centralized `WebCodecsDecoderPool` with priority-based hardware session leasing and OPFS poster-frame graceful degradation.
4. **Professional NLE Keyboard Velocity**: Implement full J-K-L pitch-corrected transport, Blade/Razor split commands, Ripple Delete with timeline gap closure, and slip/slide editing.

---

## 2. Architectural Blueprint

```mermaid
graph TD
    subgraph UI_Timeline["Timeline & Viewport (apps/studio)"]
        VirtualCanvas["TrackWaveformVirtualCanvas (Single 2D Canvas per Track)"]
        LODPyramid["WaveformLODPyramid (Multi-Resolution Peak Slices)"]
        ShortcutEngine["TimelineHotkeys & TransportController (J-K-L, Razor, Ripple)"]
    end

    subgraph Audio_Pipeline["Audio DSP Pipeline"]
        WorkletNode["AudioWorkletNode (Dedicated Audio Thread)"]
        SPSC["SPSC RingBuffer (SharedArrayBuffer + Atomics)"]
        MixerStream["UniversalAudioMixer (Main / Worker Thread)"]
    end

    subgraph Video_Pipeline["Video Decoding & Preview Worker (preview.worker.ts)"]
        DecoderPool["WebCodecsDecoderPool (Max 8 Hardware Leases)"]
        PriorityQueue["Playhead Proximity Priority Scorer"]
        WorkerReader["MediabunnyWorkerReader (Hardware / Keyframe Leased)"]
        PosterFallback["OPFS Poster Frame Cache (Graceful Degradation)"]
    end

    UI_Timeline -->|Frame & Pan Query| VirtualCanvas
    VirtualCanvas -->|Decimated Peaks| LODPyramid
    MixerStream -->|Write Samples| SPSC
    SPSC -->|Read 128 Blocks (Lock-Free)| WorkletNode
    WorkerReader -->|Acquire / Evict| DecoderPool
    DecoderPool -->|Exceeds Quota| PosterFallback
    DecoderPool -->|Prioritize| PriorityQueue
```

---

## 3. Four Strategic Pillars

### Pillar 1: Timeline Waveform Virtualization (Unified 2D Canvas Lane)

#### Problem
In `WaveSurferWaveform.tsx`, each audio clip mounts a full `WaveSurfer.js` instance with its own `<div />`, `<canvas />`, resize observers, and event hooks. When a project contains 40+ audio clips across multiple tracks, zooming and scrolling causes massive layout thrashing, DOM node bloat, and excess GPU memory consumption.

#### Solution: `TrackWaveformVirtualCanvas`
1. **Single Canvas per Audio Track**:
   - Instead of 50 individual clip canvases, each audio track renders a single HTML5 `<canvas>` sized to the visible viewport width ($W_{\text{visible}}$).
   - High DPI support: `canvas.width = W_visible * window.devicePixelRatio`.
2. **Frustum Culling**:
   - Calculate viewport frame range:
     $$F_{\text{start}} = \lfloor \text{scrollLeft} / \text{pxPerFrame} \rfloor, \quad F_{\text{end}} = \lceil (\text{scrollLeft} + W_{\text{visible}}) / \text{pxPerFrame} \rceil$$
   - Query timeline state for clips on this track intersecting $[F_{\text{start}}, F_{\text{end}}]$.
3. **Decimated LOD Peak Rendering**:
   - Query `WaveformLODPyramid.selectLOD(pxPerFrame)`.
   - Batch draw all visible waveform bars using a single path:
     ```typescript
     ctx.beginPath();
     for (let x = drawStart; x < drawEnd; x += barSpacing) {
       const peak = getPeakAt(x);
       ctx.moveTo(x, centerY - peak * halfHeight);
       ctx.lineTo(x, centerY + peak * halfHeight);
     }
     ctx.stroke();
     ```
4. **Memory Footprint**:
   - Fixed memory cost: $O(\text{visible tracks})$ canvases, zero per-clip DOM overhead.

---

### Pillar 2: Lock-Free Audio RingBuffer via `SharedArrayBuffer` (`AudioWorklet`)

#### Problem
`WebAudioEngine` currently schedules audio chunks via `AudioBufferSourceNode.start(scheduledTime)` or transfers audio via `postMessage`. This introduces micro-task queue jitter (5-30ms) and garbage collection pauses during rapid scrubbing or reverse shuttle playback.

#### Solution: `SharedArrayBufferAudioWorklet`
1. **Lock-Free SPSC Circular Buffer**:
   - Interleaved or 2-channel planar shared memory buffer.
   - Header (64 bytes):
     - `STATE_READ_PTR` (Int32, byte offset 0)
     - `STATE_WRITE_PTR` (Int32, byte offset 4)
     - `STATE_CAPACITY` (Int32, byte offset 8)
     - `STATE_FLAGS` (Int32, byte offset 12)
   - Payload: Stereo Float32Array arrays (e.g. 44,100 samples $\times$ 2 channels $\times$ 4 bytes $\approx 352\text{ KB}$).
2. **Atomic Synchronization**:
   - **Producer (Engine / Mixer)**:
     ```typescript
     const readPtr = Atomics.load(control, STATE_READ_PTR);
     const writePtr = Atomics.load(control, STATE_WRITE_PTR);
     // Calculate available capacity and write samples
     Atomics.store(control, STATE_WRITE_PTR, nextWritePtr);
     ```
   - **Consumer (`AudioWorkletProcessor.process`)**:
     Runs on the real-time audio thread every 128 samples ($\approx 2.9\text{ ms}$). Reads directly from `SharedArrayBuffer` without memory allocation or blocking.
3. **Graceful Fallback**:
   - If `typeof SharedArrayBuffer === 'undefined'` (missing COOP/COEP headers), seamlessly fall back to existing `UniversalAudioStreamWorklet` with transferable Float32 buffers.

---

### Pillar 3: WebCodecs Hardware Decoder Quota & Multi-Stream Graceful Degradation

#### Problem
Chromium and WebKit enforce a strict limit of $\sim 16$ active hardware video decoders per renderer process. In complex timelines with multi-cam clips, overlays, and transitions, instantiating an `Input` for every clip causes `QuotaExceededError` or black frames.

#### Solution: `WebCodecsDecoderPool`
1. **Centralized Quota Controller**:
   - Singleton in `preview.worker.ts` with `MAX_HARDWARE_DECODERS = 8`.
   - Tracks active leases: `activeLeases: Map<string, MediabunnyWorkerReader>`.
2. **Playhead Proximity Priority Scorer**:
   - Every playhead scrub calculates priority score $P(clip)$:
     $$P(clip) = \begin{cases}
       1000 - \text{trackIndex} & \text{if } F_{\text{playhead}} \in [clip.start, clip.end] \text{ and track is visible} \\
       100 - |F_{\text{playhead}} - clip.start| / fps & \text{if within } \pm 3 \text{ seconds} \\
       0 & \text{otherwise}
     \end{cases}$$
3. **Eviction & Restoration**:
   - If a new clip requests decoding and 8 decoders are active, the lowest-priority reader is gracefully evicted (`reader.evictHardwareDecoder()`, calling `input.dispose()`).
   - If that evicted clip is revisited later, it is lazily re-initialized on demand.
4. **OPFS Poster Frame Fallback**:
   - When a clip has no hardware decoder lease, the UI requests poster frames generated during asset ingestion and stored in OPFS (`ContentCacheRegistry.get('opfs')`).

---

### Pillar 4: NLE Professional Editing Shortcuts & Interaction Polish

#### Features & User Experience
1. **J-K-L Transport Control**:
   - **L**: Play forward ($1\times \to 2\times \to 4\times \to 8\times$).
   - **K**: Pause / Stop ($0\times$).
   - **J**: Play reverse ($-1\times \to -2\times \to -4\times \to -8\times$).
   - **K + L**: 0.5x Slow-forward scrub; **K + J**: 0.5x Slow-reverse scrub.
   - Smooth pitch-corrected audio rendering using Web Audio `playbackRate` with automatic muting above $2\times$ shuttle speed.
2. **Blade / Razor Tool (Keystroke `C` & `S`)**:
   - Keystroke `C`: Toggles Razor cursor mode. Clicking any clip splits it cleanly at that exact frame.
   - Keystroke `S` (or `Cmd+K`): Slices all unlocked clips intersecting the current playhead frame.
   - Fully integrated with `TimelineCommandDispatcher` with undo (`Cmd+Z`) and redo (`Cmd+Shift+Z`).
3. **Ripple Delete (Keystroke `Shift + Backspace` / `Shift + Delete`)**:
   - Deletes selected clip and immediately ripples following clips to the left by `clip.durationFrames`.
   - Preserves downstream clip synchronization across locked/unlocked tracks.
4. **Slip & Slide Tooling (Keystroke `Y` / `U`)**:
   - **Slip (`Y`)**: Adjusts `sourceStartTime` without moving clip timeline start or end.
   - **Slide (`U`)**: Moves clip position while trimming adjacent in/out points.

---

## 4. Phase-by-Phase Implementation Roadmap

### Phase 1: Timeline Waveform Virtualization
- [ ] Create `apps/studio/src/components/timeline/TrackWaveformCanvas.tsx`.
- [ ] Connect to `WaveformLODPyramid` for visible slice peak sampling.
- [ ] Replace per-clip `WaveSurferWaveform` in `ClipItem.tsx` with lane-level canvas rendering.
- [ ] Formal unit test in `autogenerated-tests/track_waveform_virtual_canvas.test.ts`.

### Phase 2: WebCodecs Decoder Quota Pool
- [ ] Create `apps/studio/src/renderer/workers/WebCodecsDecoderPool.ts`.
- [ ] Add `evictHardwareDecoder()` and `reacquireHardwareDecoder()` to `MediabunnyWorkerReader.ts`.
- [ ] Integrate priority leasing in `preview.worker.ts` based on playhead position and active tracks.
- [ ] Formal stress test in `autogenerated-tests/webcodecs_decoder_pool.test.ts`.

### Phase 3: Lock-Free AudioWorklet SPSC RingBuffer
- [ ] Create `apps/studio/src/lib/audio/SharedArrayRingBuffer.ts` (SPSC implementation with `Atomics`).
- [ ] Create `apps/studio/src/lib/audio/worklets/SpscAudioWorkletProcessor.ts`.
- [ ] Update `WebAudioEngine.ts` to feed audio frames through the shared ring buffer.
- [ ] Verify zero audio underruns and zero GC pauses during 100-seek scrub test.

### Phase 4: Professional NLE Editing Workflows & Hotkeys
- [ ] Expand `apps/studio/src/lib/shuttle/useShuttleEngine.ts` with K+L, K+J, and pitch-preserving audio.
- [ ] Implement `RippleDeleteCommand` in `apps/studio/src/lib/timeline/commands/RippleDeleteCommand.ts`.
- [ ] Add Blade click-to-slice handler in `TimelineDom.tsx` and `ClipItem.tsx`.
- [ ] Wire keyboard shortcuts in `Timeline.tsx` with full ARIA tooltip hints.

---

## 5. Verification & Testing Strategy

1. **Waveform Virtualization**:
   - Render timeline with 100 audio clips: assert DOM node count remains constant $< 50$ total nodes.
   - Verify 60 FPS panning/zooming via Chrome DevTools Performance Profiler.
2. **Decoder Pool**:
   - Load 30 4K video clips into project: verify active hardware `VideoDecoder` count never exceeds 8.
   - Assert zero `QuotaExceededError` events thrown.
3. **Audio SPSC RingBuffer**:
   - Execute 1,000 rapid seek operations: verify audio thread never starves (zero NaN samples, zero underrun pops).
4. **NLE Editing Hotkeys**:
   - Unit test `RippleDeleteCommand`: assert correct frame offset shifts and undo/redo bit-identical state recovery.
