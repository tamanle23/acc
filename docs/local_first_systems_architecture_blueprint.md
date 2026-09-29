# Local-First Content Factory: Architectural Blueprint

This document outlines the technical implementation architecture for the 6 Core Pipelines. The focus is strictly on **Local-First, Native Execution**—eliminating reliance on third-party APIs (OpenAI, ElevenLabs) and heavy UI wrappers (ComfyUI) in favor of high-performance, code-driven inference and orchestration.

## System-Wide Core Stack

Before detailing individual pipelines, this is the foundational stack that supports all operations, utilizing a robust dual-runtime approach:

*   **Orchestration Engine:** **Conductor OSS** (formerly Netflix Conductor). Highly scalable microservices orchestration engine used to manage complex DAG (Directed Acyclic Graph) workflows, state persistence, timeouts, and distributed task queues across all our workers.
*   **Runtime & API Layer (Dual Stack):**
    *   **Java (Spring Boot / Quarkus):** The backbone for business-related tasks. Handles CRUD operations, database transactions, user management, external API integrations (social publishing), and acts as the primary workflow coordinator for Conductor.
    *   **Bun (TypeScript):** Dedicated specifically to high-performance content rendering, media assembly, file I/O, and acting as the bridge to the AI inference engines.
*   **Database Layer:** `PostgreSQL` (JSONB) for application state and Conductor metadata, paired with `Redis` (for Conductor queues) and `Elasticsearch` (for Conductor workflow execution indexing).
*   **Inter-Process Communication (IPC):** Python sidecar workers (running heavy AI models) expose high-throughput **gRPC** endpoints. Bun acts as the gRPC client, allowing for ultra-low latency and strictly typed transfer of heavy binary data (image tensors, audio buffers) between Node/V8 and Python.

---

## Pipeline 1: Event-Driven Scraper & Summarizer

**Goal:** Ingest external data, run it through a local LLM to extract structured insights, and store it.

**Architecture:**
1.  **Ingestion Worker (Java + Conductor):** A scheduled Conductor workflow triggers a Java task worker. The Java service handles the business logic of scraping targeted RSS feeds or APIs.
2.  **Native Inference Engine (vLLM / Llama.cpp):** 
    *   Host a quantized model (e.g., Llama-3.1-8B-Instruct GGUF) on a local GPU using **vLLM**.
    *   The Java service queries vLLM's local OpenAI-compatible API using structured JSON Grammar/Outlines to guarantee the response strictly matches a predefined JSON schema (e.g., `{ title, key_points, sentiment }`).
3.  **Storage:** Java writes the guaranteed JSON output directly to a Postgres `JSONB` column, completing the workflow and triggering downstream distribution tasks.

---

## Pipeline 2: Database Injection & Programmatic Templating

**Goal:** Generate massive amounts of 2D visual or HTML content instantly by injecting data into code-based templates without using generative AI.

**Architecture:**
1.  **Trigger (Conductor):** A workflow is triggered upon new rows entering the Postgres DB. The Java service queries the database and passes the structured payload to the rendering queue.
2.  **HTML/React Templating (Bun Worker):** 
    *   Conductor routes the rendering task to a **Bun worker**.
    *   Bun hydrates React components (like a comparison table or quote card) with the JSON payload.
3.  **Native Rendering Engine (Node-canvas / Puppeteer):**
    *   Bun uses `node-canvas` to draw text and shapes directly to a pixel buffer via C++ bindings, OR uses a local headless Chrome instance (`puppeteer-core`) to render the React HTML page and execute `page.screenshot()`. This produces crisp PNGs in milliseconds with zero GPU VRAM usage. Bun saves the file and returns the file URI to Conductor.

---

## Pipeline 3: Native Generative Assets

**Goal:** Create net-new media (Images and Audio) via code-driven diffusion and TTS models.

**Architecture:**
This pipeline heavily utilizes the **Bun $\rightarrow$ gRPC $\rightarrow$ Python** bridge.

