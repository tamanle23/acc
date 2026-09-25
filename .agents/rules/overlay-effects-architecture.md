# Overlay Effects CLI Architecture Rule

When working with the `overlay-effects` CLI, you MUST adhere to the following architectural guidelines.

## 1. Modular Variant Architecture
The CLI architecture must be modular. Use an Interface/Class structure to define effect variants so they can be triggered via CLI. For example: `--effect rain --variant drizzle`.

Each effect generator must implement a strategy to select and execute the requested variant.

## 2. Supported Effects & Variants Catalog
Below is the mandatory catalog of supported effects, their variants, the required background container, and their core features.

### Weather (MP4 / Black BG)
*   **`rain`**: variants `[drizzle, heavy_rain, storm]`
    *   *Features*: motion blur lines, angles 15-60 degrees.
*   **`snow`**: variants `[light_snow, flurries, blizzard]`
    *   *Features*: sine-wave drifting, turbulence field.

### Atmosphere (MP4 / Black BG)
*   **`dust`**: variants `[ambient_dust, sunshaft_dust]`
    *   *Features*: slow-moving, low opacity, fade in/out.
*   **`fog`**: variants `[ground_mist, dense_fog]`
    *   *Features*: 2D perlin noise stretching horizontally.
*   **`light_leak`**: variants `[edge_burns, transition_flash]`
    *   *Features*: high luma, color gradients.

### Action & Fire (MP4 / Black BG)
*   **`embers`**: variants `[campfire_sparks, windy_sparks]`
    *   *Features*: upwards velocity, flickering glow.
*   **`smoke`**: variants `[rising_steam, rolling_smoke]`
    *   *Features*: complex fractal movement.
*   **`lightning`**: variants `[sheet_lightning, branching_lightning]`
    *   *Features*: 1-3 frame flashes, high impact.
*   **`fire`**: variants `[campfire_flames, wall_of_fire]`
    *   *Features*: fBm noise with fire color gradient mapping.

### Retro (MP4 / Black BG)
*   **`film_damage`**: variants `[hairline_scratches, film_dirt]`
    *   *Features*: random generation, jittering.
*   **`vhs`**: variants `[tracking_snow, tracking_lines]`
    *   *Features*: RGB displacement, chromatic aberration.

### Organic Objects (WebM / Transparent Alpha BG)
*   **`leaves`**: variants `[autumn_breeze, sakura_petals]`
    *   *Features*: 3D rotation simulation, pendulum swinging.
*   **`bubbles`**: variants `[underwater_bubbles, floating_bubbles]`
    *   *Features*: scaling up over time, sharp edges.

### Cinematic & Optical (MP4 / Black BG)
*   **`bokeh`**: variants `[drifting_bokeh, pulsing_bokeh]`
    *   *Features*: large out-of-focus overlapping light circles, additive blending.
*   **`lens_flare`**: variants `[anamorphic_streak, sun_burst]`
    *   *Features*: horizontal light streaks, radial sun glares.

### Cyberpunk & Tech (MP4 / Black BG)
*   **`digital_glitch`**: variants `[block_datamosh, rgb_shake]`
    *   *Features*: blocky pixelation, severe RGB channel shifting.
*   **`matrix_rain`**: variants `[classic_green, red_alert]`
    *   *Features*: falling digital characters, glowing trails.

### Celebration & Romance (WebM / Transparent Alpha BG)
*   **`confetti`**: variants `[party_confetti, golden_shower]`
    *   *Features*: multi-colored 3D tumbling rectangles.
*   **`floating_hearts`**: variants `[slow_hearts, burst_hearts]`
    *   *Features*: bezier heart shapes, upward pendulum drift.

### Cosmic (MP4 / Black BG)
*   **`starfield`**: variants `[twinkling_night, warp_speed]`
    *   *Features*: sine-wave opacity twinkling, 3D perspective projection.

### Motion Graphics & Camera UI (WebM / Transparent Alpha BG)
*   **`camera_ui`**: variants `[camcorder_rec, cctv_security, dslr_viewfinder]`
    *   *Features*: blinking REC, crosshairs, battery indicators, timestamp.
*   **`sci_fi_hud`**: variants `[target_lock, data_processing]`
    *   *Features*: rotating dashed circles, scanning lines, hex code streams.
*   **`audio_spectrum`**: variants `[classic_bars, circular_eq]`
    *   *Features*: procedural noise-driven EQ bars, seamless looping visualization.

### Anime & Manga Action (WebM / Transparent Alpha BG)
*   **`speed_lines`**: variants `[radial_burst, horizontal_rush]`
    *   *Features*: sharp trailing lines, high contrast manga style.

### Volumetric Lighting (MP4 / Black BG)
*   **`god_rays`**: variants `[heavenly_glow, underwater_shafts]`
    *   *Features*: intense light shafts, slow moving volumetric gradients.

### Liquid & Grunge (MP4 / Black BG or WebM)
*   **`rain_on_glass`**: variants `[static_drops, sliding_drops]`
    *   *Features*: organic water drop shapes, sliding physics.
*   **`grunge_texture`**: variants `[stop_motion_paper, flickering_halftone]`
    *   *Features*: stop-motion paper textures, comic book halftone dots.

## 3. Maintaining this Rule
**IMPORTANT**: If a new effect or variant is introduced to the `overlay-effects` CLI, you MUST update this rule file (`.agents/rules/overlay-effects-architecture.md`) to reflect the new additions.
