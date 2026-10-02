# Pipeline 1: Event-Driven Scraper & Summarizer - Implementation & Developer Guide

**Document Status:** Operational Guide & Technical Documentation
**Target Architecture:** ACC (Automated Content Creator) Multi-Pipeline Engine v3.0
**Location:** `apps/cli/src/pipelines/01-scraper`

---

## 1. Overview & Goal

**Pipeline 1 (Event-Driven Scraper & Summarizer)** processes real-time news alerts, market events, web URLs, and RSS/webhook feeds. It extracts key insights using zero-hallucination local LLMs, synthesizes spoken voiceovers via Kokoro TTS, renders 1080x1920 vertical breaking news alert cards, and fans out across 4 distribution channels concurrently (Video Shorts, Audio Podcasts, Social Cards, and Static Web Markdown).

This implementation strictly leverages **4 Core Design Patterns** for decoupled, regression-free execution.

---

## 2. Design Patterns Architecture

```
 ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 │                              PIPELINE 1 ORCHESTRATION                                  │
 ├───────────────┬──────────────────┬──────────────────────┬──────────────────┬────────────┤
 │ 1. INGEST     │ 2. SUMMARIZE     │ 3. TTS SYNTHESIS     │ 4. VFX STITCH    │ 5. EXPORT  │
 └──────┬────────┴────────┬─────────┴──────────┬───────────┴────────┬─────────┴──────┬─────┘
        │                 │                    │                    │                │
 ┌──────▼──────┐   ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐  ┌──────▼──────┐
 │ Scraper     │   │ vLLM / Local│      │ Kokoro TTS  │      │ Lower-Third │  │ 4-Way       │
 │ Engine      ├──►│ LLM Extraction     │ Synthesis   ├─────►│ Ticker      ├──► Exporter │
 │ (Bounded Q) │   │ Stage       │      │ (Flyweight) │      │ Command     │  │ Dispatcher  │
 └─────────────┘   └─────────────┘      └─────────────┘      └─────────────┘  └─────────────┘
                          │                    │                    │
                   ┌──────▼────────────────────▼────────────────────▼────────┐
                   │ Shared Asset Context                                    │
                   │   (AssetContext: text, audio, canvas card, IR)          │
                   └─────────────────────────────────────────────────────────┘
```

### 2.1. Producer-Consumer with Bounded Queue (`BoundedQueue`)
- **Role**: Prevents process RAM/OOM crashes when overwhelmed by burst feeds or high-frequency webhooks.
- **Class**: `BoundedQueue<IngestedEvent>` inside `ScraperEngine`.
- **Behavior**: Asynchronous backpressure throttles producers when queue capacity (default: 50) is reached.

### 2.2. Shared Context & Flyweight Pattern (`AssetContext` & `FlyweightModelRegistry`)
- **Role**: Eliminates duplicate media copies and manages VRAM/memory allocation for AI models.
- **Classes**: `AssetContext`, `FlyweightModelRegistry`.
- **Behavior**:
  - `AssetContext` stores metadata and references for `summary_json`, `narration_audio`, `alert_card`, and `canvas`.
  - `FlyweightModelRegistry` caches heavy model instances (e.g., `kokoro-tts`, `vllm-llama3`) and automatically unloads idle models when switching pipeline stages.

### 2.3. Command Pattern (`RenderLowerThirdTickerCommand`)
- **Role**: Encapsulates media editing and lower-third news ticker composition into dry-runnable, inspectable objects.
- **Class**: `RenderLowerThirdTickerCommand` (implements `VFXCommand`).
- **Behavior**: Validates background asset presence, computes CPU/VRAM execution cost, and compiles into FFmpeg `drawtext` filter graph nodes.

### 2.4. Pipeline Middleware Engine (`PipelineRunner`)
- **Role**: Executes workflow stages sequentially with defensive fault isolation.
- **Class**: `PipelineRunner` executing `IPipelineMiddleware` stages:
  1. `SummarizeStage`: Performs structured JSON extraction.
  2. `TTSStage`: Synthesizes spoken voiceover narration.
  3. `VFXCompositionStage`: Renders 1080x1920 breaking news card and enqueues ticker commands.
  4. `IRAssemblyStage`: Assembles canonical `PipelineIR` (schema v3.0.0).
  5. `ExporterStage`: Fans out across Video, Audio, Social, and Web exporters.

---

## 3. Class Structure & File Layout

| Path | Responsibility |
|:---|:---|
| `apps/cli/src/pipelines/01-scraper/ScraperEngine.ts` | Ingestion engine supporting manual events, URL fetching, and HTTP Webhook server with `BoundedQueue`. |
| `apps/cli/src/pipelines/01-scraper/ScraperPipeline.ts` | Pipeline middleware orchestrator driving the 5 pipeline stages. |
| `packages/core/src/VFXCommand.ts` | Includes `RenderLowerThirdTickerCommand` for news ticker filter compilation. |
| `packages/core/src/AssetContext.ts` | Shared immutable asset context & Flyweight model registry. |
| `packages/core/src/PipelineRunner.ts` | Middleware execution engine with defensive fault isolation. |

---

## 4. Usage Guide

### 4.1. Programmatic API

```typescript
import { ScraperEngine, ScraperPipeline } from '@acc/cli';
import { IPCFacade, FallbackAIStrategy } from '@acc/core';

// 1. Initialize Engine
const engine = new ScraperEngine(50); // Bounded queue capacity = 50

// 2. Ingest Event (Manual, URL, or Webhook)
const event = await engine.ingestManual(
  'BREAKING: Federal Reserve announces rate decision amidst economic shift.'
);

// 3. Execute Pipeline
const pipeline = new ScraperPipeline();
const { ir, exportResults } = await pipeline.run(event, './output/breaking_news');

console.log('Generated Story Title:', ir.metadata.title);
console.log('Video Output Path:', exportResults.video?.outputPath);
```

### 4.2. CLI Command Line Interface

```bash
# Run Pipeline 1 with inline or default config
acc run scraper

# Run Pipeline 1 with custom event JSON config
acc run scraper --config ./config/alert_event.json --out ./output/event_1

# Start HTTP Webhook Server for real-time ingestion
acc serve --port 3000
```

---

## 5. Testing & Verification

Unit and integration tests are maintained under `autogenerated-tests/`:

- `autogenerated-tests/phase4_scraper_summarizer.test.ts`: End-to-end integration test suite covering manual ingestion, HTTP webhook POST, TTS voiceover, card rendering, and exporter fan-out.
- `autogenerated-tests/pipeline1_design_patterns.test.ts`: Dedicated design patterns unit test suite verifying `BoundedQueue`, `RenderLowerThirdTickerCommand`, and `PipelineRunner` stage isolation.

Run test suites with Bun:

```bash
bun test autogenerated-tests/phase4_scraper_summarizer.test.ts autogenerated-tests/pipeline1_design_patterns.test.ts
```
