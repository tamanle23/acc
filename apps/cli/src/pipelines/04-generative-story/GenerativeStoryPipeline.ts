import fs from 'fs';
import path from 'path';
import { FFmpegManager } from '@acc/core';
import type { StoryConfig, ResolvedStoryConfig, ResolvedSceneConfig } from './types';
import { renderStoryVideo } from './StoryRenderer';
import { resolveStorySettings, mergeDefined, DEFAULT_VIDEO_SETTINGS } from './platforms';
import { EditingPipelineOrchestrator } from './EditingPipelineOrchestrator';

export interface StoryPipelineOptions {
  outDir?: string;
  format?: string;
  dryRun?: boolean;
}

export function resolveStoryFolder(storyDir: string, options?: StoryPipelineOptions): { rawConfig: StoryConfig; resolvedConfig: ResolvedStoryConfig; outputFilePath: string; metadataPath: string; absoluteDir: string } {
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

export class GenerativeStoryPipeline {
  public readonly id = 'generative-storytelling' as const;
  private orchestrator = new EditingPipelineOrchestrator();

  public async prepare(): Promise<void> {
    await FFmpegManager.prepare();
  }

  public async execute(storyDir: string, options?: StoryPipelineOptions): Promise<string> {
    await this.prepare();
    const { rawConfig, resolvedConfig, outputFilePath, metadataPath, absoluteDir } = resolveStoryFolder(storyDir, options);

    const startTime = Date.now();

    // Use EditingPipelineOrchestrator to process and normalize story AST
    try {
      await this.orchestrator.processAndRender(rawConfig, {
        outputDir: path.dirname(outputFilePath),
        format: resolvedConfig.settings.container as any,
      });
    } catch {
      // Fallback to classic scene-by-scene canvas renderer
      await renderStoryVideo(resolvedConfig, outputFilePath, absoluteDir);
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    // Save metadata
    const metadata = {
      name: resolvedConfig.name || 'story',
      description: resolvedConfig.description || '',
      videoFile: path.basename(outputFilePath),
      renderedAt: new Date().toISOString(),
      durationSec: parseFloat(durationSec),
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

    return outputFilePath;
  }
}

export const defaultStoryPipeline = new GenerativeStoryPipeline();
