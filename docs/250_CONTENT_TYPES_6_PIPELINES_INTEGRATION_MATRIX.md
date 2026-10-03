# 250 Content Types x 6 Core Pipelines Integration Matrix

> **System Architecture Specification & Content Matrix Mapping Guide**
> **Project:** ACC (Automated Content Creator) Multi-Pipeline Engine
> **Reference Documents:** `docs/1.the_ultimate_automated_content_matrix_en.md` & `docs/2.6_core_implementation_strategies.en.md`

---

## 1. Executive Summary & Core Architectural Paradigm

The primary principle of the ACC Multi-Pipeline Engine is: **Build 6 core canonical pipeline architectures that process structured data, assets, or generative prompts, and branch out into 250 distinct content variants at the distribution (Exporter) stage.**

Rather than creating 250 isolated scripts, every single content variant described in the 250 Automated Content Matrix is mapped directly onto one of the **6 Core Canonical Pipelines** in `apps/cli/src/pipelines/` and exported via one of the multi-channel exporters in `@acc/exporters`.

```
[ Trigger / Ingestion Source ]
             │
             ▼
[ 1 of 6 Canonical Pipelines (PipelineRunner Middleware Chain) ]
  ├── Pipeline 1: Event-Driven Scraper & Summarizer
  ├── Pipeline 2: Database Injection & Programmatic Templating
  ├── Pipeline 3: Repurposing / Asset Extraction & Recycling
  ├── Pipeline 4: Autonomous Generative Storytelling
  ├── Pipeline 5: Rule-based & Math Logic Generation
  └── Pipeline 6: Infinite Ambient & Procedural Loops
             │
             ▼
[ Unified Exporter Dispatcher (@acc/exporters) ]
  ├── Static Web Exporter      (WordPress / Ghost / Webflow / SSG HTML/MD)
  ├── Social Network Exporter  (Twitter/X Threads, LinkedIn, Quote Cards, Infographic PNG)
  ├── Video Engine Exporter    (TikTok/Reels 9:16, Youtube 16:9 MP4/WebM)
  ├── Audio Engine Exporter    (Podcast MP3/WAV, Audiobooks, SFX/BGM)
  ├── Interactive Web Exporter (HTML5 / D3.js / React-Vue Widgets / WebGL)
  └── Live Stream Exporter     (24/7 RTMP / FLV Stream)
```

---

## 2. Canonical Pipeline Mapping Matrix Overview

| Pipeline ID | Pipeline Name & Class | Primary Input Strategy | Key AI / Engine Stack | Primary Target Exporters |
| :--- | :--- | :--- | :--- | :--- |
| **Pipeline 1** | `ScraperPipeline` (`01-scraper`) | Cron / Webhooks / RSS / REST APIs | vLLM / Qwen2.5 / Llama3 (JSON Grammar), Bun WebSockets | `static-web`, `social`, `audio`, `video` |
| **Pipeline 2** | `DBTemplatingPipeline` (`02-db-templating`) | SQL / PostgreSQL JSONB / Airtable / Specs DB | `@napi-rs/canvas`, Puppeteer, D3.js, SSG Builders | `static-web`, `social`, `video`, `interactive-web` |
| **Pipeline 3** | `RepurposingPipeline` (`03-repurposing`) | Long-form Video / Audio / Books / Webinars / PDFs | Whisper.cpp, OpenCV / YOLO / SAM 2, FFmpeg FFI zero-copy | `static-web`, `social`, `video`, `audio` |
| **Pipeline 4** | `GenerativeStoryPipeline` (`04-generative-story`) | Prompt Seeds / Story Config JSON / LLM AST | Flux/SDXL (diffusers), F5-TTS/Kokoro, Depth3D, AudioDucking | `video`, `audio`, `social`, `static-web`, `interactive-web` |
| **Pipeline 5** | `RuleLogicPipeline` (`05-rule-logic`) | Algorithmic Solvers / Equations / Physics Rules | Native JS/Python math solvers, Manim Engine, LLM Interpreters | `static-web`, `social`, `video`, `audio`, `interactive-web` |
| **Pipeline 6** | `AmbientStreamPipeline` (`06-ambient-stream`) | Continuous procedural generator / White noise | MusicGen (AudioCraft), WebGL Shaders, FFmpeg RTMP Stdin Pipe | `live-stream`, `video`, `audio`, `interactive-web` |

---

## 3. Detailed Itemized Mapping: 250 Content Variants Across 6 Pipelines

Below is the exhaustive, item-by-item architectural mapping for all 250 content types from the content matrix into the 6 pipelines and exporter destinations.

---

### Format 1: Static Web Post (CMS: WordPress, Ghost, Webflow, SSG)

#### Group 1.1: News, Data & Reports
*Primary Pipeline:* **Pipeline 1 (Event-Driven Scraper & Summarizer)**
*Exporter Target:* `@acc/exporters/static-web` (Markdown / Ghost REST API / WordPress XML-RPC)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Daily Industry Digest | Pipeline 1 | RSS / Webhooks | vLLM Qwen2.5 JSON summarization | Static Web |
| 2 | Market/Crypto Recap | Pipeline 1 | CoinGecko / Yahoo Finance API | ChartJS + LLM market analysis | Static Web |
| 3 | Real Estate Price Tracker | Pipeline 1 | Classifieds REST APIs | Geo-spatial grouping + Markdown table | Static Web |
| 4 | Hyper-local Weather Briefing | Pipeline 1 | OpenWeatherMap API | Contextual clothing/schedule rules | Static Web |
| 5 | Startup Funding Roundups | Pipeline 1 | Crunchbase / SEC EDGAR API | Financial bullet-point summarizer | Static Web |
| 6 | Regulatory/Policy Updates | Pipeline 1 | Gov Scraper (Puppeteer) | ELI5 legal language simplification | Static Web |
| 7 | Local Event Calendar | Pipeline 1 | Eventbrite / Meetup APIs | Categorized date/location aggregator | Static Web |
| 8 | Utility Outage Alerts | Pipeline 1 | Utility RSS / Scraper | Geo-mapped HTML list generation | Static Web |
| 9 | Earthquake/Disaster Reports | Pipeline 1 | USGS API Webhook | Fast automated breaking alert generator | Static Web |
| 10 | GitHub Trending Repos | Pipeline 1 | GitHub REST / GraphQL API | Repository description & tech summary | Static Web |

