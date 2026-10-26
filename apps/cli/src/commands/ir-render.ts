import fs from 'fs';
import path from 'path';
import {
  IRChunkWorkerPool,
  FFmpegManager,
  Tracer,
  TraceContext,
} from '@acc/core';
import {
  IRConfigAdapterRegistry,
  RelationalDAGCompiler,
  AssetMetadataProber,
  IRMasterRenderer,
  type IIRFrameSink,
  type VideoIRDocument,
} from '@acc/ir';
import { log } from '../prompts';
import { Logger, MediaEngineRegistry, MediaEngineType } from '@acc/core-isomorphic';

export interface IrRenderCliOptions {
  input: string;
  output?: string;
  engine?: MediaEngineType;
  dryRun?: boolean;
  chunkStart?: number;
  chunkEnd?: number;
  concurrency?: number;
  seed?: number;
  traceparent?: string;
}

/**
 * Handles the 'ir-render' command line execution.
 * Standalone debug & headless execution stage strictly consuming canonical video-ir.json.
 */
export async function handleIrRenderCommand(options: IrRenderCliOptions): Promise<void> {
  const rootContext = TraceContext.fromTraceparent(options.traceparent);

  return Tracer.runWithContext(rootContext, async () => {
    // ─── Phase 1: Input Discovery & Canonical Validation ───────────────
    const { irDoc, baseDir } = await Tracer.withSpan('ir.input_transform', async () => {
      await FFmpegManager.prepare();
      let inputPath = path.resolve(options.input);

      if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
        const candidates = ['video-ir.json', 'video-ir.transformed.json'];
        let matched: string | null = null;
        for (const file of candidates) {
          const candidate = path.join(inputPath, file);
          if (fs.existsSync(candidate)) {
            matched = candidate;
            break;
          }
        }

        if (!matched) {
          if (fs.existsSync(path.join(inputPath, 'story-config.json'))) {
            const msg = `'story-config.json' detected in ${inputPath}.\n'ir-render' is a headless debug stage that only consumes canonical 'video-ir.json'.\n👉 To synthesize assets and run the generative story pipeline, use: acc run story ${inputPath}`;
            if (process.stdout.isTTY) log.error(msg);
            Logger.error('IRRenderCommand', msg);
            process.exit(1);
          }
          if (fs.existsSync(path.join(inputPath, 'pipeline-ir.json'))) {
            const msg = `'pipeline-ir.json' detected in ${inputPath}.\n'ir-render' only consumes canonical 'video-ir.json'.\n👉 To execute the omnichannel pipeline, use: acc run <pipeline_id> ${inputPath}`;
            if (process.stdout.isTTY) log.error(msg);
            Logger.error('IRRenderCommand', msg);
            process.exit(1);
          }
          const msg = `No canonical 'video-ir.json' found in directory ${inputPath}.\n'ir-render' strictly consumes pre-compiled Video IR documents.`;
          if (process.stdout.isTTY) log.error(msg);
          Logger.error('IRRenderCommand', msg);
          process.exit(1);
        }
        inputPath = matched;
      } else {
        const baseName = path.basename(inputPath);
        if (baseName === 'story-config.json') {
          const msg = `'story-config.json' detected.\n'ir-render' is a headless debug stage that only consumes canonical 'video-ir.json'.\n👉 To synthesize assets and run the generative story pipeline, use: acc run story ${path.dirname(inputPath)}`;
          if (process.stdout.isTTY) log.error(msg);
          Logger.error('IRRenderCommand', msg);
          process.exit(1);
        }
        if (baseName === 'pipeline-ir.json') {
          const msg = `'pipeline-ir.json' detected.\n'ir-render' only consumes canonical 'video-ir.json'.\n👉 To execute the omnichannel pipeline, use: acc run <pipeline_id> ${path.dirname(inputPath)}`;
          if (process.stdout.isTTY) log.error(msg);
          Logger.error('IRRenderCommand', msg);
          process.exit(1);
        }
      }

      if (!fs.existsSync(inputPath)) {
        const msg = `Input file does not exist: ${inputPath}`;
        if (process.stdout.isTTY) log.error(msg);
        Logger.error('IRRenderCommand', msg);
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
        const msg = `Failed to parse or transform input document: ${err.message}`;
        if (process.stdout.isTTY) log.error(msg);
        Logger.error('IRRenderCommand', msg);
        process.exit(1);
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
            engine: options.engine,
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
        let sink: IIRFrameSink | undefined;
        if (outputPath) {
          sink = MediaEngineRegistry.get(options.engine).createVideoSink() as IIRFrameSink;
          Logger.info('IRRenderCommand', `Configured Output Video Sink: ${sink.name} -> ${outputPath}`);
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
