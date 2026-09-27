# [046] 3D Depth Backlog & Out-of-Bounds Frame-Breaker Engine

## 1. Context & Problem Statement
The user requested:
1. Brainstorming comprehensive 3D depth / pop-out visual techniques to elevate 2D storytelling slides into dynamic 3D experiences.
2. Archiving all brainstormed 3D techniques into a dedicated technical backlog (`docs/3D_DEPTH_BACKLOG.md`).
3. Executing the implementation of **Idea 1: Out-of-Bounds (Vượt khung / Frame-Breaker 3D Illusion)** with strict adherence to the **7-Point Synchronization Protocol** for `story-config.json`.

---

## 2. Implementation Plan (7-Point Synchronization Protocol)
1. **TypeScript Definitions (`src/types.ts`)**:
   - Defined `Depth3DMode` (`'frame_breaker' | 'parallax_25d' | 'volumetric_sandwich' | 'depth_map_3d' | 'wigglegram'`).
   - Defined `FrameBreakerStyle` (`'polaroid' | 'card' | 'cinema' | 'comic'`).
   - Defined `Depth3DConfig` interface with styling options (`popOutIntensity`, `elevationShadow`, `floatingMotion`, `subjectImage`, etc.).
   - Added `depth3d?: Depth3DConfig` to `SceneConfig`, `StorySettings`, and `ResolvedStorySettings`.
2. **JSON Schema (`schema/story-config.schema.json`)**:
   - Added `#/$defs/depth3d` schema with validation rules, enum modes, styles, and property descriptions.
   - Connected `depth3d` into `settings.properties` and `scenes.items.properties`.
3. **Specification Document (`docs/STORY_CONFIG_SPEC.md`)**:
   - Created **Section 12: Cấu hình Hiệu Ứng Nổi 3D (3D Depth & Frame-Breaker)** with full properties tables, styles catalog, and JSON samples.
4. **Core Renderer & Main CLI (`cli.ts`, `src/platforms.ts`, `src/renderer.ts`, `src/depth3d/frame-breaker.ts`)**:
   - Created high-performance Canvas rendering engine `renderFrameBreakerScene()` using `@napi-rs/canvas` to render dimmed blurred backdrop, styled framed card, clipped inner scene, pop-out protruding subject, dynamic 3D drop shadow, and floating sine-wave motion.
   - Piped raw RGBA memory buffers via `canvas.data()` directly into FFmpeg `stdin` (`-f rawvideo -pix_fmt rgba`) with zero disk overhead.
   - Integrated into `src/renderer.ts` scene rendering pipeline with fallback compatibility.
5. **Auto-Config Tool (`auto-config.ts`)**:
   - Added interactive prompt wizard for 3D Depth Pop-out and injected default configuration into `finalSettings`.
6. **Sample Story Config (`sample-story/story-config.json`)**:
   - Configured `depth3d` on Scene 1 (`frameStyle: "polaroid"`, `popOutIntensity: 1.2`, `elevationShadow: true`, `floatingMotion: true`).
   - Verified end-to-end rendering via `bun run cli.ts ./sample-story`.
7. **Project Readme (`README.md`)**:
   - Synchronized cheat sheet and documentation links with `docs/3D_DEPTH_BACKLOG.md` and 3D Depth features.

---

## 3. Changes Made
- `docs/3D_DEPTH_BACKLOG.md`: **[NEW]** Complete technical specification and roadmap for 5 3D depth techniques.
- `src/depth3d/frame-breaker.ts`: **[NEW]** Canvas-based 3D Frame-Breaker engine with zero-disk FFmpeg RGBA streaming.
- `src/types.ts`: **[MODIFY]** Added `Depth3DConfig`, `Depth3DMode`, `FrameBreakerStyle`.
- `schema/story-config.schema.json`: **[MODIFY]** Added `depth3d` definitions and validation rules.
- `docs/STORY_CONFIG_SPEC.md`: **[MODIFY]** Added Section 12 detailing 3D Depth configuration.
- `src/platforms.ts`: **[MODIFY]** Added `depth3d` pass-through in `resolveStorySettings`.
- `src/renderer.ts`: **[MODIFY]** Dispatched scene rendering to `renderFrameBreakerScene` when `depth3d` is enabled.
- `src/overlay-effects/stacker.ts`: **[MODIFY]** Added `format=auto` and explicit `format=yuv420p` color space conversion.
- `auto-config.ts`: **[MODIFY]** Added interactive wizard option for 3D Depth and settings defaults.
- `sample-story/story-config.json`: **[MODIFY]** Enabled `depth3d` on Scene 1.
- `README.md`: **[MODIFY]** Documented 3D Depth features and backlog links.

---

## 4. Verification & Walkthrough
- Executed `bun run cli.ts ./sample-story` rendering 3 scenes in parallel with Scene 1 utilizing the 3D Out-of-Bounds Frame-Breaker engine.
- Rendering succeeded in **5.4s - 7.8s** with zero errors.
- Extracted and verified sample frames using FFmpeg:
  - Dimmed blurred background.
  - Polaroid card with drop shadow and floating oscillation.
  - Lower body clipped cleanly within the card frame.
  - Upper subject head popping out above the top border.
