# ACC System Architecture Document
**Version:** 1.0 (Master Blueprint)
**Role:** System Architect
**Scope:** End-to-End System Architecture, from Infrastructure Orchestration to Control Plane UI.

---

## 1. Executive Summary
The ACC project is a hyper-scalable, omnichannel Autonomous Content Creation system designed to programmatically generate, edit, composite, and distribute 250 distinct content variants across 5 formats. It leverages a Turborepo monorepo architecture, blending an ultra-fast TypeScript/Bun core for media processing and orchestration with a high-performance Python/uv gRPC backend for AI model execution.

The core philosophy revolves around **stateless processing**, orchestrated via **Netflix Conductor OSS**, utilizing **Zero-Disk Data Processing** (via Bun FFI and NAPI-RS Canvas streams) to achieve massive vertical and horizontal scalability.

---

## 2. Top-Level Architecture
The project is structured as a Turborepo monorepo divided into applications (`apps/`) and internal domain packages (`packages/`).

### 2.1 Core Technologies
*   **Package Managers & Runtimes:** Bun (TypeScript workspaces, test runner), `uv` (Python dependencies, pytest).
*   **Workflow Orchestration:** Netflix Conductor OSS (Stateless Task Workers).
*   **Media Processing:** System FFmpeg Native via Bun FFI (`@acc/core/src/ffmpeg-ffi`), `@napi-rs/canvas` for zero-disk RGBA overlays.
*   **AI/ML:** Python gRPC Subsystem (Kokoro, Depth Anything v2, SAM 2, llama.cpp).
*   **Design Patterns:** Extensive use of Gang of Four (GoF) patterns (Strategy, Factory, Command, Composite, Decorator, Flyweight, Middleware, Template Method, Observer, State Machine).

---

## 3. The 6 Canonical Pipelines & Conductor Orchestration
ACC maps 250 diverse content types into **6 Canonical Pipelines**. These pipelines are orchestrated externally via Netflix Conductor OSS `FORK_JOIN` DAGs (Directed Acyclic Graphs) for 1-to-N omnichannel fan-out, ensuring zero complex internal business routing logic within the workers themselves.

All pipelines utilize the following foundational design patterns:
- **Pipeline Pattern (Middleware Architecture):** Breaks execution into a sequence of isolated processing stages (`PipelineRunner`).
- **Command Pattern:** Encapsulates media editing instructions (e.g., `XFadeTransition`, `AudioDucking`).
- **Shared Context / Flyweight Pattern:** Eliminates duplicate media copies and prevents memory bloat by sharing immutable assets (`AssetContext`).
- **Producer-Consumer with Bounded Queues:** Controls concurrency and applies backpressure between fast I/O tasks and compute/VRAM-heavy tasks.

### The Canonical Pipelines

#### Pipeline 1: Event-Driven Scraper & Summarizer
*Goal: Ingest real-time market/news data, summarize via vLLM/Llama 3, synthesize TTS, and render alert videos/podcasts.*
- **Producer-Consumer:** Websockets/Cron emit events to `BoundedQueue`. Consumers apply LLM grammar constraints to output JSON and synthesize TTS audio.
- **Shared Context/Flyweight:** Tracks raw text, extracted key points, synthesized voice, and screenshot PNGs. Retains vLLM models in VRAM.
- **VFX Commands:** `RenderLowerThirdTickerCommand`, `AudioDuckingCommand`.
- **Pipeline Orchestration:** `IngestStage` -> `SummarizeStage` -> `TTSStage` -> `VFXCompositionStage` -> `FFmpegStreamStage`.

#### Pipeline 2: Database Injection & Programmatic Templating
*Goal: Stream rows from PostgreSQL (JSONB), inject into HTML/Canvas templates, and render infographics/comparison videos.*
- **Producer-Consumer:** PostgreSQL streams records in batches. Consumer workers render DOM nodes to PNG buffers.
- **Shared Context/Flyweight:** Headless browser instance and canvas handles reused across items.
- **VFX Commands:** `BarChartRaceCommand`, `SplitScreenComparisonCommand`.
- **Pipeline Orchestration:** `DBStreamStage` -> `CanvasRenderStage` -> `VFXCommandCompileStage` -> `FFmpegConcatStage`.

#### Pipeline 3: Repurposing / Asset Extraction
*Goal: Process long-form audio/video, perform Whisper.cpp word-level alignment, track faces, and output auto-cropped clips.*
- **Producer-Consumer:** Audio splitter breaks data into chunks. Whisper.cpp aligns words, and YOLO Face-Tracking identifies speaker coordinates.
- **Shared Context/Flyweight:** Shared memory pointers for source 4K video files, avoiding duplicate file open calls.
- **VFX Commands:** `DynamicCropCommand`, `WordHighlightCaptionCommand`.
- **Pipeline Orchestration:** `AudioExtractStage` -> `WhisperAlignmentStage` -> `FaceTrackingStage` -> `VFXCropStage` -> `FFmpegEncodingStage`.

