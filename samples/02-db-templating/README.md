# 02-db-templating

Sample project materials demonstrating **02-db-templating** within the ACC (Automated Content Creator) ecosystem.

## Features
- **3D Depth Mode**: `isometric_podium`
- **VFX Overlay**: `sci_fi_hud`
- **SFX Design**: Synchronized sound effect cues in `assets/`
- **Universal Video IR v3.0.0**: `pipeline-ir.json`
- **Omnichannel Config**: `omnichannel-config.json`
- **Story Config**: `story-config.json`

## Run with Unified CLI
```bash
# Run pipeline with input data
bun run cli.ts run db -c ./samples/02-db-templating -n

# Headless Auto-Config dry-run
bun run auto-config.ts ./samples/02-db-templating --yes --dry-run
```
