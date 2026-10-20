# Brainstorming & Architectural Plan: Enhanced Canvas Timeline (Studio) - Iteration 19 Extension

## 1. Executive Vision & Problem Context
The Studio timeline recently gained a **Dual-Mode (`[ DOM | Canvas ]`)** architecture, eliminating duplicate rendering and providing high-performance 60fps rendering through an `OffscreenCanvas` Web Worker with an interval tree index.

While the foundation is solid, professional Non-Linear Editors (e.g., DaVinci Resolve, Final Cut Pro, Adobe Premiere Pro) succeed because their timelines feel **tactile, predictable, informative, and visually distinct**. When working on canvas mode, we need to bring the exact same (or superior) UX ergonomics as DOM mode, combining the sheer speed of Canvas/Worker with pro-grade interaction feedback:
- **Visual Clarity:** Clear distinction between Video, Audio, Title, and Effect tracks; rich thumbnail filmstrips and audio waveform LODs; high-contrast selection and hover borders.
- **Accurate Sequence Snapping:** Magnetic snap lines to clip edges, playhead, marker points, and timecode intervals with snap distance damping.
- **Fluid Movement & Cross-Lane Reordering:** Type-safe track drag-and-drop, collision preview (red ghost on invalid collision, cyan ghost on valid drop), auto-insert ripple vs overwrite behavior.
- **Resizing & Trimming:** Ergonomic trim handles with visual delta tooltip (`+12f`, `-00:00:00:12`), ripple trim option (`Alt` / `Cmd`), and out-of-bounds protection.
- **5-State Matrix & Accessibility:** Adhering strictly to `/ui-ux-design-system` and `/frontend-app-architect` standards.

---

## 2. Canvas Visual & Spatial Layout Architecture

### 2.1 Track & Lane Design Tokens
Canvas rendering must align with our Tailwind tokens (`slate-950`, `slate-900`, `slate-800`, `cyan-400`, `rose-500`, etc.):
- **Track Lane Backgrounds:**
  - Alternating subtle zebra striping (`#0f172a` for even tracks, `#131d35` for odd tracks).
  - Track separators: 1px subtle divider (`rgba(51, 65, 85, 0.4)`).
  - Empty lane placeholder watermark or subtle dotted grid showing frame boundaries.
- **Clip Visual Styling:**
  - **Video Clips:** Deep slate-cyan border (`#0891b2`), translucent fill with rounded corners (4px radius).
  - **Audio Clips:** Forest emerald accent (`#059669` / `#10b981`), high-contrast waveform visualization drawn with dual-channel or centered LOD amplitude bars.
  - **Overlays / Captions:** Amber/Purple tint (`#8b5cf6` or `#f59e0b`).
  - **Clip Headers / Metadata:** 10px monospace typography (`font-mono`, e.g., `ui-monospace`) displaying clip title, asset duration, and FX badge icons (`[fx]`, `[vol]`).
- **Selection & Focus:**
  - Unselected: 1px border `rgba(255, 255, 255, 0.15)`.
  - Hover: 1.5px border `rgba(255, 255, 255, 0.4)` + cursor transition.
  - Selected: 2px solid cyan (`#22d3ee`) outline with outer drop shadow glow (`rgba(34, 211, 238, 0.35)`).
  - Trim Grips: Distinct corner notches or 3-dot grip pills on left and right ends when selected or hovered.

```
+-------------------------------------------------------------------------------------------------+
| [Video 1]   (=== [ Clip A: intro.mp4 (00:00:05:00) ] ===)     (=== [ Clip B: main.mp4 ] ===)    |
| [Video 2]               (=== [ Overlay: logo.png ] ===)                                         |
| [Audio 1]   (=== [ ||||||||||||||||||||||||||||||||| Voiceover ] ===)                           |
+-------------------------------------------------------------------------------------------------+
```

---

## 3. Interaction Design & Sequences Movement

### 3.1 Pointer State Machine Enhancements
Currently, `TimelinePointerStateMachine` handles basic drag and trim. We will enhance it with:
1. **Multi-Axis Constraint & Threshold:**
   - 3px drag hysteresis before activating `DRAGGING_CLIP` or `TRIMMING_CLIP` to prevent accidental drags on quick clicks.
   - Horizontal snap lock: If dragging mostly horizontally, resist vertical track hopping until pointer moves >15px vertically.
2. **Magnetic Snapping Engine (`TimelineMagneticSnapService`):**
   - **Snap Candidates:**
     1. Playhead position (`currentFrame`).
     2. In/Out points of all clips across *all* active tracks.
     3. 1-second and 5-second major timecode grid lines.
     4. Markers/cue points.
   - **Visual Magnetic Feedback:**
     - Glowing vertical snap guideline extending through all tracks.
     - Sticky magnetic pull: Snapping "holds" within a 10px screen threshold before breaking free smoothly.
     - HUD tooltip indicating what was snapped to (`"Snapped to Playhead"`, `"Snapped to Clip 1 End"`).
