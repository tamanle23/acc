# 05-rule-logic

Sample project materials demonstrating **05-rule-logic** within the ACC (Automated Content Creator) ecosystem.

## Features
- **3D Depth Mode**: `extruded_text_3d`
- **VFX Overlay**: `confetti`
- **SFX Design**: Synchronized sound effect cues in `assets/`
- **Universal Video IR v3.0.0**: `pipeline-ir.json`
- **Omnichannel Config**: `omnichannel-config.json`
- **Story Config**: `story-config.json`

## Run with Unified CLI
```bash
# Run pipeline with input data
bun run cli.ts run rule -c ./samples/05-rule-logic -n

# Headless Auto-Config dry-run
bun run auto-config.ts ./samples/05-rule-logic --yes --dry-run
```
