import fs from 'fs';
import path from 'path';
import type { StoryConfig, ResolvedStoryConfig, ResolvedSceneConfig } from '@acc/core/types';
import { resolveStorySettings, mergeDefined, DEFAULT_VIDEO_SETTINGS } from '../platforms';

export interface StoryFolderResolutionOptions {
  outDir?: string;
  format?: string;
  dryRun?: boolean;
}

export interface ResolvedStoryFolderResult {
  rawConfig: StoryConfig;
  resolvedConfig: ResolvedStoryConfig;
  outputFilePath: string;
  metadataPath: string;
  absoluteDir: string;
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

export function resolveStoryFolder(
  storyDir: string,
  options?: StoryFolderResolutionOptions
): ResolvedStoryFolderResult {
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
    const resolvedAudio = resolveMediaPath(scene.audio || '', absoluteDir, 'audio');

    const resolvedVideoSettings = mergeDefined(DEFAULT_VIDEO_SETTINGS, scene.videoSettings);
    const resolvedSfx = scene.sfx?.map(clip => ({
      ...clip,
      source: resolveMediaPath(clip.source, absoluteDir, 'audio'),
    }));

    resolvedScenes.push({
      ...scene,
      resolvedImage,
      resolvedVideo,
      resolvedAudio,
      resolvedVideoSettings,
      sfx: resolvedSfx,
    });
  }

  const resolvedSettings = resolveStorySettings(rawConfig.settings);
  if (resolvedSettings.audioTrack) {
    resolvedSettings.audioTrack = {
      ...resolvedSettings.audioTrack,
      source: resolveMediaPath(resolvedSettings.audioTrack.source, absoluteDir, 'audio'),
    };
  }
  if (resolvedSettings.sfx) {
    resolvedSettings.sfx = resolvedSettings.sfx.map(clip => ({
      ...clip,
      source: resolveMediaPath(clip.source, absoluteDir, 'audio'),
    }));
  }

  if (options?.format) {
    resolvedSettings.container = options.format as any;
  }

  const resolvedConfig: ResolvedStoryConfig = {
    name: rawConfig.name,
    description: rawConfig.description,
    settings: resolvedSettings,
    scenes: resolvedScenes,
    captions: rawConfig.captions,
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
