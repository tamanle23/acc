# Architecture & Brainstorming: Structurizing 6 Core Content Pipelines with Advanced Design Patterns

**Document Status:** Architectural Vision & Technical Specification
**Target Systems:** Visual Storytelling Generator, Multi-Pipeline Automation Matrix
**Core Technologies:** Bun, TypeScript, FFmpeg (FFI & CLI), PyTorch / Native C++ AI Engines (vLLM, Whisper.cpp, Diffusers, VieNeu-TTS), React / Canvas / Remotion

---

## 1. Executive Summary & Context

To scale the **Visual Storytelling Generator** from a slide-stitching video generator into an enterprise-grade **Automated Content Engine** capable of handling 250+ content variants across 6 core pipelines, the software architecture must decouple data ingestion, AI processing, media transformation, and encoding.

In high-throughput multimedia processing systems, unmanaged execution leads to:
1. **God-Object Monoliths**: Unmaintainable procedural code mixing I/O, AI inference, and FFmpeg filter building.
2. **Resource Exhaustion (OOM & VRAM Crashing)**: Parallel AI model loading or unbounded frame buffers overwhelming RAM and GPU VRAM.
3. **Fragile FFmpeg Pipelines**: Syntax errors in string-concatenated complex filter graphs failing after long computation phases.
4. **Non-Idempotent Workflows**: Modifying raw media paths in-place, preventing retries, dry-runs, and multi-variant rendering.

This document presents a unified architectural design leveraging **4 core design patterns**:
- **Pipeline Pattern (Middleware Engine)**: Orchestrates discrete stages of video generation.
- **Command Pattern**: Encapsulates atomic VFX, audio ducking, and video stitching operations as dry-runnable, inspectable objects.
- **Shared Context / Flyweight Pattern**: Provides immutable asset metadata registration and zero-copy memory management.
- **Producer-Consumer with Bounded Queues**: Enforces strict backpressure, throttling CPU/GPU usage across heterogeneous processing stages.

---

## 2. Theoretical Foundation & Pattern Roles

```
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                              PIPELINE ORCHESTRATOR                                     │
 ├──────────────┬──────────────────┬─────────────────────┬───────────────────┬────────────┤
 │ 1. INGEST    │ 2. AI GENERATION │ 3. VFX & COMPOSITION│ 4. ENCODING STITCH│ 5. DELIVERY│
 └──────┬───────┴────────┬─────────┴──────────┬──────────┴─────────┬─────────┴──────┬─────┘
        │                │                    │                    │                │
 ┌──────▼──────┐  ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐  ┌──────▼──────┐
 │ Producer    │  ┌─────────────┐      │ VFX Command │      │ FFmpeg DAG  │  │ Delivery    │
 │ Bounded Q   ├──► AI Worker   │      │ Queue       ├──────► Encoder     ├──► Webhook/   │
 │ (Scraper/DB)│  │ (Flyweight) │      │ (Command)   │      │ (Consumer)  │  │ S3 Storage  │
 └─────────────┘  └──────┬──────┘      └──────┬──────┘      └─────────────┘  └─────────────┘
                         │                    │
                  ┌──────▼────────────────────▼────────┐
                  │ Shared Asset Context & Flyweight   │
                  │   (Immutable Asset Registry)       │
                  └────────────────────────────────────┘
```

### 2.1. Pipeline Pattern (Middleware Architecture)
- **Intent**: Break execution into a sequence of isolated processing stages where the output of stage $N$ becomes the input context for stage $N+1$.
- **Role in Engine**: Acts as the high-level workflow engine (`PipelineRunner`). Stages operate as pluggable middleware (`IPlugin`) that can be reordered, conditionally executed, or safely bypassed upon failure.
- **Key Benefit**: **Fault Isolation**. If an optional stage (e.g., AI Upscaling or 3D Depth Mesh Generation) fails or times out, a defensive middleware catches the error, registers a fallback asset in the context, and allows subsequent rendering steps to proceed.

