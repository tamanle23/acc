import type { IPipelineMiddleware } from '@acc/core';
import type { GenerativeStoryContext } from '../GenerativeStoryPipeline';
import { resolveStoryFolder } from '../GenerativeStoryPipeline';

export function createStoryFolderResolutionStage(): IPipelineMiddleware<GenerativeStoryContext> {
  return {
    name: 'StoryFolderResolutionStage',
    async execute(ctx: GenerativeStoryContext, next: () => Promise<void>): Promise<void> {
      const storyDir = typeof ctx.input === 'string' ? ctx.input : ctx.baseDir;
      const resolved = resolveStoryFolder(storyDir, { outDir: ctx.outDir, dryRun: ctx.dryRun });

      ctx.rawConfig = resolved.rawConfig;
      ctx.resolvedConfig = resolved.resolvedConfig;
      ctx.outputFilePath = resolved.outputFilePath;
      ctx.metadataPath = resolved.metadataPath;
      ctx.absoluteDir = resolved.absoluteDir;

      for (const [idx, scene] of resolved.resolvedConfig.scenes.entries()) {
        const sceneId = `scene_${idx}`;
        if (scene.resolvedImage) {
          ctx.assets.register(sceneId, 'original', scene.resolvedImage);
        }
        if (scene.resolvedAudio) {
          ctx.assets.register(sceneId, 'narration', scene.resolvedAudio);
        }
      }

      await next();
    },
  };
}
