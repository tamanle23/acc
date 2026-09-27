# Sound Effects Architecture Rules

- **ROUTING**: `--effect <name> --variant <name> --sub-variant <name>`.
- **ENGINE-SELECTION**:
  - `library` (Freesound): Fauna (animals), Diegetic (real weather/traffic), realistic Foley.
  - `ai` (Deep Learning): Sci-Fi (lasers/spaceships), Cinematic (braams/risers), fictional creatures.
  - `ffmpeg` (Procedural): UI (clicks/beeps), tone synthesis, composite layering (`amix`).
- **3-LAYER-FREQUENCY-BLUEPRINT**:
  - Layer 1 (Highs): Attack/Transient (2kHz - 8kHz)
  - Layer 2 (Mids): Body/Texture (300Hz - 2kHz)
  - Layer 3 (Lows): Weight/Sub (40Hz - 120Hz)
- **METADATA-JSON**: MUST output companion `.json` with duration, volume metadata, and FFmpeg filter mixing instructions.
- **CATALOG-SYNC**: MUST update `docs/master_rules_reference.md` and `docs/SOUND_EFFECTS_CLI_GUIDE.md` when adding new sound effects/variants.
