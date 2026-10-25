# [008] Refactor Overlay Effects for Modular Variants Architecture

**1. Context & Problem Statement**:
A new mandatory rule (`.agents/rules/overlay-effects-architecture.md`) was introduced requiring all overlay effects to be modular and support specific variants via the `--variant` CLI argument. We needed to refactor the existing `rain` and `snow` generators to implement this switch logic and accept the `--variant` argument from the main CLI.

**2. Implementation Plan**:
- **Interface Update**: Added `variant` property to `OverlayEffectConfig` in `src/overlay-effects/types.ts`.
- **CLI Parser**: Updated `overlay-effects-cli.ts` to accept `--variant` (or `-v`) with a default value of `'default'`, and pass it to the config.
- **Rain Generator**: Refactored `src/overlay-effects/generators/rain.ts` with a `switch` block.
  - Implemented `drizzle`: 300 drops, slower speed, slight angle.
  - Implemented `heavy_rain`: 1000 drops, fast speed, steep angle.
  - Implemented `storm`: 2000 drops, very fast speed, sharp horizontal angle.
- **Snow Generator**: Refactored `src/overlay-effects/generators/snow.ts` with a `switch` block.
  - Implemented `light_snow`: 500 flakes, slow speed, gentle sway.
  - Implemented `flurries`: 1500 flakes, medium speed, moderate sway.
  - Implemented `blizzard`: 4000 flakes, fast speed, aggressive horizontal sway.

**3. Changes Made**:
- `src/overlay-effects/types.ts`: [MODIFY] Added `variant` property.
- `overlay-effects-cli.ts`: [MODIFY] Added variant parser.
- `src/overlay-effects/generators/rain.ts`: [MODIFY] Added switch block for drizzle, heavy_rain, storm.
- `src/overlay-effects/generators/snow.ts`: [MODIFY] Added switch block for light_snow, flurries, blizzard.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect rain --variant drizzle --duration 3 --fps 30 --width 1920 --height 1080 --output ./rain_drizzle_3s.mp4`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect snow --variant blizzard --duration 3 --fps 30 --width 1920 --height 1080 --output ./snow_blizzard_3s.mp4`
- Tested both edge cases and they render successfully with noticeably different particle characteristics.