#### Pipeline 4: Autonomous Generative Storytelling
*Goal: Turn seed prompts into multi-scene videos with AI images (Flux/SDXL), VieNeu-TTS dialogue, 3D Depth pop-outs, and procedural overlays.*
- **Producer-Consumer:** LLMs generate script prompts. GPU Diffusers generate sequential images, and Depth Anything v2 computes depth maps.
- **Shared Context/Flyweight:** `AssetContext` tracks original images, depth maps, cutout masks. Diffusers and TTS stay active in VRAM.
- **VFX Commands:** `Depth3DPopOutMacroCommand`, `ParallaxSlideCommand`.
- **Pipeline Orchestration:** `PromptGenStage` -> `ImageGenStage` -> `DepthExtractionStage` -> `VFX3DStage` -> `VoiceGenStage` -> `FFmpegStage`.

#### Pipeline 5: Rule-Based & Logic Generation
*Goal: Execute mathematical functions, Manim procedural animations, or code syntax highlights.*
- **Producer-Consumer:** Math generator creates problem sets. Python/Manim processes render vector animation frames.
- **Shared Context/Flyweight:** Reusable SVG path handles and pre-rendered vector glyphs.
- **VFX Commands:** `SVGPathTracingCommand`, `CodeTypingEffectCommand`.
- **Pipeline Orchestration:** `LogicGenStage` -> `VectorRenderStage` -> `VFXSyncStage` -> `FFmpegMuxStage`.

#### Pipeline 6: Infinite Ambient & Procedural Loops
*Goal: Stream 24/7 Lofi radio or ambient relaxation videos with real-time audio synthesis and WebGL procedural shaders to RTMP.*
- **Producer-Consumer:** MusicGen generates 30s chunks. WebGL renderer generates loop frames. Non-blocking FFmpeg stdin pipes multiplex bytes.
- **Shared Context/Flyweight:** Shared GPU frame buffers and seamless loop video handles.
- **VFX Commands:** `AudioReactiveWaveformCommand`, `ProceduralShaderOverlayCommand`.
- **Pipeline Orchestration:** `ProceduralAudioGenStage` -> `ShaderLoopStage` -> `StreamMultiplexStage` -> `RTMPDeliveryStage`.

### Orchestration Mechanism
*   The `apps/cli` application spins up stateless workers via `@io-orkes/conductor-javascript`.
*   Workers poll for tasks using `TaskWorkerFactory` and `ConductorWorkerPoller`.
*   Tasks are strictly defined in `schema/conductor/workflows/` and processed by `IConductorTaskCommand` implementations.

---

## 4. Subsystem Breakdown (Workspace Packages)

### 4.1 `@acc/core` (The Foundation)
The foundational backbone containing primitives and hardware-accelerated bindings.
*   **FFmpeg FFI (`packages/core/src/ffmpeg-ffi`)**: Uses Bun FFI bindings with `FFIType.u64` raw pointers to prevent C-string truncation or type conversion panics. Achieves extreme performance by bypassing disk I/O.
*   **Flyweight Model Registry (`ModelHandleRegistry`)**: Manages AI handles (e.g., loading, evicting lowest priority, tracking memory usage in MB) to ensure the GPU/CPU isn't overwhelmed.
*   **Asset Context & BoundedQueue**: Tracks media assets through the pipeline stages, ensuring backpressure limits.

### 4.2 `@acc/effect-engines` (Media Manipulation)
The visual and auditory powerhouse containing 13 Systematic Video Editing Groups.
*   **Overlay Effects (`overlay-effects`)**: Uses `VFXCompositeLayerStack` (Composite Pattern) and `CanvasAdapterFactory`. Renders frames via `@napi-rs/canvas` directly into FFmpeg `stdin` PassThrough streams.
*   **3D Depth Effects (`src/depth3d`)**: Handled by `Depth3DFactory` and `IDepth3DRenderer` strategies for 2.5D/3D visual illusions.
*   **Sound Effects (`sound-effects`)**: Uses `SmartRouter`, `BaseSoundGenerator`, and `BaseFFmpegGenerator` for procedural DSP synthesis, sidechain ducking (`AudioDuckingDSP`), and Foley marking.
*   **Systematic Video Editing (`src/editing`)**: Features facades like `EditingEngineFacade` and capabilities like `MontageBeatSync`, `SpeedRampStrategy`, `SmashCutStrategy`, `ChromaKeyCompositorStrategy`, and `KineticTypography` spring-physics motion graphics.

