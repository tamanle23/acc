---
name: VideoIR-Lexicon-ScriptAST-Studio
version: "2.0.0-studio"
schemaTarget: "https://videoir.dev/schemas/script-ast/v1.json"
themeMode: dark
tokens:
  colors:
    canvasAbyss: "#09090B"
    surfacePaper: "#111115"
    surfaceCard: "#16161C"
    surfaceElevated: "#1E1E26"
    surfaceGlass: "rgba(22, 22, 28, 0.76)"
    textParchment: "#F5F2EB"
    textEditorial: "#A1A1AA"
    textTechnical: "#636370"
    accentAmberMarker: "#F59E0B"
    accentAmberSoft: "rgba(245, 158, 11, 0.14)"
    accentEmeraldVoice: "#10B981"
    accentEmeraldSoft: "rgba(16, 185, 129, 0.12)"
    accentCyanCue: "#06B6D4"
    accentVioletJCut: "#A855F7"
    accentIndigoFacet: "#6366F1"
    borderHairline: "#23232C"
    borderSpecular: "rgba(255, 255, 255, 0.07)"
    statusValid: "#22C55E"
    statusWarning: "#EAB308"
    statusDanger: "#F43F5E"
  typography:
    fontSans: "'Be Vietnam Pro', 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif"
    fontSerifStage: "'Newsreader', 'Instrument Serif', Georgia, serif"
    fontMono: "'JetBrains Mono', monospace"
  spacing:
    gridUnitPx: 4
  radii:
    sm: "6px"
    md: "10px"
    lg: "14px"
    pill: "9999px"
---

# Design System: VideoIR Lexicon — Studio-Grade ScriptAST Environment

## 1. Visual Theme & Aesthetic Philosophy

**VideoIR Lexicon** is a flagship narrative & acoustic pre-production studio for authoring `ScriptAST v1.0` documents. It rejects the sterile look of database forms and the overwhelming track-sprawl of traditional video editors in favor of **"Tactile Editorial Luxury"**—a fusion of **Linear's precision dark-mode craft**, **Descript's word-locked audio magic**, and **Final Draft's distraction-free narrative rhythm**.

The interface feels like writing on **velvet obsidian stationery (`#111115`)** under warm studio task lighting. Spoken dialogue in `Be Vietnam Pro` (`#F5F2EB`) commands 100% of the visual focus at rest. Technical machinery—such as TTS phoneme waveforms, `RelativeTimeAnchor` offsets, and `ExtensionFacet` schemas—stays whisper-quiet until summoned through natural hover states, text selection popovers, or magnetic gutter cards.

### Signature Studio Polish
* **Specular Top-Lit Surfaces:** Every beat card and floating toolbar combines a `1px solid #23232C` outer hairline with a `1px inset rgba(255, 255, 255, 0.07)` top-edge highlight, giving panels the physical tactility of anodized aluminum hardware.
* **Zero-Math Inline `[marker]` Jewels:** Inline bracket markers (`[surge]`, `[hero_drop]`, `[mask]`) inside `beat.speech` render as luminous **Amber Gold (`#F59E0B`)** micro-pills with a subtle inner glow. Hovering a marker illuminates a smooth cubic-Bezier silk thread across the right margin to its bound `ScriptCue` card.
* **Physical J-Cut / L-Cut Card Interlocking:** When a beat's `pauseAfter` is dragged into negative values (e.g., `-350ms`), the bottom edge of Beat $N$ and the top edge of Beat $N+1$ physically overlap via a translucent **Kinetic Violet (`#A855F7`)** acoustic cross-weave bar, showing the exact words where the next speaker's voice leads in.
* **Living Acoustic Margin:** Each beat's left margin houses a minimalist **Voice Capsule** showing the speaker's avatar, engine preset (`VieNeu-TTS · Hue Warm` or `F5-TTS · Baritone`), and an ultra-clean 24-bar vertical micro-waveform that pulses in Emerald (`#10B981`) during playback.

---

## 2. Color Architecture & Semantic Roles

