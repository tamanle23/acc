import fs from 'fs';
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
import type { StoryConfig, ResolvedStoryConfig, ResolvedSceneConfig } from './types';
import { renderStoryVideo } from './StoryRenderer';
import { resolveStorySettings, mergeDefined, DEFAULT_VIDEO_SETTINGS } from './platforms';
import { EditingPipelineOrchestrator } from './EditingPipelineOrchestrator';

export interface StoryPipelineOptions extends PipelineExecutionOptions {
  outDir?: string;
  format?: string;
  dryRun?: boolean;
}

export function resolveStoryFolder(
  storyDir: string,
  options?: StoryPipelineOptions
): {
  rawConfig: StoryConfig;
  resolvedConfig: ResolvedStoryConfig;
  outputFilePath: string;
  metadataPath: string;
  absoluteDir: string;
} {
  const absoluteDir = path.resolve(storyDir);
  const configPath = path.join(absoluteDir, 'story-config.json');

  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Directory not found: ${absoluteDir}`);
  }
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const rawConfigStr = fs.readFileSync(configPath, 'utf-8');
  let rawConfig: StoryConfig;
  try {
    rawConfig = JSON.parse(rawConfigStr);
  } catch (error: any) {
    throw new Error(`Failed to parse story-config.json: ${error.message}`);
  }

  function resolveMediaPath(filePath: string, baseDir: string, type: 'image' | 'audio'): string {
    if (!filePath) return '';
    const directPath = path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(baseDir, filePath);
    if (fs.existsSync(directPath)) return directPath;
    const baseName = path.basename(filePath);
    for (const folder of ['assets']) {
      const candidate = path.resolve(baseDir, folder, baseName);
      if (fs.existsSync(candidate)) return candidate;
    }
    const rootCandidate = path.resolve(baseDir, baseName);
    if (fs.existsSync(rootCandidate)) return rootCandidate;
    return directPath;
  }

  const outputDir = options?.outDir ? path.resolve(options.outDir) : path.join(absoluteDir, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const rawScenes = rawConfig.scenes || rawConfig.slides || [];
  if (rawScenes.length === 0) {
    throw new Error('No scenes found in story-config.json');
  }

  const resolvedScenes: ResolvedSceneConfig[] = [];
  for (let idx = 0; idx < rawScenes.length; idx++) {
    const scene = rawScenes[idx];
    const resolvedImage = scene.image ? resolveMediaPath(scene.image, absoluteDir, 'image') : undefined;
    const resolvedVideo = scene.video ? resolveMediaPath(scene.video, absoluteDir, 'image') : undefined;
    let resolvedAudio = resolveMediaPath(scene.audio || '', absoluteDir, 'audio');

    const resolvedVideoSettings = mergeDefined(DEFAULT_VIDEO_SETTINGS, scene.videoSettings);
    resolvedScenes.push({
      ...scene,
      resolvedImage,
      resolvedVideo,
      resolvedAudio,
      resolvedVideoSettings,
    });
  }

  const resolvedSettings = resolveStorySettings(rawConfig.settings);
  if (options?.format) {
    resolvedSettings.container = options.format as any;
  }

  const resolvedConfig: ResolvedStoryConfig = {
    name: rawConfig.name,
    description: rawConfig.description,
    settings: resolvedSettings,
    scenes: resolvedScenes,
  };

  const baseName = rawConfig.name
    ? rawConfig.name.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_')
    : 'output';
  const container = resolvedSettings.container;

  let counter = 1;
  let outputFileName = `${baseName}_${counter}.${container}`;
  let metadataFileName = `${baseName}_${counter}.json`;
  let outputFilePath = path.join(outputDir, outputFileName);
  let metadataPath = path.join(outputDir, metadataFileName);

  while (fs.existsSync(outputFilePath) || fs.existsSync(metadataPath)) {
    counter++;
    outputFileName = `${baseName}_${counter}.${container}`;
    metadataFileName = `${baseName}_${counter}.json`;
    outputFilePath = path.join(outputDir, outputFileName);
    metadataPath = path.join(outputDir, metadataFileName);
  }

  return { rawConfig, resolvedConfig, outputFilePath, metadataPath, absoluteDir };
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
  public readonly description = 'Multi-scene visual storytelling generator featuring 3D Depth mesh pop-outs, character cutouts, dynamic typography, and zero-copy NVENC rendering.';

  private orchestrator = new EditingPipelineOrchestrator();

  public async prepare(): Promise<void> {
    await FFmpegManager.prepare();
  }

  public buildRunner(): PipelineRunner<UnifiedPipelineContext<string | StoryConfig>> {
    const runner = new PipelineRunner<UnifiedPipelineContext<string | StoryConfig>>();

    // Stage 1: Resolve Config and Asset Paths
    runner.use({
      name: 'StoryFolderResolutionStage',
      execute: async (ctx: GenerativeStoryContext, next) => {
        await this.prepare();
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
    });

    // Stage 2: Orchestrated AST Transformation & Video Rendering
    runner.use({
      name: 'StoryOrchestratedRenderStage',
      execute: async (ctx: GenerativeStoryContext, next) => {
        const rawConfig = ctx.rawConfig!;
        const resolvedConfig = ctx.resolvedConfig!;
        const outputFilePath = ctx.outputFilePath!;
        const absoluteDir = ctx.absoluteDir!;

        if (ctx.dryRun) {
          await next();
          return;
        }

        try {
          const result = await this.orchestrator.processAndRender(rawConfig, {
            outputDir: path.dirname(outputFilePath),
            format: resolvedConfig.settings.container as any,
          });
          ctx.ir = result.ir;
        } catch {
          // Graceful fallback to classic canvas renderer
          await renderStoryVideo(resolvedConfig, outputFilePath, absoluteDir);
        }

        await next();
      },
    });

    // Stage 3: Metadata Persistence
    runner.use({
      name: 'StoryMetadataPersistenceStage',
      execute: async (ctx: GenerativeStoryContext, next) => {
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
    });

    return runner;
  }

  public async execute(
    storyDirOrConfig: string | StoryConfig,
    options: StoryPipelineOptions = {}
  ): Promise<any> {
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
    return executedCtx.outputFilePath || outDir;
  }
}

export const defaultStoryPipeline = new GenerativeStoryPipeline();

// Auto-register in central registry
defaultPipelineRegistry.register(new GenerativeStoryPipeline(), ['4', 'story', 'generative-storytelling', 'storyteller']);
