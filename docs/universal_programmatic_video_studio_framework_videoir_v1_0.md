# Universal Programmatic Video Studio Framework: End-to-End Pipeline Topology & Multi-Archetype Architecture

Building a studio-grade programmatic video engine capable of powering everything from 15-second e-commerce motion posters to animated 3D/anime stories, SaaS product walkthroughs, financial data recaps, and AI avatar commerce requires separating **genre-specific creative intent** from **invariant media physics**.

By architecting the six-stage production lifecycle (**Idea $\rightarrow$ Script $\rightarrow$ Storyboard $\rightarrow$ Pre-Production $\rightarrow$ Production $\rightarrow$ Post-Production**) as a **Three-Tier, Multi-Dialect Media Compiler**, a single unified platform can orchestrate any video vertical while converging onto one deterministic execution binary: the **Universal Video Intermediate Representation (`VideoIR` V1.0-Stable)**.

---

## 1. Executive Mental Model: The Three-Tier Media Compiler

Inspired by modular compiler infrastructures (such as LLVM and MLIR), the Universal Studio Framework decouples upstream creative reasoning from downstream hardware rendering across three distinct architectural planes:

1. **Tier 1 — Polymorphic Frontend Dialects (Stages 1–2: Idea & Script):**
   Different video formats originate from vastly different data triggers and follow distinct narrative laws. Pluggable **Domain Ingestion Adapters** normalize raw inputs into a `StudioBriefEnvelope`, which **Dialect Compilers** transform into a vertical, beat-synchronous **`ScriptAST`**.
2. **Tier 2 — Universal Mid-Level Scene Graph & Lowering Compiler (Stages 3–4: Storyboard & Pre-Production):**
   Narrative beats are solved into a resolution-independent **`StoryboardAST`** composed of semantic layout anchors, virtual camera rigs, and declarative asset slots. During Pre-Production, an **Audio-First Fulfillment Engine** synthesizes and probes physical media assets, while a deterministic **Lowering Compiler** pivots the vertical scene graph into a horizontal, multi-track timeline.
3. **Tier 3 — Unified Deterministic Execution Backend (Stages 5–6: Production & Post-Production):**
   Every production archetype compiles down to a single, schema-validated **`VideoIR` (`video-ir.schema.json`)** document. The Production compositor and Post-Production muxer evaluate `meta`, `assets`, `tracks`, `sequences`, and `modifiers` as a stateless mathematical function of the discrete frame index $f \in [0, N_{\text{total}})$, streaming raw buffers directly into hardware encoders with $O(1)$ memory overhead.

### 1.1 Architectural State Progression Across the Six Compiler Passes

| Compiler Pass | Architectural Plane | Primary Artifact Emitted | Temporal Representation | Spatial & Asset State | Gatekeeper Validation Invariant |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Stage 1: Idea** | Semantic Control (Frontend) | `StudioBriefEnvelope` + `IRMeta` | Target duration budget & `globalFps` locked | `canvasSize` ($w \times h$), `colorSpace`, and safe-zone tokens locked | Validated dimensions, integer `globalFps` $\ge 1$, and verified Closed-World Knowledge Graph. |
| **Stage 2: Script** | Semantic Control (Frontend) | **`ScriptAST`** (Beat-Synchronous Tree) | Estimated beat durations & syllable budgets | Unbound semantic voiceover, SFX, and visual directives | Total syllable-to-time budget within $\pm 8\%$ of target duration; zero unverified claims. |
| **Stage 3: Storyboard** | Mid-Level Scene Graph | **`StoryboardAST`** (Spatial & Camera Graph) | Symbolic timing anchors (`lock_to_voiceover`, `lock_to_bgm_bars`) | Normalized $[0.0, 1.0]$ 9-grid zones, motion macros, and abstract `assetManifest` slots | Acyclic timing graph; zero typography/UI safe-zone bounding-box collisions. |
| **Stage 4: Pre-Production** | Relational Resolution & Lowering | **Locked `VideoIR` V1.0-Stable** | `SequenceTime` (`RelationalStart` & `RelationalDuration` resolved to integer frames) | Concrete `AssetDefinition` URIs, `sourceTrim`, `colorProfile`, and lowered `ModifierNode` chains | 100% JSON Schema compliance (`video-ir.schema.json`); all media streams probed; generative VRAM flushed. |
| **Stage 5: Production** | Deterministic Data (Backend) | Raw RGBA/WebGL2 Frame Stream & Bus Audio | Discrete Frame Stepping ($t = f / \text{globalFps}$) | Hierarchical `IRTrack` & `IRSequence` evaluation across 11 `BlendMode` formulas | Exact frame parity with resolved timeline length; immediate disposal of decoded GPU textures. |
| **Stage 6: Post-Production** | Deterministic Data (Backend) | Final MP4/WebM + Distribution Payload | Hardware Backpressure-Locked Streaming | Root `modifiers` cascade (Master 3D camera, LUT grading, `-14 LUFS` audio limiting) | Zero dropped encoder packets; broadcast loudness compliance; clean hardware handle release. |

