---
name: VideoIR-StageCraft-StoryboardAST-Studio
version: "2.0.0-studio"
schemaTarget: "https://videoir.dev/schemas/storyboard-ast/v1.json"
themeMode: dark
tokens:
  colors:
    canvasPasteboard: "#050608"
    surfaceShell: "#0B0D13"
    surfaceDock: "#10131C"
    surfaceCard: "#161A26"
    surfaceHudGlass: "rgba(16, 19, 28, 0.82)"
    textPrimary: "#F8FAFC"
    textSecondary: "#94A3B8"
    textTechnical: "#4E5D78"
    accentSnappedCyan: "#06B6D4"
    accentSnappedFill: "rgba(6, 182, 212, 0.08)"
    accentFloatViolet: "#A855F7"
    accentFloatFill: "rgba(168, 85, 247, 0.10)"
    accentCueAmber: "#F59E0B"
    accentSafeCoral: "#F43F5E"
    accentCameraEmerald: "#10B981"
    borderSeam: "#1C2232"
    borderSpecular: "rgba(255, 255, 255, 0.07)"
    statusCompilerReady: "#22C55E"
  typography:
    fontSans: "'Plus Jakarta Sans', 'Inter', 'Be Vietnam Pro', -apple-system, sans-serif"
    fontDisplay: "'Space Grotesk', 'Inter', sans-serif"
    fontMono: "'JetBrains Mono', monospace"
  spacing:
    gridUnitPx: 4
  radii:
    xs: "4px"
    sm: "6px"
    md: "8px"
    lg: "12px"
    pill: "9999px"
---

# Design System: VideoIR StageCraft — Studio-Grade StoryboardAST & LayoutTree Workbench

## 1. Visual Theme & Aesthetic Philosophy

**VideoIR StageCraft** is a flagship 2D spatial layout and cue-choreography studio for authoring `StoryboardAST v1.0` documents powered by a headless W3C **`LayoutTree` Solver** (`canvas_layout_engine.ts`). It blends **Figma's structural grid clarity**, **Rive's state-machine choreography elegance**, and **DaVinci Resolve's color-critical darkroom ergonomics**.

In StageCraft, users never fight brittle manual keyframes or arbitrary `(x, y)` pixel coordinates. The center of the studio is a **True Darkroom Optical Pasteboard (`#050608`)** where the active video canvas floats like a calibrated reference monitor. Over this canvas, the headless `LayoutTree` solver projects crisp, color-coded geometric guides—visually distinguishing **DPR-Snapped Static Regions (`#06B6D4` Cyan)** from **Unrounded Float Motion Paths (`#A855F7` Violet)**—while the bottom **Elastic Beat-Ribbon** locks every scene cut and choreography action directly to narrative `ScriptBeat` spans and magnetic **Amber Gold (`#F59E0B`)** `ScriptCue` pins.

### Signature Studio Polish
* **Calibrated Darkroom Pasteboard (`#050608`):** The infinite stage surround uses an ultra-low-reflectance `#050608` matte dotted with subtle `24px` optical crosshairs (`#141824`), ensuring 100% color accuracy on the video canvas and high contrast for wireframe overlays.
* **Dual-Coordinate Optical Wireframes (`RoundTree` vs. Float Matrix):**
  * **Static Layout Slots (`dpr-snapped`):** Outlined in crisp `1px solid #06B6D4` (**Electric Cyan**) with flushed corner brackets and an inline micro-pill (`900 × 80 · DPR-Snapped`), proving crack-free adjacent cell borders.
  * **Choreographed Elements (`unrounded-float`):** Outlined in `1.5px solid #A855F7` (**Kinetic Violet**) with a glowing cubic-Bezier trajectory spline, spring velocity ticks, and a floating-point readout pill (`160.58, 244.00 · Float Mat2D`).
* **Magnetic Cue-to-Canvas Wiring:** Dragging a connection noodle from any **Amber Gold `cue:<id>` Pin** on the bottom Beat-Ribbon directly onto a canvas element attaches a `ChoreographyAction` pill, automatically promoting that element from Static Cyan to Motion Violet.
* **Live Compiler Lowering Badges:** Every inspector card displays a subtle, glowing terminal chip showing the exact `VideoIR V1.0-Stable` target modifier it compiles down into (`→ motion/gsap`, `→ vfx/camera_3d`, `→ time_space/callout_leader`, `→ overlay/canvas_particles`).

