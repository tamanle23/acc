# Master Implementation Plan: Concrete Strategy Implementations for All 250 Content Variations

## Executive Summary & Problem Context
The ACC multi-pipeline engine maps **250 content variations** across **5 publishing formats** (Static Web, Social, Video, Audio, Interactive HTML) and **6 Canonical Pipelines** (`Scraper`, `DBTemplating`, `Repurposing`, `GenerativeStory`, `RuleLogic`, `AmbientStream`).
While the interface contract `IContentTaskStrategy<TInput, TOutput>` has been defined in `packages/core/src/conductor/interfaces/IContentTaskStrategy.ts` and the Universal Video IR rendering engine is fully stabilized (Phases 1–6 complete), there are currently **zero concrete strategy implementations** and no central strategy registry.

This plan details the design, taxonomy, and phased implementation of all 250 concrete content strategies using the Gang of Four (GoF) **Strategy + Registry + Template Method Pattern**.

---

## 1. Architectural Design & Taxonomy

### 1.1 The Anti-Pattern to Avoid: 250 Repetitive Boilerplate Classes
Creating 250 standalone classes each with 100+ lines of duplicated fetch/transform logic would lead to massive maintenance overhead.
Instead, we leverage **Domain Template Base Strategies** (Template Method Pattern) grouping content types by processing archetypes:

```
                      [ IContentTaskStrategy<TInput, TOutput> ]
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   │                                             │
      [ BaseContentTaskStrategy ]                  [ ContentStrategyRegistry ]
                   │
    ┌──────────────┼──────────────┬──────────────┬──────────────┬──────────────┐
    │              │              │              │              │              │
[ScraperNews] [DBInfographic] [Repurposing]  [Generative]   [RuleLogic]   [AmbientAudio]
  Archetype      Archetype      Archetype      Archetype      Archetype     Archetype
    │              │              │              │              │              │
 Items 1-40    Items 41-85   Items 86-130   Items 131-180  Items 181-215  Items 216-250
```

### 1.2 Core Class Hierarchy & Registry Contract

```typescript
// packages/core/src/conductor/strategies/ContentStrategyRegistry.ts
export class ContentStrategyRegistry {
  private static strategies = new Map<string, IContentTaskStrategy<any, any>>();

  public static register(strategy: IContentTaskStrategy<any, any>): void {
    this.strategies.set(strategy.contentTypeId, strategy);
  }

  public static get(contentTypeId: string): IContentTaskStrategy<any, any> | undefined {
    return this.strategies.get(contentTypeId);
  }

  public static getByPipeline(pipelineId: string): IContentTaskStrategy<any, any>[] {
    return Array.from(this.strategies.values()).filter(s => s.pipelineId === pipelineId);
  }

  public static getAll(): IContentTaskStrategy<any, any>[] {
    return Array.from(this.strategies.values());
  }
}
```

### 1.3 Concrete Content Type Metadata Specification
Each strategy exposes:
1. `contentTypeId`: Canonical identifier (e.g., `item_001_daily_industry_digest`, `item_042_barchart_race`).
2. `pipelineId`: Core pipeline ('1' - '6').
3. `targetModality`: Target exporter ('static-web' | 'social' | 'video' | 'audio' | 'interactive-web').
4. `feasibility`: Tier A (95-100%), Tier B (80-90%), Tier C (60-75%), Tier D (<60%).
5. `interventionStage`: 'Before' | 'In the Middle' | 'After'.
6. `process(ctx: UnifiedPipelineContext<TInput>): Promise<TOutput>`: Generates or transforms into `PipelineIR` or modality output.

---

## 2. Breakdown of the 250 Content Variations Across 6 Phases

