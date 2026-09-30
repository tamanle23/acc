# History Log 068: Fix Interface Property Initializer & Resolve Settings Defaults

## Problem Statement
1. In TypeScript, interface properties cannot have initializers (e.g., `ratio?: number = 2;` in `src/types.ts:L212`), leading to TypeScript compile errors (`An interface property cannot have an initializer`).
2. Optional settings (such as `upscale` and `bgm`) needed default fallback values populated when `resolveStorySettings` is invoked.

## Proposed Plan
1. Remove property initializer from `UpscaleSettings.ratio` interface definition in `src/types.ts`.
2. Update `resolveStorySettings` in `src/platforms.ts` to supply default values for optional/undefined fields:
   - `upscale`: default `model = 'realesrgan-x4plus'`, `ratio = 2` when enabled/configured.
   - `bgm`: default `volume = 0.1`, `loop = true`, `fadeIn = 0`, `fadeOut = 2`, `autoDucking = true`.

## Changes Made
- `src/types.ts`: Changed `ratio?: number = 2;` to `ratio?: number;` in `UpscaleSettings`.
- `src/platforms.ts`: Updated `resolveStorySettings` to map `upscale` and `bgm` objects with proper default values for undefined fields.

## Verification
- Verified TypeScript parsing and execution via `bun run cli.ts --help`.

## Tasks
- [x] Fix `UpscaleSettings` interface initializer in `src/types.ts`.
- [x] Update `resolveStorySettings` in `src/platforms.ts`.
- [x] Create history log and sync history index.