---

## 2. Color Architecture & Semantic Wireframe Grammar

| Semantic Role | Token | Descriptive Name & Hex | Studio Application & Visual Meaning |
| :--- | :--- | :--- | :--- |
| **Darkroom Pasteboard** | `--sc-canvas-pasteboard` | Calibrated Optical Black (`#050608`) | Infinite 2D stage viewport background behind the video frame. |
| **App Shell Chrome** | `--sc-surface-shell` | Deep Obsidian Navy (`#0B0D13`) | Top studio bar and outer window frame. |
| **Dock Panel Surface** | `--sc-surface-dock` | Precision Slate (`#10131C`) | Left Archetype/Scene dock, Right Inspector dock, and Bottom Beat-Ribbon dock. |
| **Elevated Card / Track** | `--sc-surface-card` | Anodized Cobalt (`#161A26`) | `LayoutArchetype` builder cards, layer rows, and timeline scene blocks (`inset 0 1px 0 rgba(255,255,255,0.07)`). |
| **Floating Stage HUD** | `--sc-surface-hud-glass` | Smoked Optical Glass (`rgba(16, 19, 28, 0.82)`) | Top-center viewport overlay toggles and bottom-left zoom pill (`backdrop-filter: blur(16px)`). |
| **Primary Label Text** | `--sc-text-primary` | Pure Alabaster (`#F8FAFC`) | Active layer names, inspector headings, and readout values (`17.4:1` AAA contrast). |
| **Secondary UI Text** | `--sc-text-secondary` | Cool Slate (`#94A3B8`) | Property keys, grid area names, and inactive tab labels (`7.6:1` AA contrast). |
| **Muted Rulers & Guides** | `--sc-text-technical` | Steel Blueprint (`#4E5D78`) | Pixel ruler ticks (`0px`, `540px`, `1080px`) and disabled slots. |
| **Static Layout (`dpr-snapped`)** | `--sc-accent-snapped` | DPR-Snapped Cyan (`#06B6D4`) | W3C CSS Grid/Flex track lines, `LayoutRegionSlot` boundaries, and static `SceneElement` frames. |
| **Motion Path (`unrounded-float`)** | `--sc-accent-float` | Sub-Pixel Motion Violet (`#A855F7`) | Animated `SceneElement` bounding boxes, Bezier motion paths, and `ChoreographyAction` timeline clips. |
| **Narrative Cue Pin** | `--sc-accent-cue` | Magnetic Cue Gold (`#F59E0B`) | Foreign-key `cue:<id>` and `beat:<id>:start` pins inherited from `ScriptAST`. |
| **Platform Safe Zone** | `--sc-accent-safe` | Exclusion Rose Coral (`#F43F5E`) | Hatched `stage.safeInsets` masks (TikTok/Reels UI overlays) and overflow alerts. |
| **3D Camera & Stage VFX** | `--sc-accent-camera` | Frustum Emerald (`#10B981`) | `CameraDirective` (`vfx/camera_3d`) frustum frames and `@chrono-spatial` particle bounds. |

---

## 3. Typography & Precision Readout Hierarchy

| UI Element / Role | Font Family | Size | Weight | Line Height | Tracking | Studio Styling Rules |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Studio & Scene Title** | `Space Grotesk` | `15px` | `600` | `1.25` | `-0.01em` | Top bar scene breadcrumb and aspect ratio indicator. |
| **Dock Section Header** | `Space Grotesk` | `11.5px` | `700` | `1.20` | `0.07em` | Uppercase (`LAYOUT ARCHETYPE`, `SCENE ELEMENTS`, `CHOREOGRAPHY`). |
| **Layer Tree & Card Title** | `Plus Jakarta Sans` | `13px` | `500` | `1.35` | `0em` | `SceneElement.id` (`el_drill_cutout`) paired with region chip (`hero_stage`). |
| **Inspector Form Label** | `Plus Jakarta Sans` | `12px` | `400` | `1.35` | `0em` | Left column (`110px` width) in property grids; right column holds inputs. |
| **W3C Grid & Cue Tokens** | `JetBrains Mono` | `11px` | `600` | `1.15` | `-0.01em` | Track pills (`1.15fr`, `0.85fr`, `auto`), `cue:cue_product_slam`, `→ motion/gsap`. |
| **Canvas Micro-HUD Tag** | `JetBrains Mono` | `10px` | `500` | `1.00` | `0.02em` | Corner coordinate pills on stage (`40.00, 244.00 · 900.00×794.67 · FLOAT`). |

