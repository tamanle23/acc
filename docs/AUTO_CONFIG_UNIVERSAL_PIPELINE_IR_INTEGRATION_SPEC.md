# Architecture & Specification: Universal `auto-config` Integration with `PipelineIR`

## 1. Executive Summary & Vision

The **Visual Storytelling Generator (ACC)** currently maintains `auto-config.ts` as an interactive, single-purpose CLI script specifically designed to scaffold `story-config.json` for Pipeline 4 (Generative Storytelling). While effective for local slideshow setups, it is tightly coupled with terminal prompts (`@clack/prompts`) and cannot serve headless worker tasks, autonomous Conductor agents, or the wider omnichannel pipeline ecosystem (Pipelines 1–6, 250 content variations).

This specification establishes the architectural blueprint to transform `auto-config` into the **Universal Content Ingestion & Auto-Scaffolding Engine**. Driven by robust **Gang of Four (GoF) design patterns** and enterprise software best practices, the upgraded engine:
1. **Decouples Scanning from UI**: Separates media discovery and heuristic analysis into a headless core library (`@acc/core`).
2. **Auto-Classifies Pipelines**: Automatically infers whether input assets represent a digest (Pipeline 1), data table (Pipeline 2), repurposed video (Pipeline 3), generative story (Pipeline 4), rule-based logic (Pipeline 5), or ambient loop (Pipeline 6).
3. **Emits Canonical Universal ASTs**: Synthesizes standard **`PipelineIR` (v3.0.0)** accompanied by fine-grained **`FineGrainedVideoDirectorConfig`** envelopes.
4. **Guarantees Zero Regressions**: Emits legacy `story-config.json` via transparent adapters, preserving 100% backward compatibility for all existing scripts and test suites.

---

## 2. Core Architectural Principles & Best Practices

To guarantee that the solution is **easy to maintain, easy to scale, and regression-free**, the implementation adheres strictly to the following standards:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Design Best Practices SSOT                        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Single Responsibility (SRP): Probing, classifying, building, and    │
│    CLI rendering reside in dedicated, decoupled modules.               │
│ 2. Open-Closed Principle (OCP): New pipeline classifiers and media     │
│    probers are added via strategy interfaces without editing core.     │
│ 3. Headless-First Architecture: Every engine capability is runnable    │
│    programmatically via API before being surfaced in terminal UI.      │
│ 4. State Immutability: Input directories and discovered assets are     │
│    never modified in-place; all emitted ASTs are pure transforms.      │
│ 5. Defensive Execution: Probing corrupted or missing media invokes     │
│    graceful fallbacks rather than terminating execution.               │
│ 6. Deterministic Output Parity: Identical directory assets and         │
│    seed parameters produce bit-identical PipelineIR documents.         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Enterprise Design Patterns Matrix

```
                        ┌───────────────────────────────┐
                        │    AutoConfigEngineFacade     │  <-- [Facade Pattern]
                        │   (Unified High-Level API)    │
                        └──────────────┬────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  AssetProber     │         │ PipelineClassifier│        │ PipelineIR       │
│  Chain           │         │ Strategy Registry │        │ Builder          │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ [Chain of Resp]  │         │ [Strategy Pattern│        │ [Builder Pattern]│
│ • ImageProber    │         │ • P1: Summarizer │        │ • addChunks()    │
│ • VideoProber    │         │ • P2: Templating │        │ • setAudioDsp()  │
│ • AudioProber    │         │ • P3: Recycler   │        │ • setDirector()  │
│ • ScriptAligner  │         │ • P4: Story      │        │ • setHints()     │
└──────────────────┘         │ • P5: RuleLogic  │         └──────────────────┘
                             │ • P6: AmbientLoop│
                             └──────────────────┘
                                       │
                                       ▼
                             ┌──────────────────┐
                             │ LegacyBridge     │  <-- [Adapter Pattern]
                             │ Adapter          │
                             ├──────────────────┤
                             │ Emits backward-  │
                             │ compatible       │
                             │ story-config.json│
                             └──────────────────┘
```

