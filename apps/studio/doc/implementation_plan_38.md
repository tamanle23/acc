# Implementation Plan - Iteration 38: Studio High-Performance NLE Engine Upgrade

Comprehensive architectural blueprint for Timeline Waveform Virtualization, Lock-Free AudioWorklet RingBuffer, WebCodecs Hardware Decoder Pooling, and Professional NLE Editing Workflows.

Companion to Consolidated Master Plan: [`docs/iterations/master_implementation_plan_iteration_43.md`](file:///mnt/c/Users/Admin/workspace/git/acc/docs/iterations/master_implementation_plan_iteration_43.md).

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

## 3. Four Strategic Pillars & Engineering Invariants

### Pillar 1: Timeline Waveform Virtualization (Unified 2D Canvas Lane)
- **Frustum Culling**: Render only clips intersecting $[F_{\text{start}}, F_{\text{end}}]$ where $F_{\text{start}} = \lfloor X_{\text{scroll}} / S_{px} \rfloor$ and $F_{\text{end}} = \lceil (X_{\text{scroll}} + W_{\text{viewport}}) / S_{px} \rceil$.
- **Source-Trimmed Peak Slicing**: Compute $\text{clipLocalTimeSec}(x) = T_{\text{in}} + \frac{x - C_k.\text{startX}}{S_{px} \times \text{FPS}}$ to accurately slice the multi-resolution pyramid.
- **Viewport-Anchored DOM**: Mount a single sticky `<canvas>` inside `DroppableTrackLane.tsx` (`position: sticky; left: 0; pointer-events: none`). Sized strictly to $W_{\text{viewport}} \times \text{DPR}$.

### Pillar 2: Lock-Free Audio RingBuffer via `SharedArrayBuffer` (`AudioWorklet`)
- **Memory Layout**: 64-byte Int32 control block (`READ_POINTER`, `WRITE_POINTER`, `CAPACITY_SAMPLES`, `STATE_FLAGS`) followed by planar stereo Float32 channels (1.68 MB for 5 seconds at 44.1 kHz).
- **Split Wraparound Handling**: When writing or reading across circular buffer capacity, split operations into two contiguous slices to prevent buffer overrun.
- **Memory Barrier Semantics**: Producer executes Release Store via `Atomics.store(control, WRITE_POINTER, nextWritePtr)` after writing Float32 data. Consumer executes Acquire Load via `Atomics.load(control, WRITE_POINTER)` before reading Float32 data.
- **Dual Transport Fallback**: If `crossOriginIsolated === false`, automatically fall back to `MessagePortTransferableTransport`.

### Pillar 3: WebCodecs Hardware Decoder Quota Pool
- **Hardware Quota Ceiling**: Cap concurrent hardware video decoders at $\le 8$ in `WebCodecsDecoderPool.ts`.
- **Priority Function**: $P(C_k) = 10,000 - (\text{trackIndex} \times 100)$ for active playhead clips; degrades for off-playhead clips.
- **Auto-Recovery Ladder**: If `VideoDecoder.configure()` throws `QuotaExceededError`, reduce limit, evict lowest-priority reader, and fall back to OPFS-cached poster frames.

### Pillar 4: Professional NLE Editing Shortcuts & Interaction Polish
- **Linked A/V Ripple Delete**: Delete target clip and companion linked audio/video simultaneously. Close timeline gap by shifting all subsequent clips by $-D$ frames. Immune locked tracks.
- **Blade / Razor (`C` & `S`)**: Click-to-slice and playhead frame slicing across unlocked tracks.
- **J-K-L Transport**: $1\times, 2\times$ pitch-preserved playback; muting with scrub clicks at $\ge 4\times$.

---

## 4. Phase-by-Phase Implementation Roadmap

### Phase 1: Timeline Waveform Virtualization
- [x] Create `apps/studio/src/components/timeline/TrackWaveformVirtualCanvas.tsx`.
- [x] Integrate with `DroppableTrackLane.tsx` with sticky viewport anchor.
- [x] Deprecate per-clip `WaveSurferWaveform` in `ClipItem.tsx` and refactor `WaveSurferWaveform.tsx` to pure 2D Canvas.
- [x] Formal unit test in `autogenerated-tests/track_waveform_virtual_canvas.test.ts`.

### Phase 2: WebCodecs Decoder Quota Pool
- [x] Create `apps/studio/src/renderer/workers/WebCodecsDecoderPool.ts`.
- [x] Add `evictHardwareDecoder()` and `reacquireHardwareDecoder()` in `MediabunnyWorkerReader.ts`.
- [x] Integrate priority leasing in `preview.worker.ts`.
- [x] Formal stress test in `autogenerated-tests/webcodecs_decoder_pool.test.ts`.

### Phase 3: Lock-Free AudioWorklet SPSC RingBuffer
- [x] Create `apps/studio/src/lib/audio/SharedArrayRingBuffer.ts` (SPSC implementation with `Atomics`).
- [x] Create `apps/studio/src/lib/audio/worklets/SpscAudioWorkletProcessor.ts`.
- [x] Update `WebAudioEngine.ts` to feed audio frames through shared ring buffer with fallback.
- [x] Formal test in `autogenerated-tests/shared_array_ring_buffer.test.ts`.

### Phase 4: Professional NLE Editing Workflows & Hotkeys
- [ ] Implement `RippleDeleteCommand` in `apps/studio/src/lib/timeline/commands/RippleDeleteCommand.ts`.
- [ ] Expand `apps/studio/src/lib/shuttle/useShuttleEngine.ts` with J-K-L speed doubling and pitch correction.
- [ ] Wire Blade cursor and shortcuts in `Timeline.tsx`.
- [ ] Formal test in `autogenerated-tests/timeline_ripple_delete.test.ts`.
