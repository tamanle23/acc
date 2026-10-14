# 191. Master Integration Plan (Iteration 2) Phase 1: Narrative Scripting Frameworks (Option B)

## 1. Context & Motivation
Following the roadmap established in `docs/master_integration_plan_iteration2.md`, Phase 1 targets Pillar 1 (Option B): **Narrative Architecture & Master Scripting Frameworks**.
The goal is to connect the **6 Master Scripting Frameworks** (`docs/video-production-techniques/Six_Master_Scripting_Frameworks.md` and `deep_dive_the_6_master_video_scripting_frameworks.md`) directly into `@acc/core/autoconfig` without any deprecated external Conductor dependencies.

Each scripting framework provides deterministic pacing beats, A/V synchronization, camera motions, SFX cues, typography directives, and audio ducking curves to compile directly into `PipelineIR` and `VideoIR`.

## 2. Key Changes Made

### A. Core Scripting Interface & Domain Model (`packages/core/src/autoconfig/scripting/IScriptingFrameworkStrategy.ts`)
- Defined `ScriptBeat` with A/V pacing properties:
  - `name`: Narrative beat title (e.g. "The Cold Hook", "The Discovery", "The Ultimatum Hook").
  - `timingSec`: `[startSec, endSec]` monotonic timestamp intervals.
  - `audioRole`: `'hook' | 'friction' | 'metaphor' | 'turn' | 'climax' | 'resolution'`.
  - `visualPacing`: `'rapid_cut' | 'slow_burn' | 'kinetic_motion' | 'intimate_hold'`.
  - `sfxCue`, `cameraPreset`, `typographyStyle`, `description`, `narrationTemplate`.
- Defined `ScriptPromptPayload`: topic, target duration, raw content, style ID.
- Defined `IScriptingFrameworkStrategy`: `generateBeats`, `generateBeatsSync`, and `applyToPipelineIR`.

### B. Base Strategy Implementation (`packages/core/src/autoconfig/scripting/BaseScriptingFrameworkStrategy.ts`)
- Implemented `BaseScriptingFrameworkStrategy` adhering strictly to `STATE-IMMUTABILITY` and `DEFENSIVE-CODING`.
- Proportional duration scaling: automatically scales nominal beat durations to match requested `targetDurationSec` while maintaining contiguous monotonic intervals.
- `applyToPipelineIR`:
  - Deep-clones input `PipelineIR`.
  - Maps narrative beats to content chunks (replaces single fallback chunks or enriches existing multi-chunk manifests with beat metadata).
  - Automatically synthesizes chronological `sfxMarkers` in `audioComposition`.
  - Configures framework-specific audio ducking profiles (`attenuationDb`, `attackMs`, `releaseMs`).
  - Tags metadata with `framework:<id>`.

### C. 6 Concrete Framework Strategies (`packages/core/src/autoconfig/scripting/`)
1. **`MysteryBoxExplainerStrategy.ts`** (`mystery-box-explainer`):
   - Delays the core answer, constructs A/B-Story contrast with heavy bass drops and whiteboard/void resets.
   - Maps to: `immersive-documentary`, `sketchbook`, `isometric-system`, `geopolitical-atlas`, `visual-metaphor-engine`, `tactile-flatlay`, `white-room-void`.
2. **`BreadcrumbTrailDigitalStrategy.ts`** (`breadcrumb-trail-digital`):
   - Forensic digital investigation: fast UI clicks, terminal code blocks, window snapping, vacuum drop, receipts.
   - Maps to: `screenlife-narrative`, `terminal-code-block`, `evidence-receipts`, `reverse-engineer-teardown`, `internet-mystery`.
3. **`StakesAndEscalationStrategy.ts`** (`stakes-and-escalation`):
   - High-velocity challenge: ultimatum hook, kinetic rule sets, easy wins, the wall, buzzer beater.
   - Maps to: `hyper-retention-challenge`, `speedrun`, `bodycam-fps`, `top-down-gameplay`, `day-in-the-life-pov`.
4. **`IntimateConfessionalStrategy.ts`** (`intimate-confessional`):
   - Raw vulnerability, unbroken takes, gentle background bokeh, quiet editorial captions, deep empathetic audio ducking (-22dB).
   - Maps to: `parasocial-anchor`, `walking-monologue`, `intimate-confessional`, `directors-commentary`.
5. **`HistoricalParallelsStrategy.ts`** (`historical-parallels`):
   - Dual-timeline split screens, archival parchment LUTs, rhythmic historical mirrors, timelapses.
   - Maps to: `archival-collage`, `scrapbook-style`, `historical-parallels`, `kinetic-typography`, `dual-stimulus`, `infinite-fractal`.
6. **`ContrarianThesisStrategy.ts`** (`contrarian-thesis`):
   - Provocative thesis, myth-busting badges, forensic counter-evidence receipts, paradigm shift payoff.
   - Maps to: `video-essay`, `synthetic-broadcast`, `culinary-metaphor`, `contrarian-thesis`, `data-drama`.

### D. Framework Registry (`packages/core/src/autoconfig/scripting/ScriptingFrameworkRegistry.ts`)
- Central GoF Registry managing all 6 strategies with alias lookups (e.g. `thesis-and-proof`, `rhythm-and-flow`).
- `resolveForStyle(styleId)`: resolves framework strategy from 48 visual style IDs.
- `resolveForContent(topicOrContent, styleId)`: classifies narrative framework based on content keywords.

### E. PipelineIRBuilder & AutoConfigEngineFacade Integration
- Updated `packages/core/src/autoconfig/builders/PipelineIRBuilder.ts`:
  - Added `applyScriptingFramework(framework, beats?)` and `setScriptBeats(beats)`.
  - Automatically synthesizes initial chunks from beats when building text-only projects.
- Updated `packages/core/src/autoconfig/AutoConfigEngineFacade.ts`:
  - Added `options.scriptingFramework` and `options.targetDurationSec` to `AutoScaffoldOptions`.
  - Connected framework resolution and beat synthesis directly into `scaffoldDirectory`.
- Re-exported all scripting classes from `packages/core/src/autoconfig/index.ts` and `@acc/core`.

### F. Verification & QA Suite (`autogenerated-tests/scripting_frameworks_verification.test.ts`)
- Created comprehensive test suite verifying:
  - Strategy registration and alias resolution across all 6 strategies.
  - Video style ID mapping and keyword content classification.
  - Beat generation, monotonic timing, and proportional duration scaling.
  - Immutability preservation and chunk enrichment on `applyToPipelineIR`.
  - Direct integration with `PipelineIRBuilder` and `AutoConfigEngineFacade`.
- Results: **16 passed, 0 failed, 113 expect() assertions**.
- Retained in `autogenerated-tests/` per `AUTOGENERATED-TESTS-MANDATE`.

## 3. Impact & Zero Regression
- Zero regressions across existing autoconfig tests (**55 passed across 6 files**).
- Zero regressions across schema and sample tests (**10 passed across 2 files**).
- Complies fully with `STATE-IMMUTABILITY`, `ZERO-REGRESSION`, and `NO-STUBS-ORPHANED-CODE`.
