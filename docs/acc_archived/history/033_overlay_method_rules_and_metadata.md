# [033] Overlay Method Systematization & Standardized Metadata JSON

**1. Context & Problem Statement**:
To eliminate ambiguity when compositing layers downstream and prevent artifacts (such as black background overwriting alpha transparency or wrong blend modes erasing dark details), we needed to:
1. Formulate a strict architectural rule in `.agents/rules/overlay-effects-architecture.md` categorizing all effects into 4 standard overlay pipelines (`alpha`, `screen`, `multiply`, `overlay`).
2. Guarantee that whenever any overlay effect is rendered, the CLI and Engine MUST generate a standardized companion `<filename>.json` metadata file containing exact blending instructions, background color, decoder requirements (e.g., `-c:v libvpx-vp9`), and FFmpeg filter snippets.

**2. Implementation Plan**:
- **Rules Documentation**: Updated `.agents/rules/overlay-effects-architecture.md` with Section 3 ("Mandatory Overlay Method & Companion Metadata Rule") and updated catalog tables.
- **Registry & Pipeline Schema**: Enriched `PipelineConfig` in `src/core/Registry.ts` and `effects-registry.json` with `overlay_method`, structured `background` (`type`, `color`), `recommended_blend_mode`, and `ffmpeg_filter_snippet`.
- **Engine & CLI Auto-Metadata**: Updated `src/overlay-effects/engine.ts` and `overlay-effects-cli.ts` to automatically emit structured JSON metadata whenever an effect is rendered or loaded.

**3. Changes Made**:
- `.agents/rules/overlay-effects-architecture.md`: [MODIFY] Added comprehensive overlay method specifications and companion metadata format.
- `effects-registry.json`: [MODIFY] Populated `overlay_method`, `background`, `ffmpeg_filter_snippet` on all pipelines.
- `src/core/Registry.ts`: [MODIFY] Updated `PipelineConfig` and `PipelineBackground` interfaces.
- `src/overlay-effects/engine.ts`: [MODIFY] Implemented automatic companion JSON metadata generation for all rendered layers.
- `overlay-effects-cli.ts`: [MODIFY] Unified rendering flow to print video and metadata paths.

**4. Verification & Walkthrough**:
- Tested `bun run overlay-effects-cli.ts -e rain -v storm -d 5`: generated `rain_storm_5s.mp4` and `rain_storm_5s.json` (`overlay_method: "screen"`).
- Tested `bun run overlay-effects-cli.ts -e leaves -v sakura_petals -d 3`: generated `leaves_sakura_petals_3s.webm` and `leaves_sakura_petals_3s.json` (`overlay_method: "alpha"`, `ffmpeg_input_options: ["-c:v", "libvpx-vp9"]`).
- End-to-end verified via `bun run cli.ts ./sample-story` rendering `Dinosaur_Story_6.mp4`.