### Phase 1: Core Foundation & Format 1 (Static Web CMS - Items 1 to 50)
* **Pipeline Focus:** Pipeline 1 (News/Data Ingestion), Pipeline 2 (DB Specs/Comparisons), Pipeline 5 (Reference Guides).
* **Target Modality:** `static-web` (Markdown, SSG, HTML, Ghost/WordPress payloads).
* **Deliverables:**
  - `BaseContentTaskStrategy` and `ContentStrategyRegistry`.
  - Strategy implementations for:
    - Items 1–10: Real-time digests, crypto recap, real estate, weather, startup funding, regulatory updates.
    - Items 11–20: Programmatic SEO comparisons (A vs B, Top 10, coupon aggregator, price history).
    - Items 21–30: Glossary terms, math/physics reference, history on this day, code snippet library.
    - Items 31–40: Travel itineraries, restaurant reviews, flight drops, non-fiction book summaries.
    - Items 41–50: Product comparison matrices, specs tables, FAQ databases, changelogs.
  - Automated tests validating AST compilation for Items 1–50.

### Phase 2: Format 2 (Social Media Automation - Items 51 to 100)
* **Pipeline Focus:** Pipeline 1 (Alerts & Tickers), Pipeline 2 (Quote Cards & Tables), Pipeline 4 (Generative Memes/Affirmations).
* **Target Modality:** `social` (Twitter/X threads, LinkedIn carousels, Instagram quote cards).
* **Deliverables:**
  - Items 51–60: Bite-sized quotes, tweet threads from articles, carousel slide decks.
  - Items 61–70: Social comparison cards, weekly digest slides, stat callouts.
  - Items 71–80: Meme templates, customer testimonials, community highlights.
  - Items 81–90: Real-time price threshold alerts, stock breakouts, sports tickers, SaaS status alerts.
  - Items 91–100: Flash discount codes, affiliate drops, micro-horoscopes, AI hot takes.
  - Automated tests validating social thread & card AST generation for Items 51–100.

### Phase 3: Format 3 (Short-Form & Long-Form Video - Items 101 to 150)
* **Pipeline Focus:** Pipeline 3 (Repurposing Clips), Pipeline 4 (Generative Storytelling), Pipeline 2 (Bar Chart Races).
* **Target Modality:** `video` (Direct compilation to `VideoIRDocument` via `PipelineIRToUniversalIRAdapter`).
* **Deliverables:**
  - Items 101–110: Faceless Reddit TTS shorts, creepypasta tales, horror stories, daily tarot draws.
  - Items 111–120: Bar chart races, financial comparisons, split-screen comparisons, quiz videos.
  - Items 121–130: 3D Depth parallax stories, historical re-enactments, science documentations.
  - Items 131–140: Podcast shorts auto-cropping (YOLO face tracking + Whisper karaoke).
  - Items 141–150: Ambient lo-fi relaxing loops, shader visualizers, quote loops.
  - Automated tests verifying Universal Video IR compilation for all video strategies.

### Phase 4: Format 4 (Podcasts & Audio Production - Items 151 to 200)
* **Pipeline Focus:** Pipeline 3 (Audio Extraction/Speech), Pipeline 4 (Dramatic Narration), Pipeline 6 (Binaural & Ambient).
* **Target Modality:** `audio` (Direct to `AudioExporter`, bypasses Video IR).
* **Deliverables:**
  - Items 151–160: Solo podcasts, debate podcasts, AI interviewer discussions.
  - Items 161–170: Lo-fi beat generators, guided meditations, yoga flow audio, dynamic nature sounds.
  - Items 171–180: Public domain audiobooks, web novel narrations, creepypasta soundscapes, bedtime stories.
  - Items 181–190: Spaced repetition drills, language shadowing audio, traffic & emergency alerts.
  - Items 191–200: Workout interval cues, Pomodoro reminders, 3D binaural ASMR, infinite white noise.
  - Automated tests verifying multi-track audio compositions and ducking parameters.

