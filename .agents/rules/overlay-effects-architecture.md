# Overlay Effects CLI: Architecture & Catalog Rules

## 1. Modular Architecture & Routing
- **CLI Pattern:** Use strict Interface/Class polymorphism. Trigger via CLI arguments: `--effect <name> --variant <variant_name>`.
- **Strategy Pattern:** Each effect generator MUST implement a strategy interface to route, configure, and execute the requested variant dynamically. 
- **Extensibility:** Adding a new effect requires updating ONLY its specific class implementation and this rule file.

## 2. Core System Architecture (Mandatory Constraints)
- **Memory-Efficient Data Pipeline (Zero-Disk):** DO NOT render static image files (PNG/JPG) to disk. The graphics logic must calculate each frame, draw to Canvas, extract the raw byte array (Raw Buffer RGBA), and pipe it directly into an open FFmpeg process via Node.js/Bun Streams (`stdin`). FFmpeg must encode the video in real-time.
- **Seamless Looping:** Implement exact loop interpolation. Particles moving across the screen MUST have matching coordinates at the first and last frames, or utilize opacity crossfading based on particle lifetime to ensure zero visual seams.
- **Polyrhythmic Looping:** The CLI MUST support customizable prime number durations (e.g., 3s, 5s, 7s, 11s...) at a fixed FPS (30 or 60). This ensures that when stacked later via FFmpeg, the combined prime-duration overlays create a non-repeating cycle lasting for minutes.
- **Background & Codec Management:**
  - *Solid Black (RGB 0,0,0):* Export as MP4 (H.264/H.265). Strictly for `screen` or additive blended effects (weather, lights, atmospheric).
  - *Transparent (Alpha Channel):* Export as WebM (VP9). Strictly for solid objects requiring transparency (leaves, bubbles, UI elements).

## 3. Technical Catalog & Render Pipelines
*CRITICAL: The FFmpeg configuration (codec, pixel format) MUST strictly match the pipeline designated for each effect.*

### Pipeline A: Luma/Screen Blending (Output: MP4 | Background: Solid Black RGB 0,0,0)
| Category | Effect (`--effect`) | Variants (`--variant`) | Core Technical Features |
| :--- | :--- | :--- | :--- |
| **Weather** | `rain` | `drizzle`, `heavy_rain`, `storm` | Motion blur lines, 15-60 degree angles. |
| **Weather** | `snow` | `light_snow`, `flurries`, `blizzard` | Sine-wave drifting, turbulence field. |
| **Atmosphere** | `dust` | `ambient_dust`, `sunshaft_dust` | Slow-moving, low opacity, fade in/out. |
| **Atmosphere** | `fog` | `ground_mist`, `dense_fog` | 2D perlin noise stretching horizontally. |
| **Atmosphere** | `light_leak` | `edge_burns`, `transition_flash` | High luma, color gradients. |
| **Action** | `embers` | `campfire_sparks`, `windy_sparks` | Upwards velocity, flickering glow. |
| **Action** | `smoke` | `rising_steam`, `rolling_smoke` | Complex fractal movement. |
| **Action** | `lightning` | `sheet_lightning`, `branching_lightning`| 1-3 frame flashes, high impact. |
| **Action** | `fire` | `campfire_flames`, `wall_of_fire` | fBm noise with fire color gradient mapping. |
| **Retro** | `film_damage`| `hairline_scratches`, `film_dirt` | Random generation, jittering. |
| **Retro** | `vhs` | `tracking_snow`, `tracking_lines` | RGB displacement, chromatic aberration. |
| **Cinematic** | `bokeh` | `drifting_bokeh`, `pulsing_bokeh` | Large out-of-focus overlapping light circles. |
| **Cinematic** | `lens_flare` | `anamorphic_streak`, `sun_burst` | Horizontal light streaks, radial sun glares. |
| **Cyberpunk** | `digital_glitch`| `block_datamosh`, `rgb_shake` | Blocky pixelation, severe RGB channel shifting. |
| **Cyberpunk** | `matrix_rain` | `classic_green`, `red_alert` | Falling digital characters, glowing trails. |
| **Cosmic** | `starfield` | `twinkling_night`, `warp_speed` | Sine-wave opacity twinkling, 3D perspective. |
| **Volumetric**| `god_rays` | `heavenly_glow`, `underwater_shafts`| Intense light shafts, volumetric gradients. |
| **Grunge** | `rain_on_glass`| `static_drops`, `sliding_drops` | Organic water drop shapes, sliding physics. |
| **Grunge** | `grunge_texture`| `stop_motion_paper`, `flickering_halftone`| Stop-motion textures, halftone dots. |