---

## 4. Signature Studio Components & 5+ State Matrix

### A. The Interactive `LayoutTree` Stage Viewport (Center Zone)
* **Floating Glass Overlay Bar (Top-Center of Stage, `height: 36px`):**
  * Segmented toggle pills with glowing status dots:
    1. `[⊞ Grid & Regions · Cyan]` — Toggles W3C CSS Grid/Flex track rulers (`1fr`, `2fr`, `gap: 24px`) and named slot labels (`top_banner`, `hero_stage`, `spec_dock`).
    2. `[🛡️ Safe Insets · Coral]` — Toggles the translucent Coral Rose (`#F43F5E`) diagonal-hatched exclusion mask (`top: 140px, bottom: 320px, right: 140px`) with a faint ghost preview of TikTok/Reels UI icons so creators see *why* the zone is reserved.
    3. `[🎥 Camera Frustum · Emerald]` — Toggles the 3D camera target frame (`shotType: "close-up"`, `pan-zoom` vector).
    4. `[📐 Dual-Coord HUD]` — Shows live `RoundTree` integer vs. IEEE-754 float geometry badges on selected nodes.
* **5+ State Matrix for Canvas Regions & Elements:**
  * **1. Resting:** Region boundaries render as whisper-thin `1px dashed rgba(6, 182, 212, 0.28)` hairlines; video/image assets render at full fidelity.
  * **2. Hover ($O(1)$ `SpatialHashGrid` Hit-Test):** Hovered element illuminates with a `1.5px solid #06B6D4` (if static) or `#A855F7` (if animated) frame and a crisp top-left pill (`el_spec_card · region: spec_dock`).
  * **3. Selected — Static `dpr-snapped` Mode:** Solid `2px solid #06B6D4` Cyan frame with 4 precision L-brackets and a bottom-right telemetry pill: `DPR-SNAPPED · X:40 Y:140 · 900×80px`.
  * **4. Selected — Animated `unrounded-float` Mode:** Solid `2px solid #A855F7` Violet frame, cubic-Bezier motion path with start/end ghost outlines (`scaleFrom: 2.4 → scaleTo: 1.0`), and a telemetry pill: `FLOAT MAT2D · X:40.00 Y:244.00 · 900.00×794.67px`.
  * **5. Empty Region Drop-Target:** Unpopulated `LayoutRegionSlot` displays a recessed translucent blueprint grid (`rgba(6, 182, 212, 0.04)`) with a centered `+ Assign Element to "bento_3"` button.
  * **6. Safe-Zone Collision / Missing Asset Error:** If an element overflows into `safeInsets` or lacks a valid `assetRef`, the intersecting edge pulses `#F43F5E` Coral-Red with a 1-click `Clamp to Safe Inset` action.

### B. Interactive `LayoutArchetype` Mini-Blueprint (Left Dock)
* Instead of forcing users to type raw CSS Grid arrays, the `LayoutArchetype` card renders an **interactive miniature 2D grid map**:
  * Columns and rows have inline editable track pills along the top and left edges (`[1.15fr]`, `[0.85fr]`, `[80px]`, `[1fr]`, `gap: 32px`).
  * Each cell inside the mini-map shows its `LayoutRegionSlot.id` (`header_bar`, `ide_pane`, `visualizer_pane`), `zIndex` badge (`z:10`), and a glowing dot indicating how many `SceneElement` nodes occupy that slot in the current scene.