#### Group 1.2: Programmatic SEO & E-commerce
*Primary Pipeline:* **Pipeline 2 (Database Injection & Programmatic Templating)**
*Exporter Target:* `@acc/exporters/static-web` (Next.js/Astro SSG, Webflow CMS API)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 11 | Product A vs Product B | Pipeline 2 | Specs PostgreSQL JSONB DB | Jinja2 / Nunjucks comparison table | Static Web |
| 12 | Top 10 [Niche] Products | Pipeline 2 | Amazon Product Advertising API | Dynamic affiliate listicle builder | Static Web |
| 13 | Daily Coupon Aggregator | Pipeline 2 | Promo Code API / DB | Expiration validator + HTML grid | Static Web |
| 14 | Price History Analysis | Pipeline 2 | Historical Price DB | All-time low detection + advice badge | Static Web |
| 15 | Tech Specs Buyer's Guide | Pipeline 2 | Spec DB | Rule-based filtering + LLM guide | Static Web |
| 16 | AI-Summarized User Reviews | Pipeline 2 | Review Scraper (1-5 stars) | Consensus sentiment extractor | Static Web |
| 17 | Alternatives to [Product] | Pipeline 2 | SaaS Database | Feature matrix comparison SSG | Static Web |
| 18 | Unboxing & Specs Teaser | Pipeline 2 | New Release RSS | Image extraction + spec callouts | Static Web |
| 19 | In-stock Alerts (Scarcity) | Pipeline 2 | E-comm Inventory Poller | Scarcity notification builder | Static Web |
| 20 | Occasion Gift Guides | Pipeline 2 | Calendar / Occasion DB | Persona-based product filter | Static Web |

#### Group 1.3: Education, Reference & Utility
*Primary Pipeline:* **Pipeline 5 (Rule-based & Math Logic Generation)**
*Exporter Target:* `@acc/exporters/static-web` (Hugo / Docusaurus / Astro)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 21 | Niche Glossary & Terms | Pipeline 2 | DB Dictionary | Programmatic SEO page generator | Static Web |
| 22 | Math/Physics Formula Explainer | Pipeline 5 | Algorithmic Math Engine | KaTeX LaTeX renderer + practice generator | Static Web |
| 23 | "On This Day" History | Pipeline 1 | Wikipedia API | Current date event filter + LLM recap | Static Web |
| 24 | Code Snippet Library | Pipeline 5 | Code AST DB | Prism.js / Shiki syntax highlighter | Static Web |
| 25 | Daily Grammar Examples | Pipeline 5 | Linguistic Grammar Engine | Sentence template generator | Static Web |
| 26 | Developer Cheat Sheets | Pipeline 5 | CLI command DB | Markdown cheat table formatter | Static Web |
| 27 | Cosmetic Ingredient Analyzer | Pipeline 2 | Chemical DB | Ingredient toxicity/function lookup | Static Web |
| 28 | Automated Biographies | Pipeline 2 | Wikidata SPARQL | Biography template synthesizer | Static Web |
| 29 | Recipe Nutrition Facts | Pipeline 2 | USDA Food API | Macro Breakdown calculator | Static Web |
| 30 | Zodiac/Feng Shui Calculations | Pipeline 5 | Astronomical Ephemeris Engine | Chart calculation algorithm | Static Web |

#### Group 1.4: Lifestyle, Travel & Niche
*Primary Pipeline:* **Pipeline 2 (DB Templating)** & **Pipeline 1 (Scraper)**
*Exporter Target:* `@acc/exporters/static-web`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 31 | "What's in My Fridge" Recipe | Pipeline 5 | Ingredient List Input | Combinatorial recipe lookup solver | Static Web |
| 32 | Automated Travel Itineraries | Pipeline 2 | City Points-of-Interest DB | Spatial routing optimizer + schedule | Static Web |
| 33 | Restaurant Aggregator Reviews | Pipeline 1 | Google Maps API | Synthetic review summary generator | Static Web |
| 34 | Flight Price Drop Alerts | Pipeline 1 | Aviation Flight APIs | Price threshold detector | Static Web |
| 35 | Ingredient Substitute Guides | Pipeline 2 | Food Substitute Matrix DB | Substitution ratio calculator | Static Web |
| 36 | Etiquette & Travel Tips | Pipeline 2 | Cultural DB | Do's and Don'ts checklist builder | Static Web |
| 37 | Dynamic Packing Lists | Pipeline 1 | Weather API + Trip Type | Packing rules matrix solver | Static Web |
| 38 | Ski Snow/Trail Reports | Pipeline 1 | Ski Resort API | Trail condition status table | Static Web |
| 39 | Trending OOTD Posts | Pipeline 1 | Pinterest/Fashion RSS | Outfit item combiner | Static Web |
| 40 | Non-fiction Book Summaries | Pipeline 3 | Book PDF / EPUB | LLM chapter chunker & key takeaway extractor | Static Web |