### 4.3 `@acc/ir` (Universal Video Intermediate Representation)
The deterministic timeline compiler and declarative data plane connecting high-level story configs to low-level media engines.
*   **Canonical IR Schema (`VideoIR.ts`, `modifiers.ts`, `schema/video-ir.schema.json`, `schema/modifiers.schema.json`)**: Versioned declarative schema adhering to the Open-Closed Principle (OCP) with strictly required sequence types (`video`, `image`, `audio`, `text`, `overlay`), track-containment compatibility validation, explicit modifier targets (`target: SequenceType | SequenceType[]`), global document-level post-composition modifier passes (`doc.modifiers`), and dual-level blend modes (`seq.blendMode` cascading over `track.blendMode`).
*   **Relational DAG Compiler (`RelationalDAGCompiler.ts`)**: Resolves non-destructive relative dependencies (`startWith`, `startAfter`, `endWith`) into absolute discrete frame intervals via two-pass Kahn's topological sort and cycle detection, propagating sequence types and blend modes to `ResolvedSequence` and root modifiers to `ResolvedTimeline`.
*   **Deterministic Clock & Interval Tree Index (`DeterministicAudioClock.ts`, `IntervalTreeIndex.ts`)**: Rational Bresenham sample accumulator ensuring zero drift across millions of frames, paired with an augmented binary interval tree index enabling $O(\log M)$ playhead intersection lookups for frontend visual editing preview.
*   **Pioneer Adapter Flywheel (`StoryConfigToUniversalIRAdapter.ts`, `PipelineIRToUniversalIRAdapter.ts`)**: Bi-directional bridge auto-transpiling legacy story-config and pipeline-ir structures directly into modernized universal IR timelines with strictly typed sequences and modifier targets.
*   **Modifier Plugin Registry (`ModifierPluginRegistry.ts`)**: Extensible Strategy/Plugin architecture executing audio ducking, 3D depth pop-out, blend modes, transitions, and split edits dynamically with registered `defaultTarget` specifications.
*   **Deterministic Headless Rasterizer & Interactive Preview Engine (`IRMasterRenderer.ts`, `IRPreviewEngine.ts`)**: Frame-locked synchronous rasterizer driven by deterministic PRNG seeded noise with bit-identical rendering parity between headless batch exports and interactive video editor scrubbers, supporting dual blend modes and global document-level post-composite passes.

### 4.4 `@acc/exporters` (Publishing Fan-Out)
Responsible for platform-compliant rendering.
*   Features `WidgetExporter` for interactive video branching.
*   Features `SpatialVideoExporter` for specialized AR/VR delivery formats.
*   Executes parallel multi-format outputs as defined by the Conductor `FORK_JOIN` nodes.

### 4.5 `apps/ai-supervisor/python-backend` (gRPC AI Subsystem)
A high-throughput backend managed by `uv` (`pyproject.toml`) wrapping heavy AI models behind a strict gRPC interface. Located directly inside `apps/ai-supervisor/python-backend` to unify desktop control plane lifecycle and AI inference engine.
*   **Computer Vision**: Depth Anything v2, SAM 2 (Segment Anything).
*   **Audio/Voice**: Kokoro.
*   **LLMs**: `llama.cpp` wrapper for local/efficient inference.

---

## 5. UI/UX: Liquid Glass Control Plane
The human-in-the-loop (HITL) interface is designed under the **Liquid Glass UI Master Architecture** (`DESIGN.md`), allowing management of all 250 content types through a modular UI without needing 250 individual views.

*   **Design Tokens**: Default Light Mode (Luminous Frosted Crystal `#F8FAFC`, Deep Slate `#0F172A`).
*   **Accessibility**: Strict WCAG 2.1 AA compliance (4.5:1 text contrast ratio, 44x44px touch targets).
*   **Component Architecture**: Composed of Text/Tone Editors, Spatial/Layout Grids, Audio/Waveform Timelines, and Logic/Node Graphs.
*   **Human Intervention Gates**: Features 4 Specialized Mid-Execution Human Intervention Workspaces (Before, In the Middle, After processing) to permit manual course-correction, plus Universal Pipeline Trigger UIs and Post-Publishing Health Dashboards.

---

## 6. Engineering Standards & Performance Tuning