---

## 2. Comprehensive Taxonomy of Studio Production Archetypes

A universal studio framework must accommodate the full spectrum of modern automated video workflows. Below is the complete architectural taxonomy of **Ten Canonical Studio Production Archetypes**, detailing how each specializes the upstream frontend while sharing the downstream `VideoIR` execution engine.

### 2.1 Master Cross-Archetype Topology Matrix

| Archetype | Stage 1: Idea Trigger | Stage 2: `ScriptAST` Dialect | Stage 3: `StoryboardAST` Layout & Camera | Stage 4: Pre-Production Asset Strategy | Stages 5–6: Dominant `VideoIR` Primitives |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A. Catalog Promo & Motion Poster** | Product SKU, price/discount, brand tokens | **2-Column Promo:** Hook $\rightarrow$ Benefit $\rightarrow$ Urgent CTA | 9-grid hero cutout, spring entry macros, kinetic text | Neural TTS, transparent PNG cutouts, procedural shader loops | High-FPS (`60fps`) `transform` curves, `screen` VFX overlays, word-pop `TimedTextCue` |
| **B. Visual Storytelling & 3D/Anime Cinematics** | Story premise, character bible, lore rules | **1-Column Screenplay:** Scene slugs, multi-character dialogue, foley | Shot-reverse-shot camera rigs, multi-plane Z-depth parallax | Multi-speaker voice cloning, ComfyUI / ControlNet / AnimateDiff plates | `24/30fps` `vfx/camera_3d`, `colorProfile` 3D LUTs, `cross_dissolve` overlaps |
| **C. Automated News & Tech Media Digest** | RSS/article payload, spec tables, press kit | **2-Column Broadcast:** Anchor narration, headline lower-thirds, quotes | Split-screen B-roll + ticker tape + dynamic stat cards | Fast broadcast TTS, web media scraping, stock video `sourceTrim` | Nested `parentTrack` PiP groups, whip-pan transitions, `data` & `timed_text` tracks |
| **D. Play-Learning & Interactive Explainer** | Curriculum concept, learning goal, quiz nodes | **Pedagogical Beat Script:** Question hook $\rightarrow$ Step breakdown $\rightarrow$ Recall prompt | Vector diagram choreography, pointer callouts, progressive reveal | Expressive tutor TTS, parameterized `lottie` JSON generation, custom fonts | Lossless `lottie` sequences, step-synchronized `cues`, ultra-clean vector rasterization |
| **E. Data-Driven Personalized & Wrapped Recaps** | User telemetry JSON, CRM profile, financial ledger | **Parameterized Narrative:** Dynamic user milestones & comparative insights | Data-bound chart templates, counter roll-ups, badge reveals | Per-user TTS name stitching, procedural Lottie/chart hydration | `data` track parameter binding, keyframed counter text, dynamic color token injection |
| **F. SaaS UI Walkthrough & Release Demos** | Changelog AST, DOM selector script, feature flags | **Action-Synced Tutorial:** Step directive $\rightarrow$ Cursor action $\rightarrow$ Value callout | Viewport pan-and-zoom camera solver following cursor coordinates | Headless browser capture or high-DPI UI layer export + cursor path synthesis | `vfx/camera_3d` focal tracking on cursor coordinates, `multiply` spotlight dimmers |
| **G. UGC Avatar, Digital Twin & Podcast Shorts** | Long-form VOD/podcast or product script + avatar ID | **Diarized / Direct-to-Camera Script:** Conversational hooks & punchlines | Dynamic face-tracked auto-reframing or PiP green-screen composite | Lip-sync avatar synthesis or VOD sub-clipping (`sourceTrim`) + WhisperX alignment | `activeStreams` selection, alpha-matte `overlay` compositing, karaoke `TimedTextCue` |
| **H. Real Estate, Automotive & Spatial Tours** | Property/vehicle listing, multi-angle photos/3D splats | **Luxury Showcase Script:** Architectural/spec highlights & location prestige | Smooth orbital camera paths, callout pin tracking, speed-ramped transitions | Optical-flow frame interpolation / 3D path rendering + spec badge generation | `time_space` speed-ramping modifiers, 2D/3D tracked callout `overlay` sequences |
| **I. Music Visualizer, Lyric Video & Audiogram** | Master audio stem(s), lyrics file (LRC), cover art | **Beat-Quantized Lyric AST:** Verse/Chorus structure locked to BPM & bar grid | Audio-reactive center stage, floating album art, rhythmic typography | Stem separation (drums/bass/vocals), FFT envelope extraction, forced lyric alignment | Beat-locked `RelationalStart`, FFT-driven `transform` scale pulses, `color_dodge` shaders |
| **J. Gaming Highlights & Esports Telemetry Recaps** | Match replay log, kill-feed timestamps, player stats | **Hype Caster Script:** Play-by-play climax commentary & stat comparisons | Action-cam zoom punches, HUD stat overlays, slow-motion impact frames | Hype-voice TTS synthesis, replay stream `sourceTrim` slicing around peak events | Extreme `time_space` velocity curves, additive impact shakes, rapid `overlapFrames` cuts |

