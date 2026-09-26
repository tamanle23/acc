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
  - *Solid Black (RGB 0,0,0):* Export as MP4 (H.264). Strictly for `screen` or additive blended effects (weather, lights, atmospheric).
  - *Transparent (Alpha Channel):* Export as WebM (VP9). Strictly for solid objects requiring transparency (leaves, bubbles, UI elements).
  - *Solid White (RGB 255,255,255):* Export as MP4 (H.264). Strictly for `multiply` dark textures (ink, dark smoke).
  - *Neutral Gray 50% (RGB 128,128,128):* Export as MP4 (H.264). Strictly for `overlay` contrast textures (film grain).

---

## 3. Mandatory Overlay Method & Companion Metadata Rule

### A. Quy chuẩn Lựa chọn Phương pháp Overlay (Overlay Method Selection)
Mỗi hiệu ứng khi thiết kế BẮT BUỘC phải gán đúng một trong các phương pháp sau:

1. **`alpha` (Alpha Channel Transparency):**
   - **Màu nền:** Trong suốt 100% (`rgba(0, 0, 0, 0)`).
   - **Container & Codec:** `.webm` (`libvpx-vp9`, `yuva420p`).
   - **FFmpeg Decoder Input:** BẮT BUỘC khai báo `-c:v libvpx-vp9` trước `-i` để tránh FFmpeg tự ý xóa kênh Alpha.
   - **FFmpeg Filter:** `overlay=shortest=1`.
   - **Áp dụng:** Toàn bộ đối tượng 2D/3D, UI/HUD, Vector, Chữ, Particle đặc sắc, Composite đóng gói độc lập.

2. **`screen` (Luma Additive Blending):**
   - **Màu nền:** Đen đặc (`#000000`).
   - **Container & Codec:** `.mp4` (`libx264`, `yuv420p`).
   - **FFmpeg Filter:** `blend=all_mode=screen:all_opacity=1:shortest=1`.
   - **Áp dụng:** Hiện tượng quang học, phát sáng, lửa, sấm sét, mưa, tuyết, bụi khí quyển, bokeh, lóa ống kính.

3. **`multiply` (Darkening Blending):**
   - **Màu nền:** Trắng tinh (`#FFFFFF`).
   - **Container & Codec:** `.mp4` (`libx264`, `yuv420p`).
   - **FFmpeg Filter:** `blend=all_mode=multiply:all_opacity=1:shortest=1`.
   - **Áp dụng:** Vết mực loang, khói đen, bóng râm, vết ố giấy cũ, tối góc vignette.

4. **`overlay` (Contrast / Texture Blending):**
   - **Màu nền:** Xám trung tính 50% (`#808080`).
   - **Container & Codec:** `.mp4` (`libx264`, `yuv420p`).
   - **FFmpeg Filter:** `blend=all_mode=overlay:all_opacity=1:shortest=1`.
   - **Áp dụng:** Hạt phim analog (film grain), vân xước phim nhựa, texture giấy sần.

### B. Quy chuẩn Metadata Companion JSON
Bất kỳ khi nào CLI hay Engine xuất một file hiệu ứng (ví dụ `rain_heavy_rain_5s.mp4`), hệ thống **BẮT BUỘC PHẢI XUẤT ĐỒNG THỜI** một file JSON cùng tên (`rain_heavy_rain_5s.json`) chứa đầy đủ các trường thông tin chuẩn sau:

```json
{
  "effect": "rain",
  "variant": "heavy_rain",
  "pipeline": "mp4_luma",
  "overlay_method": "screen",
  "background": {
    "type": "solid",
    "color": "#000000"
  },
  "recommended_blend_mode": "screen",
  "ffmpeg_input_options": [],
  "ffmpeg_filter_snippet": "blend=all_mode=screen:all_opacity=1:shortest=1",
  "resolution": {
    "width": 1920,
    "height": 1080
  },
  "fps": 30,
  "duration": 5.0,
  "format": "mp4"
}
```

---

## 4. Technical Catalog & Render Pipelines

