# [026] Video Scene Integration (B-Roll & Stock Footage)

**1. Context & Problem Statement**:
The visual storytelling generator was originally designed around static images (`image`) whose duration was strictly tied to the voiceover (`audio`). The user requested the ability to ingest `.mp4`/`.webm`/`.mov` video files as scenes, which introduced duration conflicts (video length vs voiceover length) and audio conflicts (video noise vs voiceover).

**2. Implementation Plan**:
- Followed the 7-Point Synchronization checklist.
- Replaced `image` mapping with `video` or `image` (prioritizing video).
- Introduced `videoSettings` to configure behavior when durations clash (`timeBase`, `shortVideoMode`, `longVideoMode`, `volume`).

**3. Changes Made**:
- `src/types.ts`: Added `VideoSettings` interface, `video` & `videoSettings` to `SceneConfig` and `ResolvedSceneConfig`.
- `schema/story-config.schema.json`: Added `VideoSettings` to definitions, updated properties.
- `docs/STORY_CONFIG_SPEC.md`: Wrote specs for video integration.
- `src/renderer.ts`: Updated `renderSingleScene` to dynamically apply `-stream_loop`, `tpad=stop_mode=clone`, `-shortest`, and `amix` based on config.
- `cli.ts`: Added `resolveMediaPath` fallbacks for `video` and default `videoSettings` resolution.
- `auto-config.ts`: Added `.mp4`, `.mov`, `.webm`, `.mkv` extensions, modified smart pairing logic to ingest video files and auto-scaffold `videoSettings`.

**4. Verification & Walkthrough**:
- FFmpeg filters intelligently fall back to image loops if no video is provided.
- If a video is shorter than audio and `shortVideoMode` is `freeze`, it uses `tpad` to hold the last frame.
- If audio mixing is enabled (`volume > 0.0`), `amix` dynamically combines streams with `apad`.
- Auto-config automatically recognizes video extensions inside the media directories.