---

### 2.2 Detailed Architectural Profiles of the Ten Archetypes

#### Archetype A: Catalog Promo & Motion Poster (E-Commerce, F&B, Retail)
* **Frontend Ingestion & Scripting:** Ingests structured SKU catalogs. The 2-Column Promo Dialect enforces high-converting commercial pacing (0–3s visual/verbal hook, 3–10s core product benefit demonstration, 10–15s offer lockup and CTA).
* **Storyboard & Pre-Production Lowering:** Places high-resolution product cutouts in `center_stage` using spring-physics entry macros (`spring_pop_up`) and zero-gravity idle oscillation (`zero_g_levitate`). TTS voiceover durations lock the scene boundaries via `matchAssetDuration: true`.
* **`VideoIR` Execution Signature:** Heavy utilization of `60fps` `transform` modifiers on `image` sequences, `screen` and `add` blend modes for liquid splashes or energy particles (`lottie` and `video` overlays), and diacritic-safe word-by-word kinetic captions (`timed_text`).

#### Archetype B: Visual Storytelling & 3D/Anime Cinematics (Entertainment, Lore, Brand Films)
* **Frontend Ingestion & Scripting:** Ingests narrative treatments, character sheets, and world lore. The 1-Column Screenplay Dialect structures beats into cinematic shots with multi-character dialogue, emotional prosody tags, and environmental foley cues.
* **Storyboard & Pre-Production Lowering:** Decomposes each scene into multi-plane depth layers (foreground silhouette, midground character slot, background environment plate). Pre-Production dispatches asynchronous jobs to generative node graphs (ComfyUI with IP-Adapter, ControlNet depth/pose, and AnimateDiff/RIFE) sized to the exact frame count resolved from character dialogue TTS.
* **`VideoIR` Execution Signature:** Operates at cinematic frame rates (`24` or `30` `globalFps`). Relies on track-level `vfx/camera_3d` modifiers for multi-plane parallax camera moves, per-asset `colorProfile` 3D LUTs for cohesive visual grading, and root-level film grain and halation master modifiers.

#### Archetype C: Automated News & Tech Media Digest (Digital Publishers, Market Briefings)
* **Frontend Ingestion & Scripting:** Ingests structured news feeds, financial filings, or product review specs. Compiles a 2-Column Broadcast Script pairing authoritative anchor voiceover with lower-third headlines, pull-quotes, and source attribution badges.
* **Storyboard & Pre-Production Lowering:** Uses modular split-screen and Picture-in-Picture (PiP) grid layouts. Pre-Production automatically sub-clips raw press footage using `AssetDefinition.sourceTrim` (`startFrame`, `durationFrames`) so only the most relevant 3-second action windows are decoded.
* **`VideoIR` Execution Signature:** Extensive use of hierarchical `parentTrack` groupings (`groupOrder` stacking background B-roll, framed footage containers, lower-third `lottie` banners, and persistent news ticker `text` sequences) alongside aggressive `audio/sidechain_ducking` on background beds.

