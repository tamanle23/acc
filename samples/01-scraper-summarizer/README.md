# 01-scraper-summarizer

Sample project materials demonstrating **01-scraper-summarizer** within the ACC (Automated Content Creator) ecosystem.

## Features
- **3D Depth Mode**: `isometric_billboard`
- **VFX Overlay**: `camera_ui`
- **SFX Design**: Synchronized sound effect cues in `assets/`
- **Universal Video IR v3.0.0**: `pipeline-ir.json`
- **Omnichannel Config**: `omnichannel-config.json`
- **Story Config**: `story-config.json`

## Run with Unified CLI
```bash
# Run pipeline with input data
bun run cli.ts run scraper -c ./samples/01-scraper-summarizer -n

# Headless Auto-Config dry-run
bun run auto-config.ts ./samples/01-scraper-summarizer --yes --dry-run
```
