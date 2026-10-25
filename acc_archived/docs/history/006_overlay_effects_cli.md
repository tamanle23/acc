# [006] Implement Overlay Effects Generator CLI

**1. Context & Problem Statement**:
The project required a new standalone CLI tool written in TypeScript running on Bun to automatically generate 2D graphical overlay effects (like rain, snow, etc.). These effects are needed for video VFX, requiring seamless polyrhythmic loops. Importantly, it was mandated not to write static image frames to disk, but to stream raw frame buffers directly to FFmpeg.

**2. Implementation Plan**:
- **Canvas Engine Strategy**: Decoupled the rendering library (using `@napi-rs/canvas` by default) via a Strategy Pattern (`CanvasAdapter`), allowing future swap to `skia-canvas`.
- **Pipeline Architecture**: Utilized `fluent-ffmpeg` combined with Node.js `PassThrough` streams. The CLI computes each frame, converts the HTML5 canvas to a raw RGBA buffer, and pipes it straight into the FFmpeg input stream (`rawvideo`).
- **Seamless Loop Math**: Applied custom math (modulo wrapping based on duration & FPS) to particle logic so the last frame perfectly links back to the first frame.
- **CLI Parser**: Leveraged `util.parseArgs` for zero-dependency command line execution.

**3. Changes Made**:
- `package.json`: Added `@napi-rs/canvas`, `simplex-noise` and new script `"overlay-effects": "bun run overlay-effects-cli.ts"`.
- `overlay-effects-cli.ts`: [NEW] The entry point for the new CLI.
- `src/overlay-effects/types.ts`: [NEW] Centralized configuration interfaces.
- `src/overlay-effects/registry.ts`: [NEW] Module loader for dynamic effects.
- `src/overlay-effects/pipeline.ts`: [NEW] Built `EffectPipeline` class wrapping `fluent-ffmpeg`.
- `src/overlay-effects/utils/loop-math.ts`: [NEW] Math functions for seamless looping.
- `src/overlay-effects/canvas-strategies/*`: [NEW] Implementation of the Strategy pattern for `@napi-rs/canvas`.
- `src/overlay-effects/generators/rain.ts`: [NEW] Heavy Rain effect algorithm.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect rain --duration 3 --fps 30 --width 1920 --height 1080 --output ./rain_3s.mp4`
- The system properly initialized `napi-rs/canvas`, computed 90 frames, successfully pushed the chunks via `PassThrough` stream to `fluent-ffmpeg`, and generated a fully seamless MP4 without touching the disk for intermediate frames.
