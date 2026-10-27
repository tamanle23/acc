# [022] Expand Motion Graphics with Sci-Fi HUD & Audio Spectrum

**1. Context & Problem Statement**:
The user requested additional effects to be added to the newly created `Motion Graphics` group. To maximize utility for tech, gaming, and lyrical music video niches, we proposed and implemented `sci_fi_hud` (futuristic UI elements) and `audio_spectrum` (fake audio equalizer bars).

**2. Implementation Plan**:
- **`sci_fi_hud`**:
  - `target_lock`: Simulated an advanced targeting system by drawing concentric dashed circles rotating in opposite directions. Encased them in corner brackets that pulse in scale using a sine wave. Added dynamically updating target coordinates.
  - `data_processing`: Rendered a high-tech grid, a sweeping scanner line, a filling progress bar, and a matrix-like stream of randomly generated hex codes scrolling upwards on the left side of the screen.
- **`audio_spectrum`**:
  - Leveraged `simplex-noise` to drive the height of the EQ bars without needing real audio input.
  - *Crucial Math*: To ensure the 1D noise values loop seamlessly over the 3-second duration, mapped the normalized time `tNorm` [0, 1) to a 2D circle in the noise coordinate space `(cos(tNorm * 2PI), sin(tNorm * 2PI))`.
  - `classic_bars`: Vertical bars rendered at the bottom edge.
  - `circular_eq`: Bars radiating outward from a central rotating circle, extremely popular in Monstercat/NCS style music videos.

**3. Changes Made**:
- `.agents/rules/overlay-effects-architecture.md`: [MODIFY] Added `sci_fi_hud` and `audio_spectrum` to the Motion Graphics group catalog.
- `src/overlay-effects/generators/sci_fi_hud.ts`: [NEW] Developed the Sci-Fi HUD generator.
- `src/overlay-effects/generators/audio_spectrum.ts`: [NEW] Developed the seamless looping procedural Audio Spectrum generator.
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported both new generators.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect sci_fi_hud --variant target_lock -t`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect audio_spectrum --variant circular_eq -t`
- Verified that both effects render out as WebM with transparent alpha channels and maintain a flawless seamless loop at the cut point.
