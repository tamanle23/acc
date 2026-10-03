# ACC Control Plane — Design System & UI/UX Architecture Specification (DESIGN.md)

> **Master Design System Specification, Visual Foundations & Human Interaction Blueprint**
> **Project:** ACC (Automated Content Creator) Control Plane UI
> **Target Specs:** 250 Content Types across 5 Publishing Formats x 6 Canonical Pipelines x Conductor OSS Task Workers
> **Design Paradigm:** Liquid Glass Design Language (Luminous Frosted Crystal, Refractive Depth, Specular Rim Lighting, Reactive Ambient Mesh Glows)
> **Primary Styling Mode:** Default Light Mode (Luminous Crystal Canvas `#F8FAFC`, Deep Slate High-Contrast Typography `#0F172A`) with Toggleable Dark Studio Mode

---

## 1. Executive Summary & Design Vision

### 1.1 The ACC Control Plane Design Paradigm
The Automated Content Creator (ACC) system executes automated content workflows orchestrated by **Netflix Conductor OSS**. The **ACC Control Plane UI** provides a visual cockpit for human operators across 3 distinct content lifecycle stages:
1. **Trigger & Seed (`Before` Stage — 56.4% of Workflows):** Ingestion source whitelisting, database spec matrix mapping, character LoRA face-lock selection, math equation validation, and GLSL shader seed configuration.
2. **Intervene & Refine (`In the Middle` Stage — 35.2% of Workflows):** Interactive review at paused Conductor `HUMAN_REVIEW` task gates to perform zero-copy WebCodecs video frame trimming, AI script tone editing, multitrack audio sidechain ducking, and interactive HTML5 choice graph reachability validation.
3. **Audit & Health Monitor (`After` Stage — 8.0% of Workflows):** Real-time monitoring of 24/7 RTMP streams, flash crash ticker retraction, public social auto-reply toxicity logs, and 1-to-N omnichannel fan-out tracking.

---

## 2. Core Design Directives & UX Principles

When generating or evaluating UI designs for all 250 content type workflows, the ACC Control Plane strictly enforces 12 foundational design directives:

### 2.1 Visual Design Directives
1. **Visual Hierarchy:** Critical Call-to-Actions (CTAs) like `Approve & Resume Workflow` feature prominent sizing (min height 48px), high-contrast primary colors (Emerald `#059669` / Cyan `#0284c7`), and ample whitespace to isolate primary actions from secondary options.
2. **Clarity:** Explicit, plain-language text labels are mandated over ambiguous standalone icons (e.g. `Edit Script Narrative` rather than an unlabelled pencil icon). Interactive elements feature predictable hover states, cursor affordances, and active press Feedback.
3. **Consistency:** A unified component library (`LiquidGlassPanel`, `LiquidGlassModal`, `SpecularButton`), strict W3C DTCG Design Tokens, and uniform typography scales across all screens.
4. **System Feedback:** Instant visual confirmation for user actions via hover state glows, active press scales, loading indicators, and toast notifications.
5. **Forgiveness:** Frictionless "Undo" / "Redo" command stacks for all user edits, paired with plain-language, actionable error messages (e.g. *"Script exceeds Twitter 280-character limit by 14 characters. Click 'Auto-Summarize' to fix."*).
6. **Accessibility (WCAG 2.1 AA Compliance):** Minimum **4.5:1 contrast ratio** for all body text against glass surfaces, and minimum **44x44px touch targets** for mobile/tablet interfaces.

### 2.2 User Experience (UX) Directives
7. **User-Centricity:** Interfaces are structured around operator goals across the 3 lifecycle stages (`Before`, `In the Middle`, `After`).
8. **Friction Reduction:** Smart defaults, automatic PII redaction blur boxes, and automated grammar validation to minimize cognitive load.
9. **Information Architecture:** Progressive disclosure reveals complex parameters (e.g. Depth3D focal lengths, sidechain ratio curves) only when requested.
10. **Context Awareness:** Responsive grid layouts adapting seamlessly from multi-monitor workstation setups down to mobile tablet interfaces.
11. **Data-Driven Iteration:** Telemetry tracking operator intervention durations to optimize automation thresholds over time.
12. **Inclusive Design:** Native keyboard navigation (`Tab`, `Enter`, `Escape`), screen-reader ARIA landmarks, and a default high-contrast Light Mode theme.

---

## 3. Design Foundations & W3C Tokens

### 3.1 Default Light Mode Color Palette

```css
/* packages/ui/src/styles/liquid-glass-light.css */

:root {
  /* Canvas Background */
  --color-bg-page: #F8FAFC;         /* Light Slate Canvas */

  /* Light Mode Frosted Glass Surfaces */
  --glass-surface-base: rgba(255, 255, 255, 0.70);
  --glass-surface-hover: rgba(255, 255, 255, 0.85);
  --glass-surface-active: rgba(241, 245, 249, 0.95);

  /* High-Contrast Slate Typography */
  --color-text-primary: #0F172A;   /* Contrast > 12:1 against light glass */
  --color-text-secondary: #475569; /* Contrast > 5.5:1 */
  --color-text-muted: #64748B;

  /* Specular Rim Light Gradient */
  --glass-border-specular: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(203, 213, 225, 0.5) 40%,
    rgba(0, 180, 216, 0.4) 100%
  );

  /* Accent & Status Colors */
  --color-accent-cyan: #0284C7;     /* Primary Action Cyan */
  --color-accent-magenta: #C026D3;  /* Human Review Gate Accent */
  --color-accent-emerald: #059669;  /* Success & Approval Emerald */
  --color-accent-red: #DC2626;      /* Rejection & Alert Red */

  /* Ambient Mesh Glows */
  --glow-cyan-light: radial-gradient(circle at 30% 20%, rgba(0, 180, 216, 0.20), transparent 60%);
  --glow-magenta-light: radial-gradient(circle at 80% 30%, rgba(217, 70, 239, 0.18), transparent 60%);

  /* Multi-Pass Backdrop Blurs */
  --glass-blur-sm: blur(8px) saturate(150%);
  --glass-blur-md: blur(18px) saturate(180%);
  --glass-blur-lg: blur(32px) saturate(200%);
}
```