### 6.1 Performance Constraints
*   **Asynchronous I/O Only**: Strict prohibition of synchronous I/O. Methods like `fs.readFileSync` or `fs.existsSync` are banned. Everything uses `fs.promises` or specialized wrappers (e.g., `fileExists` from `@acc/core`). CPU-bound loops must explicitly yield to avoid blocking the Bun event loop, ensuring fast HTTP request/Conductor polling turnaround.
*   **Zero-Disk Caching Strategy**: Disk-based intermediary caching (like legacy MP3 generation) is actively removed in favor of direct in-memory AAC and FFI audio/video processing.

### 6.2 Benchmarking Suite (`benchmarks/`)
The system enforces performance profiling across 3 explicit tiers:
1.  **Micro (`mitata`)**: Located in `benchmarks/micro/`. Benchmarks FFI DSP, zero-copy memory movement, Canvas overlays, and BoundedQueue.
2.  **HTTP/Load (`oha`)**: Located in `benchmarks/http/`. Load tests webhooks and ingestion limits.
3.  **CLI Macro (`hyperfine`)**: Located in `benchmarks/cli/`. Timings for full execution pipelines, generating CSV/JSON/Markdown reports.

### 6.3 Code Architecture Practices
*   **Strict Facade & Middlewares**: Heavy systems (`MulticamFacade`, `MatchmoveVisionFacade`, `MoCapVTubeFacade`) are hidden behind Facades. Processing runs through `EditingStageMiddleware` / `EditingStageRunner`.
*   **CLI Interactions**: Handled exclusively using `@clack/prompts` wrappers from `@acc/core` for clean interactive CLI states.
*   **Logging**: Standard `console.log` is strictly prohibited. The system enforces the custom `@acc/core` `Logger` which requires namespace scoping for structured, trace-friendly output.

---

## 7. Universal Auto-Config Engine Architecture

The **Universal Auto-Config Engine** (`@acc/core/autoconfig`) provides autonomous, zero-configuration project scaffolding for raw media asset directories across all 6 Canonical Pipelines. It replaces manual JSON authored setups with autonomous detection, pipeline classification, and AST synthesis.

### 7.1 Architecture & GoF Design Patterns

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        AutoConfigEngineFacade                          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
┌──────────────────┐     ┌──────────────────┐         ┌──────────────────┐
│ MediaAssetProber │     │PipelineClassifier│         │PipelineIRBuilder │
│      Chain       │────►│     Registry     │────────►│   (Builder v3)   │
│(Chain of Resp.)  │     │(Strategy Pattern)│         └────────┬─────────┘
└──────────────────┘     └──────────────────┘                  │
                                                               ▼
                         ┌──────────────────┐         ┌──────────────────┐
                         │AutoConfigLegacy  │         │ DirectorPreset   │
                         │  Bridge Adapter  │◄────────│     Factory      │
                         │ (Adapter Pattern)│         │(Factory Pattern) │
                         └────────┬─────────┘         └────────┬─────────┘
                                  │                            │
                                  ▼                            ▼
                         ┌──────────────────┐         ┌──────────────────┐
                         │story-config.json │         │pipeline-ir.json  │
                         │ (Legacy Bridge)  │         │omnichannel-config│
                         └──────────────────┘         └──────────────────┘
