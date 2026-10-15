import fs from 'fs';
import path from 'path';
import { Logger, FFmpegManager, Tracer, TraceContext } from '@acc/core';
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
  traceparent?: string;
}


/**
 * Handles the 'ir-render' command line execution.
 */
export async function handleIrRenderCommand(options: IrRenderCliOptions): Promise<void> {
  const rootContext = TraceContext.fromTraceparent(options.traceparent);

  return Tracer.runWithContext(rootContext, async () => {
    // ─── Phase 1: Input Discovery & AST Adaptation ─────────────────────
    const { irDoc, baseDir } = await Tracer.withSpan('ir.input_transform', async () => {
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
      let transformedDoc: VideoIRDocument;

      const dir = path.dirname(inputPath);
      try {
        const parsed = JSON.parse(rawContent);
        const registry = IRConfigAdapterRegistry.getInstance();
        transformedDoc = registry.transform(parsed, { baseDir: dir });
      } catch (err: any) {
        Logger.error('IRRenderCommand', `Failed to parse or transform input document: ${err.message}`);
        process.exit(1);
      }

      if (options.exportIr) {
        const exportPath = path.resolve(options.exportIr);
        await fs.promises.mkdir(path.dirname(exportPath), { recursive: true });
        await fs.promises.writeFile(exportPath, JSON.stringify(transformedDoc, null, 2), 'utf-8');
        Logger.info('IRRenderCommand', `✓ Transformed Video IR JSON saved to: ${exportPath}`);
      }

      return { irDoc: transformedDoc, baseDir: dir };
    });

    // ─── Phase 2: Relational DAG Compilation ───────────────────────────
    const timeline = await Tracer.withSpan(
      'ir.dag_compile',
      async () => {
        const prober = new AssetMetadataProber(baseDir);
        const compiler = new RelationalDAGCompiler({ prober });

        Logger.info('IRRenderCommand', 'Executing two-pass topological DAG compilation...');
        const compiledTimeline = await compiler.compile(irDoc);

        Logger.info('IRRenderCommand', `✓ Timeline successfully compiled:`);
        Logger.info('IRRenderCommand', ` - Total Frames:     ${compiledTimeline.totalFrames}`);
        Logger.info('IRRenderCommand', ` - Duration:         ${compiledTimeline.durationSeconds}s`);
        Logger.info('IRRenderCommand', ` - Resolution:       ${compiledTimeline.meta.canvasSize.w}x${compiledTimeline.meta.canvasSize.h} @ ${compiledTimeline.meta.globalFps}fps`);
        Logger.info('IRRenderCommand', ` - Total Tracks:     ${compiledTimeline.tracks.size}`);
        Logger.info('IRRenderCommand', ` - Total Sequences:  ${compiledTimeline.sequences.size}`);

        return compiledTimeline;
      },
      {
        contentId: irDoc.meta.contentId,
        globalFps: irDoc.meta.globalFps,
      }
    );

    if (options.dryRun) {
      Logger.info('IRRenderCommand', '✓ Dry-run completed successfully. Zero compute allocated.');
      return;
    }

    // ─── Phase 3: Render Execution (Single or Parallel Pool) ───────────
    let chunkStart: number | undefined;
    let chunkEnd: number | undefined;
    if (options.chunkStart !== undefined || options.chunkEnd !== undefined) {
      chunkStart = options.chunkStart || 0;
      chunkEnd = options.chunkEnd || timeline.totalFrames;
      Logger.info('IRRenderCommand', `Temporal chunking active: rendering frames ${chunkStart} -> ${chunkEnd} (${Math.max(0, chunkEnd - chunkStart)} frames)`);
    }

    const outputPath = options.output ? path.resolve(options.output) : undefined;
    const concurrency = options.concurrency ?? 1;

    await Tracer.withSpan(
      'ir.render_execution',
      async (span) => {
        span.attributes['concurrency'] = concurrency;
        span.attributes['totalFrames'] = timeline.totalFrames;

        // Multi-Worker Parallel Temporal Chunking Engine
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

        // Single-Worker Target Sink Resolution
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
      },
      {
        totalFrames: timeline.totalFrames,
        durationSeconds: timeline.durationSeconds,
      }
    );
  });
}

