# ACC CLI Quickstart & Sample Execution Reference

Comprehensive command execution manual for running, verifying, and scaffolding all 6 canonical content pipelines within the ACC (Automated Content Creator) ecosystem using the **Unified CLI (`cli.ts`)** and the **Universal Auto-Config CLI (`auto-config.ts`)**.

---

## 1. 🚀 Main Orchestrator CLI (`bun run cli.ts`)

> **Pro Tip**: Use the `-n` (or `--dry-run`) flag to validate pipeline execution graphs, asset probing, timeline calculations, and effect graphs without committing heavy physical video encoding to disk. Remove `-n` when you are ready to export physical files.

### 📰 Pipeline 1: Event-Driven Scraper & Summarizer
*Use Case: Parses RSS/JSON feeds, extracts key insights via LLM, synthesizes spoken TTS narration, and renders breaking news alert cards.*

```bash
# Non-destructive dry-run validation
bun run cli.ts run scraper -c ./samples/01-scraper-summarizer/source_feed.json -n

# Real physical export to disk (including video, audio, social, and web modalities)
bun run cli.ts run scraper -c ./samples/01-scraper-summarizer/source_feed.json -e video,audio,social,web -o ./output/p1
```

---

### 📊 Pipeline 2: Database Injection & Dynamic Templating
*Use Case: Ingests relational databases or CSV datasets, and renders animated 60 FPS Bar Chart Race infographics.*

```bash
# Non-destructive dry-run validation
bun run cli.ts run db -c ./samples/02-db-templating/database_payload.json -n

# Real physical export with 16:9 widescreen layout
bun run cli.ts run db -c ./samples/02-db-templating/database_payload.json -o ./output/p2
```

---

### 📱 Pipeline 3: Repurposing Recycler (Podcast / Video Cutdown)
*Use Case: Extracts viral hook segments from transcripts, applies speaker face-tracking with smart 9:16 vertical crop, and syncs karaoke kinetic captions.*

```bash
# Non-destructive dry-run validation
bun run cli.ts run repurposing -c ./samples/03-repurposing-recycler/repurpose_transcript.json -n

# Real physical export as vertical 9:16 TikTok/Reels clip
bun run cli.ts run repurposing -c ./samples/03-repurposing-recycler/repurpose_transcript.json -o ./output/p3
```

---

### 🎬 Pipeline 4: Generative Storytelling (Legacy & Canonical IR)
*Use Case: Multi-scene mythological and cinematic narratives with Volumetric Sandwich typography, 3D Frame-Breaker pop-outs, and Ken Burns camera movements.*

```bash
# Option 1: Legacy Shorthand (Most convenient syntax, points directly to directory)
bun run cli.ts ./samples/04-generative-storytelling -n

# Option 2: Explicit command syntax via 'run story'
bun run cli.ts run story -c ./samples/04-generative-storytelling -n

# Option 3: Direct Universal Video IR Render Engine (with 4 parallel temporal workers)
bun run cli.ts ir-render -c ./samples/04-generative-storytelling/story-config.json -j 4 -n

# Real physical render output
bun run cli.ts ./samples/04-generative-storytelling -o ./output/p4
```

---

### 📐 Pipeline 5: Rule & Mathematical Logic Engine
*Use Case: Executes step-by-step mathematical proofs and logical decision trees rendered on a high-contrast educational chalkboard.*

```bash
# Non-destructive dry-run validation
bun run cli.ts run rule -c ./samples/05-rule-logic/proof_problem.json -n

# Real physical lecture slide video render
bun run cli.ts run rule -c ./samples/05-rule-logic/proof_problem.json -o ./output/p5
```

---

### 🎧 Pipeline 6: Infinite Ambient & Procedural Loops
*Use Case: Continuous 24/7 Lo-Fi relaxation soundscapes with rain-on-glass shaders and seamless audio crossfades.*

```bash
# Non-destructive dry-run validation
bun run cli.ts run ambient -c ./samples/06-ambient-loops/ambient_config.json -n

# Render a physical 30-second seamless loop clip
bun run cli.ts run ambient -c ./samples/06-ambient-loops/ambient_config.json -d 30 -o ./output/p6

# Live RTMP stream broadcast (e.g. YouTube Live with 2.0s GOP)
bun run cli.ts stream ambient -c ./samples/06-ambient-loops/ambient_config.json --rtmp "rtmp://a.rtmp.youtube.com/live2/YOUR_STREAM_KEY" -d 3600
```

---

## 2. ⚡ Universal Auto-Config CLI (`bun run auto-config.ts`)

The Auto-Config CLI autonomously probes raw media directories (inspecting visual aspect ratios, audio classifications, data schemas, and text scripts) and automatically classifies the target directory into its optimal pipeline archetype.

### Headless CI/CD Mode (`--yes` / `-y`)
Executes non-interactively with heuristic detection and writes or verifies project artifacts:

```bash
# Autonomously probe and classify Pipeline 1 (Scraper & Summarizer)
bun run auto-config.ts ./samples/01-scraper-summarizer --yes --dry-run

# Autonomously probe and classify Pipeline 2 (Database Templating)
bun run auto-config.ts ./samples/02-db-templating --yes --dry-run

# Autonomously probe and classify Pipeline 3 (Repurposing Recycler)
bun run auto-config.ts ./samples/03-repurposing-recycler --yes --dry-run

# Autonomously probe and classify Pipeline 4 (Generative Storytelling)
bun run auto-config.ts ./samples/04-generative-storytelling --yes --dry-run

# Autonomously probe and classify Pipeline 5 (Rule & Math Logic)
bun run auto-config.ts ./samples/05-rule-logic --yes --dry-run

# Autonomously probe and classify Pipeline 6 (Ambient Loops)
bun run auto-config.ts ./samples/06-ambient-loops --yes --dry-run
```

### Parameter Overrides in Headless Mode:
```bash
# Force specific aspect ratio and framerate overrides during scaffolding
bun run auto-config.ts ./my-raw-media --yes --aspect 9:16 --fps 60 --depth false
```

### Interactive Terminal Wizard Mode (`@clack/prompts`):
Omit `--yes` to launch the interactive conversational UI:
```bash
bun run auto-config.ts ./samples/04-generative-storytelling
```
*(Provides an interactive terminal wizard to customize target pipeline, aspect ratio, 3D depth, transitions, and audio ducking using keyboard arrow keys).*

---

## 3. 🧪 Comprehensive Automated Test Verification

Execute the complete end-to-end verification suite confirming that all 6 sample directories are discovered, classified, and calibrated across SFX, VFX Overlays, and 3D Depth:

```bash
# Run sample scaffolding verification test suite
bun test autogenerated-tests/samples-scaffolding-verification.test.ts

# Run both sample verification and autoconfig engine test suites
bun test autogenerated-tests/samples-scaffolding-verification.test.ts autogenerated-tests/autoconfig/
```
