import type { ResolvedStoryConfig } from '@acc/core/types';
import { VideoEditPipelineOrchestrator } from './VideoEditPipelineOrchestrator';

/**
 * Backward-compatible entrypoint for story video rendering.
 * Delegates directly to the consolidated VideoEditPipelineOrchestrator.
 */
export async function renderStoryVideo(
  config: ResolvedStoryConfig,
  outputFilePath: string,
  baseDir: string = process.cwd()
): Promise<void> {
  return VideoEditPipelineOrchestrator.renderStoryVideo(config, outputFilePath, baseDir);
}
