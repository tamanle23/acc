# 🚀 ACC Universal Auto-Config & Asset Staging Guide

This guide details the asset requirements, heuristic classification rules, and CLI workflows for the **ACC Universal Auto-Config Engine (v3.0)** across all **6 Canonical Pipeline Archetypes** and **6 Master Narrative Scripting Frameworks**.

---

## 📑 Table of Contents
1. [Overview & Execution Workflow](#1-overview--execution-workflow)
2. [Target Folder Requirements by Pipeline Archetype](#2-target-folder-requirements-by-pipeline-archetype)
3. [Target Folder Requirements by Narrative Scripting Framework](#3-target-folder-requirements-by-narrative-scripting-framework)
4. [Generated Artifacts & File Schemas](#4-generated-artifacts--file-schemas)
5. [CLI Usage & Flag Reference](#5-cli-usage--flag-reference)
6. [Troubleshooting & Best Practices](#6-troubleshooting--best-practices)
7. [Comprehensive Guide for 250 Content Variations & Publishing Formats](#7-comprehensive-guide-for-250-content-variations--publishing-formats)

---

## 1. Overview & Execution Workflow

The **ACC Universal Auto-Config Engine** inspects any media directory using a modular **Media Asset Prober Chain**. It discovers media, classifies the content into a Canonical Pipeline (Pipelines 1–6), builds a validated [`pipeline-ir.json`](file:///c:/Users/Admin/workspace/git/acc/schema/pipeline-ir.schema.json), synthesizes fine-grained director configurations ([`omnichannel-config.json`](file:///c:/Users/Admin/workspace/git/acc/schema/omnichannel-config.schema.json)), and preserves backwards compatibility.

```
                    ┌────────────────────────────┐
                    │   Target Project Folder    │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │  Media Asset Prober Chain  │
                    │  (Visuals, Audio, Data,    │
                    │   Scripts, Paired Pairs)   │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │ PipelineClassifierRegistry │
                    │   (Calculates Confidence   │
                    │    Across Pipelines 1-6)   │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
     ┌─────────────────────────────────────────────────────────┐
     │                   PipelineIRBuilder                     │
     │  - Maps asset pairs to chronological content chunks     │
     │  - Applies narrative beats & ducking (if framework set) │
     │  - Sets aspect ratio, resolution, & export modalities   │
     └────────────────────────────┬────────────────────────────┘
                                  │
           ┌──────────────────────┴──────────────────────┐
           ▼                                             ▼
┌──────────────────────┐                     ┌──────────────────────┐
│   pipeline-ir.json   │                     │omnichannel-config.json│
│ (Universal 3.0.0 AST)│                     │(Director Preset 60fps│
│                      │                     │ 3D Depth, VFX, Audio)│
└──────────────────────┘                     └──────────────────────┘
```

---

## 2. Target Folder Requirements by Pipeline Archetype

The heuristic classifier assigns a confidence score ($0.0 \dots 1.0$) based on file types, metadata, word counts, and naming patterns found in the target directory:

### Pipeline 1: Scraper & Summarizer (`scraper-summarizer`)
* **Core Concept**: News digests, articles, documentation summaries, and kinetic bullet typography.
* **Expected Files in Folder**:
  - `article.txt`, `post.md`, or `news.txt` (Text-heavy document, $\ge 50$ words).
  - *(Optional)* 1–2 background branding visuals (`background.png`, `logo.svg`).
  - *(Optional)* `voiceover.mp3` (if external TTS was pre-rendered).
* **Classifier Triggers**: Folder is text-rich ($\ge 50$ words) without sequential slide images or CSV tables.
* **Auto-Generated Defaults**:
  - `defaultAspect`: `16:9` (or source aspect).
  - `theme`: `clean_editorial`.
  - `chunkDurationMs`: ~12,000ms per paragraph/bullet.
  - Modalities: `['static-web', 'social', 'audio', 'video']`.

### Pipeline 2: Database & Dynamic Templating (`db-templating`)
* **Core Concept**: Data visualizer, animated bar chart race, leaderboard cards, and stats carousels.
* **Expected Files in Folder**:
  - `data.csv`, `metrics.json`, `leaderboard.tsv`, or `stats.json`.
  - Must contain tabular rows ($\ge 1$ data rows with numeric metrics).
  - *(Optional)* Entity icons or logos matching entity IDs.
* **Classifier Triggers**: Tabular data file discovered with structured columns and numeric fields.
* **Auto-Generated Defaults**:
  - `defaultAspect`: `9:16` (Vertical TikTok/Shorts) or `16:9`.
  - `defaultFps`: **`60`** (Fluid animation interpolation for bar charts).
  - `theme`: `neon_cyber_data`.
  - Modalities: `['video', 'social', 'interactive-web']`.

### Pipeline 3: Repurposing Recycler (`repurposing-recycler`)
* **Core Concept**: Converting long-form recordings (podcasts, webinars, interviews) into vertical viral clips.
* **Expected Files in Folder**:
  - A single raw long-form recording: `podcast.mp4`, `interview.mov`, or `webinar.mkv` ($>15$ seconds).
  - *(Optional)* `transcript.srt` or `captions.vtt`.
* **Classifier Triggers**: Contains long-form video files without a dominating sequence of still images.
* **Auto-Generated Defaults**:
  - `defaultAspect`: `9:16` (Active speaker face centering & vertical crop).
  - `defaultFps`: `30`.
  - Subtitle Style: High-contrast karaoke word highlights with overlap.
  - Modalities: `['video', 'audio']`.

### Pipeline 4: Generative Storytelling (`generative-storytelling`)
* **Core Concept**: Narrative video stories combining sequential visuals, AI voiceover, SFX, 3D depth, and BGM.
* **Expected Files in Folder**:
  - **Sequential Visuals**: `01.png`, `02.png`, `03.png` ... (or `scene1.jpg`, `scene2.jpg`).
  - **Chronological Audio**: `01.mp3`, `02.mp3`, `03.mp3` ... (matching scene narrations).
  - *(Optional)* Background music: `bgm.mp3` or `music.wav`.
  - *(Optional)* Script lines: `script.txt` (numbered lines matching images).
* **Classifier Triggers**: Multiple visual assets paired with voiceover files, or standard storytelling layout.
* **Auto-Generated Defaults**:
  - `defaultAspect`: `9:16` (Vertical TikTok/Reels) or `16:9`.
  - `defaultFps`: `30`.
  - `enableDepth3D`: `true` (Parallax depth layers, z-camera travel).
  - `ducking`: Attenuation `-14dB`, attack `200ms`, release `350ms`.
  - Modalities: `['video']`.

### Pipeline 5: Rule-Logic & Procedural Engine (`rule-logic`)
* **Core Concept**: Quiz logic, branching choices, decision trees, interactive education, or math chalkboard proofs.
* **Expected Files in Folder**:
  - Script containing decision keywords: `rules.txt`, `scenario.md` (containing words like `choice`, `branch`, `quiz`, `if`, `proof`, `q.e.d`).
  - Or a structured rule file: `tree.json` or `rules.json` (containing `branches`, `conditions`, `nextStep`).
* **Classifier Triggers**: Script or data containing branching logic or conditional state trees.
* **Auto-Generated Defaults**:
  - `defaultAspect`: `16:9`.
  - `theme`: `interactive_clean`.
  - `chunkDurationMs`: ~10,000ms per decision node.
  - Modalities: `['interactive-web', 'static-web', 'video']`.

### Pipeline 6: Ambient Loops & Soundscapes (`ambient-loops`)
* **Core Concept**: Infinite relaxation audio, lo-fi study beats, atmospheric drone, and rain soundscapes.
* **Expected Files in Folder**:
  - Seamless audio track: `lofi_beat.mp3`, `rain_ambient.wav`, `meditation_loop.ogg`.
  - 1 continuous background image or looping video: `background.png` or `space.mp4`.
  - **Crucial constraint**: **Zero voiceover speech files** and **zero narrative script files**.
* **Classifier Triggers**: Audio classified as `ambient` or `music` without voiceover narration.
* **Auto-Generated Defaults**:
  - `defaultAspect`: `16:9`.
  - `chunkDurationMs`: 60,000ms (1-minute looping block).
  - `theme`: `ambient_particles_glow`.
  - `backgroundMusic`: Continuous looping volume `0.8` (full volume, no ducking).
  - Modalities: `['video', 'audio', 'live-stream']`.

---

## 3. Target Folder Requirements by Narrative Scripting Framework

When configuring **Pipeline 4 (Generative Storytelling)** or passing `--framework <id>`, the framework orchestrates the pacing, camera behavior, audio ducking, and SFX cues:

| Framework ID / Flag | Framework Name | Best Suited For | Target Folder Contents | Generated Beat Structure & Pacing |
| :--- | :--- | :--- | :--- | :--- |
| `mystery_box` / `mystery-box-explainer` | **Mystery Box Explainer** | Science, technology, curious discoveries, math paradoxes. | • 5–6 scene visuals<br>• Or `script.txt` with hook & problem statement. | **6 Beats (150s nominal)**:<br>1. *The Cold Hook* (0–5s, rapid zoom, bass drop)<br>2. *The Friction / Stakes* (5–15s, tension riser)<br>3. *The Title / Reset* (15–20s, whoosh wipe)<br>4. *The Metaphor Build* (20–90s, kinetic isometric)<br>5. *The Turn / Complication* (90–120s, warning strobe)<br>6. *The Climax & Payoff* (120–150s, slow burn resolution). |
| `breadcrumb_trail` / `breadcrumb-trail` | **Breadcrumb Trail** | Investigative journalism, maps, timelines, geopolitical breakdowns. | • Map screenshots, document clippings, archival photos, timeline recordings. | **5 Beats (180s nominal)**:<br>1. *The Micro-Anomaly* (0–10s, macro push-in)<br>2. *Zoom Out to Macro* (10–30s, map pan)<br>3. *The Paper Trail* (30–120s, document sweep)<br>4. *The Acceleration* (120–150s, rapid cut cadence)<br>5. *The Synthesis* (150–180s, pull back resolution). |
| `stakes_escalation` / `stakes-and-escalation` | **Stakes & Escalation** | High-energy challenges, competitions, extreme countdowns. | • Fast visual cuts, countdown cues, high-energy voice recordings. | **6 Beats (90s nominal)**:<br>1. *The Impossible Premise* (0–5s, siren/riser)<br>2. *The Early Win* (5–20s, cheerful chime)<br>3. *The Rule Change* (20–45s, glitch impact)<br>4. *The Near Catastrophe* (45–65s, camera shake)<br>5. *The Final Push* (65–80s, frantic build)<br>6. *The Payoff* (80–90s, celebration impact). |
| `confessional` / `intimate-confessional` | **Intimate Confessional** | Personal founder essays, life lessons, reflections. | • Talking head portraits, raw voice memo (`.m4a`/`.wav`), soft piano BGM. | **5 Beats (120s nominal)**:<br>1. *The Vulnerable Admission* (0–10s, subtle zoom)<br>2. *The Backstory Context* (10–40s, steady center)<br>3. *The Breaking Point* (40–70s, deep breath silence)<br>4. *The Epiphany Realization* (70–100s, subtle warm push)<br>5. *The Principle / Takeaway* (100–120s, intimate hold). |
| `historical` / `historical-parallels` | **Historical Parallels** | Historical documentaries, philosophical and economic cycles. | • Archival artwork, historical paintings, vintage photographs, solemn voiceover. | **5 Beats (240s nominal)**:<br>1. *The Modern Paradox* (0–15s, slow creep in)<br>2. *The Ancient Mirror* (15–60s, sepia crossfade)<br>3. *The Crucible* (60–160s, battle drone ambiance)<br>4. *The Critical Divergence* (160–200s, contrast wipe)<br>5. *The Echo & Warning* (200–240s, solemn hold). |
| `contrarian` / `contrarian-thesis` | **Contrarian Thesis** | Thought leadership, myth busting, challenging industry dogmas. | • Headline screenshots, flawed advice quotes, rebuttal graphs. | **5 Beats (100s nominal)**:<br>1. *The Consensus Lie* (0–10s, glass break / buzzer)<br>2. *Why Smart People Fall For It* (10–35s, subtle drift)<br>3. *The First-Principles Truth* (35–65s, clean punch)<br>4. *The Mechanism Explained* (65–85s, step reveal)<br>5. *The Directive Rule* (85–100s, bold conclusion). |

---

## 4. Generated Artifacts & File Schemas

When `auto-config` runs on a folder, it emits the following artifacts:

### 1. `pipeline-ir.json` (Universal AST)
* **Status**: Primary Source of Truth (SSOT).
* **Schema**: [`schema/video-ir.schema.json`](file:///c:/Users/Admin/workspace/git/acc/schema/video-ir.schema.json)
* Contains content chunks, order, text, audio paths, duration in milliseconds, distribution hints, and audio ducking parameters.

### 2. `omnichannel-config.json` (Director Configuration)
* **Status**: Fine-grained rendering specifications.
* **Schema**: [`schema/omnichannel-config.schema.json`](file:///c:/Users/Admin/workspace/git/acc/schema/omnichannel-config.schema.json)
* Contains visual composition styles, resolution (`1080x1920` or `1920x1080`), FPS (`30` or `60`), transitions, subtitle styling, 3D depth parameters, and hardware encoder directives.

### 3. `story-config.json` (Legacy Backwards-Compatibility)
* **New Projects**: **Omitted by default** to keep projects clean.
* **Existing Projects**: Enters **Update/Merge Mode** — preserves existing custom parameters, author tags, and manual calibration while updating scene mappings.
* **Manual Override**: Passing `--export-legacy` will force generation.

---

## 5. CLI Usage & Flag Reference

### Running the Auto-Config Engine

```bash
# Interactive Mode (Prompts for confirmation & options)
bun run auto-config.ts ./my-project-folder

# Automated / Non-Interactive (Auto-accepts defaults)
bun run auto-config.ts ./my-project-folder --yes

# With a Specific Narrative Framework
bun run auto-config.ts ./my-project-folder --framework mystery_box --yes

# Overriding Pipeline Archetype & Aspect Ratio
bun run auto-config.ts ./my-project-folder --pipeline 2 --aspect 16:9 --fps 60 --yes

# Dry-run inspection without saving files
bun run auto-config.ts ./my-project-folder --dry-run
```

### CLI Flag Reference
| Flag | Description | Default |
| :--- | :--- | :--- |
| `-y, --yes` | Run non-interactively without interactive prompts | `false` |
| `-n, --dry-run` | Inspect assets and report classification without saving files | `false` |
| `--pipeline <1-6>` | Explicitly force a specific Pipeline archetype (1–6) | Heuristic score |
| `--framework <id>` | Apply narrative scripting framework (e.g. `mystery_box`) | None |
| `--aspect <ratio>` | Override aspect ratio (`9:16`, `16:9`, `1:1`, `4:5`) | Pipeline default |
| `--fps <24\|30\|60>` | Force output frame rate | Pipeline default |
| `--duration <sec>` | Scale beat and chunk durations to fit target duration | Nominal |
| `--depth / --no-depth` | Enable or disable 3D depth parallax layers | `true` (Pipeline 4) |
| `--transitions` | Enable or disable transition effects | `true` |

---

## 6. Troubleshooting & Best Practices

1. **Why does an empty directory default to Pipeline 4?**
   - When no CSV data, video files, or text files are present, the classifier falls back to Canonical Pipeline 4 (Generative Storytelling) as the universal base. Use `--pipeline <id>` if you wish to scaffold a specific pipeline from scratch.

2. **How to scale narrative beats to a specific video length:**
   - Use `--duration <seconds>`:
     ```bash
     bun run auto-config.ts ./my-project --framework mystery_box --duration 60 --yes
     ```
     The engine mathematically scales every beat proportionally (e.g. compressing 150s nominal beats down to 60s).

3. **How to render the generated project:**
   - Dry run / compile verification:
     ```bash
     bun run apps/cli/src/index.ts ir-render -c ./my-project --dry-run
     ```
   - Hardware-accelerated native render:
     ```bash
     bun run apps/cli/src/index.ts ir-render -c ./my-project -o ./output/video.mp4
     ```

---

## 7. Comprehensive Guide for 250 Content Variations & Publishing Formats

The ACC Omnichannel Engine maps **250 distinct content variations** across **5 publishing formats** (Static Web, Social, Video, Audio, Interactive HTML) powered by the **6 Canonical Pipelines** (`Scraper`, `DBTemplating`, `Repurposing`, `GenerativeStory`, `RuleLogic`, `AmbientStream`).

Each content variation can be scaffolded using `auto-config` by providing appropriate asset indicators or specifying its canonical pipeline.

```
                           [ 250 Content Variations ]
                                       │
        ┌───────────────┬──────────────┼───────────────┬───────────────┐
        ▼               ▼              ▼               ▼               ▼
 ┌─────────────┐ ┌─────────────┐ ┌───────────┐  ┌─────────────┐ ┌─────────────┐
 │  Format 1   │ │  Format 2   │ │ Format 3  │  │  Format 4   │ │  Format 5   │
 │ Static Web  │ │Social Media │ │   Video   │  │   Audio     │ │ Interactive │
 │ (Items 1-50)│ │(Items 51-100│ │(Items 101-│  │ (Items 151-│ │ (Items 201- │
 │             │ │             │ │    150)   │  │     200)    │ │    250)     │
 └─────────────┘ └─────────────┘ └───────────┘  └─────────────┘ └─────────────┘
```

---

### Format 1: Static Web CMS & Editorial (Items 1 to 50)
* **Primary Modality**: `static-web` (Markdown, SSG, HTML, Ghost/WordPress, Astro/Next.js)
* **Pipeline Focus**: **Pipeline 1** (Scraper & Summarizer), **Pipeline 2** (Specs & Comparisons), **Pipeline 5** (Reference Guides)
* **Target Folder Setup**:
  - `source.txt` or `article.md` containing raw text, links, or documentation tables.
  - Optional: `featured-image.png` or `thumbnail.jpg` (Aspect ratio: `16:9` or `1.91:1`).
  - Optional: `metadata.json` with author, tags, and category.

| Sub-Category | Item Range | Example Content Types | How to Stage in Folder | Primary Pipeline |
| :--- | :--- | :--- | :--- | :--- |
| **Real-Time Digests** | 1–10 | Daily industry tech news, crypto market recap, real estate digest, weather bulletins, regulatory updates. | Drop RSS export, raw news text file, or markdown digest ($\ge 50$ words). | **Pipeline 1** |
| **Programmatic SEO** | 11–20 | Product A vs Product B, Top 10 alternatives, discount code aggregator, historical price tracker. | Drop `comparison.csv` with columns: `Item_A`, `Item_B`, `Specs`, `Winner`. | **Pipeline 2** |
| **Reference & Educational**| 21–30 | Developer glossary, math theorem sheets, "On This Day" history facts, programming snippet cards. | Drop markdown file with structured definitions or formulas (`# Term\nDefinition`). | **Pipeline 5** / **1** |
| **Curation & Reviews** | 31–40 | 3-day travel itineraries, local restaurant guides, flight deal alerts, non-fiction book chapter summaries. | Drop numbered itinerary text or book breakdown markdown notes. | **Pipeline 1** |
| **Specs & Documentation** | 41–50 | Hardware specs comparison matrices, FAQ knowledge base, API changelog notes, software release digests. | Drop `specs.json` or `changelog.md` with version headers. | **Pipeline 2** / **1** |

---

### Format 2: Social Media Automation (Items 51 to 100)
* **Primary Modality**: `social` (Twitter/X threads, LinkedIn carousels, Instagram quote cards, TikTok text carousels)
* **Pipeline Focus**: **Pipeline 1** (Breaking Alerts), **Pipeline 2** (Quote Cards & Tables), **Pipeline 4** (Memes & Affirmations)
* **Target Folder Setup**:
  - `content.txt` with numbered tweets/slides or short punchy text.
  - Square (`1:1`) or Portrait (`4:5`) background graphics (`card_bg.png`, `brand.svg`).
  - Optional: `quotes.csv` with columns: `Quote`, `Author`, `Topic`.

| Sub-Category | Item Range | Example Content Types | How to Stage in Folder | Primary Pipeline |
| :--- | :--- | :--- | :--- | :--- |
| **Bite-Sized Quotes & Threads** | 51–60 | Viral Twitter/X threads from long articles, philosophical quote cards, LinkedIn 5-slide PDF carousels. | Drop article text + run `auto-config` with `--aspect 1:1` or `--aspect 4:5`. | **Pipeline 1** / **4** |
| **Comparison & Stat Callouts** | 61–70 | Visual metric cards (e.g. "92% vs 45%"), feature checklist graphics, weekly digest recap slides. | Drop `stats.csv` with key metric rows or short structured JSON. | **Pipeline 2** |
| **Community & Testimonials** | 71–80 | Customer review cards, user of the week highlights, curated viral meme templates, community Q&A cards. | Drop customer reviews list (`reviews.txt`) and headshot photos. | **Pipeline 4** |
| **Financial & Ticker Alerts** | 81–90 | Real-time stock breakout alerts, crypto RSI overbought warnings, sports score updates, SaaS uptime alerts. | Drop data webhook payload (`alert.json` with ticker and change %). | **Pipeline 1** / **2** |
| **Micro-Promotions & Drops** | 91–100 | Flash discount promo codes, affiliate deal callouts, daily micro-horoscopes, daily AI hot takes. | Short text file with coupon, expiration time, and CTA text. | **Pipeline 1** |

---

### Format 3: Short-Form & Long-Form Video (Items 101 to 150)
* **Primary Modality**: `video` (Compiled directly into `VideoIRDocument` for 4K / NVENC FFI rendering)
* **Pipeline Focus**: **Pipeline 3** (Repurposed Clips), **Pipeline 4** (Generative Storytelling), **Pipeline 2** (Bar Chart Races)
* **Target Folder Setup**:
  - **Option A (Storytelling)**: Chronological images (`01.png`, `02.png`...) + voiceover audio (`01.mp3`, `02.mp3`...).
  - **Option B (Chart Race)**: `ranking_data.csv` with historical year/month metric values.
  - **Option C (Long Video Repurpose)**: `interview.mp4` + optional `captions.srt`.

| Sub-Category | Item Range | Example Content Types | How to Stage in Folder | Primary Pipeline |
| :--- | :--- | :--- | :--- | :--- |
| **Faceless Stories & Lore** | 101–110 | Reddit TTS horror stories, creepypasta tales, historical drama vignettes, daily tarot reading videos. | Visual slides + voiceover audio (`01.png` + `01.mp3`) + `--framework mystery_box`. | **Pipeline 4** |
| **Dynamic Data Visualizers** | 111–120 | Animated bar chart races, GDP evolution, crypto market dominance race, split-screen comparison videos. | Drop `history.csv` with year/date column and ranked entities. | **Pipeline 2** |
| **Cinematic 3D Explanations**| 121–130 | 3D Depth parallax scientific explainers, war documentary timelines, space exploration visual journeys. | High-res scene photos + voiceover + `--depth` flag enabled. | **Pipeline 4** |
| **Viral Repurposed Clips** | 131–140 | Podcast short highlights, keynote speech golden nuggets, stream reaction clips, interview soundbites. | Raw video file (`podcast.mp4`) + run with `--pipeline 3 --aspect 9:16`. | **Pipeline 3** |
| **Atmospheric Video Loops** | 141–150 | Lo-fi chill visualizers, rain window loops, cyber city drive loops, motivational quote slow-burn loops. | Seamless background visual (`scene.png`) + continuous audio (`beat.mp3`). | **Pipeline 6** |

---

### Format 4: Podcasts & Audio Production (Items 151 to 200)
* **Primary Modality**: `audio` (Processed directly via `AudioExporter` with EBU R128 loudness normalization)
* **Pipeline Focus**: **Pipeline 3** (Audio Extraction), **Pipeline 4** (Dramatic Narration), **Pipeline 6** (Binaural & Lo-fi)
* **Target Folder Setup**:
  - Voiceover tracks (`speech.wav`, `chapter1.mp3`) or text files for automated local TTS (`Kokoro-82M` / `VieNeu-TTS`).
  - Optional: `bgm.mp3` (Background music for automated ducking at `-14dB`).
  - Optional: Sound effect markers or cues in `sfx/` folder.

| Sub-Category | Item Range | Example Content Types | How to Stage in Folder | Primary Pipeline |
| :--- | :--- | :--- | :--- | :--- |
| **Talk Shows & Podcasts** | 151–160 | Solo monologue podcasts, AI two-speaker debates, automated interview format shows, morning news radio. | Transcript file or dual-channel voice files (`host.mp3`, `guest.mp3`). | **Pipeline 4** / **1** |
| **Atmospheric & Wellness** | 161–170 | Lo-fi study beat compilations, guided mindfulness meditation, yoga flow audio guides, nature rain soundscapes. | Looping audio file (`rain.wav`, `lofi.mp3`) + zero voiceover files. | **Pipeline 6** |
| **Audiobooks & Drama** | 171–180 | Public domain audiobooks, web novel dramatized narrations, creepypasta audio plays, bedtime stories. | Long narrative text or chapter audio + ambient tension drone track. | **Pipeline 4** |
| **Education & Habit Loops** | 181–190 | Spaced repetition vocabulary drills, language shadowing audio, commuter traffic audio bulletins. | Word pronunciation audio files or vocabulary list text file. | **Pipeline 1** / **4** |
| **Functional Audio & ASMR** | 191–200 | HIIT workout interval whistles, Pomodoro work/rest audio bells, 3D binaural whispering ASMR, pink/brown noise. | Rhythmic audio loops or interval cue audio files. | **Pipeline 6** |

---

### Format 5: Interactive Web & Procedural Logic (Items 201 to 250)
* **Primary Modality**: `interactive-web` (HTML5 Canvas, D3.js scrollytelling, Web Components, Three.js widgets)
* **Pipeline Focus**: **Pipeline 5** (Calculators & Logic Trees), **Pipeline 4** (Branching Fiction), **Pipeline 2** (Interactive D3 Visualizations)
* **Target Folder Setup**:
  - `rules.json` or `tree.json` containing state nodes, conditions, and next steps.
  - Or `scenario.txt` with branching markers (`Choice 1: ... -> Goto Step 2`).
  - Or `calculator.json` defining input variables, formulas, and metric outputs.

| Sub-Category | Item Range | Example Content Types | How to Stage in Folder | Primary Pipeline |
| :--- | :--- | :--- | :--- | :--- |
| **Branching Fiction & RPG** | 201–210 | Choose-Your-Own-Adventure game trees, visual novel state machines, interactive escape room puzzles. | Drop `story_tree.json` with nodes, dialogue, and choice branches. | **Pipeline 5** / **4** |
| **Scrollytelling & Globes** | 211–220 | Journalistic interactive scrollytelling articles, interactive 3D WebGL crisis globes, animated timeline trees. | Chronological events dataset (`timeline.json`) + event images. | **Pipeline 2** / **1** |
| **Interactive Calculators** | 221–230 | Mortgage payment calculators, SaaS ROI estimators, tax deduction simulators, fitness calorie counters. | Drop `formula.json` defining inputs, sliders, and mathematical equations. | **Pipeline 5** |
| **Interactive Knowledge** | 231–240 | Multiple-choice trivia quizzes, interactive periodic table, election result live predictor maps. | Drop `quiz.json` with questions, options, and correct answers. | **Pipeline 5** |
| **Visual Computing & Code** | 241–250 | Interactive code sandboxes, algorithm step visualizers (sorting/trees), interactive web comic carousels. | Step-by-step code tutorial markdown with executable code blocks. | **Pipeline 5** |
