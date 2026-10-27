# [013] Implement Light Leak Overlay Effect

**1. Context & Problem Statement**:
The user requested the implementation of the `light_leak` effect to complete the `Atmosphere` group. This effect requires organic shapes of warm colors (luma/gradients) that act either as a continuous edge bleed (`edge_burns`) or a bright flash for scene transitions (`transition_flash`).

**2. Implementation Plan**:
- Create `src/overlay-effects/generators/light_leak.ts`.
- **edge_burns**: Utilized multiple `createRadialGradient` calls placed at the edges and corners of the screen (e.g., top-left, bottom-right). Applied a sine wave based on the frame's `progress` (0.0 to 1.0 mapping to $0$ to $2\pi$) to slowly pulse the radii and opacity of these gradients, ensuring a mathematically perfect seamless loop.
- **transition_flash**: Utilized a `createLinearGradient` to sweep warm colors across the screen, coupled with a central intense white `createRadialGradient` that peaks at the exact midpoint (`progress = 0.5`) and fades back to black, inherently creating a looping flash transition.

**3. Changes Made**:
- `src/overlay-effects/generators/light_leak.ts`: [NEW] Developed the light leak generator supporting `edge_burns` and `transition_flash`.
- `src/overlay-effects/generators/index.ts`: [MODIFY] Exported `generateLightLeakEffect`.

**4. Verification & Walkthrough**:
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect light_leak --variant edge_burns`
- CLI executed successfully: `bun run overlay-effects-cli.ts --effect light_leak --variant transition_flash`
- Both variants rendered 90 frames successfully into MP4 files with matching JSON metadata, using standard `source-over` blending on a black background (intended to be screened later).