### Pattern 1: Facade Pattern (`AutoConfigEngineFacade`)
- **Intent**: Provides a clean, simplified entry point for all consumers (Interactive CLI, Conductor Workers, Headless Microservices, REST APIs).
- **Interface**:
  ```typescript
  export class AutoConfigEngineFacade {
    public static async scaffoldDirectory(
      dirPath: string,
      options?: AutoScaffoldOptions
    ): Promise<AutoScaffoldResult>;
  }
  ```

### Pattern 2: Chain of Responsibility (`MediaAssetProberChain`)
- **Intent**: Progressively inspects files without massive switch statements. Each handler inspects specific file extensions, extracts technical metadata (dimensions, duration, codecs, waveforms), and decorates an aggregated `DiscoveredAssetManifest`.
- **Handlers**:
  - `ImageProberHandler`: Dimensions, aspect ratio, color palette, alpha channel.
  - `VideoProberHandler`: Duration, FPS, codec, resolution, audio presence.
  - `AudioProberHandler`: Sample rate, duration, channels, RMS loudness, speech classification.
  - `ScriptProberHandler`: Extracts raw text lines, word counts, and subtitle timestamps.

### Pattern 3: Strategy Pattern (`IPipelineClassifierStrategy`)
- **Intent**: Decouples the decision logic that assigns input media to one of the 6 Canonical Pipelines.
- **Contract**:
  ```typescript
  export interface IPipelineClassifierStrategy {
    readonly pipelineId: '1' | '2' | '3' | '4' | '5' | '6';
    readonly name: string;
    calculateConfidence(manifest: DiscoveredAssetManifest): number; // 0.0 to 1.0
    generateArchetypeDefaults(manifest: DiscoveredAssetManifest): ArchetypeScaffoldConfig;
  }
  ```
- Adding support for a new data format or pipeline requires registering a single new strategy class without touching existing code.

### Pattern 4: Builder Pattern (`PipelineIRBuilder`)
- **Intent**: Constructs complex, deeply nested `PipelineIR` (v3.0.0) documents step-by-step with schema validation, preventing invalid intermediate states.
- **Methods**:
  ```typescript
  const ir = new PipelineIRBuilder('generative-storytelling')
    .setTitle(manifest.suggestedTitle)
    .addChunk(chunkDef)
    .setAudioComposition({ ducking: { enabled: true, attenuationDb: -14 } })
    .setDistributionHints({ targetAspectRatios: ['9:16', '16:9'] })
    .build();
  ```

### Pattern 5: Factory Pattern (`DirectorPresetFactory`)
- **Intent**: Translates detected visual genres and platform goals into production-grade `FineGrainedVideoDirectorConfig` envelopes.
- **Specializations**:
  - `createCinematicStoryPreset()`: 3D parallax sandwich, Ken Burns alternating zoom, teal-orange LUT, subtle ambient dust.
  - `createDataVisualizerPreset()`: Leader-zoom camera curve, glowing UI lines, minimal bottom typography.
  - `createTalkingHeadPreset()`: Smart-crop reframe, emphasis punch-ins, audio waveform visualization.

### Pattern 6: Adapter Pattern (`AutoConfigLegacyBridgeAdapter`)
- **Intent**: Ensures 100% backward compatibility by translating newly built `PipelineIR` and director configs back into legacy `StoryConfig` (`story-config.json`) structures without loss.

---

## 4. Heuristic Pipeline Classification Rules Matrix

When `auto-config` scans a directory, the `PipelineClassifierRegistry` evaluates confidence scores across all strategies:

