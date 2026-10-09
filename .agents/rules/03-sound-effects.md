# Sound Effects Architecture Rules

- **ROUTING**: `--effect <name> --variant <name> --sub-variant <name>`.
- **ENGINES**:
  - `library` (Freesound): Fauna (animals), Diegetic (weather/traffic), realistic Foley.
  - `ai` (Deep Learning): Sci-Fi (lasers/spaceships), Cinematic (braams/risers), fictional creatures.
  - `ffmpeg` (Procedural): UI (clicks/beeps), tone synthesis, composite layering (`amix`).
- **3-LAYER FREQUENCY BLUEPRINT**:
  - Layer 1 (Highs): Attack/Transient (2kHz - 8kHz)
  - Layer 2 (Mids): Body/Texture (300Hz - 2kHz)
  - Layer 3 (Lows): Weight/Sub (40Hz - 120Hz)
- **METADATA-JSON**: Output companion `.json` with duration, volume metadata, FFmpeg filter mixing specs.
- **CATALOG-SYNC**: Sync `docs/master_rules_reference.md` and `docs/SOUND_EFFECTS_CLI_GUIDE.md` on new SFX/variants.