### Pipeline B: Alpha Transparency (Output: WebM VP9 | Background: Transparent)
| Category | Effect (`--effect`) | Variants (`--variant`) | Core Technical Features |
| :--- | :--- | :--- | :--- |
| **Organic** | `leaves` | `autumn_breeze`, `sakura_petals` | 3D rotation simulation, pendulum swinging. |
| **Organic** | `bubbles` | `underwater_bubbles`, `floating_bubbles`| Scaling up over time, sharp edges. |
| **Celebration**| `confetti` | `party_confetti`, `golden_shower` | Multi-colored 3D tumbling rectangles. |
| **Celebration**| `floating_hearts`| `slow_hearts`, `burst_hearts` | Bezier heart shapes, upward pendulum drift. |
| **Motion UI** | `camera_ui` | `camcorder_rec`, `cctv_security`, `dslr`| Blinking REC, crosshairs, battery indicators. |
| **Motion UI** | `sci_fi_hud` | `target_lock`, `data_processing` | Rotating dashed circles, hex code streams. |
| **Motion UI** | `audio_spectrum`| `classic_bars`, `circular_eq` | Procedural noise-driven EQ bars, seamless looping. |
| **Anime** | `speed_lines` | `radial_burst`, `horizontal_rush` | Sharp trailing lines, high contrast manga style. |

## 4 Combinatorial System Architecture: Composite Effects Rule

## 1. The Combinatorial Principle (Nguyên lý Tổ hợp)
To achieve thousands of unique visual outcomes without bloating the codebase, the CLI MUST implement a Combinatorial System. This system generates **Composite Effects** by multiplying three dimensions:
- **Base Variants:** (e.g., `drizzle`, `storm`).
- **Polyrhythmic Time (Prime Durations):** Using prime numbers (3s, 5s, 7s, 11s) for different layers prevents visible repetition loops.
- **Layer Stacking (Compositing):** Blending 2 to 5 distinct base effects simultaneously over a target video.

## 2. Registry Expansion: The `composites` Object
The `effects-registry.json` MUST be extended to include a `"composites"` object. A composite does not have its own rendering class; instead, it defines an array of base layers.

**Example JSON Structure:**
```json
{
  "pipelines": { ... },
  "effects": { ... },
  "composites": {
    "haunted_forest": {
      "category": "Horror",
      "description": "Spooky ground mist with subtle fireflies and film damage.",
      "layers": [
        { "effect": "fog", "variant": "ground_mist", "duration": 7 },
        { "effect": "fireflies", "variant": "deep_forest", "duration": 5 },
        { "effect": "film_damage", "variant": "hairline_scratches", "duration": 3 }
      ]
    },
    "cyberpunk_alley": {
      "category": "Sci-Fi",
      "description": "Heavy rain combined with rolling smoke and digital glitches.",
      "layers": [
        { "effect": "rain", "variant": "heavy_rain", "duration": 5 },
        { "effect": "smoke", "variant": "rolling_smoke", "duration": 7 },
        { "effect": "digital_glitch", "variant": "rgb_shake", "duration": 11 }
      ]
    }
  }
}

## 5. Maintenance Directive
**CRITICAL**: If a new effect or variant is requested, you MUST update this rule file (`.agents/rules/overlay-effects-architecture.md`) strictly following the Markdown Table format above before writing any implementation code.