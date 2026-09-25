# [007] Implement Snow Overlay Effect

**1. Context & Problem Statement**:
The user requested a new "Snow" effect to be added to the Overlay Effects CLI. This requires a different visual and mathematical logic compared to rain, specifically needing slower descent, circular particles, and left-right swaying mimicking wind, while still maintaining a perfect seamless loop.

**2. Implementation Plan**:
- Create `src/overlay-effects/generators/snow.ts`.
- Implement `generateSnowEffect` which draws circles instead of lines.
- Calculate wind sway using a sine wave. To guarantee a perfect loop, the `swayFrequency` must be an integer multiple of `(2 * Math.PI) / duration`. This means a particle will complete exactly $N$ full sine wave cycles over the duration of the video.
- Export the generator in `index.ts` so `registry.ts` picks it up automatically.

**3. Changes Made**:
- `src/overlay-effects/generators/snow.ts`: [NEW] The snow rendering logic.
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported `generateSnowEffect`.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect snow --duration 3 --fps 30 --width 1920 --height 1080 --output ./snow_3s.mp4`
- Video verified: Renders 90 frames successfully. Snowflakes sway left and right without snapping at the end of the loop.
