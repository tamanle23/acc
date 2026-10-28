# Route & Workspace Topology: Studio (`@acc/studio`)
> **Application Topology:** Single-Page Canvas & Resizable Multi-Pane Studio Shell  
> **State Management:** Reactive Store (`useSyncExternalStore`) + Command Pattern Undo/Redo  
> **Status:** Living Document & Foundation Specification

---

## 1. Workspace Layout Architecture

`@acc/studio` is structured as a full-viewport responsive creative workstation with keyboard-navigable split panes (`react-resizable-panels`):

```
┌────────────────────────────────────────────────────────────────────────┐
│ Titlebar: Content ID, Timecode, Template Select, IR I/O, Export, Theme │
├───────────────┬────────────────────────────────────────┬───────────────┤
│ LeftSidebar   │ Preview Canvas Viewport                │ RightSidebar  │
│ (Activity Rail│ - 16:9 / 9:16 Responsive Video Stage   │ (Inspector)   │
│  + Drawer:    │ - Transform Gizmos & Snapping Reticle  │ - Project     │
│  Vault, Text, │ - Safe Guides, Depth & Alpha Toggles   │ - Track       │
│  Shapes, VFX, │ - Telemetry Companion Card             │ - Sequence    │
│  SFX, Footage)│                                        │ - Modifiers   │
├───────────────┴────────────────────────────────────────┴───────────────┤
│ Timeline Scrubber & Tracks                                             │
│ - Toolbar: Tools (V/C/H), Transport (J/K/L), Snap, Ripple, Zoom, VU   │
│ - SMPTE Timecode Ruler with Draggable Playhead Scrubber               │
│ - Virtualized Multi-Track DOM Canvas with Linked A/V Audio Waveforms   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Modal & Dialog Topologies

| Modal Dialog | Component File | Trigger / Keybinding | Purpose |
| :--- | :--- | :--- | :--- |
| **Export Progress Modal** | `src/components/ExportProgressModal.tsx` | Click "Export MP4" in Titlebar | Displays real-time WebCodecs MP4 encoding progress with non-blocking Cancel button. |
| **Settings Modal** | `src/components/SettingsModal.tsx` | Click Gear icon in Titlebar | Liquid Glass tuning (Dark/Light, Finish, Diffusion Strength, Accent Colors). |
| **Shortcuts Cheat Sheet** | `src/components/ShortcutsModal.tsx` | Press `?` or Click Keyboard icon | Comprehensive keyboard shortcut table for shuttle, editing, and navigation. |
| **Visual IR Debugger** | `src/components/debugger/VisualIRJsonDebuggerModal.tsx` | Press `Ctrl+Shift+J` or Click Debugger | Live interactive tree view, raw JSON syntax viewer (Shiki), and schema validator. |
| **Cue Timeline Editor** | `src/components/inspector/CueTimelineDialog.tsx` | Click "Edit Cues" in Subtitles Inspector | Subtitle dialogue timing table with millisecond offset adjustments and live playback preview. |

---

## 3. Global Keyboard Shortcut Matrix

| Key / Combination | Context | Action |
| :--- | :--- | :--- |
| `[` | Global | Toggle Left Sidebar Drawer |
| `]` | Global | Toggle Right Inspector Drawer |
| `\` | Global | Toggle Zen Mode (hide both sidebars) |
| `Space` / `K` | Viewport & Timeline | Toggle Play / Pause |
| `J` | Transport | Shuttle Rewind (-1x, -2x, -4x, -8x) |
| `L` | Transport | Shuttle Forward (1x, 2x, 4x, 8x) |
| `Left Arrow` | Timeline | Step backward 1 frame |
| `Right Arrow` | Timeline | Step forward 1 frame |
| `Shift + Left/Right` | Timeline | Jump backward / forward 1 second |
| `V` | Timeline | Activate Selection Tool |
| `C` | Timeline | Activate Razor Split Tool |
| `H` | Timeline | Activate Hand Panning Tool |
| `Ctrl + Z` | Titlebar / Timeline | Undo last command |
| `Ctrl + Y` / `Ctrl+Shift+Z` | Titlebar / Timeline | Redo command |
| `Ctrl + Shift + J` | Titlebar | Open Visual VideoIR JSON Editor & Debugger |
| `Shift + V` | Viewport | Cycle Vision Pass (Composite, Depth, Normals, Alpha) |