#### Archetype D: Play-Learning & Interactive Explainer (EdTech, Onboarding, Micro-Learning)
* **Frontend Ingestion & Scripting:** Ingests structured curriculum graphs or concept definitions. The Pedagogical Dialect organizes beats around cognitive load principles: Curiosity Hook $\rightarrow$ Visual Analogy $\rightarrow$ Step-by-Step Mechanism $\rightarrow$ Active Recall Question.
* **Storyboard & Pre-Production Lowering:** Maps abstract concepts to parameterized vector animations (`lottie`) and progressive diagram reveals. Pre-Production binds word-level TTS alignment timestamps directly to visual pointer highlights so diagram nodes illuminate at the exact millisecond the tutor names them.
* **`VideoIR` Execution Signature:** Dominated by `lottie`, `image`, and `timed_text` sequences rendered at crisp vector resolutions, utilizing synchronized `RelationalStart` (`syncWith` + `offsetFrames`) to trigger callout arrows and step-highlight modifiers.

#### Archetype E: Data-Driven Personalized & Financial/Wrapped Recaps (FinTech, SaaS, CRM)
* **Frontend Ingestion & Scripting:** Triggered by per-user JSON telemetry (e.g., annual spending breakdowns, fitness milestones, portfolio performance). The Parameterized Narrative Dialect selects conditional script branches based on user cohort percentiles.
* **Storyboard & Pre-Production Lowering:** Binds user metrics to procedural chart templates and kinetic number counters. To scale to millions of users, static voiceover stems are cached globally in the Content-Addressable Store while variable segments (user names or dynamic figures) are stitched seamlessly via `RelationalStart` (`after`).
* **`VideoIR` Execution Signature:** Uses `data` tracks (`TrackType: 'data'`) to feed normalized telemetry arrays into custom chart/counter `ModifierNode` plugins, allowing thousands of personalized videos to share identical track topologies while varying only data payloads.

#### Archetype F: SaaS UI Walkthrough & Product Release Demos (Developer Tools, B2B Marketing)
* **Frontend Ingestion & Scripting:** Ingests an automated browser interaction log (Playwright/DOM action trace) or feature release specification. Pairs concise value-proposition narration with specific UI interaction timestamps (clicks, typing, modal reveals).
* **Storyboard & Pre-Production Lowering:** A specialized **Viewport Camera Solver** analyzes the $(x, y)$ trajectory of cursor events and generates smooth, spring-damped 3D camera pans and zoom-ins (`vfx/camera_3d`) so the viewer's eye is guided naturally to active UI controls without motion sickness.
* **`VideoIR` Execution Signature:** Combines high-resolution screen capture `video` assets with vector cursor `overlay` sequences, `multiply` blend-mode spotlight masks that dim inactive screen regions, and `time_space` modifiers that fast-forward through long loading or typing intervals.

#### Archetype G: UGC Avatar, Digital Twin & Livestream/Podcast Highlights (Social Commerce, Creators)
* **Frontend Ingestion & Scripting:** Operates in two modes: (1) synthesizing a direct-to-camera AI presenter from a product script, or (2) ingesting a 60-minute podcast/livestream transcript to extract high-retention 30-second viral segments.
* **Storyboard & Pre-Production Lowering:** For VOD extraction, speaker diarization and face-detection coordinates drive an automated 9:16 crop-tracking solver, while `AssetDefinition.sourceTrim` isolates the exact frame range of the viral segment without re-encoding the source master. For AI avatars, neural lip-sync video plates are generated directly from the Stage 4A voiceover buffer.
* **`VideoIR` Execution Signature:** Multi-stream container routing via `IRSequence.activeStreams`, green-screen or alpha-matte presenter `overlay` tracks floating over product demo B-roll, and high-contrast karaoke `TimedTextCue` sequences.

#### Archetype H: Real Estate, Automotive & Spatial Virtual Tours (PropTech, Luxury Retail)
* **Frontend Ingestion & Scripting:** Ingests structured property or vehicle listings (square footage, horsepower, architectural highlights, geolocation) alongside interior/exterior photography or 3D Gaussian Splatting / NeRF flythrough renders.
* **Storyboard & Pre-Production Lowering:** Choreographs continuous camera motion across rooms or vehicle angles, anchoring floating spatial callout badges (e.g., *"Sub-Zero Kitchen"*, *"0–100 km/h in 2.8s"*) to specific spatial features.
* **`VideoIR` Execution Signature:** Heavy reliance on `time_space` speed-ramp curves (fast whip-through between rooms decelerating into smooth slow-motion showcases) and `RelationalStart.overlapFrames` for seamless cross-dissolves and whip-pan transitions.

