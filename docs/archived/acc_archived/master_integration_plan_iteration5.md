# Master Integration Plan (Iteration 5): Advanced Visual & Core Rendering Engine
## Universal Cross-Platform Parity: Web Studio & Headless Server Consistency for SFX, VFX & 3D In-Depth
### Strict Media Engine Strategy Adherence: Zero Direct Imports of `bun:ffi`, `fluent-ffmpeg`, or `mediabunny`

## 1. Executive Summary & Strategic Objectives

Following the successful execution of **Iteration 4 (Media Backend Strategy Pattern)**, **Iteration 5** elevates the core rendering and visual synthesis capabilities of the Visual Storytelling Generator (`@acc/effect-engines`, `@acc/ir`, `@acc/core`, `apps/studio`).

### Inviolable Media Engine Architecture Rule
In strict adherence to Iteration 4's Strategy Pattern and project architectural boundaries:
> [!IMPORTANT]
> **ZERO DIRECT MEDIA DRIVER CALLS**: No component in Iteration 5 (renderers, modifier plugins, video decoders, audio mixers, effect engines, or studio endpoints) is permitted to directly call or import `bun:ffi`, `fluent-ffmpeg`, `@mediabunny/server`, or `mediabunny`. All media operations (video encoding/sinks, video frame decoding, audio decoding, audio muxing, probing, and concatenation) MUST be routed strictly through `MediaEngineRegistry.get()` or `MediaSinkFactory`.

```text
                                 ┌────────────────────────────────────────────────────────┐
                                 │                 Universal Video IR AST                 │
                                 │       Camera Splines, Normal Relighting, Shader VFX    │
                                 └───────────┬───────────────────┬────────────────────┬───┘
                                             │                   │                    │
                    ┌────────────────────────┴────────┐          │                    │
                    ▼                                 ▼          ▼                    ▼
         ┌──────────────────────┐         ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
         │       Phase 1        │         │       Phase 2        │  │       Phase 3        │  │       Phase 4        │
         │ Depth Normal Map &   │         │ 3D Spline Camera &   │  │ Hardware-Accelerated │  │ Video-IR Schema Sync │
         │ Dynamic Relighting   │         │ Rack Focus Engine    │  │ Shader VFX Pipeline  │  │ & E2E Verification   │
         │ Surface Normal Gen   │         │ Bezier 3D Paths      │  │ Typed SIMD Particles │  │ 8-Point Sync Rule    │
         │ Specular & Occlusion │         │ Depth-of-Field CoC   │  │ Bloom & Anamorphic   │  │ Multi-Engine Parity  │
         └──────────┬───────────┘         └──────────┬───────────┘  └──────────┬───────────┘  └──────────┬───────────┘
                    │                                │                         │                         │
                    └────────────────────────────────┴─────────────────────────┴─────────────────────────┘
                                                     │
                                                     ▼
                               ┌───────────────────────────────────────────┐
                               │           MediaEngineRegistry             │
                               │  (createVideoSink, createVideoDecoder,    │
                               │   getAudioDecoder, getProbe, getConcat)   │
                               └─────┬──────────────┬──────────────┬───────┘
                                     │              │              │
                   ┌─────────────────┴────┐   ┌─────┴──────┐   ┌───┴────────────────┐
                   ▼                      ▼   ▼            ▼   ▼                    ▼
             [bun-ffi Engine]    [fluent-ffmpeg]   [mediabunny-server]    [mediabunny-client]
```

---

## 2. Universal Web & Server Consistency Architecture (SFX, VFX, 3D In-Depth)

### 2.1. VFX & 3D Visual Consistency: Shared Isomorphic Rendering Core
- **Stateless Canvas Parameterization**: Rendering functions operate strictly against the universal `CanvasRenderingContext2D` interface (supported identically by `@napi-rs/canvas` on the server and native HTML5 `<canvas>` in the browser).
- **Normalized Geometry Coordinates**: All spatial positions, bounds, particle sizes, and camera offsets are computed in normalized $[-1, 1]$ coordinate space and projected to pixel dimensions $(w, h)$ only at draw-time, ensuring identical scaling across 1080p, 4K, and 9:16 mobile canvas previews.
- **Deterministic Pure Frame Math**: Frame progression uses exact timeline calculations `timeSec = frameIndex / fps`. Randomness is governed by a seeded `DeterministicNoiseGenerator` (zero `Math.random()` or system clock calls).

