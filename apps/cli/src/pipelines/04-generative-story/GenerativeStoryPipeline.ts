import path from 'path';
import {
  FFmpegManager,
  IPipeline,
  PipelineExecutionOptions,
  PipelineRunner,
  UnifiedPipelineContext,
  createUnifiedPipelineContext,
  defaultPipelineRegistry,
} from '@acc/core';
import type { StoryConfig, ResolvedStoryConfig } from '@acc/core/types';
import { EditingPipelineOrchestrator } from './EditingPipelineOrchestrator';
import { createStoryFolderResolutionStage } from './stages/StoryFolderResolutionStage';
import { createStoryOrchestratedRenderStage } from './stages/StoryOrchestratedRenderStage';
import { createStoryMetadataPersistenceStage } from './stages/StoryMetadataPersistenceStage';
import { resolveStoryFolder, type StoryFolderResolutionOptions, type ResolvedStoryFolderResult } from './utils/folderResolver';

export { resolveStoryFolder, type StoryFolderResolutionOptions, type ResolvedStoryFolderResult };

export interface StoryPipelineOptions extends PipelineExecutionOptions {
  outDir?: string;
  format?: string;
  dryRun?: boolean;
}

export interface GenerativeStoryContext extends UnifiedPipelineContext<string | StoryConfig> {
  rawConfig?: StoryConfig;
  resolvedConfig?: ResolvedStoryConfig;
  outputFilePath?: string;
  metadataPath?: string;
  absoluteDir?: string;
}

export class GenerativeStoryPipeline implements IPipeline<string | StoryConfig> {
  public readonly id = 'story' as const;
  public readonly name = 'Autonomous Generative Storytelling Engine';
  public readonly description =
    'Multi-scene visual storytelling generator featuring 3D Depth mesh pop-outs, character cutouts, dynamic typography, and zero-copy NVENC rendering.';

  private orchestrator = new EditingPipelineOrchestrator();

  public async prepare(): Promise<void> {
    await FFmpegManager.prepare();
  }

  public buildRunner(): PipelineRunner<UnifiedPipelineContext<string | StoryConfig>> {
    const runner = new PipelineRunner<UnifiedPipelineContext<string | StoryConfig>>();

    // Stage 1: Resolve Config and Asset Paths
    runner.use(createStoryFolderResolutionStage());

    // Stage 2: Orchestrated AST Transformation & Video Rendering
    runner.use(createStoryOrchestratedRenderStage(this.orchestrator));

    // Stage 3: Metadata Persistence
    runner.use(createStoryMetadataPersistenceStage());

    return runner;
  }

  public async execute(
    storyDirOrConfig: string | StoryConfig,
    options: StoryPipelineOptions = {}
  ): Promise<GenerativeStoryContext> {
    await this.prepare();
    const baseDir = typeof storyDirOrConfig === 'string' ? path.resolve(storyDirOrConfig) : process.cwd();
    const outDir = options.outDir ? path.resolve(options.outDir) : path.join(baseDir, 'output');

    const ctx = createUnifiedPipelineContext<string | StoryConfig>({
      pipelineId: this.id,
      input: storyDirOrConfig,
      baseDir,
      outDir,
      dryRun: options.dryRun,
    });

    const runner = this.buildRunner();
    const executedCtx = (await runner.run(ctx)) as GenerativeStoryContext;

    // Backward compatibility helpers for legacy string-path consumers
    (executedCtx as any).outputPath = executedCtx.outputFilePath || outDir;
    (executedCtx as any).toString = () => executedCtx.outputFilePath || outDir;

    return executedCtx;
  }
}

export const defaultStoryPipeline = new GenerativeStoryPipeline();

// Auto-register in central registry
defaultPipelineRegistry.register(new GenerativeStoryPipeline(), [
  '4',
  'story',
  'generative-storytelling',
  'storyteller',
]);