#### Archetype I: Music Visualizer, Lyric Video & Audiogram (Record Labels, Audio Platforms)
* **Frontend Ingestion & Scripting:** Rather than synthesizing TTS, Stage 1 ingests a master musical track and lyrics sheet. Stage 2 performs **Beat-Grid & Stem Analysis**, decomposing the track into BPM bars, downbeats, and vocal phoneme intervals (`ScriptAST` beats align to musical measures rather than spoken sentences).
* **Storyboard & Pre-Production Lowering:** Maps low-frequency bass transients and vocal envelopes to camera shake, particle emission rates, and kinetic lyric choreography.
* **`VideoIR` Execution Signature:** Sequences lock to exact musical bar frame counts; audio-reactive `data` envelopes drive `ModifierNode` scale and glow intensity parameters; `color_dodge` and `screen` blend modes create rich atmospheric lighting around typography and cover art.

#### Archetype J: Gaming Highlights & Esports Telemetry Recaps (Gaming Platforms, Tournaments)
* **Frontend Ingestion & Scripting:** Ingests match telemetry logs (kill events, objective captures, APM spikes) paired with raw gameplay recordings. The Hype Caster Dialect generates high-tempo play-by-play narration synchronized to peak telemetry timestamps.
* **Storyboard & Pre-Production Lowering:** Slices raw multi-gigabyte gameplay files non-destructively via `sourceTrim` around peak action windows, scheduling slow-motion impact frames at the exact millisecond of a critical event and layering esports HUD scoreboard templates.
* **`VideoIR` Execution Signature:** High-frame-rate (`60fps`) evaluation combining aggressive `time_space` velocity ramps ($2.0\times$ lead-in dropping to $0.25\times$ at impact), camera impact shake modifiers, and multi-channel audio mixing (`bus_game_sfx`, `bus_caster_vo`, `bus_hype_bgm`).

---

## 3. Deep-Dive: The Six-Stage Common Framework Architecture

To support all ten archetypes without code duplication, each of the six compiler passes enforces a **Core Invariant Contract** while exposing **Pluggable Strategy Seams**.

---

### Stage 1: Idea (Context Ingestion & Campaign Envelope Initialization)

#### 3.1.1 Architectural Purpose
Stage 1 insulates the internal compiler from heterogeneous external triggers (e-commerce databases, CMS webhooks, match telemetry logs, story prompts) and establishes the immutable physical and brand laws of the render job.

#### 3.1.2 Core Invariant Contract (`StudioBriefEnvelope`)
Every Stage 1 Ingestion Adapter outputs a normalized `StudioBriefEnvelope` containing:
1. **Pre-Initialized `IRMeta` Block:** Locks the `contentId`, master frame rate `globalFps`, target pixel dimensions `canvasSize` (`w`, `h`), working `colorSpace` (`rec709`, `bt2020`, `hdr10`), and initializes `nextSequenceIndex` at `1`.
2. **Closed-World Fact Dictionary:** A verified key-value ledger of ground-truth claims (prices, dates, specs, character names) that constrains downstream generative stages.
3. **Brand & Platform Design Tokens:** Color hex palettes, primary/secondary `fontFamily` asset references, audio loudness targets, and platform UI safe-zone insets.

---

### Stage 2: Script (Polymorphic Narrative Compilation to `ScriptAST`)

#### 3.2.1 Architectural Purpose
Stage 2 compiles the `StudioBriefEnvelope` into a vertical, time-budgeted narrative tree (**`ScriptAST`**). Whether the output is a commercial 2-Column Promo Script, a cinematic 1-Column Screenplay, or a Beat-Quantized Lyric Sheet, the structural representation is unified.

#### 3.2.2 Core Invariant Contract (`ScriptAST`)
The root of `ScriptAST` is an ordered array of atomic **`NarrativeBeat`** nodes. Every beat encapsulates:
* **Pacing & Syllable Budget:** Declares `targetDurationSec` and enforces a strict syllable ceiling computed from the target language and speaking rate:
  $$N_{\text{syllables\_max}} = \lfloor D_{\text{target}} \times R_{\text{syllables/sec}} \rfloor$$
