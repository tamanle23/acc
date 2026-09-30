import { renderStoryVideo } from '../../../../../src/renderer';
import type { StoryConfig, StoryRenderOptions } from '../../../../../src/types';
import { FFmpegManager } from '@acc/core';

export interface StoryPipelineOptions extends StoryRenderOptions {
  dryRun?: boolean;
}

export class GenerativeStoryPipeline {
  public readonly id = 'generative-storytelling' as const;

  /**
   * Prepares underlying system engines (FFmpeg FFI, etc.)
   */
  public async prepare(): Promise<void> {
    await FFmpegManager.prepare();
  }

  /**
   * Executes the visual storytelling render pipeline
   * @param storyDir Path to story folder containing story-config.json
   * @param options Render overrides
   * @returns Path to generated video
   */
  public async execute(storyDir: string, options?: StoryPipelineOptions): Promise<string> {
    await this.prepare();
    return renderStoryVideo(storyDir, options);
  }
}

export const defaultStoryPipeline = new GenerativeStoryPipeline();