1.  **Workflow Initiation:** Java initiates an asset generation workflow in Conductor, passing the calculated prompts to the Bun rendering queue.
2.  **Visual Worker (Diffusers via gRPC):**
    *   A Python sidecar runs Hugging Face's `diffusers` (e.g., `Flux.1-schnell` or `SDXL`) and exposes a gRPC server.
    *   Bun acts as the gRPC client, sending a strict Protobuf message with the prompt. The Python script executes the tensor operations and streams the resulting byte array back to Bun.
3.  **Audio Worker (F5-TTS / Kokoro-TTS via gRPC):**
    *   A separate Python sidecar runs **F5-TTS** for zero-shot voice cloning, exposed via gRPC.
    *   Bun sends the text payload over gRPC. The Python worker generates the waveform and streams the raw float array back to Bun. Bun encodes this into a `.wav` file on the local disk.

---

## Pipeline 4: Programmatic Timeline & Compositing

**Goal:** Assemble disparate assets (audio, images, text) into a cohesive `.mp4` video strictly via code.

**Architecture:**
1.  **Alignment Worker (Bun + Whisper.cpp gRPC):**
    *   Before rendering, Bun sends the generated audio buffer to a Python gRPC sidecar running **Whisper.cpp**.
    *   Python returns a Protobuf response containing word-level timestamps (exact start and end times for every spoken word).
2.  **Compositing Engine (Bun + Remotion):**
    *   **Remotion:** The Bun rendering worker passes the images, the `.wav` file, and the timestamp data into a React-based Remotion composition. Remotion calculates CSS animations (like dynamic subtitles popping up) frame-by-frame.
    *   Bun executes `npx remotion render` headlessly, which pipes Chromium frames into FFmpeg to output the final `.mp4`.
3.  **Completion:** Bun notifies Conductor the video is ready. Conductor triggers a Java worker to publish the MP4 to social APIs.

---

## Pipeline 5: Multi-modal Extraction & Repurposing

**Goal:** Automatically slice long-form content (e.g., 2-hour podcasts) into short-form viral clips.

**Architecture:**
1.  **Business Logic (Java):** Java downloads the source video and initiates the "Repurpose" Conductor workflow.
2.  **Semantic Chunking (Java + vLLM):** 
    *   Java gets the full transcript, sends it to the local vLLM instance, and prompts the model to identify the best 30-60 second "hooks," returning a JSON array of timestamps.
3.  **Local Computer Vision (Bun + OpenCV gRPC):**
    *   Java passes the timestamps to Bun. Bun calls a Python gRPC sidecar running **OpenCV / YOLOv8-face**.
    *   Python scans the specified timestamps, tracks the speaker's face coordinates, and returns a structured trajectory array to Bun.
4.  **Dynamic Cropping (Bun + FFmpeg):**
    *   Bun programmatically constructs an FFmpeg command using the `crop` filter. It dynamically adjusts the crop window based on the face coordinates from the gRPC call, converting a 16:9 video into a subject-centered 9:16 Short.

---

## Pipeline 6: Infinite Ambient & Procedural Loops

**Goal:** Maintain continuous 24/7 live streams (video and audio) with minimal hardware footprint.

**Architecture:**
Unlike the other pipelines which are discrete Conductor tasks, this is a long-running daemon.

1.  **Procedural Audio (Bun + MusicGen gRPC):**
    *   A Bun daemon maintains a continuous `while(true)` loop. It makes asynchronous gRPC calls to a Python sidecar running `Audiocraft` (MusicGen) to request short, 30-second audio chunks on demand.
    *   Bun seamlessly crossfades these chunks in memory.
2.  **Procedural Visual Worker (WebGL/Shaders):**
    *   Bun hosts a local HTML page running WebGL/GLSL shaders (e.g., procedural rain, stars). Puppeteer opens this page and captures the screen continuously using the `screencast` protocol, consuming almost zero CPU/GPU.
3.  **Streaming Engine (FFmpeg via stdin):**
    *   Bun pipes the continuous raw audio chunks and the WebGL visual frames directly into the `stdin` of an **FFmpeg** process.
    *   FFmpeg multiplexes the streams on the fly and pushes them out via RTMP directly to YouTube/Twitch servers.