| Semantic Role | Token | Descriptive Name & Hex | Studio Application & Contrast Guarantee |
| :--- | :--- | :--- | :--- |
| **Studio Void** | `--lex-canvas-abyss` | Carbon Studio Void (`#09090B`) | Outer application frame and recessed sidebar wells. |
| **Editorial Paper** | `--lex-surface-paper` | Velvet Obsidian Sheet (`#111115`) | Central narrative document column background. |
| **Beat Card Surface** | `--lex-surface-card` | Anodized Graphite (`#16161C`) | Resting `ScriptBeat` cards and `ScriptParticipant` tiles. |
| **Focused / Elevated** | `--lex-surface-elevated` | Lit Charcoal (`#1E1E26`) | Active `ScriptBeat` card, slash-command palette, and floating text-selection HUD. |
| **Optical Glass** | `--lex-surface-glass` | Smoked Quartz (`rgba(22, 22, 28, 0.76)`) | Top studio bar and bottom floating Acoustic Transport Dock (`backdrop-filter: blur(20px)`). |
| **Spoken Dialogue** | `--lex-text-parchment` | Warm Ivory Parchment (`#F5F2EB`) | Primary spoken `beat.speech` copy and document headings (`16.1:1` AAA contrast). |
| **Director Stage Notes** | `--lex-text-editorial` | Brushed Pewter (`#A1A1AA`) | Italicized serif `beat.intent` camera/visual notes and section summaries (`7.8:1` AA+). |
| **Technical Metadata** | `--lex-text-technical` | Muted Gunmetal (`#636370`) | Word index ticks (`word:0`), `beat.id` slugs, and inactive keyboard shortcut badges. |
| **Inline Marker Accent** | `--lex-accent-amber` | Imperial Amber Gold (`#F59E0B`) | Inline `[marker]` pills, active beat left-edge indicator, and primary `"Send to StageCraft →"` CTA. |
| **TTS & Acoustic Accent** | `--lex-accent-emerald` | VieNeu Emerald (`#10B981`) | TTS voice synthesis waveforms, `auto:speech` badges, and forced-alignment confidence indicators. |
| **Cue Trigger Accent** | `--lex-accent-cyan` | Signal Cyan (`#06B6D4`) | Right-gutter `ScriptCue` cards (`audio:sfx`, `commerce:badge-pop`) and Bezier tether lines. |
| **J/L-Cut Overlap** | `--lex-accent-violet` | Split-Edit Violet (`#A855F7`) | Negative `pauseAfter` (`-350ms`) overlap zones and `after:cue_id` chained sequences. |
| **Facet Namespace** | `--lex-accent-indigo` | Extension Indigo (`#6366F1`) | Open extension `uses` packs (`fable:1.0`, `commerce:1.0`, `explainer:1.0`) and facet chips. |

---

## 3. Typography & Diacritic-First Rhythm

