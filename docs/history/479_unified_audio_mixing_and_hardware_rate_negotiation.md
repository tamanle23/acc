# 479. Unified Decoupled Audio Mixing and Hardware Rate Negotiation

## Problem
In earlier iterations, audio mixing across preview and export suffered from two fundamental architectural gaps:
1. **Ducking Envelope Discontinuity Across Slice Boundaries**:
   `UniversalAudioMixer.mixStereo(timeOffsetSec, durationSec)` originally computed dynamic sidechain ducking in isolation for each slice buffer. When previewing or streaming audio in consecutive chunks (e.g., 5-second or 1-second chunks), each slice evaluated voice presence from scratch with initial gain = 1.0. If a voice sequence was active across a slice boundary (e.g., spanning 4.0s to 7.0s with a boundary at 5.0s), the second slice started with zero ducking attenuation and abruptly attacked downward, introducing audible ducking flutter, volume pump, and sample discontinuity.
2. **Fixed 44.1 kHz Sample Rate & Hardware Clock Drift**:
   `WebAudioEngine` hardcoded `new AudioCtx({ sampleRate: 44100 })` while the browser's hardware output (DAC/speakers) often defaulted to 48,000 Hz or 96,000 Hz. If the browser forced or defaulted to 48,000 Hz, `UniversalAudioMixer` generated PCM samples assuming 44,100 Hz. When played into a 48,000 Hz `AudioBufferSourceNode`, this resulted in an 8.8% pitch shift down and approximately ~5.3 seconds of playback clock desynchronization per minute.
3. **Monolithic Buffer Allocations in Master Export**:
   `UniversalAudioMixer.mixTimeline` rendered the entire timeline audio into a single monolithic `Float32Array` (over 100 MB for typical multi-minute compositions), causing memory pressure and preventing pipelined streaming to storage sinks or WHATWG streams.
4. **Latent Clip Sampling Alignment Bug**:
   When `sliceStart < clipStart` (e.g. continuous slice starting at 0.0s for a clip starting at 4.0s), `UniversalAudioMixer` incorrectly computed the intra-slice sample offset relative to `sliceStart` rather than the clip start, causing clips starting after the slice beginning to sample from incorrect time offsets. Furthermore, `ProceduralAudioSynthesizer` used non-deterministic `Math.random()` and floating-point `timeOffsetSec + i / sampleRate`, leading to phase jumps across consecutive chunks.

## Plan
1. **Continuous Timeline Sidechain Ducking Envelope**:
   - Introduce `rebuildDuckingProfile(timeline: ResolvedTimeline)` in `UniversalAudioMixer` to calculate a continuous 1000 Hz (1 ms resolution) voice sidechain ducking envelope across the entire timeline duration using `DynamicAudioDuckingEngine`.
   - Implement `getDuckingFactorAtTime(timeSec: number)` with linear interpolation.
   - Update `mixStereo` to query the global timeline envelope when present, falling back to local slice envelope calculation only for ad-hoc un-synced mixes.
2. **Dynamic Hardware Sample Rate Auto-Negotiation**:
   - Add `sampleRate` mutator `setSampleRate(sampleRate: number)` to `UniversalAudioMixer` that dynamically updates `this.sampleRate` and regenerates the ducking profile if a timeline is active.
   - Expose `setAudioSampleRate(sampleRate: number)` on `IRPreviewEngine`.
   - Update `WebAudioEngine.initContext()` to instantiate `new AudioCtx()` without hardcoding 44,100 Hz, querying `this.ctx.sampleRate` and calling `mixer.setSampleRate(this.ctx.sampleRate)` and `previewEngine.setAudioSampleRate(this.ctx.sampleRate)`.
   - Re-synchronize sample rates on `attachPreviewEngine` and `startPlayback`.
