import type { ResolvedStoryConfig } from '@acc/core/types';
import { EditingPipelineOrchestrator } from './EditingPipelineOrchestrator';

/**
 * Backward-compatible entrypoint for story video rendering.
 * Delegates directly to the consolidated EditingPipelineOrchestrator.
 */
export async function renderStoryVideo(
  config: ResolvedStoryConfig,
  outputFilePath: string,
  baseDir: string = process.cwd()
): Promise<void> {
  return EditingPipelineOrchestrator.renderStoryVideo(config, outputFilePath, baseDir);
}