### Phase 5: Format 5 (Interactive Web & Games - Items 201 to 250)
* **Pipeline Focus:** Pipeline 4 (Branching Fiction), Pipeline 5 (Calculators & Logic), Pipeline 2 (Interactive D3/GSAP Scrollytelling).
* **Target Modality:** `interactive-web` (HTML5, D3.js, Web Components, Three.js).
* **Deliverables:**
  - Items 201–210: Choose Your Own Adventure trees, web visual novels, text RPG state buffers, escape rooms.
  - Items 211–220: Journalistic scrollytelling, interactive timelines, 3D WebGL news globes, stock heatmaps.
  - Items 221–230: Financial ROI calculators, mortgage calculators, tax estimators, calorie counters.
  - Items 231–240: Trivia quizzes, interactive periodic tables, election prediction maps.
  - Items 241–250: Interactive code sandboxes, algorithm visualizers, web-comic carousels.
  - Automated tests verifying branching interactive node graphs and mathematical calculators.

### Phase 6: Conductor Task Worker Binding, CLI Integration & End-to-End Stress Testing
* **Deliverables:**
  - `UniversalStrategyTaskCommand`: Generic Conductor worker command that dynamically routes incoming task definitions to the registered `IContentTaskStrategy`.
  - Integration with `TaskWorkerFactory` and `ConductorWorkerPoller`.
  - CLI command `bun run cli.ts generate --content-type <id>` supporting all 250 content type keys.
  - Master test suite verifying 100% registration coverage (250/250 strategies instantiated and tested).

---

## 3. Implementation Plan Task Tracking

- [ ] **Phase 1: Foundation & Static Web Strategies (Items 1–50)**
  - [ ] Implement `BaseContentTaskStrategy` and `ContentStrategyRegistry` in `@acc/core`.
  - [ ] Implement Strategy Archetypes: `ScraperDigestStrategy`, `DBComparisonStrategy`, `RuleReferenceStrategy`.
  - [ ] Scaffold concrete strategies for Content Types 1–50.
  - [ ] Test suite in `autogenerated-tests/strategies/strategies_phase1_static_web.test.ts`.
- [ ] **Phase 2: Social Media Strategies (Items 51–100)**
  - [ ] Implement Social Archetypes: `SocialThreadStrategy`, `QuoteCardStrategy`, `AlertTickerStrategy`.
  - [ ] Scaffold concrete strategies for Content Types 51–100.
  - [ ] Test suite in `autogenerated-tests/strategies/strategies_phase2_social.test.ts`.
- [ ] **Phase 3: Video Strategies & Universal Video IR Routing (Items 101–150)**
  - [ ] Implement Video Archetypes: `FacelessShortsStrategy`, `ChartRaceVideoStrategy`, `RepurposedClipStrategy`.
  - [ ] Scaffold concrete strategies for Content Types 101–150 with Universal IR compilation.
  - [ ] Test suite in `autogenerated-tests/strategies/strategies_phase3_video.test.ts`.
- [ ] **Phase 4: Audio & Podcast Strategies (Items 151–200)**
  - [ ] Implement Audio Archetypes: `PodcastAudioStrategy`, `AudiobookNarratorStrategy`, `AmbientSoundscapeStrategy`.
  - [ ] Scaffold concrete strategies for Content Types 151–200.
  - [ ] Test suite in `autogenerated-tests/strategies/strategies_phase4_audio.test.ts`.
- [ ] **Phase 5: Interactive Web & Logic Strategies (Items 201–250)**
  - [ ] Implement Interactive Archetypes: `BranchingGameStrategy`, `ScrollytellingStrategy`, `CalculatorWidgetStrategy`.
  - [ ] Scaffold concrete strategies for Content Types 201–250.
  - [ ] Test suite in `autogenerated-tests/strategies/strategies_phase5_interactive.test.ts`.
- [ ] **Phase 6: Conductor Task Worker Integration & Complete System Verification**
  - [ ] Bind `ContentStrategyRegistry` to Conductor `UniversalStrategyTaskCommand`.
  - [ ] Expose CLI content generation runner for all 250 strategies.
  - [ ] Run full 250-strategy audit test suite verifying 0 unmapped content types.
  - [ ] Backlog and History archival.