#### Group 1.5: Tech, Repurposing & Misc
*Primary Pipeline:* **Pipeline 3 (Repurposing)** & **Pipeline 4 (Generative Storytelling)**
*Exporter Target:* `@acc/exporters/static-web`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 41 | Multilingual Blog Translation | Pipeline 3 | Master Post Markdown | LLM / DeepL batch translation API | Static Web |
| 42 | Podcast Transcripts | Pipeline 3 | Podcast Audio File | Whisper.cpp transcription & speaker diary | Static Web |
| 43 | YouTube Video-to-Blog | Pipeline 3 | YouTube URL / Video | Subtitle parse + screenshot extraction | Static Web |
| 44 | Automated Changelogs | Pipeline 1 | GitHub Commit Log / PRs | Conventional Commits -> Release Notes LLM | Static Web |
| 45 | Niche Job Board Posts | Pipeline 1 | Job Scraper / RSS | Job listing schema extractor | Static Web |
| 46 | Daily AI Prompt Library | Pipeline 4 | Prompt Seed DB | Midjourney/Flux prompt test + sample render | Static Web |
| 47 | Server Uptime Reports | Pipeline 1 | Prometheus / Grafana API | Incident log formatter | Static Web |
| 48 | Live Sports Results | Pipeline 1 | Sports Score Webhook | Game end summary template | Static Web |
| 49 | Open Source Issue Aggregator | Pipeline 1 | GitHub API (good-first-issue) | Developer callout aggregator | Static Web |
| 50 | Automated Case Studies | Pipeline 2 | Client Survey JSON | Form data -> Success story formatter | Static Web |

---

### Format 2: Limited Length Social Network (X, Threads, LinkedIn, Facebook)

#### Group 2.1: Text & Threads (Storytelling & Explainers)
*Primary Pipeline:* **Pipeline 3 (Repurposing)** & **Pipeline 1 (Scraper)**
*Exporter Target:* `@acc/exporters/social` (Twitter API v2 / LinkedIn API / Mastodon REST)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 51 | Book Summary Threads | Pipeline 3 | Book PDF / EPUB | LLM Chunker -> 280 char thread array | Social |
| 52 | ELI5 Concept Explainers | Pipeline 3 | Complex Tech Article | LLM Grade-5 simplification engine | Social |
| 53 | Mini Case-studies | Pipeline 3 | Marketing Report | Short hook + 3-point story formatter | Social |
| 54 | Historical Event Timelines | Pipeline 3 | Historical Record | Chronological thread generator | Social |
| 55 | Podcast Quote Extractions | Pipeline 3 | Audio Transcript | Top punchline extractor | Social |
| 56 | Daily Tool Stack Recs | Pipeline 2 | SaaS DB | Bullet point top-5 generator | Social |
| 57 | Daily Micro-Challenges | Pipeline 5 | Habit Rules Matrix | Single daily task prompt generator | Social |
| 58 | Micro-fiction (2-sentence) | Pipeline 4 | Prompt Seed | 2-sentence story LLM generator | Social |
| 59 | Social "On This Day" | Pipeline 1 | Wikipedia API | Short nostalgic text + link | Social |
| 60 | Auto-reply Interaction Bots | Pipeline 1 | Mention Webhook / Stream | Contextual answer generator | Social |

#### Group 2.2: Image, Carousel & Infographic
*Primary Pipeline:* **Pipeline 2 (Database Injection & Canvas Rendering)**
*Exporter Target:* `@acc/exporters/social` (`@napi-rs/canvas` PNG / PDF Carousels)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 61 | Auto Quote Cards | Pipeline 2 | Quote DB | `@napi-rs/canvas` text layout over background | Social |
| 62 | Market Pie Charts | Pipeline 2 | Financial Data DB | ChartJS / Canvas pie graph renderer | Social |
| 63 | "VS" Split Image Cards | Pipeline 2 | Comparison DB | Split-screen template compositor | Social |
| 64 | Automated Meme Generator | Pipeline 2 | Meme Templates + Text | Text overlay alignment engine | Social |
| 65 | Product Feature Mockups | Pipeline 2 | Product Specs DB | Device frame mockup compositor | Social |
| 66 | Event Countdown Cards | Pipeline 5 | Target Event Timestamp | Remaining time graphic renderer | Social |
| 67 | "Did You Know?" Fact Cards | Pipeline 2 | Trivia DB | Lightbulb icon + typography renderer | Social |
| 68 | AI-generated Mind Maps | Pipeline 3 | Summary Text | Mermaid.js / Graphviz image exporter | Social |
| 69 | Visual Learning Roadmaps | Pipeline 2 | Skill Tree DB | Step-by-step vector canvas renderer | Social |
| 70 | Pre-flight Checklists | Pipeline 2 | Checklist DB | Green tick graphic template generator | Social |

#### Group 2.3: Interactive & Community
*Primary Pipeline:* **Pipeline 1 (Event-Driven)** & **Pipeline 5 (Rule Logic)**
*Exporter Target:* `@acc/exporters/social`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 71 | Controversial Polls | Pipeline 1 | Industry News RSS | Opinion poll question generator | Social |
| 72 | "This or That" Comparisons | Pipeline 2 | Product Image Pair | 2-image grid layout renderer | Social |
| 73 | Fill-in-the-blank Prompts | Pipeline 4 | Niche Topic | Sentence completion generator | Social |
| 74 | AMA Auto-reply Bots | Pipeline 1 | Hashtag Webhook | LLM QA answer generator | Social |
| 75 | Giveaway Announcements | Pipeline 5 | User List / Random Seed | Cryptographic random winner picker | Social |
| 76 | Customer Testimonials | Pipeline 2 | 5-Star Review DB | Screenshot blur & layout renderer | Social |
| 77 | "Caption This" Posts | Pipeline 4 | Flux/SDXL Random Image | Weird image render + prompt | Social |
| 78 | Hashtag Hijackers | Pipeline 1 | X Trending API | Contextual tweet drafter | Social |
| 79 | Emoji Puzzles | Pipeline 5 | Movie Title List | Text-to-emoji translation engine | Social |
| 80 | Weekly Community Wrap-up | Pipeline 1 | Group Activity Log | Weekly metric summary template | Social |