```

1. **Facade Pattern (`AutoConfigEngineFacade`)**:
   - Single, robust orchestrating entrypoint providing `inspectDirectory()` and `scaffoldDirectory()`.
   - Used uniformly across the interactive CLI (`auto-config.ts`), headless microservices, and Conductor task workers.
2. **Chain of Responsibility (`MediaAssetProberChain`)**:
   - Decoupled media inspection chain comprising `ImageProberHandler`, `VideoProberHandler`, `AudioProberHandler`, `ScriptProberHandler`, and `DataProberHandler`.
   - Emits a standardized `DiscoveredAssetManifest` with technical dimensions, audio classifications, durations, and chronological pairings.
3. **Strategy Pattern (`IPipelineClassifierStrategy` & `PipelineClassifierRegistry`)**:
   - Classifies asset manifest signatures into Pipelines 1–6 with normalized confidence scores `[0.0, 1.0]`.
   - Supports manual overrides, alternative ranking, and safe fallback to Pipeline 4.
4. **Builder Pattern (`PipelineIRBuilder`)**:
   - Progressively constructs schema-validated `PipelineIR` (v3.0.0) documents.
   - Pairs media chunks, maps speech audio, configures BGM tracks, and sets audio ducking envelopes (`-14dB`).
5. **Factory Pattern (`DirectorPresetFactory`)**:
   - Synthesizes domain-specialized `FineGrainedVideoDirectorConfig` envelopes across 3 cinematography tiers (Canvas LUTs, Audio Staging, and Segment/Role Overrides).
6. **Adapter Pattern (`AutoConfigLegacyBridgeAdapter`)**:
   - Losslessly bridges modern `PipelineIR` ASTs and director configurations to legacy `StoryConfig` schemas.
   - Ensures zero regressions for commands like `bun run cli.ts ./sample-story`.

### 7.2 Dual-Emission Guarantee
When scaffolding directories, the engine simultaneously emits:
1. `pipeline-ir.json`: Modern DAG AST for multi-channel video, social, audio, and web rendering.
2. `omnichannel-config.json`: Fine-grained cinematography directives and deliverable modalities.
3. `story-config.json`: Exact backward-compatible config for classical single-video rendering pipelines.

---

## 8. Narrative Scripting Frameworks Architecture (Option B)

The narrative scripting framework subsystem (`@acc/core/autoconfig/scripting/`) generates domain-calibrated pacing structures, emotional tension arcs, and A/V staging cues. It operates via the Strategy Pattern, allowing content creators and automated pipelines to apply distinct narrative paradigms:

### 8.1 The 6 Master Scripting Strategies
1. **Mystery Box / Epistemic Gap (`MysteryBoxExplainerStrategy`)**:
   - Delays core revelations, constructs high-contrast A/B narrative arcs, and stages whiteboard/void reset beats with heavy sub-bass transitions.
2. **Breadcrumb Trail Digital Investigation (`BreadcrumbTrailDigitalStrategy`)**:
   - Forensic pacing with rapid-fire terminal/UI clips, keyboard typing SFX markers, and document highlight annotations.
3. **Stakes & Escalation / Challenge (`StakesAndEscalationStrategy`)**:
   - High-velocity stakes progression with dynamic countdown timers, progress indicators, kinetic typography, and audio build-ups.
4. **Intimate Confessional / Authentic Take (`IntimateConfessionalStrategy`)**:
   - Conversational, vulnerability-driven pacing with long takes, conversational breathing room, gentle background bokeh, and emotional audio ducking.
5. **Historical Parallels / Archival Dual Timeline (`HistoricalParallelsStrategy`)**:
   - Dual-timeline split screens, archival parchment LUT color grading, and chronological progress pacing.
6. **Contrarian Thesis / Myth-Buster (`ContrarianThesisStrategy`)**:
   - Provocative opening thesis, myth busting badges, evidence receipts, and punchy resolution beats.

### 8.2 Strategy Registry & PipelineIR Integration
- **`ScriptingFrameworkRegistry`**: Central lookup and auto-classification engine that matches content prompts, keywords, or explicit `--framework` CLI flags to concrete strategies.
- **`PipelineIRBuilder`**: Ingests generated narrative beats, adjusts chunk durations, maps typography styles, and stages audio SFX markers seamlessly into the AST.

---

## 9. Hardware Accelerated Encoding Suite (Option C)

The hardware acceleration subsystem (`@acc/core/src/ffmpeg-ffi/`) eliminates CPU encoding bottlenecks by dynamically routing video compression through native GPU encoders via pure `bun:ffi` without child-process overhead.

### 9.1 Dynamic Resolver & Defensive Fallback Chain
`GPUEncoderResolver` dynamically probes loaded FFmpeg shared libraries (`avcodec`) for available hardware codecs across operating systems:
- **Windows / Linux**: `h264_nvenc` / `hevc_nvenc` (NVIDIA CUDA / NVENC), `h264_qsv` / `hevc_qsv` (Intel QuickSync), `h264_amf` / `hevc_amf` (AMD AMF).
- **macOS (Apple Silicon / Intel)**: `h264_videotoolbox` / `hevc_videotoolbox`.
- **Linux**: `h264_vaapi` / `hevc_vaapi`.
- **Universal Fallback**: Automatic, zero-crash fallback to CPU `libx264` / `libx265` whenever GPU hardware contexts fail to open or are unsupported.

### 9.2 Zero-Allocation Frame Loop & Hardware Tuning
- **`GpuVideoEncodingStrategy`**: Applies hardware-specific `av_opt_set` configurations (e.g. `preset=p4/p6`, `tune=hq`, `rc=vbr_hq`, `spatial_aq=1`, `temporal_aq=1`).
- **Memory Invariance**: Maintains zero nursery heap allocations per frame by passing raw memory pointers (`ptr(rgbaBuffer)`) directly into pre-allocated C memory buffers (`srcDataC`, `srcStrideC`), preserving the **ZERO-ALLOC-FRAME-LOOP** mandate.

---

## 10. Dual-Engine Web/UI Studio Preview Architecture (Option D)

Bridging headless batch rendering with interactive real-time editing, the Studio architecture (`apps/cli/src/studio/`) implements a Hybrid Dual-Pipeline design:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Interactive Browser UI (Studio HTML5)                │
│   (Real-time Canvas Rendering, Draggable Scrubber, JSON-Patch Log)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / WebSocket REST API
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Bun Native StudioServer                         │
│             (/api/timeline, /api/scrub, /api/patch, /api/render)       │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
       ┌────────────────────────┐        ┌────────────────────────┐
       │  StudioTimelineState   │        │ UIStudioPreviewEngine  │
       │ (Playhead & RFC 6902)  │        │(Dual-Pipeline Resolver)│
       └───────────┬────────────┘        └───────────┬────────────┘
                   │                                 │
                   ▼                                 ▼
       ┌────────────────────────┐        ┌────────────────────────┐
       │   VideoIRDocument AST  │        │   IRMasterRenderer     │
       │   (Immutable Timeline) │        │ (Deterministic Export) │
       └────────────────────────┘        └────────────────────────┘
```

