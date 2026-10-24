import path from 'path';
import { fileExists, FFmpegManager } from '@acc/core';
import type { StoryConfig, ResolvedStoryConfig, ResolvedSceneConfig } from '@acc/core/types';
import { LegacyDiskStoryRenderer } from './LegacyDiskStoryRenderer';

export interface LegacyRenderCliArgs {
  configPath: string;
  outputPath?: string;
  baseDir?: string;
}

/**
 * Resolves a story directory containing story-config.json and loads the configuration.
 */
async function resolveStoryFolderDirect(storyDir: string, outPath?: string): Promise<{
  resolvedConfig: ResolvedStoryConfig;
  outputFilePath: string;
  absoluteDir: string;
}> {
  const absoluteDir = path.resolve(storyDir);
  const configPath = path.join(absoluteDir, 'story-config.json');

  if (!(await fileExists(absoluteDir))) {
    throw new Error(`[Legacy CLI] Directory not found: ${absoluteDir}`);
  }
  if (!(await fileExists(configPath))) {
    throw new Error(`[Legacy CLI] story-config.json not found in ${absoluteDir}`);
  }

  const rawConfigStr = await (await import('fs')).promises.readFile(configPath, 'utf-8');
  const rawConfig: StoryConfig = JSON.parse(rawConfigStr);

  const rawScenes = rawConfig.scenes || [];
  if (rawScenes.length === 0) {
    throw new Error('[Legacy CLI] No scenes found in story-config.json');
  }

  const outputFilePath = outPath
    ? path.resolve(outPath)
    : path.join(absoluteDir, 'output', `${rawConfig.name || 'output'}.mp4`);

  const resolvedScenes: ResolvedSceneConfig[] = rawScenes.map((scene) => ({
    ...scene,
    resolvedImage: scene.image
      ? path.isAbsolute(scene.image)
        ? scene.image
        : path.resolve(absoluteDir, scene.image)
      : undefined,
    resolvedVideo: scene.video
      ? path.isAbsolute(scene.video)
        ? scene.video
        : path.resolve(absoluteDir, scene.video)
      : undefined,
    resolvedAudio: path.isAbsolute(scene.audio || '')
      ? scene.audio || ''
      : path.resolve(absoluteDir, scene.audio || ''),
  }));

  const rawSettings = rawConfig.settings || ({} as any);
  const resolvedSettings = {
    width: rawSettings.width || 1080,
    height: rawSettings.height || 1920,
    fps: rawSettings.fps || 30,
    videoCodec: rawSettings.videoCodec || 'auto',
    audioCodec: rawSettings.audioCodec || 'auto',
    videoBitrate: rawSettings.videoBitrate || '5000k',
    audioBitrate: rawSettings.audioBitrate || '192k',
    crf: rawSettings.crf ?? 23,
    preset: rawSettings.preset || 'medium',
    container: rawSettings.container || 'mp4',
    gpuAcceleration: rawSettings.gpuAcceleration || 'auto',
    platform: rawSettings.platform || 'tiktok',
    concurrency: typeof rawSettings.concurrency === 'number' ? rawSettings.concurrency : 1,
    fastIntermediate: rawSettings.fastIntermediate ?? true,
    captions: rawSettings.captions,
    transition: rawSettings.transition,
    upscale: rawSettings.upscale,
    tts: rawSettings.tts,
    pauseBetweenScenes: rawSettings.pauseBetweenScenes,
    overlayComposite: rawSettings.overlayComposite,
    bgm: rawSettings.bgm,
    audioTrack: rawSettings.audioTrack,
    sfx: rawSettings.sfx,
    depth3d: rawSettings.depth3d,
  };

  const resolvedConfig: ResolvedStoryConfig = {
    name: rawConfig.name,
    description: rawConfig.description,
    settings: resolvedSettings,
    scenes: resolvedScenes,
    captions: rawConfig.captions,
  };

  return { resolvedConfig, outputFilePath, absoluteDir };
}

export async function runLegacyCli(args: string[] = process.argv.slice(2)): Promise<void> {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║          @acc/legacy-story-renderer Direct Quarantined CLI                    ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Usage:
  bun run apps/legacy-story-renderer/src/cli.ts <story-directory> [options]

Options:
  -o, --output <path>    Custom output MP4 path
  -h, --help             Show this help message

Description:
  Executes the deprecated multi-pass disk renderer directly through the
  quarantined legacy package. All other CLI routes default to Universal Video IR.
`);
    return;
  }

  const inputDir = args[0];
  let customOut: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '-o' || args[i] === '--output') {
      customOut = args[++i];
    }
  }

  console.log(`\x1b[33m[Legacy Story Renderer]\x1b[0m Executing quarantined disk rendering for: ${inputDir}`);
  await FFmpegManager.prepare();

  const { resolvedConfig, outputFilePath, absoluteDir } = await resolveStoryFolderDirect(inputDir, customOut);
  const outDir = path.dirname(outputFilePath);
  const fsModule = await import('fs');
  if (!fsModule.existsSync(outDir)) {
    await fsModule.promises.mkdir(outDir, { recursive: true });
  }

  const startTime = Date.now();
  await LegacyDiskStoryRenderer.render(resolvedConfig, outputFilePath, absoluteDir);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\x1b[32m[Legacy Story Renderer] Complete!\x1b[0m Output saved to: ${outputFilePath} (${elapsed}s)`);
}

// Auto-run if executed directly via CLI
if (import.meta.main) {
  runLegacyCli().catch((err) => {
    console.error(`\x1b[31m[Legacy CLI Error]\x1b[0m ${err.message}`);
    process.exit(1);
  });
}