### 2.2. Media Engine Strategy Integration for Video & Audio Decoding
- **Abstract Video Decoder (`IMediaVideoDecoder`)**:
  - `IMediaEngineStrategy` extends with `createVideoDecoder(filePath: string, targetWidth: number, targetHeight: number): IMediaVideoDecoder`.
  - `IRMasterRenderer` no longer imports `FFIVideoDecoder` directly; it calls `MediaEngineRegistry.get().createVideoDecoder(filePath, w, h)`.
  - Concrete decoders:
    - `bun-ffi`: `FFIVideoDecoder` (libavcodec / libswscale).
    - `fluent-ffmpeg`: CLI pipe extractor or frame cache.
    - `mediabunny-server` / `mediabunny-client`: Mediabunny `Input` frame extraction to Canvas.
- **Abstract Audio Decoder (`IMediaAudioDecoder`)**:
  - `IMediaEngineStrategy` extends with `getAudioDecoder(): IMediaAudioDecoder`.
  - `DecoupledAudioMixer` no longer imports `FFIAudioDecoder` directly; it accesses decoding through `MediaEngineRegistry.get().getAudioDecoder().decodeToPCM(filePath, sampleRate, channels)`.
  - Audio generation remains pure `Float32Array` PCM in memory.

### 2.3. SFX Consistency: Dual-Engine Audio Matrix & Procedural Synthesizers
- **Universal PCM Sample Synthesis**: Procedural audio generators (UI pops, swooshes, ambient drones, impact risers) compute samples into pure `Float32Array` buffers. In the browser, this feeds directly into Web Audio `AudioBufferSourceNode`; on the server, it writes IEEE Float WAV for engine-agnostic multiplexing via `MediaEngineRegistry.get().getAudioMuxerStrategy()`.
- **Master Audio DSP Preview Endpoint**: For complex multi-track audio ducking (`-14dB` sidechain compressor) or filtergraph composites, `StudioServer` serves `/api/audio/preview` HTTP range streams. The browser client supports a seamless A/B toggle between instant local synth and the server DSP master mix.

### 2.4. 3D In-Depth Consistency: Pluggable AI Vision Provider Architecture
To guarantee identical 3D cutouts, normal maps, and displacement geometry between Web and Server, the system supports a **Pluggable AI Vision Provider Matrix**:
1. **Explicit Vision Configuration (`~/.acc/control-plane.json`)**: Configured explicitly via `visionProvider: 'ai-supervisor' | 'cloud' | 'browser'`.
   - `'ai-supervisor'`: Connects to local AI Supervisor daemon via local gRPC/REST (`127.0.0.1:50051`) for local PyTorch / ONNX execution (Depth Anything v2, SAM 2, BiRefNet) with zero cloud cost.
   - `'cloud'`: Connects to hosted public AI inference provider endpoints (Hugging Face Inference API, Replicate, RunPod).
   - `'browser'`: In-browser Transformers.js (Edge WebGPU / WASM) running lightweight ONNX depth estimation directly inside modern browsers with zero server round-trips.
2. **Normalized Depth Asset Caching**: Both Web and Server persist depth maps as standardized 16-bit PNG grayscale textures and binary alpha masks (`/api/assets/<id>/depth.png`), guaranteeing that both the server export and web preview render from the exact same mathematical geometry.

---

## 3. Phasing & Technical Architecture

### Phase 1: Depth-Aware Dynamic Relighting & Normal Map Shading (`@acc/effect-engines` & `@acc/ir`)
- **Surface Normal Map Derivation**:
  - Implement `SurfaceNormalGenerator`: Computes normalized 3D surface vectors $\mathbf{N}(x, y) = [N_x, N_y, N_z]^T$ via 3x3 Sobel convolution operators on monocular depth buffers (Depth Anything v2 / Heuristic).
  - Uses normalized Float32 gradient convolution: converts depth values to $[0.0, 1.0]$, computes $\mathbf{N} = \text{normalize}([-G_x, -G_y, 1.0 / \text{strength}])$, with boundary clamping.
  - Pre-renders normal map textures to pre-allocated typed arrays (`Float32Array` / RGBA canvas) during sequence preflight to satisfy the **ZERO-ALLOC-FRAME-LOOP** mandate.
