# [029] Add FPS, Width, and Height Arguments to Overlay Effects CLI

## 1. Context & Problem Statement
The user attempted to run `bun run overlay-effects-cli.ts` with `--fps 30 --width 1920 --height 1080` arguments, but encountered a `TypeError: Unknown option '--fps'`. The `parseArgs` configuration in the CLI did not accept these options, and the `BaseEffectEngine` did not expose a way to configure these properties dynamically, defaulting them strictly to 30fps and 1920x1080.

## 2. Implementation Plan
- **BaseEffectEngine Modification**: Add `setDimensions(width: number, height: number)` and `setFps(fps: number)` methods to allow dynamic configuration after instantiation, avoiding breaking changes to the extensive list of derived effect classes.
- **CLI Argument Parsing**: Update `overlay-effects-cli.ts` `parseArgs` config to accept `--fps`, `--width`, and `--height`.
- **Pass Arguments to Engine**: Update `renderEffectLayer` to accept these optional parameters and apply them to the engine before `renderAndPipe`.

## 3. Changes Made
- `src/core/BaseEffectEngine.ts`: Added `setDimensions` and `setFps` public methods.
- `overlay-effects-cli.ts`: Added `fps`, `width`, and `height` to `parseArgs` options. Modified `renderEffectLayer` to accept options and apply them to the `BaseEffectEngine` instance. Passed parsed `values` into `renderEffectLayer` calls in `main`.

## 4. Verification & Walkthrough
Ran the CLI to verify it accepts `--fps`, `--width`, and `--height` correctly and passes them through without errors.