* **Column 1 — `auditory` Intent:** Structured voiceover/dialogue nodes (speaker persona, text, SSML/phonetic hints, prosody emotion, pace multiplier, lead-in/tail pauses) paired with semantic sound-effect triggers (`sfxCues` bound to `beat_start`, `on_emphasis_word`, or `beat_end`).
* **Column 2 — `visualDirective` Intent:** Semantic scene description, primary subject focus, visual energy tier (`low`, `medium`, `high`, `climax`), and on-screen typography copy (`onScreenHeadline` with synchronization mode).

---

### Stage 3: Storyboard (Spatial Layout Solver & Cinematographic `StoryboardAST`)

#### 3.3.1 Architectural Purpose
Stage 3 translates the narrative beats of `ScriptAST` into a resolution-independent **Visual Composition & Motion Plan (`StoryboardAST`)**. By solving layouts in normalized $[0.0, 1.0]$ coordinate space using semantic 9-grid safe zones and high-level **Motion Macros**, a single storyboard can be lowered into `9:16`, `1:1`, or `16:9` canvases without re-running the creative layout solver.

#### 3.3.2 Core Invariant Contract (`StoryboardAST`)
1. **Declarative `assetManifest`:** Enumerates every abstract media slot (`slotId`) required by the composition, specifying its `modality` (`voiceover`, `bgm`, `sfx`, `image_cutout`, `video_loop`, `lottie_vfx`, `font`) and `acquisitionStrategy` (`catalog_lookup`, `tts_synthesis`, `comfyui_workflow`, `stock_query`, `vod_subclip`).
2. **Cinematographic `scenes` Graph:** Each scene links to a `ScriptAST` beat (`linkedBeatId`) and defines:
   * **`timingAnchor`:** Specifies whether the scene duration locks to a synthesized voiceover slot (`lock_to_voiceover`), musical bars (`lock_to_bgm_bars`), or a fixed duration (`fixed_seconds`).
   * **`camera` Rig:** Assigns a scene-wide camera preset (`static_locked`, `slow_push_in`, `rapid_zoom_punch`, `handheld_float`, `parallax_orbit`) and depth-of-field parameters.
   * **`compositionLayers` Stack:** Back-to-front visual layers (`background_plate`, `atmosphere_vfx`, `product_hero`, `secondary_prop`, `foreground_vfx`, `kinetic_typography`), each bound to a semantic `spatialAnchor` (`zone`, `offsetNormalized`, `scaleRatio`), a compositing `blendIntent`, and named `motion` presets (`entryPreset`, `idlePreset`, `exitPreset`).
   * **`transitionOut`:** Specifies the inter-scene boundary transition (`hard_cut`, `whip_pan`, `flash_frame`, `cross_dissolve`, `zoom_through`) and its overlap duration in milliseconds.

---

### Stage 4: Pre-Production (Audio-First Asset Fulfillment & The `VideoIR` Lowering Compiler)

#### 3.4.1 Architectural Purpose
Stage 4 bridges the *Semantic Control Plane* and the *Deterministic Data Plane*. It executes physical media synthesis/probing first, then runs the deterministic **Lowering Compiler** to translate the vertical `StoryboardAST` into the horizontal, track-based **Universal `VideoIR` V1.0-Stable** document.

#### 3.4.2 Sub-Phase 4A: Audio-First Fulfillment & Mathematical DAG Resolution
To prevent audio-visual desynchronization, Pre-Production resolves assets and timing in four mathematical steps:

1. **Intrinsic Audio Synthesis & Probing (`matchAssetDuration`):**
   All `voiceover` slots are synthesized first. For each voiceover sequence $A_k$ with measured audio container duration $D_{\text{sec}}(A_k)$, its exact integer frame length $L(A_k)$ is locked against `meta.globalFps`:
   $$L(A_k) = \lceil D_{\text{sec}}(A_k) \times \text{globalFps} \rceil + \text{paddingFrames}$$
2. **Sequential Beat Propagation (`RelationalStart.after`):**
   For any sequence $B$ chained sequentially `after` sequence $A$ with frame offset $\Delta f$ (`offsetFrames`) and transition overlap $O_f$ (`overlapFrames`), its resolved start frame $S(B)$ and end frame $E(B)$ are:
   $$S(B) = E(A) + \Delta f - O_f, \quad E(B) = S(B) + L(B)$$