3. **Collision Detection & Modes:**
   - **Overwrite Mode (Default NLE behavior):** Dropping a clip over another clip either flags collision or replaces the slice upon drop.
   - **Ripple / Push Mode (`Shift` or Toggle):** Automatically shifts subsequent clips to the right without destructive overwriting.
   - **Ghost Drag Feedback:**
     - Valid drop: Cyan dashed outline (`#22d3ee`) with transparent fill.
     - Invalid drop (wrong media type, locked track, or forbidden collision): Red dashed outline (`#ef4444`) with `not-allowed` cursor.

---

## 4. Edge Resizing & Trimming UX

### 4.1 Trim Handles
- **Hit Detection Zone:** Expanded to 10px on the left edge (`trim-start`) and right edge (`trim-end`), with 0ms `col-resize` cursor feedback on hover.
- **Minimum Duration Constraint:** Hard boundary of at least 1 frame (or minimum 100ms) to prevent zero-duration collapse.
- **Source Media Bounds Check:** Cannot trim beyond the source asset's actual physical duration (`0` to `mediaAsset.durationFrames`).
- **Interactive Tooltip HUD:**
  - Real-time timecode badge pinned above the trim handle showing:
    - Current clip start/end frame.
    - Delta change (`+15f` in green, `-12f` in amber).
    - Resulting duration (`00:00:04:18`).

---

## 5. Cross-Lane Drag-and-Drop

### 5.1 Track Typing & Semantic Constraints
- Video tracks accept: Video clips, Images, Text/Title overlays, Color solids.
- Audio tracks accept: Voiceovers, Background Music (BGM), Sound Effects (SFX).
- When dragging an audio clip over a video track:
  - Worker ghost turns red (`#ef4444`).
  - Cursor displays `no-drop` / `not-allowed`.
  - Drop is rejected with zero state corruption.
- When dragging across compatible tracks:
  - Target track highlights with a subtle glow or blue background border.
  - Preview ghost snaps cleanly into the target lane.

---

## 6. 5-State Component Matrix & WCAG 2.1 AA Standards

In accordance with `/ui-ux-design-system`:
1. **Default State:** Full track and clip layout rendered at 60fps with clear timecode ticks, waveform LODs, and clip labels.
2. **Loading State:** Skeleton track lanes with shimmering gradients (`bg-slate-800 animate-pulse`) when VideoIR or waveforms are being compiled.
3. **Empty State:** When a track or project has zero clips, render a centered Canvas/DOM empty state with a dashed drop target and a CTA: *"Drop media here or press [Import] to begin editing"*.
4. **Error State:** If WebGL or OffscreenCanvas fails to initialize, gracefully fall back to DOM timeline mode with an alert notification.
5. **Disabled State:** When rendering or exporting, timeline displays read-only mode with disabled cursor and 50% opacity mask.

### Accessibility (a11y) for Canvas
Because HTML5 `<canvas>` is inherently a graphical bitmap, we maintain accessible DOM semantics:
- The sticky track headers on the left provide full keyboard navigation (`Tab`, `Space`, `Enter`).
- Screen reader ARIA live region announcing timeline actions (`"Clip intro.mp4 moved to 00:01:15"`, `"Trimmed by +10 frames"`).
- Keyboard shortcuts: `J-K-L` shuttling, `S` split, `Delete` / `Backspace` remove selected clip, `Ctrl+Z` undo.

---

## 7. Architecture & Implementation Roadmap

```mermaid
flowchart TD
    subgraph UI_Layer ["Studio UI & Interaction Layer"]
        CanvasOverlay["Transparent Pointer Canvas Overlay"] -->|Pointer Events| StateMachine["TimelinePointerStateMachine"]
        StateMachine -->|Calculate Snap| SnapService["TimelineMagneticSnapService"]
        StateMachine -->|Hit Test| HitTester["TimelineHitTester"]
        StateMachine -->|Dispatch Command| CmdDispatcher["TimelineCommandDispatcher"]
    end

    subgraph State_Layer ["IR State & Command Execution"]
        CmdDispatcher -->|Execute| IRState["IRStateManager (SSOT)"]
        IRState -->|Publish State| StoreListener["Studio React Component"]
    end

    subgraph Worker_Layer ["Offscreen Worker Render Pipeline"]
        StoreListener -->|postMessage(model)| Worker["Timeline.worker.ts"]
        Worker -->|Interval Tree Cull| Tree["TimelineIntervalTree"]
        Worker -->|Render LOD| WaveformCache["WaveformLODPyramid Cache"]
        Worker -->|Render Bitmap| ThumbCache["ThumbnailLRUCache"]
        Worker -->|Draw Frame| Canvas["OffscreenCanvas Buffer"]
    end
```

### Proposed Action Items:
1. **Refine Worker Canvas Visuals (`timeline.worker.ts`):**
   - Add polished track dividers, rounded clips with gradient shading, and distinct FX badges.
   - Refine audio waveform bar contrast and filmstrip aspect-ratio cropping.
2. **Enhance Pointer State Machine (`TimelinePointerStateMachine.ts`):**
   - Implement drag activation threshold (3px) and vertical dampening.
   - Add collision prevention and magnetic snap holding.
3. **Elevate HUD Feedback (`Timeline.tsx`):**
   - Render multi-track snap indicators, delta timecode badges, and track-highlight hover styles.
4. **Verify with Autogenerated Tests:**
   - Add comprehensive tests for magnetic snap edge cases, collision prevention, and track type validation.