1. **Frontend Preview (Real-Time)**:
   - Uses HTML5 Canvas + WebGL shaders for instant playback and responsive scrubbing at variable frame rates.
   - Decoupled from heavy FFI encoder locks, allowing instant interactive feedback.
2. **Backend Dispatch (Deterministic Export)**:
   - Dispatches headless batch rendering via `IRMasterRenderer` using the exact patched `VideoIRDocument`.
   - Adheres strictly to **DETERMINISTIC-HANDSHAKE-BACKPRESSURE** and monotonic DTS/PTS timestamp guarantees.
3. **RFC 6902 JSON-Patch AST Synchronization**:
   - Every UI edit (moving clip in/out points, modifying subtitle typography, toggling `depth_3d` or `canvas_particle_overlay`) is expressed as an atomic JSON-Patch operation.
   - Built-in undo/redo history stack guarantees bidirectional state consistency and instant rollbacks.

---

## 11. Electrobun Desktop Control Plane & Multi-Daemon AI Supervisor

The **Desktop Control Plane** (`apps/ai-supervisor`) serves as the host orchestrator for the ACC desktop ecosystem. Powered by Electrobun and native Bun APIs, it provides zero-lag desktop supervision with negligible resource overhead (<30MB RAM).

```text
┌────────────────────────────────────────────────────────────────────────┐
│              Electrobun Desktop Shell & Native Tray Icon               │
│          (Windows Registry Auto-Start, Dynamic Tray Colors)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│   SupervisorEngine     │  │   HardwareProfiler     │  │     UpdateManager      │
│(Crash Backoff & Drain) │  │  (5-Tier VRAM Matrix)  │  │(SHA-256 Auto-Rollback) │
└───────────┬────────────┘  └───────────┬────────────┘  └───────────┬────────────┘
            │                           │                           │
    ┌───────┴───────────────┬───────────┴───────────┬───────────────┴────────┐
    ▼                       ▼                       ▼                        ▼
┌───────────────┐   ┌───────────────┐       ┌───────────────┐        ┌───────────────┐
│ Python Daemon │   │ Worker Daemon │       │ Studio Server │        │ Ollama Daemon │
│(:50051 gRPC)  │   │(Task Poller)  │       │(:3300 HTTP/WS)│        │(:11434 REST)  │
└───────────────┘   └───────────────┘       └───────────────┘        └───────────────┘
```

1. **Hybrid Process Lifecycle Supervision**:
   - Manages four independent services: Python backend (gRPC `:50051`), Worker daemon, React Studio client (`:5173` via Vite dev), and Ollama LLM inference (REST `:11434`).
   - Exponential crash backoff (1s, 2s, 4s delay); isolates persistent failures in `CRASH_LOOP` with native tray alerts.
   - Dynamic port collision resolver prevents startup failures when ports are occupied.
2. **Hermetic Runtime Isolation (`RuntimeManager`)**:
   - Isolates `uv` in `~/.acc/bin/` and a dedicated CPython 3.12 installation in `~/.acc/python-env/`.
   - Prevents version pollution or runtime mismatch from system Python installations (e.g. Python 3.10 or 3.14).
   - Non-blocking background provisioning: Service enters `PROVISIONING` status (yellow tray icon) during first-time initialization and transitions to `RUNNING` (green tray icon) once port `:50051` is operational.
   - Environment injection enforces `UV_PYTHON_INSTALL_DIR=~/.acc/python-env` and `UV_PYTHON=3.12`.
