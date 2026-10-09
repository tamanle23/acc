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

      // Check if IR backend routing is requested (Phase 5 Pioneer Flywheel)
      if (ctx.metadata?.useIRBackend) {
        const { StoryConfigToUniversalIRAdapter, RelationalDAGCompiler } = await import('@acc/ir');
        const { IRMasterRenderer } = await import('@acc/core');

        const irDoc = StoryConfigToUniversalIRAdapter.adapt(resolvedConfig);
        const compiler = new RelationalDAGCompiler();
        const timeline = await compiler.compile(irDoc);
        const renderer = new IRMasterRenderer(timeline);
        const result = await renderer.render();
        ctx.metadata.irRenderResult = result;
      } else {
        // Delegate video rendering to the consolidated VideoEditPipelineOrchestrator
        await VideoEditPipelineOrchestrator.renderStoryVideo(
          resolvedConfig,
          outputFilePath,
          absoluteDir
        );
      }

      const renderDurationSec = parseFloat(((Date.now() - renderStartTime) / 1000).toFixed(2));
      ctx.timings.render = renderDurationSec;

      await next();
    },
  };
}