- **Blinn-Phong Dynamic Relighting & Edge Gating**:
  - Virtual light models supporting moving 3D coordinates $\mathbf{L}(t) = [L_x(t), L_y(t), L_z(t)]$, ambient intensity $k_a$, diffuse intensity $k_d$, specular glossiness $\alpha$, and light color $[R, G, B]$.
  - **Foreground Mask Gating & Soft Rim Feather**: Multiplies lighting by subject cutout alpha ($A / 255$) with soft rim boost at transition boundaries ($0.2 < A < 0.9$), ensuring specular highlights wrap naturally around character silhouettes without bleeding onto background transparency.
  - Additive luminance compositing pass via `globalCompositeOperation = 'screen'` or `'lighter'`, preserving base textures and colors with zero degradation.
- **IR VFX Plugin Extension**:
  - Extend `Depth3DPlugin` (`vfx/depth3d`) with parameter `relighting: { enabled: boolean, lightPosition: [x,y,z], diffuse: number, specular: number, rimIntensity: number, lightColor: string }`.

### Phase 2: Cinematic 3D Camera Path Sequencer & Dynamic Rack Focus (`@acc/ir`)
- **IR Modeling & Architecture**:
  - Encapsulated as non-breaking modifier plugin `vfx/camera_3d` in sequence/track modifier chains.
  - Implements cubic Bezier & Hermite spline interpolators for 3D camera translation $\mathbf{P}(t)$, target focal point $\mathbf{T}(t)$, roll angle $\theta(t)$, and field of view $\text{FOV}(t)$.
  - Pre-interpolates camera matrices during sequence preflight, maintaining zero heap allocation per frame.
- **Dynamic Rack Focus & Circle of Confusion (CoC)**:
  - Partitions depth map into discrete focal zones (foreground, focal plane, background) during preflight.
  - Generates pre-blurred layer canvases with variable blur radii.
  - Frame-loop applies dynamic alpha crossfades between layers according to distance from focal plane $|Z(x, y) - Z_{\text{focal}}(t)|$, providing smooth, cinematic bokeh rack focus with zero CPU convolution during playback.

### Phase 3: Hardware-Accelerated Shader & Particle VFX Pipeline (`@acc/effect-engines`)
- **Typed SIMD / Float32Array Particle Compute Engine**:
  - Implement zero-allocation particle state arrays (`Float32Array` buffers storing $[x, y, z, v_x, v_y, \text{life}, \text{opacity}, \text{size}]$ contiguously in memory).
  - High-throughput vectorized step simulation yielding $>5\times$ particle counts (up to 20,000 active particles at 60fps) without heap allocation overhead.
- **CanvasAdapter Hardware Abstraction (`CanvasAdapterFactory`)**:
  - Introduce dynamic adapter resolution: `CanvasAdapterFactory.getAdapter('gpu' | 'napi-rs')`.
  - Employs headless-safe fallback: automatically utilizes high-performance CPU/SIMD canvas buffer rendering in headless server environments (Docker, Linux CI/CD) and leverages GPU-accelerated offscreen contexts when native display drivers are detected.
- **Post-Processing Shader Presets**:
  - Fast single-pass chromatic aberration, bloom/glow thresholding, and anamorphic lens flare blurs utilizing pre-allocated convolution kernels.

### Phase 4: VideoIR Schema 8-Point Sync & Multi-Engine Parity Testing (`@acc/core`, `@acc/ir`, `autogenerated-tests`)
- **8-Point VideoIR Schema Sync**:
  1. `packages/ir/src/types/VideoIR.ts`: TypeScript interfaces for `Camera3DModifierParams`, `DepthRelightingParams`, and `ParticleVfxParams`.
  2. `schema/video-ir.schema.json`: JSON Schema Draft-07 sub-schemas under `ModifierNode.params`.
  3. `packages/ir/src/schema/VideoIRSchemaValidator.ts`: Runtime validator updates.
  4. Documentation: Sync `docs/ir/1. video_(IR)_specification.md` and `docs/SYSTEM_ARCHITECTURE_DOCUMENT.md`.
  5. Adapters: Sync `StoryConfigToUniversalIRAdapter` and `PipelineIRToUniversalIRAdapter`.
  6. Compiler: Verify `RelationalDAGCompiler` and `IntervalTreeIndex` sequence scheduling.
  7. Renderer: Ensure `IRMasterRenderer` and `ModifierPluginRegistry` execute plugins seamlessly.
  8. Tests: Add comprehensive serialization, schema, and rendering parity tests in `/autogenerated-tests/`.