3. **5-Tier Granular Hardware Classification**:
   - **Tier 1 (Ultra >= 24GB VRAM / Mac UMA >= 36GB)**: Zero proactive eviction.
   - **Tier 2 (Pro 12GB–20GB VRAM / Mac UMA 16–32GB)**: Selective co-residence with dynamic headroom threshold.
   - **Tier 3 (Budget 6GB–8GB VRAM / Mac UMA 8GB)**: Active mutual eviction (unloads Ollama models before video rendering / TTS synthesis).
   - **Tier 4 (Ultra-Constrained < 6GB VRAM)**: CPU/GPU role splitting (Python pinned to CPU, VRAM dedicated to Ollama).
   - **Tier 5 (CPU-Only / Integrated)**: Disables GPU eviction; manages CPU thread pool priorities.
4. **Seamless Auto-Update with Boot Watchdog & Auto-Rollback**:
   - Periodic checks against GitHub Releases API; staged downloads with SHA-256 verification.
   - 10-second boot watchdog detects startup crash-loops and automatically rolls back from `~/.acc/updates/backup/`.

---

## 12. Pluggable Media Engine Strategy Architecture (Iteration 4)

Iteration 4 decouples the media processing stack (`@acc/core`, `@acc/ir`, `@acc/exporters`, `apps/cli`) from a singular C FFI backend through a unified **Strategy Pattern**:

```text
                                ┌───────────────────────────┐
                                │    MediaEngineRegistry    │
                                │   (Strict & Fail-Fast)    │
                                └─────────────┬─────────────┘
                                              │
         ┌──────────────────────────┬─────────┴────────┬──────────────────────────┐
         ▼                          ▼                  ▼                          ▼
┌──────────────────┐      ┌──────────────────┐  ┌──────────────────┐      ┌──────────────────┐
│   bun:ffi        │      │  fluent-ffmpeg   │  │mediabunny-server │      │mediabunny-client │
│(Native C Libs)   │      │(Bun.spawn pipe:0)│  │(Pure TS Streams) │      │(Browser WebCodecs│
│Zero-Copy Pointers│      │Full Filtergraphs │  │Atom Box Concat   │      │Offline Client UI)│
└──────────────────┘      └──────────────────┘  └──────────────────┘      └──────────────────┘
```

1. **Core Contracts (`@acc/core/src/media-engine/types.ts`)**:
   - `IMediaEngineStrategy`: Unified interface providing video frame sinks (`createVideoSink`), metadata probing (`getProbeStrategy`), chunk concatenation (`getConcatStrategy`), audio muxing (`getAudioMuxerStrategy`), and execution policies (`getChunkPolicy`).
   - `MediaEngineRegistry`: Central registry with strict prerequisite verification (fail-fast `MediaEngineError` on missing binaries/libraries) and default `bun-ffi` selection.
2. **Phase 1 Production Engines**:
   - **`bun-ffi`**: Direct C shared-library bindings (`libavcodec`, `libswscale`) passing raw pointers `ptr(rgbaBuffer)` with zero heap cloning.
   - **`fluent-ffmpeg`**: CLI-isolated subprocess streaming via native `Bun.spawn` stdin (`pipe:0`) with deterministic backpressure (`FileSink.flush()`), GPU auto-resolution (`GPUEncoderResolver`), and full complex filtergraph support.
3. **Phase 2 Production Engines**:
   - **`mediabunny-server`**: Pure TypeScript MP4 container prober without `ffprobe`, elementary-packet lossless chunk concatenation (zero subprocess, zero re-encode), and NodeAV server-side H.264 frame encoding.
   - **`mediabunny-client`**: Browser-native WebCodecs frame encoding (`VideoEncoder`) and client-side in-memory MP4 Blob muxing for `apps/studio` with zero server compute overhead.

---

## 13. Standalone Task Worker Architecture (`apps/worker`)

Decoupled as a standalone long-running workspace daemon (`apps/worker`), orchestrated by `apps/ai-supervisor` and executing task pipelines via pluggable abstractions:

1. **Pluggable Workflow Poller Abstraction (`ITaskPoller`)**:
   - Unified lifecycle contract (`start`, `stop`, `isPolling`).
   - Ships with **`SandboxTaskPoller`**: Zero-dependency local event generator producing simulated pipeline tasks for standalone desktop operation, ready for drop-in integration with custom workflow engines.
2. **Pluggable Backend Hypervisor & VRAM Arbitrator (`BackendHypervisor`)**:
   - Role division: `apps/worker` acts as the Inference Dispatcher & Hypervisor routing tasks (`tts`, `llm`, `ir-compose`) and orchestrating VRAM pre-flight checks and eviction handshakes (`purgeVRAM()`).
   - `OllamaBackendAdapter`: REST client monitoring `/api/ps` and triggering VRAM purge via `keep_alive: 0`.
   - `PythonBackendAdapter`: gRPC / IPC client with `ACC_AI_OFFLINE` detection and deterministic fallback synthesis.
