# 085: Fix Source Crop Head Pop-out & Architecture Map of /src Post-Monorepo

## 1. Problem Statement
1. **Scene 1 Dinosaur Head Sliced Flat at Top Border**: When rendering Scene 1 (`frame_breaker`, `polaroid`), the dinosaur's head was cut off flat along the top edge of the polaroid photo rather than emerging freely into the 3D space above the frame.
2. **Analysis of Test Results (Contract Testing vs Visual Regression)**: Clarifying why automated tests passed (contract / runtime integrity) while visual nuances (such as cropped head pixels) require visual rendering verification.
3. **Workspace Architecture Definition**: Clarifying the exact role, structure, and boundaries of `/src` after completing the 7-phase Turborepo monorepo refactoring.

## 2. Root Cause & Solution for Scene 1
- **Root Cause**: In Canvas 2D, calling `ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)` with `sy > 0` (e.g. `sy = 0.18 * height`) instructs Canvas to discard all pixels above `sy` from the source image. Because the dinosaur's head occupied source rows `y = 140..250`, setting `sy = 250` physically excluded the head from the source buffer, causing it to be sliced off flat at `innerY`.
- **Solution**:
  - Maintained `(sx, sy, sw, sh)` exclusively for the clipped inner photo window.
  - Computed global affine scale and translation offsets (`scale = innerW / sw`, `offsetX = innerX - sx * scale`, `offsetY = innerY - sy * scale`).
  - Rendered the **entire uncropped subject** `subjectImg` via `ctx.drawImage(subjectImg, offsetX, offsetY, img.width * scale, img.height * scale)` with a bottom-only boundary clip (`rect(frameX - 400, frameY - 600, frameW + 800, (innerY + innerH) - (frameY - 600))`).
  - Result: The dinosaur's feet remain planted on the meadow inside the card, while its complete head, dorsal crest, and waving arm burst proudly outside the polaroid frame with realistic drop shadows.

## 3. Post-Phase Architecture Map of `/src` vs Monorepo
- `/packages/core`: Core C/FFI bindings, AVCodec / AVFormat wrappers, strategy-pattern video encoders, filtergraphs, audio resamplers, IPC bridge.
- `/packages/ir`: Shared intermediate representations (StoryIR, ScraperIR, DBIR, MathIR, AmbientIR).
- `/packages/proto`: gRPC and Protocol Buffer service definitions.
- `/apps/cli`: Unified multi-pipeline CLI dispatcher (`acc run`, `acc stream`, `acc serve`, `acc list`).
- `/apps/python-backend`: Fast gRPC daemon hosting AI services (SAM 2, Depth Anything v2, Kokoro TTS, LLM grammar).
- `/src`: **The Generative Storytelling Engine (Pipeline 4)** core workspace:
  - `src/renderer.ts`: Scene orchestrator, DAG filtergraph builder, audio ducking, and worker pool dispatcher for multi-scene stories.
  - `src/depth3d/`: 3D Depth & Visual Pop-out rendering engines (`frame_breaker`, `volumetric_sandwich`, `depth_map_3d`, `parallax_25d`, `wigglegram`).
  - `src/subtitles.ts`: Dynamic ASS generator and high-performance per-frame Canvas karaoke text rasterizer.
  - `src/platforms.ts` / `src/styles.ts`: Social media platform presets and visual styling rules.
  - `cli.ts`: Legacy backward-compatible entry point (`bun run cli.ts ./sample-story`).