### Font Pairing Philosophy
1. **`Be Vietnam Pro` (Primary Prose & UI):** Specifically engineered with tall ascenders/descenders and balanced diacritic stacking so Vietnamese tone marks (`ự`, `ể`, `ẵ`, `ộ`) remain crystal clear at all weights without colliding with inline pill badges.
2. **`Newsreader` Italic (Director's Intent):** Brings the classic warmth of a film director's annotated shooting script to `beat.intent`, creating an effortless cognitive separation between *what the audience hears* (`speech`) and *what the audience sees* (`intent`).
3. **`JetBrains Mono` (Precision Time & Tokens):** Strictly `tabular-nums` for millisecond offsets (`-200ms`), word indices (`word:4`), and namespace kinds (`tts:voice-preset`).

### Type Scale Specification

| Element | Font | Size | Weight | Line Height | Tracking | Studio Styling Rules |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Script Title (`H1`)** | `Be Vietnam Pro` | `26px` | `700` | `1.25` | `-0.025em` | Editable inline header with subtle locale badge (`vi-VN-Hue`). |
| **Section Act Header (`H2`)** | `Be Vietnam Pro` | `16px` | `600` | `1.35` | `-0.01em` | Paired with pill tag (`HOOK`, `CLIMAX`, `CTA`) and section runtime total. |
| **Spoken Dialogue (`speech`)** | `Be Vietnam Pro` | `18px` | `400` | `1.75` | `0em` | Generous `1.75` line-height gives inline `[marker]` pills room to breathe. |
| **Stage Direction (`intent`)** | `Newsreader` | `15.5px` | `400` Italic | `1.55` | `0.005em` | Preceded by a subtle `🎬` lens icon in `#A1A1AA`. |
| **Inline `[marker]` Jewel** | `JetBrains Mono` | `12px` | `600` | `1.00` | `-0.01em` | `height: 22px`, `padding: 0 8px`, `border-radius: 6px`, `#F59E0B` on `rgba(245,158,11,0.14)`. |
| **Cue & Facet Pill Title** | `Be Vietnam Pro` | `12.5px` | `600` | `1.30` | `0em` | Crisp single-line truncation with hover tooltip. |
| **Tabular Time Readouts** | `JetBrains Mono` | `11px` | `500` | `1.15` | `0.02em` | `font-variant-numeric: tabular-nums` mandatory. |

---

## 4. Signature Studio Components & Interactive States

### A. The `ScriptBeat` Studio Card
Designed around a **Quiet-by-Default, Rich-on-Focus** interaction model:
* **Left Acoustic Rail (`156px`):**
  * **Speaker Selector Pill:** Avatar + Name (`Vua Lê Thái Tổ`) + subtle voice engine dot (`#10B981` for `f5-tts`). Clicking opens a quick popover to tweak `speed` (`0.95x`) or `pitchSemitones` (`-3st`) without leaving the beat.
  * **Live Duration Capsule:** Shows `auto:speech · 2.40s` with a mini 16-bar emerald waveform sparkline. If `speech` is empty, renders a Cyan pill `SILENT HOLD · 2.50s`.
* **Center Narrative Stage (`1fr`):**
  * **Spoken Prose Layer:** Clean, distraction-free text editor. Double-clicking or selecting any word summons a **Floating Glass Micro-Toolbar** directly above the word: `[+ Insert Marker]`, `[⚡ Bind Cue to word:3]`, `[🎭 Emotion Facet]`.
  * **Word-Scrub Hover:** Holding `Alt`/`Option` while hovering over words reveals subtle subscript word indices (`0`, `1`, `2`, `3`) and plays the exact `400ms` synthesized TTS phoneme slice for that word.
  * **Director's `intent` Strip:** Separated by a `1px dashed rgba(255,255,255,0.06)` divider; renders in warm italicized `Newsreader` (`"Extreme close-up on the ornate scabbard trembling and glowing with jade runes."`).
* **Right Tethered Cue Gutter (`250px`):**
  * Displays compact `ScriptCue` cards (`#16161C` with `#06B6D4` left border accent) aligned vertically with the line of text containing their target `[marker]`.
  * Each card shows a 2-line summary: Top row = Anchor pill (`@ marker:hum` + `+100ms` badge); Bottom row = Kind & primary param (`fable:prop-state · emission 2.4`).

### B. Tactile `pauseAfter` & J-Cut / L-Cut Drag Ribbon
Positioned in the `20px` gap between Beat $N$ and Beat $N+1$:
* **Resting State:** A barely visible `1px` center tick mark with a subtle mono label (`+200ms` or `⚡ -350ms J-Cut`).
* **Hover / Dragging State:** Expands into a tactile horizontal rotary-style scrub bar.
  * Dragging **downward/right** increases positive breathing room (`+100ms` $\rightarrow$ `+1.2s`), expanding the visual vertical gap between the two cards.
  * Dragging **upward/left** crosses `0ms` into negative J-cut territory (`-50ms` $\rightarrow$ `-500ms`), turning **Kinetic Violet (`#A855F7`)** and visually pulling the two beat cards into a terraced overlap with an inline preview of the overlapping audio tails.

### C. 5+ State Component Matrix

| State | Visual & Interactive Treatment |
| :--- | :--- |
| **1. Resting (Default)** | `#16161C` card surface, `1px solid #23232C` border, `inset 0 1px 0 rgba(255,255,255,0.05)`. Secondary action buttons hidden for maximum reading calm. |
| **2. Hover** | Border brightens to `#323240`; subtle top-right quick actions fade in (`150ms cubic-out`): `[+ Cue]`, `[+ Facet]`, `[▶ Play Beat]`. Hovering an inline `[marker]` draws a glowing `#F59E0B` $\rightarrow$ `#06B6D4` Bezier curve to its Cue card. |
| **3. Active / Focused** | Surface elevates to `#1E1E26`, left border illuminates with a `3px solid #F59E0B` Amber bar, ambient elevation shadow `0 16px 36px -6px rgba(0, 0, 0, 0.7)`. Right Inspector dock automatically binds to this beat. |
| **4. Synthesizing TTS (Loading)** | Left Acoustic Rail waveform bars animate with a smooth Emerald (`#10B981`) sine-wave shimmer; duration badge reads `Aligning phonemes…` without locking text input. |
| **5. Silent / Montage Beat (Empty Speech)** | When `speech` is omitted and `duration: "2.5s"` or `"auto:children"` is active, the prose area transforms into a sleek horizontal **Visual Beat Strip** (`rgba(6, 182, 212, 0.05)` fill, `1px dashed rgba(6, 182, 212, 0.3)` border) displaying chained cue blocks (`cue_spec_1 [400ms]` $\rightarrow$ `cue_spec_2 [400ms]` $\rightarrow$ `cue_spec_3 [400ms]`). |
| **6. Validation Error** | `1px solid #F43F5E` Coral-Red border on the offending Cue or Beat; inline pill explains the exact fix (`Marker [surge] missing in speech — Click to insert`). |

---

## 5. Spatial Architecture & Viewport Allocation

┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP STUDIO BAR (48px)                                                                    │
│ [≡] Sự Tích Hồ Gươm · vi-VN-Hue   [fable:1.0][tts:1.0][+ Pack]   [✓ Valid] [StageCraft →]│
├────────────────────┬────────────────────────────────────────────────┬────────────────────┤
│ LEFT STORY DOCK    │ CENTER EDITORIAL STREAM (Fluid, Max 920px)     │ RIGHT INSPECTOR    │
│ (268px)            │                                                │ (320px)            │
│                    │  SECTION 02 · INCITING INCIDENT    [bgm: -12dB]│                    │
│ ▾ CAST & VOICES    │  ┌──────────────────────────────────────────┐  │ ▾ SELECTED CUE     │
│  • Người Kể Chuyện │  │ 🎙️ Narrator  │ Thanh gươm [hum] phát sáng│  │  ID: cue_jade_hum  │
│    [VieNeu · 0.92x]│  │ 2.40s ılılı  │ 🎬 Extreme close-up...    │──┼─►Anchor: marker:hum│
│  • Vua Lê Thái Tổ  │  └──────────────┴───────────────────────────┘  │  Offset: [+100ms]  │
│    [F5-TTS · 0.95x]│         ↕ [ +200ms Pause ]                     │                    │
│  • Thần Kim Quy    │  ┌──────────────────────────────────────────┐  │ ▾ FACET SCHEMA UI  │
│    [F5-TTS · -3st] │  │ ⏱️ Silent    │ [🌊 cue_water]→[🐢 breach]│  │  fable:prop-state  │
│                    │  │ 2.50s Hold   │ 🎬 Massive golden ripples │  │  Emission: ──●─ 2.4│
│ ▾ ACT OUTLINE      │  └──────────────┴───────────────────────────┘  │                    │
│  01 Prologue  4.2s │         ⚡ [ -350ms J-Cut Overlap ]            │ ▾ WORD ALIGNMENT   │
│  02 Awakening 8.1s │  ┌──────────────────────────────────────────┐  │  [0.0s] Thanh      │
│  03 Climax    9.4s │  │ 👑 Lê Lợi    │ Thần Kim Quy [hand_hilt]..│  │  [1.2s] ★ [hum]    │
├────────────────────┴────────────────────────────────────────────────┴────────────────────┤
│ FLOATING ACOUSTIC TRANSPORT BAR (52px Centered Pill Dock, 720px wide, bottom: 16px)     │
│ [⏮] [▶ Play Script] [⏭]   00:04.20 / 00:24.80  ılılıı███ılılılı (VO + BGM Duck) [138 WPM]│
└──────────────────────────────────────────────────────────────────────────────────────────┘
* **Breathing Room Mandate:** At least **25% of the central editorial viewport** must remain open `#111115` Velvet Obsidian background margin around the `920px` centered beat column so the workspace feels calm and expansive.
* **Floating Acoustic Transport Pill:** Instead of a heavy edge-to-edge bottom footer, the audio player floats `16px` above the bottom center as a `720px` wide Smoked Quartz glass capsule (`border-radius: 9999px`, `backdrop-filter: blur(20px)`).

---

## 6. Design Guardrails (Do's & Don'ts)

* **DO** keep the central reading flow 100% free of pixel coordinates, CSS Grid math, or frame counters (`Frame 144`).
* **DO** draw a delicate SVG Bezier connector line (`1.5px dashed #06B6D4`) from an inline `[marker]` pill to its right-gutter `ScriptCue` card when either is hovered or selected.
* **DO** render domain `ExtensionFacet` payloads (`fable:emotion`, `commerce:campaign-context`, `explainer:code-context`) as polished, custom UI widgets (sliders, color swatches, syntax-highlighted mini code blocks) in the Right Inspector.
* **DON'T** clutter inactive beat cards with visible form inputs or dropdown arrows; render inactive beats as clean, typographic script blocks that transform into interactive controls on hover/focus.

---

## 7. Ready-to-Paste Google Stitch Prompts

### Prompt 1 — Flagship Desktop Studio Screen (`ScriptAST` "VideoIR Lexicon")
> **Context:** Design a flagship, craft-grade desktop web application (`1440x900`) for **"VideoIR Lexicon"**, an acoustic-first narrative script and TTS pre-production studio (`ScriptAST v1.0`). Follow `DESIGN.md` (`v2.0.0-studio`) strictly.
> **Aesthetic Direction:** Linear meets Descript and Teenage Engineering. Deep Velvet Obsidian paper (`#111115`) over a `#09090B` void, top-lit anodized graphite cards (`#16161C`) with subtle `1px` specular inner highlights, Warm Ivory Parchment dialogue (`#F5F2EB`) in `'Be Vietnam Pro'`, and italicized `'Newsreader'` serif stage directions (`#A1A1AA`).
> **Layout Structure:**
> 1. **Top Studio Header (`48px`, `#09090B`):** Breadcrumb `"Kể Studio / Sự Tích Hồ Gươm"`, locale pill `"vi-VN-Hue"`, Indigo extension pills (`fable:1.0`, `tts:1.0`, `audio:1.0`), emerald status badge `"✓ ScriptAST Valid"`, and primary Amber Gold CTA button `"Open in StageCraft →"` (`#F59E0B`).
> 2. **Left Story Dock (`268px`):**
>    - **Cast & Voices:** 3 tactile participant cards with avatars and emerald voice badges: `Người Kể Chuyện` (`vieneu-tts · 0.92x`), `Vua Lê Thái Tổ` (`f5-tts · 0.95x`), `Thần Kim Quy` (`f5-tts · -3st`).
>    - **Act Outline:** Clean vertical tree (`01 Prologue · 4.2s`, `02 Awakening · 8.1s [Active]`, `03 Climax · 9.4s`, `04 Epilogue · 3.1s`).
> 3. **Center Editorial Stream (`1fr` fluid with generous dark margin around a `900px` centered column):**
>    - Section Header: `"02 · INCITING INCIDENT"` with an Indigo BGM Mood chip (`🎵 bgm_ritual_drums · -12dB Ducking`).
>    - **Beat Card 1 (`beat_sword_tremor` — Active/Focused in `#1E1E26` with `3px` left Amber bar):** Left acoustic rail shows `Người Kể Chuyện`, `auto:speech · 2.40s`, and a mini emerald waveform. Center prose reads: `"Bỗng nhiên, thanh gươm Thuận Thiên bên hông nhà vua "` followed by a glowing Amber Gold inline pill `[hum]` (`#F59E0B`) and `" rung lên từng hồi, phát ra luồng sáng xanh ngọc bích."` Below a subtle dashed line sits italicized serif intent: `"🎬 Extreme close-up on the ornate scabbard trembling and glowing with jade runes."` On the right cue rail, two Cyan (`#06B6D4`) cue cards (`cue_jade_hum @ marker:hum` and `cue_scabbard_glow @ marker:hum +100ms`) are visually tethered to the `[hum]` pill by a glowing dashed Bezier curve.
>    - **Inter-Beat Connector 1:** Subtle pill `[ ⏸ +200ms Pause ]`.
>    - **Beat Card 2 (`beat_silent_emerge` — Silent Action Beat):** Renders as a sleek Cyan-tinted atmospheric strip (`SILENT VISUAL HOLD · 2.50s`) showing two chained horizontal cue blocks: `[🌊 cue_water_surge @ start]` $\rightarrow$ `[🐢 cue_turtle_breach @ after +800ms]`.
>    - **Inter-Beat Connector 2 (Negative J-Cut Overlap):** A vibrant Kinetic Violet (`#A855F7`) interlocked overlap bar `[ ⚡ -350ms J-Cut Overlap ]` physically pulling Beat 2 and Beat 3 together with a mini overlapping waveform graphic.
>    - **Beat Card 3 (`beat_king_question`):** Speaker `Vua Lê Thái Tổ` with inline Amber pill `[hand_hilt]`.
> 4. **Right Contextual Inspector (`320px`):** Inspecting `cue_scabbard_glow`. Shows a clean Anchor segmented control (`marker:hum`), a tactile rotary-style SignedTimeOffset scrubber (`+100ms` $\rightarrow$ `Resolved: 1,300ms`), a schema-driven `fable:prop-state` card with an `emissionIntensity` slider at `2.4`, and a Forced Alignment Word Timeline preview at the bottom.
> 5. **Floating Bottom Acoustic Transport Capsule (`720px` wide pill floating `16px` above bottom center):** Smoked glass (`backdrop-filter: blur(20px)`) with Play/Pause button, timecode `00:06.10 / 00:24.80`, dual-layer Emerald vocal + ducked Indigo BGM waveform scrubber, and `134 WPM` pacing indicator.

### Prompt 2 — Text Selection Micro-Interaction & Commerce/Explainer Beat Variations
> **Context:** Design a high-craft UI component showcase sheet for **"VideoIR Lexicon"** (`ScriptAST v1.0`) following `DESIGN.md` (`v2.0.0-studio`).
> **Include 3 focused studio components:**
> 1. **Floating Word-Selection HUD:** Show a `ScriptBeat` dialogue line where the user has highlighted the words `"100 Newton-mét"`. Directly above the selection floats a Smoked Quartz glass pill bar (`#1E1E26`, `border: 1px solid rgba(255,255,255,0.12)`) with 3 tactile actions: `[🏷️ Wrap in [marker]]`, `[⚡ Attach Cue (word:4)]`, and `[🔊 Audition Word Slice]`.
> 2. **Affiliate Commerce Beat (`commerce:1.0`):** Shows a Shopee/TikTok product showcase beat with an embedded `commerce:campaign-context` header pill (`1.650.000đ → 1.390.000đ · -16%`) and a `duration: "auto:children"` rapid 3-step spec-flash montage strip (`400ms × 3 = 1.20s`).
> 3. **Technical Explainer Beat (`explainer:1.0`):** Shows an instructor beat with an embedded dark Catppuccin TypeScript code block (`packNodeId`) where Line 2 (`0x100000000`) is linked by an Amber Bezier thread to an inline `[mul_shift]` marker pill in the speech text.