### C. Elastic Beat-Span & Magnetic Cue-Pin Ribbon (Bottom Dock, `220px` Height)
Replaces traditional frame-based timelines with a **3-tier Relational Narrative Ribbon**:
1. **Tier 1 — Read-Only `ScriptAST` Reference Bar (`36px`):** Proportional columns for each `ScriptBeat` (`beat_hook_problem`, `beat_torque_and_gyro`, `beat_rapid_montage`), displaying the spoken text snippet, emerald mini-waveform, and J-cut overlap chevron (`⚡ -200ms`).
2. **Tier 2 — `StoryboardScene` Span Blocks (`44px`):** Horizontal container blocks spanning one or more beat columns (`beatSpan: { fromBeat, toBeat }`). The left edge features a draggable diagonal transition wedge (`transition:whip-pan · 150ms`).Each block displays its active `LayoutArchetype` badge (`⊞ arch_vertical_hook_hero`).
3. **Tier 3 — Magnetic Cue Pins & Choreography Lanes (`110px`):**
   * Vertical **Amber Gold (`#F59E0B`)** dashed drop-lines descend from every `ScriptCue` (`word:0`, `cue:cue_whip_sfx`, `cue:cue_product_slam -100ms`, `cue:cue_torque_badge`).
   * Horizontal **Kinetic Violet (`#A855F7`)** and **Camera Emerald (`#10B981`)** `ChoreographyAction` capsules snap magnetically to those gold drop-lines, showing their offset (`-100ms`), duration bar (`450ms`), target (`→ el_drill_cutout`), and lowered `VideoIR` modifier tag (`motion/gsap`).

---