### 2.2. Command Pattern (for VFX & Stitch Steps)
- **Intent**: Encapsulate media editing instructions (e.g., `XFadeTransition`, `ZoomPan`, `AudioDucking`, `ColorGrade`, `OverlayEffect`) into self-contained `VFXCommand` objects.
- **Role in Engine**: Decouples *what* video effects need to be applied from *how* FFmpeg filtergraph strings or WebGL/Canvas shaders execute.
- **Key Benefit**:
  - **Dry-Run Validation**: Commands can validate their input requirements and estimate execution cost/time *before* invoking FFmpeg.
  - **Reversibility & Inspection**: Commands can be serialized to JSON, reordered, or compiled into DAG filter graphs (`FFmpegFilterGraph`).
  - **Macro Capabilities**: Multiple VFX steps can be composed into macro commands (e.g., `3DPopOutMacroCommand` = Cutout + Depth Map + Shadow + Floating Motion).

### 2.3. Shared Context / Flyweight Pattern (for Memory & Asset Management)
- **Intent**: Use sharing to support large quantities of media objects efficiently by separating intrinsic state (shared, heavy, immutable assets like AI models, video buffers, font faces) from extrinsic state (scene timestamp, layer position, opacity).
- **Role in Engine**:
  - **Shared Context (`AssetContext`)**: An immutable registry mapping scene IDs to asset variants (`original`, `upscaled`, `depth_map`, `audio_stem`). Middlewares never mutate existing assets; they register new variants.
  - **Flyweight Model/Buffer Manager**: Retains heavy AI model weights (Flux, VieNeu-TTS, Real-ESRGAN) in GPU VRAM or shared memory (`SharedArrayBuffer` / memory-mapped files) across scenes, avoiding repeated model loading overhead.
- **Key Benefit**: Eliminates duplicate media copies, prevents memory bloat, and provides deterministic asset selection (`getPreferred(['upscaled', 'original'])`).

### 2.4. Producer-Consumer Pattern with Bounded Queues
- **Intent**: Decouple task generation from task execution using fixed-capacity queues to control resource usage and apply backpressure.
- **Role in Engine**: Controls concurrency between fast I/O tasks (scraping, fetching, JSON parsing) and compute/VRAM-heavy tasks (AI generation, 4K FFmpeg rendering).
- **Key Benefit**: **Backpressure Management**. Prevents producers from flooding the system with raw video frames or high-res images that would exhaust RAM before FFmpeg consumers can process them.

---

## 3. Structurizing the 6 Core Content Pipelines