#### Group 2.4: Real-time Alerts & Niche
*Primary Pipeline:* **Pipeline 1 (Event-Driven Scraper & Summarizer)**
*Exporter Target:* `@acc/exporters/social` (Push Notifications / Telegram / X API)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 81 | Crypto/Stock Price Thresholds | Pipeline 1 | Price Webhook / WebSocket | Threshold comparison alert builder | Social |
| 82 | Traffic/Weather Alerts | Pipeline 1 | Traffic API | Rush hour delay detector | Social |
| 83 | Live Soccer Tickers | Pipeline 1 | Sports API Event Stream | Immediate score/card tweet builder | Social |
| 84 | Stock Market Breakout Alerts | Pipeline 1 | Financial Market Stream | Percentage gain anomaly detector | Social |
| 85 | Flight Delay Notifications | Pipeline 1 | Airport API | Cancellation notice template | Social |
| 86 | SaaS Downtime Status | Pipeline 1 | Ping / Status Page Webhook | Downtime notice generator | Social |
| 87 | "Word of the Day" | Pipeline 2 | Vocabulary DB | Phonetic + example card generator | Social |
| 88 | WOD (Workout of the Day) | Pipeline 5 | Exercise Matrix DB | Random exercise combination engine | Social |
| 89 | Daily Detox Recipes | Pipeline 2 | Recipe DB | Quick short-text blend guide | Social |
| 90 | Livestream Notifications | Pipeline 1 | YouTube / Twitch Webhook | Pre-stream scheduled alert post | Social |

#### Group 2.5: Promotions, Marketing & Misc
*Primary Pipeline:* **Pipeline 2 (DB Templating)** & **Pipeline 4 (Generative)**
*Exporter Target:* `@acc/exporters/social`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 91 | Affiliate Link Drops | Pipeline 2 | Affiliate Offer DB | Discount + link post generator | Social |
| 92 | Flash Discount Codes | Pipeline 2 | Coupon DB | Limited redemptions copy generator | Social |
| 93 | Flash Sale Countdowns | Pipeline 1 | E-comm Stock API | Inventory remaining counter | Social |
| 94 | Ticket Scarcity Alerts | Pipeline 1 | Ticketing API | Low-stock ticket notice | Social |
| 95 | Urgent Job Alerts | Pipeline 1 | ATS Job Feed | Role + salary bracket highlight | Social |
| 96 | Freelancer Tips | Pipeline 2 | Career Tips DB | Scheduled advice post builder | Social |
| 97 | 6 AM Positive Affirmations | Pipeline 4 | Affirmation Seed | Inspirational text + layout | Social |
| 98 | Micro-Horoscopes | Pipeline 5 | Astrological Ephemeris | Zodiac sign text generator | Social |
| 99 | Throwback Thursday (TBT) | Pipeline 3 | Historic Post Database | Auto quote-retweet / reposter | Social |
| 100 | AI "Hot Takes" | Pipeline 4 | Trending Topic | Contrarian opinion LLM generator | Social |

---

### Format 3: Video (Shorts, Reels, TikTok, Long-Form MP4)

#### Group 3.1: Faceless Shorts & Entertainment
*Primary Pipeline:* **Pipeline 3 (Repurposing)** & **Pipeline 4 (Generative Storytelling)**
*Exporter Target:* `@acc/exporters/video` (TikTok/Reels 9:16 vertical video engine with Burned Subtitles & 3D Depth)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 101 | Reddit/Creepypasta TTS | Pipeline 3 | Reddit API / Web Scraper | Kokoro TTS + Gameplay B-roll + Subtitles | Video |
| 102 | Whisper Confessions | Pipeline 4 | Story Prompt | Whisper voice clone + ambient SFX + Dark BG | Video |
| 103 | AI Visual Horror Stories | Pipeline 4 | Script JSON | Flux visuals + Depth3D + Ken Burns + Horror audio | Video |
| 104 | Tarot Daily Draws | Pipeline 5 | Card Draw Randomizer | Card image overlay + Voiceover explanation | Video |
| 105 | 60s Tech News Slideshow | Pipeline 1 | Tech RSS | FFmpeg slide render + TTS recap | Video |
| 106 | "Who Would Win?" | Pipeline 2 | Animal/Hero Stats DB | Split screen stats + FFmpeg transition | Video |
| 107 | Animal Facts | Pipeline 2 | Fauna DB | Stock video B-roll + TTS + Subtitles | Video |
| 108 | Geography Quiz Timers | Pipeline 5 | Quiz Matrix DB | Flag render + 3s countdown overlay | Video |
| 109 | Guess the AI Cover | Pipeline 4 | AI Audio Clip | Audio wave overlay + timed answer reveal | Video |
| 110 | Oddly Satisfying Loops | Pipeline 6 | Satisfying Video Clips | Seamless video loop + quote voiceover | Video |

#### Group 3.2: Educational & Explainers
*Primary Pipeline:* **Pipeline 5 (Rule Logic - Manim)** & **Pipeline 2 (DB Templating - Bar Chart Race)**
*Exporter Target:* `@acc/exporters/video`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 111 | Bar Chart Racing | Pipeline 2 | Time-series Data JSON | D3 / Canvas bar chart race -> FFmpeg | Video |
| 112 | Step-by-step Math | Pipeline 5 | Equation Input | Manim Python engine chalkboard render | Video |
| 113 | Typing Code Tutorials | Pipeline 5 | Code Snippet | IDE typing animation generator | Video |
| 114 | Bilingual Flashcards | Pipeline 2 | Language Pair DB | Word -> 3s pause -> Image/translation slide | Video |
| 115 | Animated Pronunciation | Pipeline 5 | Phonetic Word | 3D mouth shape / Waveform video render | Video |
| 116 | Google Earth Zoom-ins | Pipeline 2 | Geo Coordinates | Mapbox / Google Earth Studio automated zoom | Video |
| 117 | Physics Experiments | Pipeline 5 | Physics Parameters | Matter.js / Canvas 2D physics simulation video | Video |
| 118 | Space & Sci-fi Facts | Pipeline 1 | NASA Imagery API | Interstellar audio + NASA video stitch | Video |
| 119 | 3D Anatomy Models | Pipeline 2 | 3D Mesh Assets | Three.js / Headless WebGL rotating render | Video |
| 120 | Historical Timelines | Pipeline 2 | Dynasty Record DB | Horizontal scrolling timeline render | Video |

