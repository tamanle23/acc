# Master Integration Plan - Iteration 32: Studio High-Performance Playback Pipeline, Decoder Gating & Background Audio DSP

## 1. Problem Statement & Root Cause Diagnosis

When clicking **Play** in `@acc/studio`, playback runs for ~2–5 seconds and then the entire application locks up, causing browser tab unresponsiveness and system commit memory exhaustion (`0x800705AF: The paging file is too small for this operation to complete`).

### Root Causes
1. **Unbounded WebCodecs Hardware Decoder Queue Flooding:**
   - On every high-frequency playhead tick (30–60 fps), if `PreviewFrameMemoryManager.get(assetId, frame)` has a cache miss, `preview.worker.ts` invokes `reader.requestFrame(frame)`.
   - In `MediabunnyWorkerReader.ts`, each `requestFrame` invoked `this.canvasSink.getCanvas(targetSec)` without in-flight deduplication or concurrency gating.
   - Because decoding is asynchronous (10–30ms per frame), 30–60 hardware decode requests were spawned per second. WebCodecs hardware decoders queued dozens of un-awaited `VideoFrame` instances simultaneously, consuming gigabytes of GPU/RAM and freezing the worker message loop.
2. **Main-Thread Audio DSP Freeze (UniversalAudioMixer):**
   - On playback start, `WebAudioEngine.startPlayback` invokes `this.mixer.mixStereo(startSec, renderDuration)` on the **main UI thread** to synthesize up to 30 seconds of 44.1kHz audio across all active audio tracks.
   - For complex timelines or procedural waveforms, synthesizing $1.32\times 10^6$ Float32 samples synchronously blocks the browser's JavaScript event loop for 100–300ms, stalling the main-thread clock and RAF handlers.
3. **Re-entrant Paint Storm on Async Frame Resolution:**
   - When a frame finished decoding asynchronously, `preview.worker.ts` invoked `renderCurrentFrame(...)` directly while new playhead ticks were already arriving, resulting in nested render calls.
4. **Linear Scan in Frame Eviction:**
   - In `PreviewFrameMemoryManager`, `pendingDisposal` was an array checked with `.includes()`. On high frame rates with frequent lookahead pruning, this added GC overhead (resolved via `Set<ImageBitmap>`).

---

## 2. Architecture & Design of the Permanent Solution

```
┌─────────────────────────────────────────────────────────────┐
│                       MAIN UI THREAD                        │
│                                                             │
│  [StudioPlayheadController] <──> [DeterministicTimelineClock]│
│         │                                                   │
│         ├─► High-Frequency Tick (60fps postMessage)         │
│         │                                                   │
│  [WebAudioEngine (Non-Blocking)]                            │
│         │                                                   │
│         └─► Dispatches audio chunk mixing to AudioWorklet   │
│             or small incremental 1.0s slices (Streaming)    │
└─────────┼───────────────────────────────────────────────────┘
          │ (postMessage: { type: 'renderFrame', frame, lod })
          ▼
┌─────────────────────────────────────────────────────────────┐
│                 PREVIEW WORKER THREAD                       │
│                                                             │
│  [preview.worker.ts (Single Master Loop)]                   │
│         │                                                   │
│         ├─► 1. Check PreviewFrameMemoryManager.get()        │
│         │       ├── HIT  ──► Render to OffscreenCanvas      │
│         │       └── MISS ──► Hold last rendered canvas      │
│         │                    frame (no blank flash/stutter) │
│         │                                                   │
│         ├─► 2. WorkerClipPrewarmer (4-Frame Lookahead)      │
│         │       └── Pre-warms [playhead+1 .. playhead+4]    │
│         │                                                   │
│         ├─► 3. MediabunnyWorkerReader Concurrency Gate      │
│         │       ├── inFlightRequests Map (Deduplication)   │
│         │       ├── activeDecodes <= 2 Concurrency Gate     │
│         │       └── Epoch/Window Relevance Filter (drops    │
│         │           stale frames outside current window)    │
│         │                                                   │
│         └─► 4. Post-Render Drain: O(1) Set<ImageBitmap>     │
│                synchronous cleanup sparing active textures   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. User-Approved Design Decisions

1. **Dual Decoupling Pipeline**: Both WebCodecs video frame queue flooding and main-thread synchronous audio DSP are decoupled simultaneously.
2. **Cache-Miss Behavior**: On a cache miss during playback, the canvas holds the last rendered frame (freeze canvas) until the exact frame arrives, preventing placeholder flashes or detached errors.
3. **Lookahead Window Size**: `WorkerClipPrewarmer` maintains a tight 4-frame forward lookahead window ($\approx 15$MB RAM footprint) for deterministic, low-latency 60fps playback.

---

## 4. Proposed Changes

### apps/studio/src/workers/MediabunnyWorkerReader.ts
- Add `private inFlightRequests = new Map<number, Promise<ImageBitmap | null>>()`.
- Add concurrency gate: `private activeDecodes = 0` with `private readonly MAX_CONCURRENT_DECODES = 2`.
- Deduplicate burst calls: return the existing Promise if `frame` is already in flight.
- Drop or discard completed frames if their target timestamp is no longer relevant to the current playhead window.

### apps/studio/src/workers/WorkerClipPrewarmer.ts
- Expand prewarmer beyond clip start boundaries: actively pre-decode sequential frames $[currentFrame + 1, currentFrame + 4]$ during playback so upcoming frames are already hot in `PreviewFrameMemoryManager`.

### apps/studio/src/workers/preview.worker.ts
- If `memoryManager.get()` misses, hold the last rendered frame on the canvas instead of clearing or flashing.
- Decoded frames populate `PreviewFrameMemoryManager` and `textureCache`. Only trigger immediate repaint if paused (`!isPlaying && frame === currentFrame`); during playback, allow the next RAF tick to draw naturally.

### apps/studio/src/lib/audio/WebAudioEngine.ts
- Refactor `startPlayback` to chunk synthesis incrementally into 1.0-second slices or stream into `UniversalAudioStreamWorklet`, eliminating the 30-second synchronous DSP spike on the main UI thread.

### autogenerated-tests/
- `autogenerated-tests/mediabunny_reader_concurrency_gate.test.ts`: Test burst deduplication, max 2 concurrent decodes, and memory cleanup.
- `autogenerated-tests/webaudio_engine_chunked_synthesis.test.ts`: Verify non-blocking incremental audio slice synthesis.

---

## 5. Verification Plan

### Automated Verification
```powershell
bun test autogenerated-tests/preview_frame_memory_manager_drain.test.ts
bun test autogenerated-tests/studio_offscreen_worker_parity.test.ts
bun test autogenerated-tests/mediabunny_reader_concurrency_gate.test.ts
bun test autogenerated-tests/webaudio_engine_chunked_synthesis.test.ts
pnpm --filter @acc/studio build
```

### Manual Verification
1. Open Studio in browser (`pnpm --filter @acc/studio dev`).
2. Add a video clip with audio to the timeline.
3. Press Play / Spacebar and run continuously for $\ge 60$ seconds.
4. Verify smooth playhead progression, zero UI lockup, and stable memory usage.