3. **Unified Pull-Based Streaming & WHATWG Stream Support**:
   - Implement `mixTimelineStream(timeline, chunkSizeSec, options)` yielding `AsyncIterable<DecoupledAudioMixResult>` for memory-bounded pipelined processing.
   - Implement `toReadableWavStream(timeline, chunkSizeSec, options)` yielding standard WinterTC WHATWG `ReadableStream<Uint8Array>` with RIFF/WAVE header and 16-bit PCM chunks.
   - Extract static helpers `createWavHeader` and `encodePcmTo16Bit` for zero-redundancy isomorphic WAV encoding.
   - Refactor `preloadTimelineAudio(timeline, options)` to pre-decode audio assets into `DecodedPcmSource`, consolidating mixing logic between `mixTimeline` and `mixTimelineStream`.
4. **Sub-Sample Alignment & Pure Deterministic Synthesizer**:
   - Fix clip overlap calculation in `UniversalAudioMixer.mixStereo` to determine exact intersection `[overlapStart, overlapEnd)` and sample clip audio at `offsetFromClipStart` for `overlapDuration`.
   - Update `ProceduralAudioSynthesizer` methods (`synthBGM`, `synthLaserSFX`, `synthPilotVoice`, `synthEngineHum`) to derive integer sample indices: `startSample = Math.round(timeOffsetSec * sampleRate); sIdx = startSample + i; t = sIdx / sampleRate;`.
   - Replace non-deterministic `Math.random()` in `synthPilotVoice` and `synthLaserSFX` with deterministic seeded PRNG keyed to absolute sample index `sIdx`.

## Changes
- `packages/ir/src/renderer/audio/UniversalAudioMixer.ts`:
  - Added `timelineDuckingEnvelope`, `timelineDuckingRate = 1000`, `lastTimeline`, and `lastResolver`.
  - Added `setSampleRate(sampleRate: number)`: Updates sample rate and calls `rebuildDuckingProfile`.
  - Added `rebuildDuckingProfile(timeline: ResolvedTimeline)`: Pre-calculates 1000 Hz timeline voice envelope via `DynamicAudioDuckingEngine.generateEnvelope`.
  - Added `getDuckingFactorAtTime(timeSec: number)`: Interpolates ducking factor from pre-calculated timeline envelope.
  - Refactored `mixStereo`:
    - Cleaned clip-slice overlap calculation (`overlapStart`, `overlapEnd`, `offsetFromClipStart`, `overlapDuration`).
    - Fixed sample routing to write directly to `outStartIdx + j` in track sub-mix buses.
    - Used `getDuckingFactorAtTime(t)` when `useGlobalDucking` is active.
  - Added `mixSlice(timeOffsetSec, durationSec)`: Alias for DSP kernel mixing.
  - Added `preloadTimelineAudio(timeline, options)`: Pre-resolves audio assets into `DecodedPcmSource` on clips.
  - Added `mixTimelineStream(timeline, chunkSizeSec, options)`: Generator yielding `DecoupledAudioMixResult` chunks.
  - Extracted static `createWavHeader` and `encodePcmTo16Bit`.
  - Refactored `encodeToWav` and `exportToWav` to reuse static WAV generation methods.
  - Added `toReadableWavStream(timeline, chunkSizeSec, options)`: Returns WHATWG `ReadableStream<Uint8Array>`.
  - Updated `syncFromTimeline`: Defaults `clipVolume = typeof (seq as any).volume === 'number' ? (seq as any).volume : 1.0`.
- `packages/ir/src/renderer/audio/ProceduralAudioSynthesizer.ts`:
  - In `synthBGM`, `synthLaserSFX`, `synthPilotVoice`, `synthEngineHum`: Replaced floating-point time addition with exact integer sample index arithmetic: `startSample = Math.round(timeOffsetSec * sampleRate); sIdx = startSample + i; t = sIdx / sampleRate;`.
  - In `synthPilotVoice` and `synthLaserSFX`: Replaced `Math.random()` with deterministic seeded PRNG: `const prng = Math.sin(sIdx * 12.9898 + 78.233) * 43758.5453;`.
- `apps/studio/src/renderer/IRPreviewEngine.ts`:
  - Added `setAudioSampleRate(sampleRate: number)` to synchronize preview engine mixer rate.
