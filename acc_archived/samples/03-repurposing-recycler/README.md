# 03-repurposing-recycler

Sample project materials demonstrating **03-repurposing-recycler** within the ACC (Automated Content Creator) ecosystem.

## Features
- **3D Depth Mode**: `gyro_focal_tilt`
- **VFX Overlay**: `vhs`
- **SFX Design**: Synchronized sound effect cues in `assets/`
- **Universal Video IR v3.0.0**: `pipeline-ir.json`
- **Omnichannel Config**: `omnichannel-config.json`
- **Story Config**: `story-config.json`

## Run with Unified CLI
```bash
# Run pipeline with input data
bun run cli.ts run repurposing -c ./samples/03-repurposing-recycler -n

# Headless Auto-Config dry-run
bun run auto-config.ts ./samples/03-repurposing-recycler --yes --dry-run
```