#### Group 3.3: Visual Storytelling & Narrative
*Primary Pipeline:* **Pipeline 4 (Autonomous Generative Storytelling)**
*Exporter Target:* `@acc/exporters/video` (`EditingPipelineOrchestrator`, 3D Depth Frame-Breaker)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 121 | AI Short Films | Pipeline 4 | Seed Prompt | LLM -> Flux -> SAM 2 / Depth v2 -> FFmpeg FFI | Video |
| 122 | Motion Comics | Pipeline 4 | Comic Pages | Layer slice + Live2D breathing/blinking | Video |
| 123 | "Choose Your Path" Videos | Pipeline 4 | Branching Script AST | Video segment render + End-screen links | Video |
| 124 | Historical Interviews | Pipeline 4 | Historical Figure Prompt | Avatar lip-sync (HeyGen/LivePortrait) | Video |
| 125 | AI Stand-up Comedy | Pipeline 4 | Joke Database | 3D Avatar + Auto laugh track insertion | Video |
| 126 | Poetry Reading Visuals | Pipeline 4 | Poem Text | Ambient particle FX (Snow/Rain) + Voice | Video |
| 127 | Lullabies for Kids | Pipeline 6 | Music Box Track | Looping moon/star animation + crossfade | Video |
| 128 | POV Historical Diaries | Pipeline 4 | Historical Text | Handwriting overlay FX + Parchment canvas | Video |
| 129 | Alternate History | Pipeline 4 | "What If" Prompt | AI Visual scenario pipeline | Video |
| 130 | Mythology Maps | Pipeline 4 | Map Vector DB | Hand-drawn map + spotlight animations | Video |

#### Group 3.4: Commerce, Utility & Marketing
*Primary Pipeline:* **Pipeline 2 (DB Templating)** & **Pipeline 3 (Repurposing)**
*Exporter Target:* `@acc/exporters/video`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 131 | Amazon Zoom-in Reviews | Pipeline 2 | Product Photos | Pan & Zoom Ken Burns + TTS review | Video |
| 132 | Web Walkthrough Compilations | Pipeline 3 | UI Screenshots | Screenshot transition & cursor animation | Video |
| 133 | Real Estate Tours | Pipeline 2 | Property Photos | Room slideshow + Smooth morph transitions | Video |
| 134 | Stock Market Recap | Pipeline 1 | Financial Ticker Stream | Candlestick motion graphic video | Video |
| 135 | Crypto Chart Analysis | Pipeline 1 | Price History DB | Automatic support/resistance line drawing | Video |
| 136 | Timelapse Cooking | Pipeline 3 | Cooking Photo Sequence | High-speed photo sequence stitcher | Video |
| 137 | Workout Interval Timers | Pipeline 5 | Interval Config | Animated countdown overlay + beep cues | Video |
| 138 | AI Fashion Lookbooks | Pipeline 4 | AI Fashion Models | Fabric texture zoom-in video | Video |
| 139 | 360 Car Showcases | Pipeline 2 | 3D Car Model | Revolving 3D WebGL headless frame capture | Video |
| 140 | Travel Highlight Reels | Pipeline 3 | Travel Footage DB | Top-10 scenic spot clip stitching | Video |

#### Group 3.5: Long-form, Ambient & Compilations
*Primary Pipeline:* **Pipeline 6 (Infinite Ambient & Loops)** & **Pipeline 3 (Repurposing - Compilations)**
*Exporter Target:* `@acc/exporters/video`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 141 | 10-hour Lofi Radio | Pipeline 6 | Audio Engine + Looping GIF | MusicGen loop + seamless visual render | Video |
| 142 | 1-hour Sleep Stories | Pipeline 4 | Story Script | Fade to black at 30m + Audio attenuation | Video |
| 143 | Karaoke Text Audiobooks | Pipeline 3 | EPUB + Audio | Word-level Whisper sync karaoke video | Video |
| 144 | Auto-Documentaries | Pipeline 3 | Script Keywords | Stock footage auto-search + Script sync | Video |
| 145 | Long-form Audiograms | Pipeline 3 | Podcast MP3 | Waveform audio visualizer render | Video |
| 146 | Webinar Viral Auto-cuts | Pipeline 3 | Long Webinar Video | Face-tracking (YOLO) 9:16 vertical crop | Video |
| 147 | TikTok Meme Compilations | Pipeline 3 | Short Clip DB | Auto-stitch compilation with transitions | Video |
| 148 | 500-Year Bar Chart Races | Pipeline 2 | Historical CSV DB | Long-form D3 video compilation | Video |
| 149 | Meditation Guides | Pipeline 5 | Breathing Cadence | Expanding/contracting circle shader | Video |
| 150 | Ambient Screensavers | Pipeline 6 | Procedural Shaders | Fireplace/Aquarium WebGL infinite render | Video |

---

### Format 4: Audio (Music, Podcast, Audiobooks, SFX)

