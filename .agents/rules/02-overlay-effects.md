---
trigger: model_decision
description: Architecture and processing rules for overlay effects CLI and rendering pipeline.
---

# OVERLAY EFFECTS ARCHITECTURE

- **Routing**: Strategy Pattern via `--effect <name> --variant <variant_name>`.
- **Zero-Disk Streaming**: Canvas raw RGBA pointers direct to FFmpeg `sws_scale` via `bun:ffi` (Zero-Copy). Never write intermediate frames to disk.
- **Seamless Looping**: Prime durations (3s, 5s, 7s, 11s) at 30/60 FPS for polyrhythmic layering; seamless loop interpolation or opacity crossfade.
- **Overlay Blending**:
  - `alpha`: WebM VP9 (`libvpx-vp9`), transparent `rgba(0,0,0,0)`, `overlay=shortest=1`.
  - `screen`: MP4 H.264 (`libx264`), black `#000000`, `blend=all_mode=screen:all_opacity=1:shortest=1`.
  - `multiply`: MP4 H.264 (`libx264`), white `#FFFFFF`, `blend=all_mode=multiply:all_opacity=1:shortest=1`.
  - `overlay`: MP4 H.264 (`libx264`), gray `#808080`, `blend=all_mode=overlay:all_opacity=1:shortest=1`.
- **Artifacts & Docs**: Companion `.json` metadata (overlay_method, background, ffmpeg_filter_snippet, resolution, fps, duration). Sync `docs/master_rules_reference.md` and `docs/OVERLAY_EFFECTS_CLI.md` on new variants.