- `apps/studio/src/lib/audio/WebAudioEngine.ts`:
  - In `initContext`: Auto-negotiates hardware sample rate (`new AudioCtx()`) and configures `this.mixer.setSampleRate(this.ctx.sampleRate)`.
  - In `attachPreviewEngine`: Propagates hardware rate to preview engine and mixer.
  - In `startPlayback`: Verifies mixer sample rate matches hardware context rate before starting playback.
- `autogenerated-tests/webaudio_engine_chunked_synthesis.test.ts`:
  - Fixed pre-existing typo: `ringBuffer.getAvailable()` -> `ringBuffer.getAvailableRead()`.
- `autogenerated-tests/unified_audio_muxing_option2.test.ts`:
  - Added 5 exhaustive unit tests verifying ducking continuity across slice boundaries, hardware sample rate negotiation, bit-identical stream mixing, WinterTC WHATWG `ReadableStream` output, and equal-power panning laws.

## Verification
1. **Unit & Parity Tests**:
   - `bun test autogenerated-tests/unified_audio_muxing_option2.test.ts`: 5/5 pass (7,749 assertions).
   - `bun test autogenerated-tests/audio_pipeline_export_parity.test.ts autogenerated-tests/equal_audio_track_modifier_pipeline.test.ts autogenerated-tests/ir_preview_master_renderer_audio_parity.test.ts autogenerated-tests/webaudio_engine_chunked_synthesis.test.ts`: 10/10 pass.
   - `bun test autogenerated-tests/effect_engines_pure_isomorphic.test.ts autogenerated-tests/effect_engines_isomorphic.test.ts autogenerated-tests/particle_simd_vfx.test.ts`: 16/16 pass.
2. **Production Client Build**:
   - `pnpm --filter @acc/studio build`: Succeeded in 14.31s with zero bundle or compilation errors.

## Walkthrough
1. **Sidechain Ducking Continuity**:
   When `UniversalAudioMixer.syncFromTimeline(timeline)` is invoked, it runs `rebuildDuckingProfile(timeline)`. This pre-analyzes voice sequences across the timeline at 1 ms resolution. When `mixStereo` is called for any slice `[t, t + dt]`, BGM attenuation is queried via `getDuckingFactorAtTime(t)`. Slices evaluated consecutively (e.g. `[0, 5s]` and `[5s, 10s]`) match the output of a single continuous slice `[0, 10s]` with zero boundary fluttering ($< 10^{-5}$ sample difference).
2. **Hardware Rate Auto-Negotiation**:
   When `WebAudioEngine.initContext()` starts, `new AudioCtx()` detects the native output rate (e.g., 48,000 Hz). Calling `this.mixer.setSampleRate(hardwareRate)` immediately updates the sample rate and rebuilds the timeline ducking profile at the new rate, preventing pitch warping or clock desynchronization.
3. **Bounded Chunked Audio Streaming**:
   Callers can stream audio chunks using `mixer.mixTimelineStream(timeline, 5.0)` or consume a WHATWG stream via `mixer.toReadableWavStream(timeline, 5.0)`. Chunks are written or enqueued incrementally without holding multi-minute PCM buffers in memory.

## Tasks
- [x] Analyze audio muxing architecture in `IRPreviewEngine` and `IRMasterRenderer`.
- [x] Compile master iteration plan `docs/iterations/master_implementation_plan_iteration_86.md` and app companion `apps/studio/doc/implementation_plan_71.md`.
- [x] Implement continuous sidechain ducking envelope in `UniversalAudioMixer`.
- [x] Implement dynamic hardware sample rate negotiation in `WebAudioEngine` and `IRPreviewEngine`.
- [x] Implement chunked audio streaming (`mixTimelineStream`) and WHATWG `ReadableStream` (`toReadableWavStream`).
- [x] Resolve clip sampling offset bug and enforce deterministic integer sample indexing in `ProceduralAudioSynthesizer`.
- [x] Verify all test suites and production build.
- [x] Document in history archive and register in `docs/history/README.md`.

## Enhancement
Future enhancements can explore integrating WebCodecs `AudioEncoder` (Opus/AAC) directly with `mixTimelineStream` to support streaming compressed audio tracks into MP4/WebM containers without intermediate WAV conversion.