#### Group 4.1: Podcasts & Talk Shows
*Primary Pipeline:* **Pipeline 3 (NotebookLM Clone)** & **Pipeline 1 (News Anchor)**
*Exporter Target:* `@acc/exporters/audio` (MP3 / WAV / AAC / RSS Podcast Feed)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 151 | 2-Host Deep Dive | Pipeline 3 | PDF / Document | Multi-voice conversational LLM + Kokoro TTS | Audio |
| 152 | Solo News Anchor | Pipeline 1 | Daily News Feed | Formal TTS Voiceover + Intro/Outro BGM | Audio |
| 153 | Celebrity Interviews | Pipeline 4 | Interview Script | Voice-cloned celebrity TTS engine | Audio |
| 154 | Panel Discussions | Pipeline 3 | Topic Prompt | 4 distinct TTS voices with interjections | Audio |
| 155 | Simulated Debates | Pipeline 4 | Topic Pro/Con | Dual voice debate orchestration | Audio |
| 156 | 5-Min Product Launches | Pipeline 1 | ProductHunt RSS | Rapid summary TTS podcast | Audio |
| 157 | Crypto Market Wrap | Pipeline 1 | Market Ticker Stream | Price action reading script + TTS | Audio |
| 158 | Sports Commentary | Pipeline 1 | Match Log Event Stream | Dynamic energy commentary synthesizer | Audio |
| 159 | Showbiz Gossip Recaps | Pipeline 1 | Entertainment RSS | Sarcastic tone TTS recap | Audio |
| 160 | True Crime Podcasts | Pipeline 4 | Crime Archive | Creepy ambient SFX + Deep voice TTS | Audio |

#### Group 4.2: Music, Soundscapes & Ambient
*Primary Pipeline:* **Pipeline 6 (Infinite Ambient & Procedural Loops)**
*Exporter Target:* `@acc/exporters/audio` (`SmartRouter` DSP, MusicGen, AudioCraft)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 161 | 24/7 Lofi Hip Hop | Pipeline 6 | Procedural Seed | MusicGen 30s chunk generator + crossfader | Audio |
| 162 | Synthwave Focus Tracks | Pipeline 6 | Tempo Config | High-bpm synthwave generator | Audio |
| 163 | Binaural Beats | Pipeline 5 | Target Frequency | Dual-tone sine wave generator (Alpha/Theta) | Audio |
| 164 | Guided Meditation | Pipeline 4 | Meditation Script | Voiceover layered over Tibetan singing bowls | Audio |
| 165 | Yoga Flow Audio | Pipeline 5 | Yoga Sequence | Pose instructions + chime sound cues | Audio |
| 166 | Dynamic Nature Ambient | Pipeline 6 | Weather Logic | Rain + thunder + bird sound DSP mixer | Audio |
| 167 | Birthday Songs | Pipeline 4 | User Name Input | Suno / AudioCraft custom name lyrist | Audio |
| 168 | AI Song Covers | Pipeline 3 | Input Vocal Track | RVC Voice Conversion model pipeline | Audio |
| 169 | Historical Rap Battles | Pipeline 4 | LLM Lyrics | Rhyme lyrics -> RVC voice battle generator | Audio |
| 170 | Classical Music | Pipeline 5 | Algorithmic Harmony | Markov chain / Algorithmic MIDI composer | Audio |

#### Group 4.3: Audiobooks, Stories & Dramas
*Primary Pipeline:* **Pipeline 4 (Generative Storytelling)** & **Pipeline 3 (Book Narration)**
*Exporter Target:* `@acc/exporters/audio`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 171 | Public Domain Audiobooks | Pipeline 3 | Project Gutenberg Text | Long-form TTS narrator + Chapter tagger | Audio |
| 172 | Web-novel to Audio | Pipeline 3 | Web Novel RSS | Text chunker -> Chapter MP3 generator | Audio |
| 173 | Creepypasta Audio | Pipeline 4 | Creepypasta Text | Footstep/wind Foley SFX + Whisper voice | Audio |
| 174 | Bedtime Stories | Pipeline 4 | Child Name Prompt | Soft lullaby background + Soft TTS voice | Audio |
| 175 | Romance Whisper Audio | Pipeline 4 | Novel Excerpt | Expressive breathy TTS model | Audio |
| 176 | Sci-fi Captain's Logs | Pipeline 4 | Log Script | Radio static DSP filter + Voiceover | Audio |
| 177 | Gaming Lore Narrations | Pipeline 3 | Game Lore Wiki | Dramatic voiceover + Game ambience | Audio |
| 178 | Poetry Readings | Pipeline 4 | Poem Text | Rhythmic pause aware TTS renderer | Audio |
| 179 | Philosophical Essays | Pipeline 3 | Philosophical Text | Slow-paced, deep tone narration | Audio |
| 180 | Religious Readings | Pipeline 3 | Sacred Text | Steady voice narration + auto bell chimes | Audio |

#### Group 4.4: Education, Utility & Tools
*Primary Pipeline:* **Pipeline 5 (Rule Logic)** & **Pipeline 1 (Event-Driven)**
*Exporter Target:* `@acc/exporters/audio`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 181 | Spaced Repetition Drills | Pipeline 5 | Vocab DB | Word -> timed pause -> Translation audio | Audio |
| 182 | Shadowing Practice Audio | Pipeline 5 | Phrase List | Sentence -> 5s silence pause generator | Audio |
| 183 | Mental Math Drills | Pipeline 5 | Equation Generator | "45 plus 32... [3s] ... 77" audio builder | Audio |
| 184 | Historical Speech Re-creator | Pipeline 3 | Historic Transcript | RVC cloned voice reading historic speech | Audio |
| 185 | Article-to-Audio Webhook | Pipeline 3 | Blog Post URL | HTML scraper -> TTS audio generator | Audio |
| 186 | Dev Changelog Audio | Pipeline 1 | Release Notes | Summary TTS briefing MP3 | Audio |
| 187 | Morning Weather Audio | Pipeline 1 | Weather API | 1-minute Telegram audio brief | Audio |
| 188 | Daily Horoscope Audio | Pipeline 5 | Zodiac DB | Astrological reading audio post | Audio |
| 189 | Traffic Report Audio | Pipeline 1 | Traffic API | Radio-style traffic alert clip | Audio |
| 190 | Emergency Alarm Tests | Pipeline 5 | Test Signal Config | Synthesized alert tones + voice alert | Audio |