### 3.2 Typography Scale & Hierarchy

| Role | Font Family | Size | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Header** | System Sans / Inter | 24px | 800 Bold | 1.2 | -0.02em |
| **Section Title** | System Sans / Inter | 18px | 700 Bold | 1.3 | -0.01em |
| **Subsection Header** | System Sans / Inter | 14px | 700 Bold | 1.4 | 0em |
| **Body Primary** | System Sans / Inter | 14px | 500 Medium | 1.5 | 0em |
| **Body Secondary** | System Sans / Inter | 13px | 400 Regular | 1.5 | 0em |
| **Code & AST JSON** | JetBrains Mono / Fira Code | 12px | 500 Medium | 1.6 | 0em |
| **Badge & Tag** | JetBrains Mono / Fira Code | 11px | 700 Bold | 1.0 | +0.05em |

---

## 4. Component Library Architecture

The ACC Control Plane component suite is built with React 19 and Tailwind CSS v4 under `docs/ui/components/LiquidGlassDesignSystem.tsx` and `docs/ui/react-snippets/LiquidGlassWorkspace.tsx`.

### 4.1 Component Export Standards
All React components provide **both default exports and named exports** to eliminate import ambiguity:

```tsx
import LiquidGlassDesignSystem, {
  LiquidGlassPanel,
  TriggerStudioWorkspace,
  VideoTimelineWorkspace
} from '@/docs/ui/components/LiquidGlassDesignSystem';
```

---

## 5. Screen & Workspace Specification Matrix

```text
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                          ACC CONTROL PLANE WORKSPACE MATRIX                               │
│  ┌───────────────────────────┬─────────────────────────────────────────────────────────┐  │
│  │ 1. Trigger Studios        │ 6 Canonical Pipeline Seeding Forms (Pipelines 1 - 6)    │  │
│  ├───────────────────────────┼─────────────────────────────────────────────────────────┤  │
│  │ 2. Intervene Workspaces   │ 5 Format Workspaces (Static Web, Social, Video, Audio,  │  │
│  │                           │ Interactive HTML5 Nodes)                                │  │
│  ├───────────────────────────┼─────────────────────────────────────────────────────────┤  │
│  │ 3. Post-Publishing        │ 24/7 RTMP Stream Health & Omnichannel Fan-Out Matrix    │  │
│  └───────────────────────────┴─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Trigger Studios (`Before` Stage)
* **Pipeline 1 (Event Scraper):** `01_trigger_p1_scraper_studio.svg`
* **Pipeline 2 (DB Templating):** `02_trigger_p2_db_matrix_studio.svg`
* **Pipeline 3 (Repurposing):** `03_trigger_p3_repurposing_studio.svg`
* **Pipeline 4 (Generative Story):** `04_trigger_p4_generative_story_studio.svg`
* **Pipeline 5 (Math & Rules):** `05_trigger_p5_math_logic_studio.svg`
* **Pipeline 6 (Ambient Loops):** `06_trigger_p6_ambient_loop_studio.svg`

### 5.2 Intervene Workspaces (`In the Middle` Stage)
* **Format 1 (Static Web CMS):** `07_intervene_f1_static_web_cms_workspace.svg`
* **Format 2 (Social Network Thread):** `08_intervene_f2_social_thread_workspace.svg`
* **Format 3 (Shorts/Reels Video):** `09_intervene_f3_video_timeline_zero_copy.svg`
* **Format 4 (Audio & Podcasts):** `10_intervene_f4_audio_multitrack_ducking.svg`
* **Format 5 (Interactive HTML5):** `11_intervene_f5_interactive_choice_node_graph.svg`

### 5.3 Post-Publishing Health (`After` Stage)
* **Omnichannel Dashboard:** `12_post_publishing_omnichannel_dashboard.svg`

---

## 6. Design Asset Directory Map

All design token JSONs, Penpot palettes, SVG wireframes, and React components are stored under `docs/ui/`:

```text
docs/ui/
├── figma-tokens.json                      # W3C DTCG Format Figma Tokens
├── penpot-palette.json                    # Penpot Color Palette Asset
├── liquid-glass-wireframe.svg             # Main Liquid Glass System Wireframe
├── wireframes/
│   ├── 01_trigger_p1_scraper_studio.svg
│   ├── 02_trigger_p2_db_matrix_studio.svg
│   ├── 03_trigger_p3_repurposing_studio.svg
│   ├── 04_trigger_p4_generative_story_studio.svg
│   ├── 05_trigger_p5_math_logic_studio.svg
│   ├── 06_trigger_p6_ambient_loop_studio.svg
│   ├── 07_intervene_f1_static_web_cms_workspace.svg
│   ├── 08_intervene_f2_social_thread_workspace.svg
│   ├── 09_intervene_f3_video_timeline_zero_copy.svg
│   ├── 10_intervene_f4_audio_multitrack_ducking.svg
│   ├── 11_intervene_f5_interactive_choice_node_graph.svg
│   └── 12_post_publishing_omnichannel_dashboard.svg
├── components/
│   └── LiquidGlassDesignSystem.tsx        # React 19 / Tailwind v4 Component Suite
└── react-snippets/
    └── LiquidGlassWorkspace.tsx           # Standalone Liquid Glass Intervene Workspace Component
```
