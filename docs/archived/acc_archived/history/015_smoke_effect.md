# [015] Implement Smoke Overlay Effect

**1. Context & Problem Statement**:
The user requested the implementation of the `smoke` effect from the `Action & Fire` group. This requires generating complex fractal movement representing rising steam or rolling smoke. Like the `fog` effect, calculating pure procedural fractal noise pixel-by-pixel for every frame would be prohibitively slow in Node.js.

**2. Implementation Plan**:
- Create `src/overlay-effects/generators/smoke.ts`.
- **Fractal Brownian Motion (fBm)**: Upgraded the basic Simplex noise generator to calculate 4 octaves of noise (`fbm()`). This drastically improves the realism, creating organic, wispy cloud-like textures instead of simple blocky noise.
- **Vertical Tileable Noise**: Modified the algorithm to map the Y coordinate to a circle in the 2D noise space, then blended the edges. This guarantees that the generated noise texture perfectly tiles vertically.
- **Hardware Blur**: Added `ctx.filter = 'blur(10px)'` during rendering to further soften the procedural textures into volumetric smoke.
- **Organic Sway**: Added a synchronized horizontal sine wave offset to the scrolling layers to create a billowing effect while maintaining a mathematically flawless seamless loop.

**3. Changes Made**:
- `src/overlay-effects/generators/smoke.ts`: [NEW] Developed the smoke generator supporting `rising_steam` (2 layers, fast, wispy) and `rolling_smoke` (3 layers, thick, turbulent).
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported `generateSmokeEffect`.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect smoke --variant rising_steam`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect smoke --variant rolling_smoke`
- Both videos seamlessly loop vertically. The blending of the 3 textures created a convincing volumetric smoke simulation with minimal CPU overhead.
