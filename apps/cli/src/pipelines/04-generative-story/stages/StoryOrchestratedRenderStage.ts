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

      // Delegate video rendering to the consolidated VideoEditPipelineOrchestrator
      await VideoEditPipelineOrchestrator.renderStoryVideo(
        resolvedConfig,
        outputFilePath,
        absoluteDir
      );

      const renderDurationSec = parseFloat(((Date.now() - renderStartTime) / 1000).toFixed(2));
      ctx.timings.render = renderDurationSec;

      await next();
    },
  };
}
