# History Log 068: Fix Interface Property Initializer & Deep Config Defaults Merging

## Problem Statement
1. In TypeScript, interface properties cannot have initializers (e.g., `ratio?: number = 2;` in `src/types.ts:L212`), leading to TypeScript compile errors (`An interface property cannot have an initializer`).
2. When loading `story-config.json` text, optional configuration objects (like `upscale`, `bgm`, `transition`, `depth3d`, `tts`, `captions`, `videoSettings`) might have missing keys or properties explicitly set to `undefined`/`null`. Standard JavaScript object spreads (`{ ...defaults, ...userObj }`) overwrite default values with `undefined` when keys exist with `undefined` values.

## Proposed Plan
1. Remove property initializer from `UpscaleSettings.ratio` interface definition in `src/types.ts`.
2. Implement a recursive `mergeDefined<T>` helper in `src/platforms.ts` that ignores `undefined` and `null` values from user configuration objects, preserving the default property values.
3. Export default configuration objects (`DEFAULT_UPSCALE_SETTINGS`, `DEFAULT_BGM_SETTINGS`, `DEFAULT_TRANSITION_SETTINGS`, `DEFAULT_DEPTH3D_CONFIG`, `DEFAULT_TTS_CONFIG`, `DEFAULT_CAPTION_SETTINGS`, `DEFAULT_VIDEO_SETTINGS`).
4. Update `resolveStorySettings` in `src/platforms.ts` and `cli.ts` to use `mergeDefined` with the default objects for all settings sub-configs.

## Changes Made
- `src/types.ts`: Removed default initializer from `UpscaleSettings.ratio`.
- `src/platforms.ts`:
  - Created `mergeDefined<T>` recursive merger.
  - Exported default config objects for all sub-settings.
  - Updated `resolveStorySettings` to merge defaults with user settings.
- `cli.ts`: Updated `videoSettings` resolution using `mergeDefined(DEFAULT_VIDEO_SETTINGS, scene.videoSettings)`.

## Verification
- Ran `bun run cli.ts ./sample-story` - successfully rendered full video with resolved defaults in 3.7s.

## Tasks
- [x] Fix `UpscaleSettings` interface initializer in `src/types.ts`.
- [x] Add `mergeDefined` helper and default configuration objects in `src/platforms.ts`.
- [x] Update `resolveStorySettings` to merge sub-objects with default values.
- [x] Update `cli.ts` scene video settings resolution.
- [x] Create history log and sync history index.