3. **Cross-Track Visual Slaving (`RelationalStart.syncWith` & `RelationalDuration.matchLengthOf`):**
   Every visual or caption sequence $V$ anchored to master audio sequence $A$ inherits its exact temporal bounds:
   $$S(V) = S(A) + \Delta f, \quad L(V) = L(A) + \text{paddingFrames}$$
   Generative visual jobs (such as ComfyUI diffusion sequences or RIFE interpolations) are then dispatched requesting the exact resolved frame count $L(V)$.
4. **Global Timeline Closure (`matchLengthOf: 'timeline'`):**
   Once all primary narrative tracks resolve, the total composition length $L_{\text{timeline}}$ is calculated as the maximum end frame across all primary sequences:
   $$L_{\text{timeline}} = \max_{i \in \text{Primary}} E(i)$$
   Ambient background plates and BGM tracks declaring `matchLengthOf: 'timeline'` resolve last, looping (`loop: true`) or trimming via `sourceTrim` to span $[0, L_{\text{timeline}})$.

#### 3.4.3 Sub-Phase 4B: Structural Lowering Pass (`StoryboardAST` $\rightarrow$ `VideoIR`)
The Lowering Compiler emits a strictly validated `VideoIR` JSON document through five deterministic transformations:

| Lowering Transformation | Source `StoryboardAST` / `ScriptAST` Node | Emitted `VideoIR` Target Entity (`video-ir.schema.json`) |
| :--- | :--- | :--- |
| **1. Asset Registry Hydration** | Fulfilled `assetManifest` slots | Root **`assets`** dictionary mapping unique `assetId` keys to `AssetDefinition` (`src`, `type`, `streams`, `fontFamily`, `sourceTrim`, `colorProfile`). |
| **2. Vertical-to-Horizontal Track Pivot** | `compositionLayers[].role` across `scenes[]` | Root **`tracks`** array (`IRTrack` of type `video`, `audio`, `data`, `timed_text`) organized with `parentTrack`, `groupOrder`, `routeTo`, `blendMode`, and track `style`. |
| **3. Sequence Instantiation** | Scene layers, voiceovers, SFX, and sub-comps | **`IRTrack.sequences`** (`IRSequence` of type `video`, `image`, `audio`, `text`, `overlay`) with monotonically allocated IDs via `meta.nextSequenceIndex` and `SequenceTime`. |
| **4. Three-Tier Modifier Expansion** | `spatialAnchor`, `motion` presets, `camera` rigs, and `globalAudioDirection` | **`ModifierNode`** chains (`type`, `target`, `params`) injected at the Sequence tier (`transform`, `time_space`), Track tier (`vfx/camera_3d`, `timed_text/style`, `audio/sidechain_ducking`), and Root Document tier (`audio/master_limiter`). |
| **5. Sub-Frame Caption Alignment** | TTS forced-alignment phoneme timestamps + `onScreenHeadline` | **`IRSequence.cues`** array of `TimedTextCue` objects (`startOffsetMs`, `endOffsetMs` as number or `'end'`, and `text`). |

---

### Stage 5: Production (Stateless Frame Evaluation & Hierarchical Compositing)

#### 3.5.1 Architectural Purpose
Stage 5 is the runtime-agnostic **Deterministic Data Plane**. It consumes the frame-locked `VideoIR` document and evaluates the visual canvas and audio sub-buses at every discrete frame index $f \in [0, L_{\text{timeline}})$ without wall-clock dependencies.

#### 3.5.2 Stateless Evaluation Loop $F(f)$
At timestamp $t = f / \text{meta.globalFps}$:
1. **Visibility & Active Culling:** Filters `tracks` where `visible !== false` (visual) or `muted !== true` (audio), selecting all `sequences` whose resolved `[start, start + duration)` interval contains $f$.
2. **Stream Seeking & Color Science:** Decodes source media at `sourceTrim.startFrame` + local offset across `activeStreams`, transforming pixels from `colorProfile.input` and applying 3D `colorProfile.lut` grading into `meta.colorSpace`.
3. **Bottom-Up Three-Tier Modifier & Blend Evaluation:**
   * Evaluates `IRSequence.modifiers` at normalized sequence progress $u = (f - S_i) / L_i$.
   * Composites sequences and child tracks sharing a `parentTrack` in ascending `groupOrder` (`0` = bottom layer) using the specified `BlendMode` (`normal`, `screen`, `multiply`, `overlay`, `add`, `color_dodge`, `soft_light`, `lighten`, `darken`, `difference`, `exclusion`).
   * Evaluates `IRTrack.modifiers` on the group buffer and routes the output via `routeTo`.
