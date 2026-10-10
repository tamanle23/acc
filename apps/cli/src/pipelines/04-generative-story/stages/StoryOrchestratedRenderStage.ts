import type { IPipelineMiddleware } from '@acc/core';
import type { GenerativeStoryContext } from '../GenerativeStoryPipeline';
import { VideoEditPipelineOrchestrator } from '../VideoEditPipelineOrchestrator';

export function createStoryOrchestratedRenderStage(
  orchestrator: VideoEditPipelineOrchestrator = new VideoEditPipelineOrchestrator()
): IPipelineMiddleware<GenerativeStoryContext> {
  return {
    name: 'StoryOrchestratedRenderStage',
    async execute(ctx: GenerativeStoryContext, next: () => Promise<void>): Promise<void> {
      if (ctx.dryRun) {
        await next();
        return;
      }

      const resolvedConfig = ctx.resolvedConfig!;
      const outputFilePath = ctx.outputFilePath!;
      const absoluteDir = ctx.absoluteDir!;

      const renderStartTime = Date.now();

      // Phase 2 Canonical Transition: Universal Video IR Engine is the primary, default renderer
      const {
        StoryConfigToUniversalIRAdapter,
        RelationalDAGCompiler,
        AssetMetadataProber,
        IRChunkWorkerPool,
        IRMasterRenderer,
        FFIVideoEncoderSink,
      } = await import('@acc/ir');

      const irDoc = StoryConfigToUniversalIRAdapter.adapt(resolvedConfig, undefined, absoluteDir);
      const prober = new AssetMetadataProber(absoluteDir);
      const compiler = new RelationalDAGCompiler({ prober });
      const timeline = await compiler.compile(irDoc);

      const requestedConcurrency = ctx.options?.concurrency ?? (resolvedConfig.settings?.concurrency ? (typeof resolvedConfig.settings.concurrency === 'number' ? resolvedConfig.settings.concurrency : undefined) : undefined);
      const concurrency = requestedConcurrency ?? Math.min(4, Math.max(1, (await import('os')).cpus().length));

      if (concurrency > 1) {
        const workerPool = new IRChunkWorkerPool(timeline, 42);
        const poolResult = await workerPool.render({
          concurrency,
          outputPath: outputFilePath,
          baseDir: absoluteDir,
          seed: 42,
          generateFrameHash: false,
        });
        ctx.metadata = ctx.metadata || {};
        ctx.metadata.irPoolResult = poolResult;
        ctx.metadata.irRenderResult = {
          totalFrames: poolResult.totalFrames,
          durationSeconds: poolResult.durationSeconds,
          cumulativeHash: poolResult.merkleRootHash,
          fps: timeline.fps,
          width: timeline.width,
          height: timeline.height,
        };
      } else {
        const renderer = new IRMasterRenderer(timeline, 42);
        const sink = new FFIVideoEncoderSink();
        const result = await renderer.render({
          sink,
          outputPath: outputFilePath,
          baseDir: absoluteDir,
        });
        ctx.metadata = ctx.metadata || {};
        ctx.metadata.irRenderResult = result;
      }

      const renderDurationSec = parseFloat(((Date.now() - renderStartTime) / 1000).toFixed(2));
      ctx.timings.render = renderDurationSec;

      await next();
    },
  };
}