| Input Directory Signature | Top Strategy Matched | Target Pipeline | Auto-Generated Archetype Directives |
| :--- | :--- | :--- | :--- |
| Single long video file (`> 60s`, MP4/MOV) + voice track | `RepurposingClassifierStrategy` | **Pipeline 3** (Repurposing Recycler) | Slices viral 30s chunks; configures 9:16 smart-crop, face tracking, and kinetic subtitles. |
| CSV / JSON data file (`rows > 5`) + optional logos | `DbTemplatingClassifierStrategy` | **Pipeline 2** (DB-Templating) | Generates dynamic chart race or leaderboard chunks; configures smooth cubic-bezier bar curves. |
| Multiple text articles / Markdown files (`.md`/`.txt`) | `ScraperSummarizerClassifierStrategy` | **Pipeline 1** (Scraper & Summarizer) | Chunks text into executive summaries; stages VieNeu-TTS voiceover generation. |
| Audio stems / Looping music + abstract backgrounds | `AmbientLoopClassifierStrategy` | **Pipeline 6** (Ambient Loops) | Seamless loop crossfading, audio spectrum visualizers, particle overlay shaders. |
| Multiple ordered images (`1.png`, `2.png`) + voice clips | `GenerativeStoryClassifierStrategy` | **Pipeline 4** (Generative Storytelling) | Classical scene sequencing with 3D parallax depth, frame breaker, and transition crossfades. |
| Structured rule logic / Condition definitions | `RuleLogicClassifierStrategy` | **Pipeline 5** (Rule-Logic) | Procedural branching logic and condition triggers. |

---

## 5. Technical Specification & Interfaces

### A. Core Engine Types (`packages/core/src/autoconfig/types.ts`)

```typescript
import type { PipelineIR, FineGrainedVideoDirectorConfig } from '@acc/ir';
import type { ContentModality } from '../conductor/interfaces/IContentTaskStrategy';

export interface DiscoveredAssetManifest {
  baseDir: string;
  visualFiles: Array<{
    relativePath: string;
    absolutePath: string;
    type: 'image' | 'video';
    width?: number;
    height?: number;
    durationMs?: number;
  }>;
  audioFiles: Array<{
    relativePath: string;
    absolutePath: string;
    durationMs?: number;
    channels?: number;
    isMusic?: boolean;
    isVoiceover?: boolean;
  }>;
  scriptFiles: Array<{
    relativePath: string;
    absolutePath: string;
    content: string;
    lines: string[];
  }>;
  dataFiles: Array<{
    relativePath: string;
    absolutePath: string;
    format: 'csv' | 'json';
  }>;
}

export interface AutoScaffoldOptions {
  pipelineOverride?: 'auto' | '1' | '2' | '3' | '4' | '5' | '6';
  requestedModalities?: ContentModality[];
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  fps?: 24 | 30 | 60;
  enableDepth3D?: boolean;
  enableTransitions?: boolean;
  exportLegacyStoryConfig?: boolean;
  autoTranscribeWhisper?: boolean;
  dryRun?: boolean;
}

export interface AutoScaffoldResult {
  pipelineId: string;
  pipelineIR: PipelineIR;
  videoConfig: FineGrainedVideoDirectorConfig;
  suggestedModalities: ContentModality[];
  legacyStoryConfig?: Record<string, unknown>;
  savedFiles: {
    pipelineIRPath?: string;
    omnichannelConfigPath?: string;
    storyConfigPath?: string;
  };
}
```

### B. High-Level Engine Facade (`packages/core/src/autoconfig/AutoConfigEngineFacade.ts`)

```typescript
export class AutoConfigEngineFacade {
  public static async scaffoldDirectory(
    dirPath: string,
    options: AutoScaffoldOptions = {}
  ): Promise<AutoScaffoldResult> {
    // 1. Run Chain of Probers to discover and inspect all media
    const proberChain = MediaAssetProberChain.createDefault();
    const manifest = await proberChain.probeDirectory(dirPath);

    // 2. Classify Pipeline Archetype via Strategy Registry
    const classifier = PipelineClassifierRegistry.resolve(manifest, options.pipelineOverride);
    const archetypeDefaults = classifier.generateArchetypeDefaults(manifest);

    // 3. Construct Canonical PipelineIR AST via Builder
    const builder = new PipelineIRBuilder(classifier.pipelineId);
    builder.populateFromManifest(manifest, archetypeDefaults);
    const pipelineIR = builder.build();

    // 4. Synthesize Fine-Grained Video Director Config via Factory
    const videoConfig = DirectorPresetFactory.createForArchetype(
      classifier.pipelineId,
      manifest,
      options
    );

    // 5. Generate Legacy StoryConfig via Adapter (if requested)
    let legacyStoryConfig: Record<string, unknown> | undefined;
    if (options.exportLegacyStoryConfig !== false) {
      legacyStoryConfig = AutoConfigLegacyBridgeAdapter.toStoryConfig(
        pipelineIR,
        videoConfig,
        manifest
      );
    }

    return {
      pipelineId: classifier.pipelineId,
      pipelineIR,
      videoConfig,
      suggestedModalities: archetypeDefaults.suggestedModalities,
      legacyStoryConfig,
      savedFiles: {},
    };
  }
}
```