- **Multi-Engine Parity Matrix**:
  - Verify that visual pipelines, 3D camera projections, and relighting run identically through:
    1. `bun-ffi` (`FFIVideoEncoderSink`)
    2. `fluent-ffmpeg` (`FluentPipeVideoSink`)
    3. `mediabunny-server` (`MediabunnyServerSink`)
    4. `mediabunny-client` (`MediabunnyClientSink` / Browser Canvas)
  - Assert zero raw direct calls to `bun:ffi` or third-party binary spawners across all effect and renderer plugins.

---

## 4. User Review Required & Design Decisions Locked

> [!IMPORTANT]
> **Performance & Memory Mandate**: Phase 1 surface normal convolution, Phase 2 CoC blur, and Phase 3 particle compute must strictly adhere to **ZERO-ALLOC-FRAME-LOOP**. Scratch buffers, particle state arrays, and normal maps must be pre-allocated once during sequence preflight and reused across all frames.

1. **Strict Strategy Pattern Isolation**: No direct imports of `bun:ffi`, `fluent-ffmpeg`, or `mediabunny` anywhere in Iteration 5 or IRMasterRenderer. All video/audio decoding and encoding must route through `MediaEngineRegistry`.
2. **Phase 1: Pre-rendered Normal Map Textures**: Surface normal vectors are calculated once during preflight into reusable typed arrays.
3. **Phase 1: Additive Screen Compositing**: Lighting passes composite non-destructively onto the canvas via `'screen'`/`'lighter'` blending.
4. **Phase 1: Alpha Gated Rim Feathering**: Normal shading is gated by subject alpha with soft edge highlights.
5. **Phase 2: Modifier Plugin Pattern (`vfx/camera_3d`)**: Preserves zero-breaking-change Open-Closed principle for `VideoIR`.
6. **Phase 2: Pre-calculated Focal Zone Layering**: Bokeh rack focus renders via alpha crossfades between pre-blurred focal zones rather than expensive per-pixel CPU convolution.
7. **Phase 3: Typed SIMD Particle Arrays & Headless Safe GPU Adapter**: Contiguous `Float32Array` buffers with headless-safe fallback for 100% OS compatibility.
8. **Cross-Platform Consistency**:
   - Isomorphic canvas rendering core guarantees WYSIWYG parity between `@napi-rs/canvas` and HTML5 Canvas.
   - Dual-engine audio matrix generates bit-accurate procedural Float32Array PCM across Web Audio and FFmpeg.
   - Pluggable AI Vision Architecture explicitly routes inference according to user workspace configuration (`visionProvider: 'ai-supervisor' | 'cloud' | 'browser'`).
9. **Phase 4: Backward-Compatible 8-Point Schema Sync**: Root schema preserved at `v1.0.0-stable`, adding typed modifier parameter definitions.
10. **Testing**: Pure headless math verification with zero network dependencies in `/autogenerated-tests/`.

---

## 5. Verification Plan

### Automated Tests
- `autogenerated-tests/depth_relighting.test.ts`: Verify surface normal generation, light vector dot-products, alpha gating, and deterministic luminance parity.
- `autogenerated-tests/camera_spline_rack_focus.test.ts`: Test Bezier curve evaluation, 3D camera matrices, and CoC blur calculation across keyframes.
- `autogenerated-tests/particle_simd_vfx.test.ts`: Test contiguous Float32Array particle updates, bounds collision, and loop math determinism.
- `autogenerated-tests/media_engine_isolation.test.ts`: Enforce and verify that rendering pipelines route strictly through `MediaEngineRegistry` without direct binary/FFI calls.
- `autogenerated-tests/ir_schema_sync_iteration5.test.ts`: Validate VideoIR v3 schema compliance and serialization roundtrip.
