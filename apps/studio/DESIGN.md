# Design Specification: Studio (`@acc/studio`)
> **Target Tool / Feed:** Google Stitch AI Design Canvas & Antigravity Agents  
> **Aesthetic System:** Liquid Glass Enterprise Video Editing & Motion Graphics  
> **Platform:** Modern Browser Web (React 19 / Vite 6) & High-Performance Canvas/WebCodecs Pipeline  
> **Status:** Living Document & Foundation Specification

---

## 1. System Identity & Vision

### 1.1 Product Purpose & Persona
`@acc/studio` is an enterprise-grade non-linear video editing (NLE), procedural motion graphics, and depth-aware visual effects workspace. It is designed for creative technologists, technical directors, video editors, and motion designers who require high information density, millisecond SMPTE precision, zero dropped frames at 60 FPS, and hardware-accelerated WebCodecs client-side MP4 rendering.

### 1.2 Aesthetic Core: Liquid Glass Enterprise NLE
The visual identity of Studio fuses precision darkroom cinematography with **Liquid Glass**:
- **Multi-layered Frosted Scrims**: Translucent glass backdrops over subtle chromatic liquid ambient mesh (`liquid-ambient-mesh`), giving the canvas atmospheric depth without distracting from pixel-accurate color grading.
- **Specular Top & Rim Borders**: Specular highlights (`border-[var(--glass-border)]`, inset highlights) providing clean tactile separation between complex docked panels.
- **SMPTE Telemetry Readouts**: High-contrast monospace badge telemetry (`font-mono`) displaying frames, fractional seconds, drop ratios, and audio clock drift.
- **Dynamic Glass Personas**: User-selectable optical finishes (`specular`, `frosted`, `cyber`) and diffusion strengths (`low`, `medium`, `high`) adjustable in real-time.

---

## 2. Google Stitch Portable Design Tokens

Google Stitch ingests these tokens as prompt-level constraints when rendering screens.

### 2.1 Color Palette & Theme Tokens

| Semantic Token | Light Mode Value | Dark Mode Value | Usage Description |
| :--- | :--- | :--- | :--- |
| `--background` | `oklch(0.985 0.005 250)` | `oklch(0.12 0.035 264.695)` | Deep canvas background under workspace glass |
| `--foreground` | `oklch(0.129 0.042 264.695)` | `oklch(0.984 0.003 247.858)` | High-contrast primary text & labels |
| `--card` | `oklch(1 0 0 / 45%)` | `oklch(0.16 0.035 259.21 / 45%)` | Translucent glass card surface fill |
| `--card-foreground` | `oklch(0.129 0.042 264.695)` | `oklch(0.984 0.003 247.858)` | Text and icons inside glass cards |
| `--popover` | `oklch(1 0 0 / 85%)` | `oklch(0.16 0.035 259.21 / 85%)` | Dropdown, popover, modal dialog surface |
| `--primary` | `oklch(0.208 0.042 265.755)` | `oklch(0.929 0.013 255.508)` | Primary action buttons & transport controls |
| `--accent-theme` | `var(--accent-primary, #06b6d4)` | `var(--accent-primary, #06b6d4)` | Theme accent (Cyan, Violet, Emerald, Amber, Rose) |
| `--muted` | `oklch(0.968 0.007 247.896 / 50%)` | `oklch(0.25 0.035 260.031 / 45%)` | Track lane background & inactive card fills |
| `--muted-foreground` | `oklch(0.554 0.046 257.417)` | `oklch(0.704 0.04 256.788)` | Secondary telemetry, timecodes, helper hints |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Razor cut indicator, delete action, export cancel |
| `--border` | `oklch(0.9 0.015 255 / 45%)` | `oklch(1 0 0 / 14%)` | Panel splitters, ruler boundaries, card outlines |
| `--ring` | `oklch(0.704 0.04 256.788)` | `oklch(0.551 0.027 264.364)` | WCAG focus rings (`focus-visible:ring-2`) |

### 2.2 Liquid Glass Variables

```css
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-border: rgba(255, 255, 255, 0.12);
--glass-specular: rgba(255, 255, 255, 0.85);
```

Studio uses color-coded archetype badges to instantly communicate sequence types:
- **Audio Tracks (`track-audio`, `track-bgm`, `track-voice`)**: Emerald theme (`bg-emerald-950/85 border-emerald-500/50 text-emerald-200`)
- **Video Plates (`track-v1`, `track-video`)**: Indigo theme (`bg-indigo-950/85 border-indigo-500/50 text-indigo-200`)
- **VFX & Depth Layers (`track-v2`, `track-vfx`, `track-depth`)**: Amber theme (`bg-amber-950/85 border-amber-500/50 text-amber-200`)
- **Typography & Subtitles (`track-text`, `track-subtitles`, `timed_text`)**: Violet theme (`bg-violet-950/85 border-violet-500/50 text-violet-200`)

---

## 3. UI/UX Interaction Principles & State Matrices

1. **Default / Resting**: Clean translucent panels, subtle border reflections, clear timecode badges.
2. **Hover State**: Crisp border glow (`hover:border-accent-theme/40`, `hover:brightness-110`).
3. **Active Dragging State**: Non-blocking CSS transitions (`transition-none` during active drag, `transition-all` on drop settlement), ghost proxy overlay, and magnetic snap guidelines.
4. **Keyframe Active State**: Glowing diamond button (`KeyframeDiamondButton`), indicating temporal curve values at the current playhead position.
5. **Non-Blocking Toast Feedback**: Sonner toast stack anchored to the bottom-right corner for non-intrusive operations (MP4 completion, asset ingest, undo/redo confirmation).
6. **WCAG 2.2 AA Compliance**:
   - High-visibility focus indicators on all interactive buttons and inputs (`focus-visible:ring-1 focus-visible:ring-accent-theme`).
   - Explicit `aria-label` attributes on all icon-only buttons (Play, Pause, Shuttle, Mute, Lock, Splitter).
   - `aria-pressed` on toggle states (Lock, Mute, Theme, Snapping, Ripple).
