---
trigger: model_decision
description: Architecture and layering rules for procedural and AI sound effects.
---

# SOUND EFFECTS ARCHITECTURE

- **Routing**: Parameterized execution `--effect <name> --variant <name> --sub-variant <name>`.
- **Engines**:
  - `library` (Freesound): Fauna, diegetic, realistic Foley.
  - `ai` (Deep Learning): Sci-Fi, cinematic, fictional creatures.
  - `ffmpeg` (Procedural): UI, tone synthesis, composite layering (`amix`).
- **3-Layer Frequency Blueprint**:
  - Layer 1 (Highs): Attack/Transient (2kHz - 8kHz).
  - Layer 2 (Mids): Body/Texture (300Hz - 2kHz).
  - Layer 3 (Lows): Weight/Sub (40Hz - 120Hz).
- **Artifacts & Docs**: Companion `.json` (duration, volume metadata, FFmpeg filter mixing specs). Sync `docs/master_rules_reference.md` and `docs/SOUND_EFFECTS_CLI_GUIDE.md` on new variants.
