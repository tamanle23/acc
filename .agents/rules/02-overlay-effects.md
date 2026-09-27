# Overlay Effects Architecture Rules

- **ROUTING**: CLI `--effect <name> --variant <variant_name>`. MUST use Strategy Pattern.
- **ZERO-DISK**: NEVER render image files to disk. Pipe Canvas raw RGBA buffer directly via `stdin` to FFmpeg.
- **LOOPING**: Exact loop interpolation or opacity crossfade. Use prime-number durations (3s, 5s, 7s, 11s) at 30/60 FPS for polyrhythmic non-repeating layer cycles.
- **OVERLAY-METHODS**:
  - `alpha`: WebM VP9 (`libvpx-vp9`), transparent `rgba(0,0,0,0)`, filter `overlay=shortest=1`.
  - `screen`: MP4 H.264 (`libx264`), black `#000000`, filter `blend=all_mode=screen:all_opacity=1:shortest=1`.
  - `multiply`: MP4 H.264 (`libx264`), white `#FFFFFF`, filter `blend=all_mode=multiply:all_opacity=1:shortest=1`.
  - `overlay`: MP4 H.264 (`libx264`), gray `#808080`, filter `blend=all_mode=overlay:all_opacity=1:shortest=1`.
- **METADATA-JSON**: MUST output companion `.json` with overlay_method, background, ffmpeg_filter_snippet, resolution, fps, duration.
- **CATALOG-SYNC**: MUST update `docs/master_rules_reference.md` and `docs/OVERLAY_EFFECTS_CLI.md` when introducing new effects/variants.
