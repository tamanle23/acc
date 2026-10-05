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

### The Canonical Pipelines
1.  **`01-scraper`**: Ingests external data using `BoundedQueue` and `PipelineRunner`. Wraps external assets with `AssetContext`.
2.  **`02-db-templating`**: Populates dynamic visuals and data-driven graphics.
3.  **`03-repurposing`**: Transforms existing long-form content into short-form multi-platform clips using `AutoReframeStrategy`.
4.  **`04-generative-story`**: Orchestrates `ExtendedPipelineIR` v3.1 AST via `EditingPipelineOrchestrator` to coordinate story configs, platform safe zones, and video export rendering.
5.  **`05-rule-logic`**: Domain-specific logic application and branching logic handling.
6.  **`06-ambient-stream`**: Continuous, seamless generation and broadcast workflows.

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

### 4.3 `@acc/exporters` (Publishing Fan-Out)
Responsible for platform-compliant rendering.
*   Features `WidgetExporter` for interactive video branching.
*   Features `SpatialVideoExporter` for specialized AR/VR delivery formats.
*   Executes parallel multi-format outputs as defined by the Conductor `FORK_JOIN` nodes.

### 4.4 `apps/python-backend` (gRPC AI Subsystem)
A high-throughput backend managed by `uv` (`pyproject.toml`) wrapping heavy AI models behind a strict gRPC interface.
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