### Pipeline A: Luma/Screen Blending (Output: MP4 | Background: Solid Black `#000000`)
| Category | Effect (`--effect`) | Variants (`--variant`) | Overlay Method | Core Technical Features |
| :--- | :--- | :--- | :--- | :--- |
| **Weather** | `rain` | `drizzle`, `heavy_rain`, `storm` | `screen` | Motion blur lines, 15-60 degree angles. |
| **Weather** | `snow` | `light_snow`, `flurries`, `blizzard` | `screen` | Sine-wave drifting, turbulence field. |
| **Atmosphere** | `dust` | `ambient_dust`, `sunshaft_dust` | `screen` | Slow-moving, low opacity, fade in/out. |
| **Atmosphere** | `fog` | `ground_mist`, `dense_fog` | `screen` | 2D perlin noise stretching horizontally. |
| **Atmosphere** | `light_leak` | `edge_burns`, `transition_flash` | `screen` | High luma, color gradients. |
| **Action** | `embers` | `campfire_sparks`, `windy_sparks` | `screen` | Upwards velocity, flickering glow. |
| **Action** | `smoke` | `rising_steam`, `rolling_smoke` | `screen` | Complex fractal movement. |
| **Action** | `lightning` | `sheet_lightning`, `branching_lightning`| `screen` | 1-3 frame flashes, high impact. |
| **Action** | `fire` | `campfire_flames`, `wall_of_fire` | `screen` | fBm noise with fire color gradient mapping. |
| **Retro** | `film_damage`| `hairline_scratches`, `film_dirt` | `screen` | Random generation, jittering. |
| **Retro** | `vhs` | `tracking_snow`, `tracking_lines` | `screen` | RGB displacement, chromatic aberration. |
| **Cinematic** | `bokeh` | `drifting_bokeh`, `pulsing_bokeh` | `screen` | Large out-of-focus overlapping light circles. |
| **Cinematic** | `lens_flare` | `anamorphic_streak`, `sun_burst` | `screen` | Horizontal light streaks, radial sun glares. |
| **Cyberpunk** | `digital_glitch`| `block_datamosh`, `rgb_shake` | `screen` | Blocky pixelation, severe RGB channel shifting. |
| **Cyberpunk** | `matrix_rain` | `classic_green`, `red_alert` | `screen` | Falling digital characters, glowing trails. |
| **Cosmic** | `starfield` | `twinkling_night`, `warp_speed` | `screen` | Sine-wave opacity twinkling, 3D perspective. |
| **Volumetric**| `god_rays` | `heavenly_glow`, `underwater_shafts`| `screen` | Intense light shafts, volumetric gradients. |
| **Grunge** | `rain_on_glass`| `static_drops`, `sliding_drops` | `screen` | Organic water drop shapes, sliding physics. |
| **Grunge** | `grunge_texture`| `stop_motion_paper`, `flickering_halftone`| `screen` | Stop-motion textures, halftone dots. |

### Pipeline B: Alpha Transparency (Output: WebM VP9 | Background: Transparent `rgba(0,0,0,0)`)
| Category | Effect (`--effect`) | Variants (`--variant`) | Overlay Method | Core Technical Features |
| :--- | :--- | :--- | :--- | :--- |
| **Organic** | `leaves` | `autumn_breeze`, `sakura_petals` | `alpha` | 3D rotation simulation, pendulum swinging. |
| **Organic** | `bubbles` | `underwater_bubbles`, `floating_bubbles`| `alpha` | Scaling up over time, sharp edges. |
| **Celebration**| `confetti` | `party_confetti`, `golden_shower` | `alpha` | Multi-colored 3D tumbling rectangles. |
| **Celebration**| `floating_hearts`| `slow_hearts`, `burst_hearts` | `alpha` | Bezier heart shapes, upward pendulum drift. |
| **Motion UI** | `camera_ui` | `camcorder_rec`, `cctv_security`, `dslr_viewfinder`| `alpha` | Blinking REC, crosshairs, battery indicators. |
| **Motion UI** | `sci_fi_hud` | `target_lock`, `data_processing` | `alpha` | Rotating dashed circles, hex code streams. |
| **Motion UI** | `audio_spectrum`| `classic_bars`, `circular_eq` | `alpha` | Procedural noise-driven EQ bars, seamless looping. |
| **Anime** | `speed_lines` | `radial_burst`, `horizontal_rush` | `alpha` | Sharp trailing lines, high contrast manga style. |

---

## 5. Combinatorial System Architecture: Composite Effects Rule

### 1. The Combinatorial Principle (Nguyên lý Tổ hợp)
To achieve thousands of unique visual outcomes without bloating the codebase, the CLI MUST implement a Combinatorial System. This system generates **Composite Effects** by multiplying three dimensions:
- **Base Variants:** (e.g., `drizzle`, `storm`).
- **Polyrhythmic Time (Prime Durations):** Using prime numbers (3s, 5s, 7s, 11s) for different layers prevents visible repetition loops.
- **Layer Stacking (Compositing):** Blending 2 to 5 distinct base effects simultaneously over a target video.

### 2. Registry Expansion: The `composites` Object
The `effects-registry.json` MUST be extended to include a `"composites"` object. A composite does not have its own rendering class; instead, it defines an array of base layers.

---

## 6. Maintenance Directive
**CRITICAL**: If a new effect or variant is requested, you MUST update this rule file (`.agents/rules/overlay-effects-architecture.md`) strictly following the Markdown Table format above before writing any implementation code.