## 5. Spatial Architecture & Workbench Grid
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP STUDIO BAR (48px)                                                                    │
│ [← Lexicon] 🔗 script_affiliate_dekton  [📱 9:16 · 1080×1920 · 60fps]  [Compile VideoIR →]│
├──────────────────────┬──────────────────────────────────────────┬────────────────────────┤
│ LEFT ARCHETYPE &     │ CENTER DARKROOM STAGE (#050608)          │ RIGHT DUAL INSPECTOR   │
│ SCENE DOCK (290px)   │  [⊞ Regions] [🛡️ Safe Zone] [📐 Coords]   │ (348px)                │
│                      │         ┌──────────────────────┐         │                        │
│ ▾ LAYOUT ARCHETYPE   │         │ ░░░░ SAFE INSET ░░░░ │         │ ▾ LAYOUTTREE TELEMETRY │
│  arch_vertical_hook  │         │ ┌──────────────────┐ │         │  Slot: hero_stage      │
│  ┌────────────────┐  │         │ │ top_banner (Cyan)│ │         │  Mode: [Float Mat2D]   │
│  │ top_banner auto│  │         │ └──────────────────┘ │         │  Float: 40.00, 244.00  │
│  ├────────────────┤  │         │ ┏━━━━━━━━━━━━━━━━━━┓ │         │  Snap:  40, 244        │
│  │ hero_stage 2fr │  │         │ ┃ el_drill_cutout  ┃ │         │                        │
│  ├────────────────┤  │         │ ┃ (Violet Float)   ┃ │         │ ▾ CHOREOGRAPHY ACTION  │
│  │ spec_dock  1fr │  │         │ ┗━━━━━━━━━━━━━━━━━━┛ │         │  on: 📌 cue_product_slam│
│  └────────────────┘  │         │ ┌──────────────────┐ │         │  offset: [-100ms]      │
│ ▾ SCENE ELEMENTS (4) │         │ │ spec_dock        │ │         │  duration: [450ms]     │
│  🎬 el_broll_video   │         │ └──────────────────┘ │         │  kind: spring-slam     │
│  🟦 el_warning_pill  │         │ ░░░░ TIKTOK UI ░░░░░ │         │  Scale: 2.4x ──●── 1.0x│
│  🟪 el_drill_cutout ★│         └──────────────────────┘         │  ┌──────────────────┐  │
│  🟪 el_spec_card     │                                          │  │→ VideoIR: gsap   │  │
├──────────────────────┴──────────────────────────────────────────┴────────────────────────┤
│ BOTTOM ELASTIC BEAT-RIBBON & CUE-PIN CHOREOGRAPHY DOCK (220px)                           │
│ BEAT  │ beat_hook_problem ("Khoan rút lõi [hero_drop]...") │ beat_torque_and_gyro        │
│ SCENE │ [ 🎬 scene_01_hook_and_specs (arch_vertical_hook_hero)                        ]  │
│ CUES  │ 📌 word:0          📌 cue_whip_sfx    📌 cue_product_slam (-100ms)                │
│       │  └──[🟦 alert]      └──[🎥 shake 300ms] └──[🟪 kinetix:spring-slam · 450ms]      │
└──────────────────────────────────────────────────────────────────────────────────────────┘
---

## 6. Design Guardrails (Do's & Don'ts)

* **DO** maintain a strict visual dichotomy between **Cyan (`#06B6D4`) for static DPR-snapped `RoundTree` geometry** and **Violet (`#A855F7`) for animated unrounded-float `mat2d` geometry** across the stage, layer list, and inspector.
* **DO** show the exact downstream **`VideoIR` `ModifierTypeEnum`** mapping badge (`motion/gsap`, `vfx/camera_3d`, `time_space/callout_leader`, `overlay/canvas_particles`, `transition/push`) inside every Choreography and Transition inspector card.
* **DO** render the bottom timeline as **proportional `ScriptBeat` columns with magnetic Amber (`#F59E0B`) `ScriptCue` pins**, visually reinforcing that timing flows from `ScriptAST`.
* **DON'T** expose raw `(x, y)` numeric input boxes for manual dragging—elements are always assigned to a named `LayoutRegionSlot` inside a W3C Grid/Flex/HUD `LayoutArchetype`.

---

## 7. Ready-to-Paste Google Stitch Prompts

### Prompt 1 — Flagship Workbench (`9:16` Affiliate Showcase in "VideoIR StageCraft")
> **Context:** Design a flagship, studio-grade desktop web application (`1440x900`) for **"VideoIR StageCraft"**, a declarative 2D layout and cue-choreography workbench (`StoryboardAST v1.0`). Follow `DESIGN.md` (`v2.0.0-studio`) strictly.
> **Aesthetic Direction:** Figma Auto-Layout meets Rive and DaVinci Resolve. Calibrated Optical Black stage pasteboard (`#050608`), Precision Slate docks (`#10131C`), Anodized Cobalt cards (`#161A26`) with `1px` specular top inner highlights, Electric Cyan (`#06B6D4`) for DPR-snapped static layout slots, Kinetic Violet (`#A855F7`) for unrounded float motion paths, and Amber Gold (`#F59E0B`) for magnetic `ScriptCue` pins.
> **Layout Structure:**
> 1. **Top Studio Header (`48px`, `#0B0D13`):** Back-link pill `"← Lexicon"`, foreign-key badge `"🔗 script_affiliate_dekton_id13100xpro"`, Stage profile selector `"📱 9:16 · 1080×1920 · 60 FPS"`, active extension chips (`commerce-ui:1.0`, `kinetix:1.0`), and a glowing Cyan/Emerald primary CTA button `"Compile to VideoIR →"`.
> 2. **Left Archetype & Scene Dock (`290px`):**
>    - **Layout Archetype Mini-Blueprint:** Visual card for `arch_vertical_hook_hero` showing a miniature 3-row CSS Grid diagram (`top_banner [auto]`, `hero_stage [2fr]`, `spec_dock [1fr]`, `gap: 24px`, `padding: [140, 140, 320, 40]`).
>    - **Scene Elements Tree:** 4 items with semantic coordinate badges: `el_broll_video` (`bg_video_fill`), `el_warning_pill` (`top_banner` · Cyan badge `SNAPPED`), `el_drill_cutout` (`hero_stage` · Selected · Violet badge `FLOAT`), and `el_spec_card` (`spec_dock` · Violet badge `FLOAT`).
> 3. **Center Darkroom Stage (`1fr` on `#050608` pasteboard with subtle dot grid):**
>    - Top-center floating Smoked Glass pill bar (`[⊞ Grid Regions ✓]`, `[🛡️ Safe Insets ✓]`, `[🎥 Camera ✓]`, `[📐 Dual-Coord HUD ✓]`).
>    - Central `9:16` phone canvas (`1080×1920` scaled to fit):
>      - Coral Rose (`#F43F5E`) diagonal-hatched `safeInsets` exclusion overlay along the bottom (`320px`) and right (`140px`) showing faint ghost outlines of TikTok Shop cart/like icons.
>      - Top `el_warning_pill` red banner framed in `1.5px solid #06B6D4` Cyan with corner tag `"DPR-SNAPPED · 40, 140 · 900×80"`.
>      - Center `el_drill_cutout` (3D cordless drill image) selected and framed in `2px solid #A855F7` Neon Violet with a glowing cubic-Bezier scale-slam trajectory gizmo and corner telemetry pill `"FLOAT MAT2D · 40.00, 244.00 · 900.00×794.67"`.
> 4. **Right Dual Inspector (`348px`):**
>    - **Section 1 — `LayoutTree` Telemetry:** Shows assigned region `hero_stage`, active coordinate routing switch set to `Unrounded Float (Motion Active)`, and a side-by-side comparison pill of `Float Bounds (40.00, 244.00, 900.00×794.67)` vs `Snapped Bounds (40, 244, 900×795)`.
>    - **Section 2 — Choreography Action (`act_slam_product`):** Trigger bound to Amber Gold pill `📌 cue:cue_product_slam`, `offset: -100ms` (`Frame 66`), `duration: 450ms` (`27 frames`), `kind: kinetix:spring-slam` with an interactive spring damping curve preview (`scaleFrom: 2.4 → scaleTo: 1.0`, `damping: 0.65`), and a bottom terminal badge `"✓ Lowers to VideoIR: motion/gsap"`.
> 5. **Bottom Elastic Beat-Ribbon Dock (`220px`):**
>    - Divided into proportional columns for `beat_hook_problem`, `beat_torque_and_gyro`, and `beat_rapid_montage`.
>    - Top row shows read-only spoken lyrics + emerald waveform from `ScriptAST`.
>    - Middle row shows `scene_01_hook_and_specs` spanning the first two beats, followed by a `150ms transition:whip-pan` wedge into `scene_02_rapid_bento_montage`.
>    - Bottom lanes show vertical Amber Gold (`#F59E0B`) magnetic cue drop-lines (`word:0`, `cue_whip_sfx`, `cue_product_slam -100ms`, `cue_torque_badge`) with Violet and Emerald choreography action capsules snapped directly to the gold lines.

### Prompt 2 — Widescreen `16:9` Technical Explainer & Subgrid Inspector View
> **Context:** Design a widescreen `16:9` (`1920x1080`) configuration of **"VideoIR StageCraft"** (`StoryboardAST v1.0`) staging the Technical Architecture Explainer (`sb_generational_slotmap_explainer`), following `DESIGN.md` (`v2.0.0-studio`).
> **Highlight These Studio Features:**
> - **Center `16:9` Stage:** Partitioned by `arch_split_ide_diagram` (`columns: ["1.15fr", "0.85fr"]`, `rows: ["80px", "1fr"]`, `gap: 32px`).
> - Top `header_bar` region framed in `#06B6D4` Cyan (`DPR-SNAPPED · 64, 48 · 1792×80`) displaying `"02 / BIT-PACKING — 52-Bit Generational Handle in IEEE-754 Number"`.
> - Left `ide_pane` region holds `el_ts_editor` (`explainer-ui:code-editor`) showing a dark syntax-highlighted `packNodeId` TypeScript snippet where Line 2 (`0x100000000`) has a glowing callout leader popover anchored to `📌 cue:cue_callout_truncate` with a compiler badge `"→ time_space/callout_leader"`.
> - Right `visualizer_pane` region holds `el_bit_register` (`explainer-ui:bit-register-bar`) showing a 53-bit binary register bar split into `#22d3ee` (`Bits 51..32 · 20-Bit Generation`) and `#a855f7` (`Bits 31..0 · 32-Bit Slot Index`).
