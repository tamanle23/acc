# Studio Walkthrough 51: Universal Track Type Grouping, Backward-Compatible `groupOrder`, and Supreme Timed-Text Flat Rendering Stack

## 1. Overview & Verification Summary
Iteration 57 introduces **Universal Track Type Grouping**, **Backward-Compatible `groupOrder`**, and a **Supreme Timed-Text Flat Rendering Stack** across the VideoIR engine, Effect Engines, and Studio timeline:
1. **Modality Group Organization**: Tracks are structured into 3 distinct bands: `Text & Captions` (`timed_text`), `Video & Overlays` (`video`, `image`, `overlay`), and `Audio Tracks` (`audio`).
2. **Backward-Compatible `groupOrder`**: Tracks declare a non-negative integer `groupOrder` scoping their sequence within their modality group. Legacy documents without `groupOrder` automatically fallback to their document index.
3. **Modality-Isolated Reordering**: `ReorderTrackCommand` moves tracks strictly within their modality group; tracks will never cross between text, video, or audio tiers.
4. **Supreme Timed-Text Flat Rendering Stack**: `IRCanvasCompositor` promotes all `timed_text` tracks to an isolated top-level flat stack composited strictly on top of all visual layers, sorted by `groupOrder`.
5. **Dynamic Subtitle Anti-Collision**: Concurrently active subtitle tracks sharing identical vertical anchors automatically compute stacked slot offsets (`slotIndex`), eliminating overlapping text collisions.
6. **Studio UI & Liquid Glass Dividers**: `TimelineDom.tsx` renders ambient section headers with title, icon, and track counters, and `TrackHeaderCard` bounds reorder buttons strictly within each section.

---

## 2. Verification Matrix

| Verification Vector | Target Component | Status | Assertion |
| :--- | :--- | :--- | :--- |
| **Track Modality Grouping** | `VideoIRAuthoringEngine.groupTracksByType` | Pass | Organizes mixed tracks into `timed_text`, `video`, `audio` with normalized `groupOrder` |
| **Intra-Group Reordering** | `ReorderTrackCommand` | Pass | Moving tracks up/down reorders within modality group; boundaries are safely clamped |
| **Undo / Redo Snapshots** | `ReorderTrackCommand` | Pass | Full snapshot restoration guarantees bit-identical undo state without drift |
| **Schema Validation** | `VideoIRSchemaValidator` | Pass | Approves valid integer `groupOrder`; rejects negative numbers or non-integers |
| **DAG Compiler Pass-Through** | `RelationalDAGCompiler` | Pass | `groupOrder` is preserved on `ResolvedTrack` in compiled `ResolvedTimeline` |
| **Subtitle Anti-Collision** | `drawCanvasCaptionsFromSnapshot` | Pass | Distinct `slotIndex` values compute non-overlapping vertical offsets |
| **Compositor Flat Stack** | `IRCanvasCompositor` | Pass | Subtitles render strictly on top of all visual plates and visual master modifiers |
| **Studio UI Presentation** | `TimelineDom.tsx` & `Timeline.tsx` | Pass | Renders Liquid Glass group headers, intra-group bounds, and quick track adders |

---

## 3. Key Architecture Components

### 3.1 Schema & Authoring Engine (`packages/ir`)
- `IRTrack.groupOrder?: number`: 0-based ordering index within modality group.
- `ResolvedTrack.groupOrder?: number`: compiled representation.
- `VideoIRAuthoringEngine.getTrackModalityGroup(type)`: maps `timed_text`, `audio`, `video`, `data`.
- `VideoIRAuthoringEngine.groupTracksByType(tracks)`: segregates into modality partitions with sorted/normalized `groupOrder`.
- `VideoIRAuthoringEngine.reorderTrackInGroup(doc, trackId, direction)`: performs atomic intra-group swap and normalizes indices.

### 3.2 Compositor & Subtitles (`packages/ir`, `packages/effect-engines`)
- `CaptionSettings.slotIndex?: number`: stack slot index.
- `drawCanvasCaptionsFromSnapshot`: calculates vertical `slotOffset = slotIndex * slotSpacing`, shifting bottom-aligned subtitles upward.
- `IRCanvasCompositor.finalizePostVisualTracks`:
  1. Runs visual master modifiers (bloom, lens flare, LUTs) on the visual canvas.
  2. Renders all active `timed_text` tracks in order of `groupOrder`, dynamically assigning collision slots.

### 3.3 Studio Timeline UI (`apps/studio`)
- `TimelineDom.tsx`: groups tracks via `VideoIRAuthoringEngine.groupTracksByType`, renders Liquid Glass section banners, and calculates bounded `canMoveUp` / `canMoveDown`.
- `Timeline.tsx`: exposes "+ Video", "+ Text", and "+ Audio" quick creation buttons.
- `ReorderTrackCommand.ts`: executes intra-group reordering with snapshot undo.