3. **Production Core Task Commands**:
   - `acc.story.generate_script`: Story script generation via LLM / fallback.
   - `acc.tts.synthesize_speech`: Audio synthesis via Python Kokoro / fallback.
   - `acc.ir.compose_video`: Video IR AST generation and compilation via `@acc/ir`.

---

## 14. Dedicated React 19 NLE Studio Architecture (`apps/studio`)

Decoupled as a 100% pure client-side React 19 workspace application (`apps/studio`) powered by HTML5 `<canvas>`, WebGL, and browser WebCodecs (Option A):

1. **Pure Client-Side Architecture (Zero Server Backend)**:
   - Eliminates backend server processes; `apps/studio/src/server/` is completely removed.
   - In development: Served directly by Vite development server (`vite dev`) on port 5173.
   - In production: Built into static distribution assets (`dist/client`) via `vite build`.
2. **Event-Driven Viewport Engine & Modular Layout**:
   - Modular hierarchy: `<Titlebar />`, `<Sidebar />` (Asset Vault & Modifier Inspector), `<Preview />`, and `<Timeline />` multi-track scrubber.
   - Zero-waste state-driven rendering: Viewport monitor operates at 0 FPS during idle state and repaints only when the playhead moves, clips are trimmed, or modifiers change.
3. **Client-Side WebCodecs Video Export (`MediabunnyClientSink`)**:
   - Direct browser video export using `MediabunnyClientSink` from `@acc/ir/client` powered by Mediabunny and browser-native `VideoEncoder` (WebCodecs).
   - Renders frames offscreen via HTML5 `<canvas>`, encodes in real-time, and muxes to an in-memory MP4 Blob target with direct browser file download.
   - Interactive progress bar with immediate client-side export cancellation without process or memory leaks.
4. **Local Asset Ingestion**:
   - Direct handling of local video and audio media files via browser File API and Object URLs.

---

## 15. Advanced Visual & Core Rendering Engine (Iteration 5)

Elevates the core rendering, VFX, SFX, and 3D depth synthesis capabilities across server and browser environments:

1. **Depth-Aware Dynamic Relighting & Normal Map Shading (`@acc/effect-engines`, `@acc/ir`)**:
   - `SurfaceNormalGenerator`: 3x3 Sobel gradient convolution on monocular depth buffers deriving unit surface normal vector fields $\mathbf{N} = \text{normalize}([-G_x, -G_y, 1.0/\text{strength}])$ in contiguous `Float32Array` buffers.
   - Zero-allocation Blinn-Phong lighting kernel with diffuse, specular glossiness, ambient, and soft rim feathering $(1 - |N_z|)$.
   - Silhouette alpha gating ($A / 255$) preventing specular highlight bleeding onto background transparency.
   - Non-destructive additive screen compositing (`screen` / `lighter`) integrated into `Depth3DPlugin`.
2. **Cinematic 3D Camera Path Sequencer & Dynamic Rack Focus (`vfx/camera_3d`)**:
   - `CameraSplineInterpolator`: Cubic Catmull-Rom & Bezier 3D trajectories evaluating position $\mathbf{P}(t)$, look-at target $\mathbf{T}(t)$, roll $\theta(t)$, $\text{FOV}(t)$, and focal depth plane $Z_{\text{focal}}(t)$.
   - `Camera3DPlugin`: Sequence-level 3D camera modifier applying affine projection matrices and dynamic alpha crossfades between pre-blurred focal zones (sharp, near-blur, far-blur) strictly adhering to **ZERO-ALLOC-FRAME-LOOP**.
3. **Hardware-Accelerated Shader & Particle VFX Pipeline (`@acc/effect-engines`)**:
   - `SIMDParticleComputeEngine`: Contiguous `Float32Array` particle buffer (11-float stride) supporting 20,000+ active particles at 60fps with $O(1)$ tail replacement and zero garbage collection churn.
   - `PostProcessingShaders`: Scanline-cached chromatic aberration, high-pass bloom/glow thresholding, and horizontal anamorphic lens flare streaks.
   - `CanvasAdapterFactory`: Dynamic auto-detection resolving GPU offscreen contexts where available with seamless fallback to `@napi-rs/canvas` in headless environments.
4. **Media Engine Strategy Pattern Isolation**:
   - Universal media operations route exclusively through `MediaEngineRegistry` across all 4 production engines (`bun-ffi`, `fluent-ffmpeg`, `mediabunny-server`, `mediabunny-client`) with zero raw unmanaged binary invocations.
