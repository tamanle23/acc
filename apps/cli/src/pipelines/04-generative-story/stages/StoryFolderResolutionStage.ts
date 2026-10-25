import fs from 'fs';
import path from 'path';
import { type IPipelineMiddleware, fileExists } from '@acc/core';
import { LegacyStoryConfigAdapter } from '@acc/ir';
import type { GenerativeStoryContext } from '../GenerativeStoryPipeline';
import { resolveStoryFolder } from '../utils/folderResolver';

export function createStoryFolderResolutionStage(): IPipelineMiddleware<GenerativeStoryContext> {
  return {
    name: 'StoryFolderResolutionStage',
    async execute(ctx: GenerativeStoryContext, next: () => Promise<void>): Promise<void> {
      const storyDir = typeof ctx.input === 'string' ? ctx.input : ctx.baseDir;
      const resolved = await resolveStoryFolder(storyDir, { outDir: ctx.outDir, dryRun: ctx.dryRun });

      ctx.rawConfig = resolved.rawConfig;
      ctx.resolvedConfig = resolved.resolvedConfig;
      ctx.outputFilePath = resolved.outputFilePath;
      ctx.metadataPath = resolved.metadataPath;
      ctx.absoluteDir = resolved.absoluteDir;

      // Register Scene Assets into Unified AssetContext
      for (const [idx, scene] of resolved.resolvedConfig.scenes.entries()) {
        const sceneId = `scene_${idx}`;
        if (scene.resolvedImage) {
          ctx.assets.register(sceneId, 'original', scene.resolvedImage);
        }
        if (scene.resolvedVideo) {
          ctx.assets.register(sceneId, 'video', scene.resolvedVideo);
        }
        if (scene.resolvedAudio) {
          ctx.assets.register(sceneId, 'narration', scene.resolvedAudio);
        }
      }

      // Register Global BGM if configured
      if (resolved.resolvedConfig.settings.bgm?.source) {
        const bgmSource = resolved.resolvedConfig.settings.bgm.source;
        const bgmPath = path.isAbsolute(bgmSource)
          ? bgmSource
          : path.resolve(resolved.absoluteDir, bgmSource);
        if (await fileExists(bgmPath)) {
          ctx.assets.register('global', 'bgm', bgmPath);
        }
      }

      // Adapter Pattern: Populate PipelineIR AST
      try {
        ctx.ir = LegacyStoryConfigAdapter.adapt(resolved.rawConfig);
      } catch (err: any) {
        ctx.metadata.irAdapterWarning = err.message;
      }

      await next();
    },
  };
}
