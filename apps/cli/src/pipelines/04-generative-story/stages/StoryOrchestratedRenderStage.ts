import path from 'path';
import type { IPipelineMiddleware } from '@acc/core';
import type { GenerativeStoryContext } from '../GenerativeStoryPipeline';
import { renderStoryVideo } from '../StoryRenderer';
import { EditingPipelineOrchestrator } from '../EditingPipelineOrchestrator';

export function createStoryOrchestratedRenderStage(
  orchestrator: EditingPipelineOrchestrator = new EditingPipelineOrchestrator()
): IPipelineMiddleware<GenerativeStoryContext> {
  return {
    name: 'StoryOrchestratedRenderStage',
    async execute(ctx: GenerativeStoryContext, next: () => Promise<void>): Promise<void> {
      const rawConfig = ctx.rawConfig!;
      const resolvedConfig = ctx.resolvedConfig!;
      const outputFilePath = ctx.outputFilePath!;
      const absoluteDir = ctx.absoluteDir!;

      if (ctx.dryRun) {
        await next();
        return;
      }

      try {
        const result = await orchestrator.processAndRender(rawConfig, {
          outputDir: path.dirname(outputFilePath),
          format: resolvedConfig.settings.container as any,
        });
        ctx.ir = result.ir;
      } catch {
        // Fallback to classic scene-by-scene canvas renderer
        await renderStoryVideo(resolvedConfig, outputFilePath, absoluteDir);
      }

      await next();
    },
  };
}
