# [012] Implement Fog Overlay Effect

**1. Context & Problem Statement**:
The user requested the implementation of the `fog` effect from the `Atmosphere` group. The requirement specified using "2D perlin noise stretching horizontally". Using raw noise algorithms directly per-pixel on the main Canvas for every frame in Node.js would be highly inefficient. We needed an optimized approach to generate seamless rolling volumetric fog.

**2. Implementation Plan**:
- Create `src/overlay-effects/generators/fog.ts`.
- **Optimization Strategy**: Generate two low-resolution tileable 2D noise textures *once* upfront using `simplex-noise`. 
- **Stretching**: Scale up these noise textures via Canvas `drawImage()`. The bi-linear filtering creates the soft edges inherent to fog, and the asymmetrical scaling (stretching width more than height) fulfills the visual requirement of horizontally stretching noise.
- **Tileable Noise Math**: Mapped the X coordinate on the noise canvas to a 2D circle in noise space so the left edge seamlessly wraps to the right edge.
- **Seamless Loop Math**: Calculated exact drift speeds (`exactSpeed1`, `exactSpeed2`) that ensure the noise texture pans exactly an integer number of screen widths across the given `duration`.
- Exposed `getRawCanvas()` in the `CanvasAdapter` to allow `napi-rs/canvas` to properly accept an offscreen canvas as an image source.

**3. Changes Made**:
- `src/overlay-effects/generators/fog.ts`: [NEW] Developed the optimized fog generator supporting `ground_mist` (masked gradient) and `dense_fog` (full screen).
- `src/overlay-effects/canvas-strategies/napi-rs.ts`: [MODIFY] Added `getRawCanvas()` method.
- `src/overlay-effects/canvas-strategies/base.ts`: [MODIFY] Added optional `getRawCanvas()` to the interface.
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported `generateFogEffect`.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect fog --variant ground_mist`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect fog --variant dense_fog`
- The system correctly generates the low-res textures upfront, then rapidly renders the 90 frames using Canvas hardware scaling/blending, achieving high performance.
