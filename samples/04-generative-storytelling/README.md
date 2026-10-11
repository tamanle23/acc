# 04-generative-storytelling

Sample project materials demonstrating **04-generative-storytelling** within the ACC (Automated Content Creator) ecosystem.

## Features
- **3D Depth Mode**: `volumetric_sandwich`
- **VFX Overlay**: `dust`
- **SFX Design**: Synchronized sound effect cues in `assets/`
- **Universal Video IR v3.0.0**: `pipeline-ir.json`
- **Omnichannel Config**: `omnichannel-config.json`
- **Story Config**: `story-config.json`

## Run with Unified CLI
```bash
# Run pipeline with input data
bun run cli.ts run generative -c ./samples/04-generative-storytelling -n

# Headless Auto-Config dry-run
bun run auto-config.ts ./samples/04-generative-storytelling --yes --dry-run
```