---

## 6. CLI Upgrades & User Experience

The interactive CLI (`auto-config.ts`) becomes a thin, intuitive wrapper over `AutoConfigEngineFacade`:

```
┌─────────────────────────────────────────────────────────────┐
│             ACC Auto-Config Engine (v3.0)                   │
└─────────────────────────────────────────────────────────────┘
✔ Discovered 8 images, 1 BGM track, and 1 script file.
✔ Heuristic Classification: Pipeline 4 (Generative Storytelling) [98% Confidence]

? Select Output Architecture:
  ❯ (1) Omnichannel Universal PipelineIR (Recommended - Video, Social, Audio)
    (2) Legacy story-config.json (Single Video only)
    (3) Both (Dual-Mode Parity)

? Select Deliverable Modalities:
  [✔] Video (9:16 TikTok / Reels / Shorts)
  [✔] Social Media (Twitter Thread & LinkedIn Post)
  [✔] Audio Podcast Clip
  [ ] Static Web Article

✔ Synthesizing PipelineIR (v3.0.0)... Done
✔ Synthesizing Fine-Grained Director Config (3D Sandwich + Ken Burns)... Done
✔ Successfully saved:
  - ./pipeline-ir.json
  - ./omnichannel-config.json
  - ./story-config.json (Legacy Bridge)

You can now render instantly via:
  bun run cli.ts ./my-project --omnichannel
```

---

## 7. Zero-Regression & Verification Strategy

To guarantee that this enhancement introduces **zero breaking changes** to existing production flows:

1. **Dual Emission Guarantee**:
   Whenever `auto-config` runs without explicit flags, it generates both `pipeline-ir.json` and the classic `story-config.json`. Any legacy script running `bun run cli.ts <folder>` continues working identically.
2. **Golden Master AST Testing**:
   Formal regression tests compare `sample-story/story-config.json` generated by legacy logic against the output of `AutoConfigLegacyBridgeAdapter` to guarantee bit-for-bit key/value parity.
3. **Dedicated Test Suite in `/autogenerated-tests/autoconfig/`**:
   - `classifier_strategies.test.ts`: Verifies classification confidence across synthetic directories for all 6 pipelines.
   - `pipeline_ir_builder.test.ts`: Validates chunk sequencing, timestamps, and audio ducking envelopes.
   - `director_preset_factory.test.ts`: Tests fine-grained 3D depth, Ken Burns, and LUT generation.
   - `legacy_bridge_adapter.test.ts`: Verifies complete two-way fidelity between `StoryConfig` and `PipelineIR`.
   - `auto_config_facade_e2e.test.ts`: End-to-end execution on real asset directories.

---

## 8. Implementation Roadmap

| Phase | Milestone | Deliverables |
| :---: | :--- | :--- |
| **Phase 1** | **Headless Prober Chain & Manifest** | Implement `DiscoveredAssetManifest` and `MediaAssetProberChain` in `@acc/core`. |
| **Phase 2** | **Classifier Strategies & Registry** | Implement `IPipelineClassifierStrategy` for Pipelines 1–6 and `PipelineClassifierRegistry`. |
| **Phase 3** | **Builder & Director Preset Factory** | Implement `PipelineIRBuilder` and `DirectorPresetFactory` generating canonical `PipelineIR` and `videoConfig`. |
| **Phase 4** | **Legacy Bridge Adapter** | Implement `AutoConfigLegacyBridgeAdapter` to losslessly emit `story-config.json`. |
| **Phase 5** | **Facade & CLI Modernization** | Implement `AutoConfigEngineFacade` and refactor `auto-config.ts` into a clean Clack UI wrapper. |
| **Phase 6** | **Quality Engineering & Documentation** | Add test suite in `/autogenerated-tests/autoconfig/`, verify master test suite, update `README.md` and guides. |
