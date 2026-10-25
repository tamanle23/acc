# 06-ambient-loops

Sample project materials demonstrating **06-ambient-loops** within the ACC (Automated Content Creator) ecosystem.

## Features
- **3D Depth Mode**: `macro_bokeh`
- **VFX Overlay**: `rain_on_glass`
- **SFX Design**: Synchronized sound effect cues in `assets/`
- **Universal Video IR v3.0.0**: `pipeline-ir.json`
- **Omnichannel Config**: `omnichannel-config.json`
- **Story Config**: `story-config.json`

## Run with Unified CLI
```bash
# Run pipeline with input data
bun run cli.ts run ambient -c ./samples/06-ambient-loops -n

# Headless Auto-Config dry-run
bun run auto-config.ts ./samples/06-ambient-loops --yes --dry-run
```