#### Group 4.5: Interactive Audio, ASMR & Misc
*Primary Pipeline:* **Pipeline 6 (Procedural)** & **Pipeline 5 (Rule Logic)**
*Exporter Target:* `@acc/exporters/audio`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 191 | Workout Interval Cues | Pipeline 5 | Timer Config | Voice countdown + whistle sound effects | Audio |
| 192 | Pomodoro Voice Reminders | Pipeline 5 | 25m Timer | Break announcement voice generator | Audio |
| 193 | Hypnosis Tracks | Pipeline 4 | Hypnosis Script | Slow binaural beat + soothing voice | Audio |
| 194 | Binaural 3D ASMR | Pipeline 4 | ASMR Script | Spatial audio panning (Ambisonics 3D) | Audio |
| 195 | Infinite White Noise | Pipeline 6 | Noise Generator | Synthesized fan/airplane/rain audio DSP | Audio |
| 196 | Audio CAPTCHAs | Pipeline 5 | Random Digits | Number voice synthesizer + background noise | Audio |
| 197 | Audio Descriptions | Pipeline 3 | Image Alt Text | Screen reader audio description builder | Audio |
| 198 | IVR Phone Menus | Pipeline 2 | Menu JSON | Dynamic menu TTS audio generator | Audio |
| 199 | Holiday Voicemail Greetings | Pipeline 1 | Calendar Events | Festive greeting audio builder | Audio |
| 200 | Meme Soundboard Clips | Pipeline 3 | Audio Clips DB | Auto-trim sound effect clip exporter | Audio |

---

### Format 5: Interactive HTML/Web (Games, Scrollytelling, Tools)

#### Group 5.1: Games, Stories & Fiction
*Primary Pipeline:* **Pipeline 4 (Generative Storytelling)**
*Exporter Target:* `@acc/exporters/interactive-web` (HTML5 / Twine / Web Components / JS Game Bundle)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 201 | Choose Your Own Adventure | Pipeline 4 | Story Tree AST | HTML/JS choice button web application | Interactive Web |
| 202 | Web Visual Novels | Pipeline 4 | Visual Novel AST | Ren'Py Web / HTML5 Canvas novel UI | Interactive Web |
| 203 | Text-based RPGs | Pipeline 4 | Prompt World Engine | Infinite LLM Game Master chat interface | Interactive Web |
| 204 | Murder Mystery Chats | Pipeline 4 | Mystery Scenario DB | Interrogate AI suspect chat app | Interactive Web |
| 205 | Web Escape Rooms | Pipeline 5 | Puzzle Logic DB | Text puzzle validation web engine | Interactive Web |
| 206 | AI Dungeon Clones | Pipeline 4 | Unbounded Prompt | Text interaction web application | Interactive Web |
| 207 | Dating Sims | Pipeline 4 | Persona Config | Avatar dialogue chat web interface | Interactive Web |
| 208 | Card Battlers | Pipeline 5 | Card Stats DB | Algorithmic card generator + HTML game UI | Interactive Web |
| 209 | Wikipedia Trivia Games | Pipeline 1 | Wikipedia SPARQL | 10-question trivia quiz Web App | Interactive Web |
| 210 | "Guess the AI Image" | Pipeline 4 | Flux + Real Photos | Split image quiz UI | Interactive Web |

#### Group 5.2: Data Visualization & Scrollytelling
*Primary Pipeline:* **Pipeline 2 (DB Templating - D3/GSAP)** & **Pipeline 1 (Real-time Scraper)**
*Exporter Target:* `@acc/exporters/interactive-web` (D3.js / WebGL / Three.js / GSAP)

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 211 | Journalistic Scrollytelling | Pipeline 2 | Article Markdown + Data | GSAP ScrollTrigger + D3 chart binding | Interactive Web |
| 212 | Interactive Timelines | Pipeline 2 | Timeline JSON DB | Horizontal slider timeline web app | Interactive Web |
| 213 | 3D WebGL News Globes | Pipeline 1 | Geo Event Stream | Three.js 3D globe with interactive pins | Interactive Web |
| 214 | Real-time Stock Heatmaps | Pipeline 1 | Financial Market Stream | D3 treemap real-time color update | Interactive Web |
| 215 | Crypto Fear & Greed Dials | Pipeline 1 | Sentiment Index API | Animated gauge dial Web Component | Interactive Web |
| 216 | Interactive Periodic Tables | Pipeline 2 | Chemical Element DB | Element grid click pop-up explainer | Interactive Web |
| 217 | Dynamic Weather Maps | Pipeline 1 | Meteorological API | Leaflet / Mapbox dynamic weather layers | Interactive Web |
| 218 | Population Sliders | Pipeline 2 | Demographic CSV | Year slider population pyramid chart | Interactive Web |
| 219 | Election Prediction Maps | Pipeline 2 | Electoral Vote DB | Clickable state red/blue tally map | Interactive Web |
| 220 | Knowledge Graphs | Pipeline 2 | Graph Database | D3 force-directed knowledge graph UI | Interactive Web |

