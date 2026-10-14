import fs from 'fs';
import path from 'path';
import { Logger, FFmpegManager } from '@acc/core';
import {
  IRConfigAdapterRegistry,
  RelationalDAGCompiler,
  AssetMetadataProber,
  IRMasterRenderer,
  IRChunkWorkerPool,
  FFIVideoEncoderSink,
  type VideoIRDocument,
} from '@acc/ir';

export interface IrRenderCliOptions {
  input: string;
  output?: string;
  dryRun?: boolean;
  chunkStart?: number;
  chunkEnd?: number;
  concurrency?: number;
  seed?: number;
  exportIr?: string;
}

/**
 * Handles the 'ir-render' command line execution.
 */
export async function handleIrRenderCommand(options: IrRenderCliOptions): Promise<void> {
  await FFmpegManager.prepare();
  let inputPath = path.resolve(options.input);
  if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
    const candidates = ['pipeline-ir.json', 'story-config.json', 'omnichannel-config.json', 'video-ir.json'];
    for (const file of candidates) {
      const candidate = path.join(inputPath, file);
      if (fs.existsSync(candidate)) {
        inputPath = candidate;
        break;
      }
    }
  }

  if (!fs.existsSync(inputPath)) {
    Logger.error('IRRenderCommand', `Input file does not exist: ${inputPath}`);
    process.exit(1);
  }

  Logger.info('IRRenderCommand', `Loading input from: ${inputPath}`);
  const rawContent = await fs.promises.readFile(inputPath, 'utf-8');
  let irDoc: VideoIRDocument;

  const baseDir = path.dirname(inputPath);
  try {
    const parsed = JSON.parse(rawContent);
    // Use Stage 1 Config Adapter Registry to auto-detect and transform input format
    const registry = IRConfigAdapterRegistry.getInstance();
    irDoc = registry.transform(parsed, { baseDir });
  } catch (err: any) {
    Logger.error('IRRenderCommand', `Failed to parse or transform input document: ${err.message}`);
    process.exit(1);
  }

  // If user requested exporting/dumping the transformed Video IR JSON document
  if (options.exportIr) {
    const exportPath = path.resolve(options.exportIr);
    await fs.promises.mkdir(path.dirname(exportPath), { recursive: true });
    await fs.promises.writeFile(exportPath, JSON.stringify(irDoc, null, 2), 'utf-8');
    Logger.info('IRRenderCommand', `✓ Transformed Video IR JSON saved to: ${exportPath}`);
  }

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
  let chunkStart: number | undefined;
  let chunkEnd: number | undefined;
  if (options.chunkStart !== undefined || options.chunkEnd !== undefined) {
    chunkStart = options.chunkStart || 0;
    chunkEnd = options.chunkEnd || timeline.totalFrames;
    Logger.info('IRRenderCommand', `Temporal chunking active: rendering frames ${chunkStart} -> ${chunkEnd} (${Math.max(0, chunkEnd - chunkStart)} frames)`);
  }

  const outputPath = options.output ? path.resolve(options.output) : undefined;
  const concurrency = options.concurrency ?? 1;

  // Multi-Worker Parallel Temporal Chunking Engine (Phase 1)
  if (concurrency > 1 && chunkStart === undefined && chunkEnd === undefined && outputPath) {
    Logger.info('IRRenderCommand', `Starting multi-worker parallel temporal chunk rendering (concurrency: ${concurrency})...`);
    const workerPool = new IRChunkWorkerPool(timeline, options.seed ?? 42);

    const poolResult = await workerPool.render({
      concurrency,
      outputPath,
      baseDir,
      seed: options.seed ?? 42,
      generateFrameHash: false,
      onProgress: (p) => {
        Logger.info('IRRenderCommand', `[Parallel Render] Chunks ${p.completedChunks}/${p.totalChunks} | Frames ${p.completedFrames}/${p.totalFrames} (${p.percent}%)`);
      },
    });

    Logger.info('IRRenderCommand', `✓ Parallel render completed successfully:`);
    Logger.info('IRRenderCommand', ` - Total Frames:     ${poolResult.totalFrames} (${poolResult.durationSeconds}s)`);
    Logger.info('IRRenderCommand', ` - Active Workers:   ${poolResult.concurrency} (${poolResult.chunkCount} chunks)`);
    Logger.info('IRRenderCommand', ` - Merkle Root Hash: ${poolResult.merkleRootHash}`);
    Logger.info('IRRenderCommand', ` - Output File:      ${poolResult.outputPath}`);
    Logger.info('IRRenderCommand', ` - Execution Time:   ${(poolResult.executionTimeMs / 1000).toFixed(2)}s`);
    return;
  }

  // Stage 2: Single-Worker Target Sink Resolution
  let sink: FFIVideoEncoderSink | undefined;
  if (outputPath) {
    sink = new FFIVideoEncoderSink();
    Logger.info('IRRenderCommand', `Configured Output Video Sink: FFIVideoEncoder -> ${outputPath}`);
  }

  Logger.info('IRRenderCommand', 'Starting deterministic headless rasterization loop...');
  const renderer = new IRMasterRenderer(timeline, options.seed ?? 42);

  const result = await renderer.render({
    sink,
    outputPath,
    baseDir,
    chunkStart,
    chunkEnd,
    generateFrameHash: false,
    onProgress: (p) => {
      Logger.info('IRRenderCommand', `[Render Progress] Frame ${p.currentFrame}/${p.totalFrames} (${p.percent}%)`);
    },
  });

  Logger.info('IRRenderCommand', `✓ Render completed with bit-identical determinism:`);
  Logger.info('IRRenderCommand', ` - Cumulative Hash: ${result.cumulativeHash}`);
  Logger.info('IRRenderCommand', ` - Audio Samples:   ${result.audioResult.totalSamples} (${result.audioResult.sampleRate}Hz)`);

  if (result.sinkResult && result.sinkResult.outputPath) {
    Logger.info('IRRenderCommand', ` - Output File:     ${result.sinkResult.outputPath}`);
    Logger.info('IRRenderCommand', ` - Frames Encoded:  ${result.sinkResult.framesConsumed}`);
    Logger.info('IRRenderCommand', ` - File Size:       ${((result.sinkResult.fileSizeBytes ?? 0) / 1024 / 1024).toFixed(2)} MB`);
  }
}
