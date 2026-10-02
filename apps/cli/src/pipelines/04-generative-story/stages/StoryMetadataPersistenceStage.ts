import fs from 'fs';
import path from 'path';
import type { IPipelineMiddleware } from '@acc/core';
import type { GenerativeStoryContext } from '../GenerativeStoryPipeline';

export function createStoryMetadataPersistenceStage(): IPipelineMiddleware<GenerativeStoryContext> {
  return {
    name: 'StoryMetadataPersistenceStage',
    async execute(ctx: GenerativeStoryContext, next: () => Promise<void>): Promise<void> {
      if (ctx.dryRun) {
        await next();
        return;
      }

      const resolvedConfig = ctx.resolvedConfig!;
      const outputFilePath = ctx.outputFilePath!;
      const metadataPath = ctx.metadataPath!;

      const metadata = {
        name: resolvedConfig.name || 'story',
        description: resolvedConfig.description || '',
        videoFile: path.basename(outputFilePath),
        renderedAt: new Date().toISOString(),
        durationSec: 0,
        scenesCount: resolvedConfig.scenes.length,
        platform: resolvedConfig.settings.platform,
        resolution: `${resolvedConfig.settings.width}x${resolvedConfig.settings.height}`,
        fps: resolvedConfig.settings.fps,
        videoCodec: resolvedConfig.settings.videoCodec,
        audioCodec: resolvedConfig.settings.audioCodec,
        crf: resolvedConfig.settings.crf,
        preset: resolvedConfig.settings.preset,
        container: resolvedConfig.settings.container,
      };
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

      await next();
    },
  };
}
