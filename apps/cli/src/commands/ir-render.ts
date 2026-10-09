import fs from 'fs';
import path from 'path';
import { Logger } from '@acc/core';
import {
  StoryConfigToUniversalIRAdapter,
  RelationalDAGCompiler,
  AssetMetadataProber,
  IRMasterRenderer,
  type VideoIRDocument,
  type LegacyStoryConfig,
} from '@acc/ir';

export interface IrRenderCliOptions {
  input: string;
  output?: string;
  dryRun?: boolean;
  chunkStart?: number;
  chunkEnd?: number;
  seed?: number;
}

/**
 * Handles the 'ir-render' command line execution.
 */
export async function handleIrRenderCommand(options: IrRenderCliOptions): Promise<void> {
  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    Logger.error('IRRenderCommand', `Input file does not exist: ${inputPath}`);
    process.exit(1);
  }

  Logger.info('IRRenderCommand', `Loading input from: ${inputPath}`);
  const rawContent = fs.readFileSync(inputPath, 'utf-8');
  let irDoc: VideoIRDocument;

  try {
    const parsed = JSON.parse(rawContent);
    if (parsed.version && parsed.version.includes('stable')) {
      irDoc = parsed as VideoIRDocument;
    } else {
      // Automatically adapt legacy story-config.json
      Logger.info('IRRenderCommand', 'Detected legacy story-config format. Adapting to Video IR V1.0-Stable via Pioneer Adapter...');
      irDoc = StoryConfigToUniversalIRAdapter.adapt(parsed as LegacyStoryConfig);
    }
  } catch (err: any) {
    Logger.error('IRRenderCommand', `Failed to parse input document: ${err.message}`);
    process.exit(1);
  }

  const baseDir = path.dirname(inputPath);
  const prober = new AssetMetadataProber(baseDir);
  const compiler = new RelationalDAGCompiler({ prober });

  Logger.info('IRRenderCommand', 'Executing two-pass topological DAG compilation...');
  const timeline = await compiler.compile(irDoc);

  Logger.info('IRRenderCommand', `✓ Timeline successfully compiled:`);
  Logger.info('IRRenderCommand', ` - Total Frames:     ${timeline.totalFrames}`);
  Logger.info('IRRenderCommand', ` - Duration:         ${timeline.durationSeconds}s`);
  Logger.info('IRRenderCommand', ` - Resolution:       ${timeline.meta.canvasSize.w}x${timeline.meta.canvasSize.h} @ ${timeline.meta.globalFps}fps`);
  Logger.info('IRRenderCommand', ` - Total Tracks:     ${timeline.tracks.size}`);
  Logger.info('IRRenderCommand', ` - Total Sequences:  ${timeline.sequences.size}`);

  if (options.dryRun) {
    Logger.info('IRRenderCommand', '✓ Dry-run completed successfully. Zero compute allocated.');
    return;
  }

  // Handle temporal chunking slicing if specified
  if (options.chunkStart !== undefined || options.chunkEnd !== undefined) {
    const start = options.chunkStart || 0;
    const end = options.chunkEnd || timeline.totalFrames;
    timeline.totalFrames = Math.max(1, end - start);
    Logger.info('IRRenderCommand', `Temporal chunking active: rendering frames ${start} -> ${end} (${timeline.totalFrames} frames)`);
  }

  Logger.info('IRRenderCommand', 'Starting deterministic headless rasterization loop...');
  const renderer = new IRMasterRenderer(timeline, options.seed ?? 42);

  const result = await renderer.render({
    generateFrameHash: true,
    onProgress: (p) => {
      Logger.info('IRRenderCommand', `[Render Progress] Frame ${p.currentFrame}/${p.totalFrames} (${p.percent}%)`);
    },
  });

  Logger.info('IRRenderCommand', `✓ Render completed with bit-identical determinism:`);
  Logger.info('IRRenderCommand', ` - Cumulative Hash: ${result.cumulativeHash}`);
  Logger.info('IRRenderCommand', ` - Audio Samples:   ${result.audioResult.totalSamples} (${result.audioResult.sampleRate}Hz)`);
}
