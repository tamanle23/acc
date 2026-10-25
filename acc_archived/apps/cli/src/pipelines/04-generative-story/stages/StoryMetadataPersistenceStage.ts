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
      const renderDurationSec = ctx.timings.render || 0;

      const metadata = {
        name: resolvedConfig.name || 'story',
        description: resolvedConfig.description || '',
        videoFile: path.basename(outputFilePath),
        renderedAt: new Date().toISOString(),
        durationSec: renderDurationSec,
        scenesCount: resolvedConfig.scenes.length,
        platform: resolvedConfig.settings.platform,
        resolution: `${resolvedConfig.settings.width}x${resolvedConfig.settings.height}`,
        fps: resolvedConfig.settings.fps,
        videoCodec: resolvedConfig.settings.videoCodec,
        audioCodec: resolvedConfig.settings.audioCodec,
        crf: resolvedConfig.settings.crf,
        preset: resolvedConfig.settings.preset,
        container: resolvedConfig.settings.container,
        gpuAcceleration: resolvedConfig.settings.gpuAcceleration,
        concurrency: resolvedConfig.settings.concurrency,
        captions: resolvedConfig.settings.captions
          ? {
              preset: resolvedConfig.settings.captions.preset,
              subtitleMode: resolvedConfig.settings.captions.subtitleMode,
            }
          : undefined,
        upscale: resolvedConfig.settings.upscale,
        transition: resolvedConfig.settings.transition,
      };

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

      await next();
    },
  };
}