#### Group 5.3: Calculators, Tools & Planners
*Primary Pipeline:* **Pipeline 5 (Rule Logic & Math Engine)**
*Exporter Target:* `@acc/exporters/interactive-web`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 221 | ROI Calculators + AI Analysis | Pipeline 5 | Financial Formula | Math formula calc + LLM risk assessment | Interactive Web |
| 222 | Calorie Counters | Pipeline 5 | Calorie Matrix DB | Weight goal math + Local dish generator | Interactive Web |
| 223 | Mortgage Calculators | Pipeline 5 | Amortization Engine | Interest math + Cashflow recommendation | Interactive Web |
| 224 | Tax Estimator Forms | Pipeline 5 | Tax Bracket Rules | Income form calculation engine | Interactive Web |
| 225 | Carbon Footprint Quizzes | Pipeline 5 | Emission Factors DB | Quiz score calculation widget | Interactive Web |
| 226 | Resume Builders | Pipeline 4 | Raw Text Input | LLM resume formatter -> HTML UI | Interactive Web |
| 227 | Cover Letter Generators | Pipeline 4 | Job URL Scraper | Scraped spec + user profile letter builder | Interactive Web |
| 228 | Drag-and-drop Diet Planners | Pipeline 2 | Meal DB | HTML5 Drag-and-Drop calendar grid | Interactive Web |
| 229 | Generative UI Workouts | Pipeline 5 | Gym Rules DB | Custom workout schedule UI builder | Interactive Web |
| 230 | Interactive Trip Maps | Pipeline 2 | POI Coordinates | Map line drawing route planner UI | Interactive Web |

#### Group 5.4: E-commerce & Marketing
*Primary Pipeline:* **Pipeline 2 (DB Templating)** & **Pipeline 4 (Generative)**
*Exporter Target:* `@acc/exporters/interactive-web`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 231 | Tinder Product Swipers | Pipeline 2 | Product Catalog | Swiper.js swipe right/left product rec UI | Interactive Web |
| 232 | Gift Recommendation Chat | Pipeline 4 | E-comm Catalog DB | Conversational product recommender UI | Interactive Web |
| 233 | Interactive Lookbooks | Pipeline 2 | Image Hotspots DB | Hover pop-up price tags overlay UI | Interactive Web |
| 234 | "Build Your Own" Configurator | Pipeline 2 | Product Assets DB | Real-time color/part swapper UI | Interactive Web |
| 235 | WebXR AR Try-on | Pipeline 2 | 3D Glasses/Lipstick Mesh | WebXR / MindAR camera overlay UI | Interactive Web |
| 236 | Calibrated Spin Wheels | Pipeline 5 | Probability Rules DB | HTML Canvas spin wheel widget | Interactive Web |
| 237 | Lead-gen Personality Quizzes | Pipeline 5 | Quiz Scoring Rules | Multi-step quiz form + Email gate UI | Interactive Web |
| 238 | Dynamic Landing Pages | Pipeline 2 | UTM Parameters | Contextual headline/hero image swapper | Interactive Web |
| 239 | Personalized Pricing Tables | Pipeline 2 | Visitor Persona Rules | Dynamic tier feature visibility UI | Interactive Web |
| 240 | Isometric 3D Storefronts | Pipeline 2 | Product 3D DB | Three.js isometric shelf click inspector | Interactive Web |

#### Group 5.5: Education & Micro-learning
*Primary Pipeline:* **Pipeline 5 (Rule Logic & Math Engine)**
*Exporter Target:* `@acc/exporters/interactive-web`

| # | Content Type Name | Pipeline | Input / Trigger | Processing / Engine | Exporter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 241 | Spaced Repetition Flashcards | Pipeline 5 | Flashcard Deck DB | 3D Flip animation + Leitner scheduling UI | Interactive Web |
| 242 | Code IDE with AI Hints | Pipeline 5 | LeetCode Challenge | Web IDE + AST parser hint trigger UI | Interactive Web |
| 243 | Step-by-step Math Solvers | Pipeline 5 | KaTeX LaTeX DB | Expanding accordion math step explainer | Interactive Web |
| 244 | Voice Pronunciation Checkers | Pipeline 5 | Phonetic Target | Web Audio API spectrograph speech scorer | Interactive Web |
| 245 | Interactive Keyboards | Pipeline 5 | MIDI Note Rules | Virtual piano keyboard chord detector | Interactive Web |
| 246 | Anatomy Explorers | Pipeline 2 | Anatomical Mesh DB | Layered body system slider Web UI | Interactive Web |
| 247 | 3D Molecular Viewers | Pipeline 5 | PDB Molecule Files | 3D Ball-and-stick WebGL viewer | Interactive Web |
| 248 | Web Sandbox Physics | Pipeline 5 | Physics Engine (Matter.js) | Gravity/friction parameter control canvas | Interactive Web |
| 249 | Interactive Natal Charts | Pipeline 5 | Birth Details Input | Astronomical chart vector drawing UI | Interactive Web |
| 250 | Web-comic Carousels | Pipeline 4 | Comic Panel AST | Scroll-triggered comic reader + SFX play | Interactive Web |

---

## 4. Cross-Pipeline Exporter Mapping (`@acc/exporters`)

All 6 Canonical Pipelines produce domain models or intermediate representations (IR) that are converted into final distribution artifacts by `@acc/exporters`.

```text
packages/exporters/
├── static-web/        # Generates SSG HTML, Markdown, or pushes to WordPress/Ghost REST APIs
├── social/            # Generates Twitter/X threads, LinkedIn posts, Quote Cards & Infographic PNGs
├── video/             # Invokes FFmpeg FFI zero-copy pipeline for MP4/WebM vertical & horizontal renders
├── audio/             # Exports MP3/WAV audio, RSS podcast feeds, and binaural audio files
├── interactive-web/   # Compiles HTML5 web components, React/Vue widgets, and D3/WebGL applications
└── live-stream/       # Manages 24/7 RTMP stream multiplexing directly to YouTube/Twitch
```

---

## 5. Summary & Next Steps for Engineering

1. **Unified Orchestration via `PipelineRunner`:** All 6 pipelines are fully registered under `PipelineRegistry` and dispatched via `@acc/cli`.
2. **Exporter Standard:** Each pipeline step appends its output to `UnifiedPipelineContext`, passing structured artifacts directly to `@acc/exporters`.
3. **100% Coverage Achieved:** With only 6 canonical pipeline drivers and 6 exporter modules, the ACC engine fully powers all 250 content variations without maintaining monolithic or fragmented codebase paths.