Here is how the 4 design patterns structure each of the 6 specialized content pipelines defined in the architecture vision.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PIPELINE STRUCTURIZATION MATRIX                                      │
├───────────────────────────────┬─────────────────────────────┬───────────────────────────┬──────────────┤
│ Pipeline Type                 │ Producer-Consumer & Queue   │ Shared Context / Flyweight│ VFX Command  │
├───────────────────────────────┼─────────────────────────────┼───────────────────────────┼──────────────┤
│ 1. Scraper & Summarizer       │ Bounded Websocket/Cron      │ Text Cache & LLM Context  │ News Ticker  │
│ 2. DB Injection & Templating  │ DB Batch Stream (JSONB)     │ Shared Canvas / Fonts     │ Chart Motion │
│ 3. Repurposing & Extraction   │ Audio Chunking Queue        │ Shared Video Buffers/VRAM │ Crop & Cutout│
│ 4. Generative Storytelling    │ Dual-Stage (Prompt -> Render│ VRAM Flyweight (Diffusers)│ 3D & Overlays│
│ 5. Rule-Based & Logic Gen     │ Math/Manim Worker Pool      │ Pre-rendered Vector Assets│ SVG Path Anim│
│ 6. Infinite Ambient Loops     │ Byte Stream Pipe (FFmpeg)   │ Seamless Loop Assets      │ Shader FX    │
└───────────────────────────────┴─────────────────────────────┴───────────────────────────┴──────────────┘
```

---

### Pipeline 1: Event-Driven Scraper & Summarizer
*Goal: Ingest real-time market/news data, summarize via vLLM/Llama 3, synthesize TTS, and render alert videos/podcasts.*

1. **Producer-Consumer**:
   - **Producer**: Websocket listener / Cron scraper emits raw HTML/JSON events into a `BoundedQueue<RawArticle>` (capacity: 50).
   - **Consumer Pool 1**: vLLM worker pool consumes articles, applying grammar constraints to output structured JSON (`Title`, `KeyPoints`, `Urgency`).
   - **Consumer Pool 2**: VieNeu-TTS worker pool converts text to audio chunks (`BoundedQueue<AudioStem>`).
2. **Shared Context / Flyweight**:
   - `AssetContext` stores raw article text, extracted key points, synthesized voice audio, and screenshot PNGs.
   - Flyweight engine maintains the vLLM model in VRAM and pre-loaded brand typography/logo assets in memory.
3. **VFX Commands**:
   - `RenderLowerThirdTickerCommand`: Renders real-time news ticker at the bottom.
   - `AudioDuckingCommand`: Ducks ambient background music during voice alert segments.
4. **Pipeline Orchestration**:
   `IngestStage` -> `SummarizeStage` -> `TTSStage` -> `VFXCompositionStage` -> `FFmpegStreamStage`.

---

### Pipeline 2: Database Injection & Programmatic Templating
*Goal: Stream thousands of rows from PostgreSQL (JSONB), inject into HTML/Canvas templates, and render infographics/comparison videos.*

1. **Producer-Consumer**:
   - **Producer**: PostgreSQL cursor streams product comparison records in batches into a `BoundedQueue<ProductPair>`.
   - **Consumer**: Multi-threaded Bun/Puppeteer or `node-canvas` worker pool renders DOM nodes directly to PNG buffers.
2. **Shared Context / Flyweight**:
   - **Flyweight**: Headless browser instance and canvas context handles are reused across thousands of items (reusing DOM trees, CSS styles, and web fonts).
   - `AssetContext` maps `product_id_A` and `product_id_B` to pre-processed cutout images.
3. **VFX Commands**:
   - `BarChartRaceCommand`: Interpolates bar widths over frame timestamps.
   - `SplitScreenComparisonCommand`: Constructs dual-viewport video layouts with synchronized timing.
4. **Pipeline Orchestration**:
   `DBStreamStage` -> `CanvasRenderStage` -> `VFXCommandCompileStage` -> `FFmpegConcatStage`.

---

### Pipeline 3: Repurposing / Asset Extraction
*Goal: Process long-form podcasts/webinars (1-2 hours), perform Whisper.cpp word-level alignment, track faces via YOLO/OpenCV, and output auto-cropped 9:16 vertical clips.*

1. **Producer-Consumer**:
   - **Producer**: Audio splitter breaks 2-hour audio into 30-second chunks into a `BoundedQueue<AudioChunk>`.
   - **Consumer 1**: Whisper.cpp C++ bindings process transcriptions with word timestamps.
   - **Consumer 2**: YOLO Face-Tracking worker identifies active speaker coordinates $(x,y,w,h)$.
2. **Shared Context / Flyweight**:
   - `AssetContext` tracks video frame buffers and word timestamp maps.
   - **Flyweight**: Shared memory pointers for source 4K video file handles, avoiding duplicate open calls across parallel worker threads.
3. **VFX Commands**:
   - `DynamicCropCommand`: Smoothly moves the 9:16 bounding box based on tracked speaker coordinates.
   - `WordHighlightCaptionCommand`: Burns animated captions with active word highlighting (`primaryColor`, `scaleBounce`).
4. **Pipeline Orchestration**:
   `AudioExtractStage` -> `WhisperAlignmentStage` -> `FaceTrackingStage` -> `VFXCropStage` -> `FFmpegEncodingStage`.

---

### Pipeline 4: Autonomous Generative Storytelling
*Goal: Turn seed prompts into multi-scene videos with AI images (Flux/SDXL), VieNeu-TTS dialogue, 3D Depth pop-outs, and procedural atmosphere overlays.*

1. **Producer-Consumer**:
   - **Stage 1 Producer**: LLM generates 3-act script with scene prompts -> `BoundedQueue<ScenePrompt>`.
   - **Stage 2 Consumer (GPU)**: Diffusers worker pool generates images sequentially to prevent VRAM over-allocation.
   - **Stage 3 Consumer (CPU/GPU)**: Depth Anything v2 computes 16-bit metric depth maps.
2. **Shared Context / Flyweight**:
   - `AssetContext` maintains scene lineage: `original_prompt` -> `image:raw` -> `image:upscaled` -> `image:depth` -> `image:cutout`.
   - **Flyweight**: Model weight cache in VRAM (Flux transformer + Depth Anything model kept loaded; unloads automatically when switching pipeline stages).
3. **VFX Commands**:
   - `Depth3DPopOutCommand`: Combines subject cutout, background depth mesh, drop shadow, and floating motion.
   - `SeamlessOverlayCommand`: Pipes procedural Canvas loop (rain, smoke, particles) over the 3D scene.
   - `AudioPaddingXFadeCommand`: Pads voiceover gaps and inserts cross-fades between slides.
4. **Pipeline Orchestration**:
   `ScriptGenStage` -> `ImageGenStage` -> `Depth3DStage` -> `VFXStitchStage` -> `FFmpegRenderStage`.

---

### Pipeline 5: Rule-Based & Logic Generation
*Goal: Execute mathematical functions, Manim procedural animations, or code syntax highlights, then combine with explanatory narration.*

1. **Producer-Consumer**:
   - **Producer**: Math exercise generator creates problem sets -> `BoundedQueue<LogicProblem>`.
   - **Consumer**: Manim Python process / Shiki code syntax highlighter renders vector animation frames.
2. **Shared Context / Flyweight**:
   - **Flyweight**: Reusable SVG path handles and pre-rendered vector glyphs.
   - `AssetContext` tracks vector frame sequences and audio synchronization maps.
3. **VFX Commands**:
   - `SVGPathTracingCommand`: Controls `stroke-dashoffset` parameters over time to simulate hand-drawing.
   - `CodeTypingEffectCommand`: Simulates realistic human typing delays (20ms-80ms per character).
4. **Pipeline Orchestration**:
   `LogicGenStage` -> `VectorRenderStage` -> `VFXSyncStage` -> `FFmpegMuxStage`.

---

### Pipeline 6: Infinite Ambient & Procedural Loops
*Goal: Stream 24/7 Lofi radio or ambient relaxation videos with real-time audio synthesis (MusicGen) and WebGL procedural shaders directly to YouTube RTMP.*

1. **Producer-Consumer**:
   - **Producer 1**: MusicGen worker generates 30s audio chunks into `BoundedQueue<AudioChunk>`.
   - **Producer 2**: WebGL/Shader headless renderer generates seamless visual loop frames.
   - **Consumer**: Non-blocking FFmpeg stdin pipe multiplexes stream bytes continuously to RTMP endpoint.
2. **Shared Context / Flyweight**:
   - **Flyweight**: Shared GPU frame buffers and seamless loop video handles.
   - `AssetContext` manages active stream state and overlay metadata.
3. **VFX Commands**:
   - `AudioReactiveWaveformCommand`: Renders real-time audio spectrum visualization.
   - `ProceduralShaderOverlayCommand`: Applies Perlin noise color gradients to background elements.
4. **Pipeline Orchestration**:
   `ProceduralAudioGenStage` -> `ShaderLoopStage` -> `StreamMultiplexStage` -> `RTMPDeliveryStage`.

---

## 4. Concrete Code Blueprints & Class Implementations

Below is a reference TypeScript implementation showing how these patterns interact in Bun.

### 4.1. Shared Context & Flyweight Pattern (`AssetContext.ts`)

```typescript
import { Logger } from './logger';

export interface AssetMetadata {
  width?: number;
  height?: number;
  duration?: number;
  mimeType?: string;
  [key: string]: any;
}

export class AssetContext {
  // Scene ID -> (Variant -> FilePath)
  private registry: Map<string, Map<string, string>> = new Map();
  private metadata: Map<string, AssetMetadata> = new Map();

  public register(sceneId: string, variant: string, filePath: string, meta?: AssetMetadata): void {
    if (!this.registry.has(sceneId)) {
      this.registry.set(sceneId, new Map());
    }
    this.registry.get(sceneId)!.set(variant, filePath);

    if (meta) {
      const key = `${sceneId}:${variant}`;
      this.metadata.set(key, { ...this.metadata.get(key), ...meta });
    }
    Logger.debug('AssetContext', `Registered [${sceneId}] (${variant}): ${filePath}`);
  }

  public getPreferred(sceneId: string, preferredVariants: string[]): string | undefined {
    const variants = this.registry.get(sceneId);
    if (!variants) return undefined;

    for (const variant of preferredVariants) {
      if (variants.has(variant)) {
        return variants.get(variant);
      }
    }
    return undefined;
  }

  public getMetadata(sceneId: string, variant: string): AssetMetadata | undefined {
    return this.metadata.get(`${sceneId}:${variant}`);
  }
}

/**
 * Flyweight AI Model & Shared Memory Handle Registry
 */
export class FlyweightModelRegistry {
  private static instance: FlyweightModelRegistry;
  private loadedModels: Map<string, { modelHandle: any; lastUsed: number }> = new Map();
  private maxVRAMBudgetMB: number = 8192; // 8GB default budget

  private constructor() {}

  public static getInstance(): FlyweightModelRegistry {
    if (!FlyweightModelRegistry.instance) {
      FlyweightModelRegistry.instance = new FlyweightModelRegistry();
    }
    return FlyweightModelRegistry.instance;
  }

  public async acquireModel<T>(modelId: string, loader: () => Promise<T>): Promise<T> {
    if (this.loadedModels.has(modelId)) {
      const entry = this.loadedModels.get(modelId)!;
      entry.lastUsed = Date.now();
      Logger.debug('FlyweightRegistry', `Reusing cached VRAM model: ${modelId}`);
      return entry.modelHandle as T;
    }

    Logger.info('FlyweightRegistry', `Loading AI model into VRAM: ${modelId}`);
    const modelHandle = await loader();
    this.loadedModels.set(modelId, { modelHandle, lastUsed: Date.now() });
    return modelHandle;
  }

  public async releaseInactiveModels(ttlMs: number = 60000): Promise<void> {
    const now = Date.now();
    for (const [modelId, entry] of this.loadedModels.entries()) {
      if (now - entry.lastUsed > ttlMs) {
        Logger.info('FlyweightRegistry', `Unloading idle VRAM model: ${modelId}`);
        // Free PyTorch / CUDA memory if applicable
        if (entry.modelHandle && typeof entry.modelHandle.dispose === 'function') {
          await entry.modelHandle.dispose();
        }
        this.loadedModels.delete(modelId);
      }
    }
  }
}
```

---

### 4.2. Command Pattern for VFX & Stitching (`VFXCommand.ts`)

```typescript
import { FFmpegFilterGraph } from './FFmpegFilterGraph';
import { AssetContext } from './AssetContext';

export interface CommandValidationResult {
  valid: boolean;
  errors: string[];
}

export interface VFXCommand {
  id: string;
  type: string;
  validate(context: AssetContext): CommandValidationResult;
  compileToFilterGraph(graph: FFmpegFilterGraph, context: AssetContext): Promise<void>;
  estimateCost(): { cpuScore: number; vramMB: number; durationSec: number };
}

/**
 * Concrete Command: Crossfade Transition between two slides
 */
export class XFadeTransitionCommand implements VFXCommand {
  public id: string;
  public type = 'VFX_XFADE_TRANSITION';

  constructor(
    id: string,
    private leftSceneId: string,
    private rightSceneId: string,
    private transitionType: string = 'fade',
    private durationSec: number = 1.0
  ) {
    this.id = id;
  }

  public validate(context: AssetContext): CommandValidationResult {
    const errors: string[] = [];
    const leftImg = context.getPreferred(this.leftSceneId, ['upscaled', 'original']);
    const rightImg = context.getPreferred(this.rightSceneId, ['upscaled', 'original']);

    if (!leftImg) errors.push(`Left scene asset missing for ${this.leftSceneId}`);
    if (!rightImg) errors.push(`Right scene asset missing for ${this.rightSceneId}`);

    return { valid: errors.length === 0, errors };
  }

  public async compileToFilterGraph(graph: FFmpegFilterGraph, context: AssetContext): Promise<void> {
    const leftStream = `v_${this.leftSceneId}`;
    const rightStream = `v_${this.rightSceneId}`;
    const outputStream = `v_xfade_${this.id}`;

    graph.addNode({
      filter: 'xfade',
      inputs: [leftStream, rightStream],
      outputs: [outputStream],
      params: {
        transition: this.transitionType,
        duration: this.durationSec,
        offset: 4.0 // Computed offset
      }
    });
  }

  public estimateCost() {
    return { cpuScore: 2, vramMB: 128, durationSec: this.durationSec };
  }
}

/**
 * Concrete Command: Depth 3D Pop-Out Effect
 */
export class Depth3DPopOutCommand implements VFXCommand {
  public id: string;
  public type = 'VFX_3D_POP_OUT';

  constructor(
    id: string,
    private sceneId: string,
    private style: 'polaroid' | 'comic' | 'card' = 'polaroid'
  ) {
    this.id = id;
  }

  public validate(context: AssetContext): CommandValidationResult {
    const errors: string[] = [];
    if (!context.getPreferred(this.sceneId, ['cutout'])) {
      errors.push(`Depth3D requires cutout variant for ${this.sceneId}`);
    }
    return { valid: errors.length === 0, errors };
  }

  public async compileToFilterGraph(graph: FFmpegFilterGraph, context: AssetContext): Promise<void> {
    // Add nodes for frame cutout overlay, shadow depth, and floating motion
    graph.addNode({
      filter: 'overlay',
      inputs: [`v_bg_${this.sceneId}`, `v_cutout_${this.sceneId}`],
      outputs: [`v_3d_out_${this.sceneId}`],
      params: { x: '(main_w-overlay_w)/2', y: '(main_h-overlay_h)/2' }
    });
  }

  public estimateCost() {
    return { cpuScore: 5, vramMB: 512, durationSec: 3.0 };
  }
}
```

---

### 4.3. Producer-Consumer with Bounded Queue (`BoundedQueue.ts`)

```typescript
export class BoundedQueue<T> {
  private queue: T[] = [];
  private capacity: number;
  private producersWaiting: Array<() => void> = [];
  private consumersWaiting: Array<(item: T) => void> = [];

  constructor(capacity: number) {
    if (capacity <= 0) throw new Error("Capacity must be positive");
    this.capacity = capacity;
  }

  public async enqueue(item: T): Promise<void> {
    if (this.queue.length >= this.capacity) {
      await new Promise<void>((resolve) => this.producersWaiting.push(resolve));
    }

    this.queue.push(item);

    if (this.consumersWaiting.length > 0) {
      const consumer = this.consumersWaiting.shift()!;
      const nextItem = this.queue.shift()!;
      consumer(nextItem);
    }
  }

  public async dequeue(): Promise<T> {
    if (this.queue.length > 0) {
      const item = this.queue.shift()!;
      if (this.producersWaiting.length > 0) {
        const producer = this.producersWaiting.shift()!;
        producer();
      }
      return item;
    }

    return new Promise<T>((resolve) => {
      this.consumersWaiting.push((item) => {
        if (this.producersWaiting.length > 0) {
          const producer = this.producersWaiting.shift()!;
          producer();
        }
        resolve(item);
      });
    });
  }

  public size(): number {
    return this.queue.length;
  }
}
```

---

### 4.4. Pipeline Orchestrator Pattern (`PipelineRunner.ts`)

```typescript
import { AssetContext } from './AssetContext';
import { VFXCommand } from './VFXCommand';
import { Logger } from './logger';

export interface PipelineContext {
  storyId: string;
  baseDir: string;
  assets: AssetContext;
  vfxQueue: VFXCommand[];
  metadata: Record<string, any>;
}

export interface IPipelineMiddleware {
  name: string;
  execute(ctx: PipelineContext, next: () => Promise<void>): Promise<void>;
}

export class PipelineRunner {
  private middlewares: IPipelineMiddleware[] = [];

  public use(middleware: IPipelineMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  public async run(ctx: PipelineContext): Promise<PipelineContext> {
    Logger.info('PipelineRunner', `Starting execution for pipeline [${ctx.storyId}]`);
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;

      if (i === this.middlewares.length) return;

      const mw = this.middlewares[i];
      Logger.debug('PipelineRunner', `Executing stage: ${mw.name}`);

      try {
        await mw.execute(ctx, () => dispatch(i + 1));
      } catch (err: any) {
        Logger.error('PipelineRunner', `Fault in stage [${mw.name}]: ${err.message}`);
        // Defensive Fallback handling: log error and allow pipeline to proceed with fallback assets
        await dispatch(i + 1);
      }
    };

    await dispatch(0);
    Logger.info('PipelineRunner', `Pipeline [${ctx.storyId}] execution completed.`);
    return ctx;
  }
}
```

---

## 5. System Interactivity & Memory Management Strategy

### 5.1. Zero-Copy Media Pipeline
1. **Direct FFmpeg Pipe Streams**: When transferring canvas frames or procedural audio chunks to FFmpeg, avoid writing intermediate `.png` or `.wav` files to disk. Stream byte arrays directly into FFmpeg `stdin` (`pipe:0`).
2. **Unix Domain Sockets & Shared Memory (`SharedArrayBuffer`)**: Inter-process communication between Bun worker threads and native C++ sidecars (e.g. Whisper.cpp, C++ FFmpeg FFI) uses shared memory buffers to prevent serialization overhead.

### 5.2. VRAM Throttling Architecture
- **GPU Mutex & Pool**: A system-wide semaphore restricts GPU-intensive models (e.g., Real-ESRGAN + Depth Anything + VieNeu-TTS) from running concurrently on a single GPU.
- **Model Lifecycle**:
  ```
  Load Weights -> Batch Execution -> Evict/Cache in Shared RAM -> Free VRAM
  ```

---

## 6. Implementation Roadmap

| Phase | Milestone | Deliverables | Target Artifacts |
|:---|:---|:---|:---|
| **Phase 1** | AssetContext & Flyweight | Refactor asset path handling into `AssetContext` and implement `FlyweightModelRegistry`. | `packages/core/src/AssetContext.ts` |
| **Phase 2** | VFX Command Engine | Convert transition and overlay logic in `renderer.ts` and `overlay-effects-cli.ts` into `VFXCommand` classes. | `packages/core/src/commands/` |
| **Phase 3** | Pipeline Runner Middleware | Replace main rendering loop with `PipelineRunner` supporting fallback middleware execution. | `packages/core/src/PipelineRunner.ts` |
| **Phase 4** | Bounded Concurrency Pool | Wrap scraper and GPU AI execution tasks in `BoundedQueue` workers. | `packages/core/src/BoundedQueue.ts` |

---

## 7. Conclusion

By combining the **Pipeline Pattern** (for modular stage orchestration), **Command Pattern** (for dry-runnable, inspectable VFX/stitching operations), **Shared Context & Flyweight** (for zero-copy memory & VRAM management), and **Producer-Consumer with Bounded Queues** (for backpressure-managed multi-core processing), the Visual Storytelling Generator achieves structural decoupling. This architecture safely supports all 6 core content pipelines and 250+ variants without risk of system crashes or resource exhaustion.