4. **Immediate Texture Disposal:** Explicitly closes every decoded `VideoSample` or temporary GPU surface before advancing to frame $f + 1$.

---

### Stage 6: Post-Production (Master Cascade, Zero-Copy Encoding & Multi-Target Delivery)

#### 3.6.1 Architectural Purpose
Stage 6 executes the root document finishing chain (`VideoIR.modifiers`) and streams raw visual and audio buffers directly into hardware encoders with zero intermediate disk writes.

#### 3.6.2 Dual Execution Topologies
* **Interactive Studio Client Path (Browser WebCodecs):** Pipes composited `OffscreenCanvas` frames into `CanvasSource` and mixed audio into `AudioBufferSource`, awaiting hardware WebCodecs encoder backpressure at every frame for instant WYSIWYG previewing and local export.
* **Headless Batch Server Path (Worker Cluster):** Pipes raw RGBA/NV12 frame buffers directly into `@mediabunny/server` `StreamTarget` or FFmpeg `stdin` backed by hardware NVENC/VAAPI encoders, maintaining a flat $O(1)$ ring-buffer memory footprint across 4K batch renders.

---

## 4. Cross-Cutting Studio Infrastructure Subsystems

To run all ten archetypes reliably at studio scale, four infrastructure subsystems operate across the six stages:

1. **Content-Addressable Asset Cache (CAS):**
   Every Stage 4 `assetManifest` request is hashed deterministically over its generation parameters (e.g., $\text{SHA-256}(\text{model} \parallel \text{voiceId} \parallel \text{text} \parallel \text{pace})$). Identical hashes resolve immediately to cached `AssetDefinition` entries, allowing editors to tweak Stage 3 camera rigs or typography without re-running TTS or diffusion models.
2. **Split-Plane GPU & VRAM Semaphore Scheduler:**
   Enforces a strict hardware barrier between **Stage 4A (Neural TTS, ComfyUI Diffusion, Optical Flow)** and **Stages 5–6 (WebGL2 Compositing & Hardware NVENC Encoding)**. All generative model weights are unloaded from VRAM once `VideoIR.assets` are hydrated, preventing Out-of-Memory crashes on 12GB–24GB workstation GPUs.
3. **Multi-Aspect Responsive Re-Lowering (`9:16` / `1:1` / `16:9`):**
   Because Stage 3 (`StoryboardAST`) stores spatial layout in normalized 9-grid safe zones, delivering a campaign across TikTok (`9:16`), Instagram Feed (`1:1`), and YouTube (`16:9`) requires running **Stage 4A (Asset Fulfillment) only once**, followed by executing **Stage 4B (Lowering to `VideoIR`) three times** with different `IRMeta.canvasSize` dimensions.
4. **Incremental GOP Frame-Range Splicing:**
   Because `VideoIR` timing is frame-locked and Stage 5 evaluation $F(f)$ is purely stateless, modifying a single caption or product layer in Scene 2 only re-renders the dirty frame interval $[S_{\text{dirty}}, E_{\text{dirty}})$ and splices the updated Group of Pictures (GOP) segment at the muxer boundary.

---

## 5. Studio Governance & Architectural Guardrails

* **Rule 1 — Strict Separation of AST Planes (Never Author `VideoIR` Directly from LLMs):**
  LLMs must only author vertical `ScriptAST` and `StoryboardAST` documents. Horizontal track allocation, `groupOrder` sorting, matrix keyframe math, and `SequenceTime` resolution are exclusively performed by the deterministic Stage 4 Lowering Compiler.
* **Rule 2 — Audio-First Temporal Locking:**
  In all voice- or music-driven archetypes, visual sequences must never hardcode estimated frame durations prior to audio probing. Visual tracks must slave to audio master sequences via `RelationalStart` (`syncWith`) and `RelationalDuration` (`matchLengthOf`).
* **Rule 3 — Strict `ModifierNode.target` Domain Validation:**
  The Stage 4 Lowering Compiler and Stage 5 Compositor must verify that every `ModifierNode.target` discriminator matches the host sequence's `SequenceType` (`video`, `image`, `audio`, `text`, `overlay`) before shader or DSP instantiation.
* **Rule 4 — Zero Intermediate Disk I/O in Production:**
  Stages 5 and 6 must stream frames in memory via backpressure-locked promises (`await videoSource.add(...)`), never writing temporary `.png` image sequences to disk.