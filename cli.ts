import fs from 'fs';
import path from 'path';
import type { StoryConfig, ResolvedStoryConfig, ResolvedSceneConfig } from '@acc/core/src/types';
import { renderStoryVideo } from '@acc/cli/src/pipelines/04-generative-story/StoryRenderer';
import { resolveStorySettings, mergeDefined, DEFAULT_VIDEO_SETTINGS } from '@acc/cli/src/pipelines/04-generative-story/platforms';
import { FFmpegManager, intro, outro, isCancel, cancel, Logger } from '@acc/core';
import * as prompt from '@clack/prompts';

async function main() {
  await FFmpegManager.prepare();
  const rawArgs = process.argv.slice(2);
  const firstArg = rawArgs[0]?.toLowerCase();
  if (firstArg && ['run', 'stream', 'serve', 'list', 'overlay', 'sfx', 'help', '--help', '-h'].includes(firstArg)) {
    const { runCli } = await import('./apps/cli/src/index');
    await runCli(rawArgs);
    if (firstArg !== 'serve') {
      process.exit(0);
    }
    return;
  }

  intro('ACC - Automated Content Creator');

  let targetDir = rawArgs[0];

  if (!targetDir) {
    const dirPrompt = await prompt.text({
      message: 'Please enter the path to your story folder:',
      placeholder: './sample-story',
      validate: (val) => (!val || val.trim() === '' ? 'Path cannot be empty.' : undefined),
    });

    if (isCancel(dirPrompt)) {
      cancel('Operation cancelled.');
      process.exit(0);
    }

    targetDir = dirPrompt as string;
  }

  if (!targetDir || targetDir.trim() === '') {
    outro('No folder path provided. Exiting.');
    process.exit(1);
  }

  // Clean quotes if user pasted path with quotes
  targetDir = targetDir.trim().replace(/^["']|["']$/g, '');

  const absoluteDir = path.resolve(targetDir);
  const configPath = path.join(absoluteDir, 'story-config.json');

  if (!fs.existsSync(absoluteDir)) {
    outro(`Directory not found: ${absoluteDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(configPath)) {
    outro(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  const rawConfig = fs.readFileSync(configPath, 'utf-8');
  let config: StoryConfig;
  try {
    config = JSON.parse(rawConfig);
  } catch (error) {
    outro(`Failed to parse story-config.json: ${error}`);
    process.exit(1);
  }

  function resolveMediaPath(filePath: string, baseDir: string, type: 'image' | 'audio'): string {
    if (!filePath) return '';

    const directPath = path.isAbsolute(filePath)
      ? path.normalize(filePath)
      : path.resolve(baseDir, filePath);

    if (fs.existsSync(directPath)) {
      return directPath;
    }

    const baseName = path.basename(filePath);
    const subFolders = ['assets'];

    for (const folder of subFolders) {
      const candidate = path.resolve(baseDir, folder, baseName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const rootCandidate = path.resolve(baseDir, baseName);
    if (fs.existsSync(rootCandidate)) {
      return rootCandidate;
    }

    return directPath;
  }

  const outputDir = path.join(absoluteDir, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const rawScenes = config.scenes || config.slides || [];

  if (rawScenes.length === 0) {
    outro('No scenes found in story-config.json');
    process.exit(1);
  }

  const resolvedScenes: ResolvedSceneConfig[] = [];
  for (let idx = 0; idx < rawScenes.length; idx++) {
    const scene = rawScenes[idx];
    const resolvedImage = scene.image ? resolveMediaPath(scene.image, absoluteDir, 'image') : undefined;
    const resolvedVideo = scene.video ? resolveMediaPath(scene.video, absoluteDir, 'image') : undefined;
    let resolvedAudio = resolveMediaPath(scene.audio || '', absoluteDir, 'audio');

    if (scene.image && !fs.existsSync(resolvedImage || '')) {
      Logger.warn('cli', `⚠️ [Scene ${idx + 1}] Cảnh báo: Không tìm thấy file ảnh: ${scene.image} (đã thử: ${resolvedImage})`);
    }
    if (scene.video && !fs.existsSync(resolvedVideo || '')) {
      Logger.warn('cli', `⚠️ [Scene ${idx + 1}] Cảnh báo: Không tìm thấy file video: ${scene.video} (đã thử: ${resolvedVideo})`);
    }

    if (scene.audio && !fs.existsSync(resolvedAudio)) {
      Logger.warn('cli', `⚠️ [Scene ${idx + 1}] Cảnh báo: Không tìm thấy file âm thanh: ${scene.audio} (đã thử: ${resolvedAudio})`);
    } else if (!scene.audio) {
      Logger.warn('cli', `⚠️ [Scene ${idx + 1}] Cảnh báo: Scene không có cấu hình audio.`);
    }

    const resolvedVideoSettings = mergeDefined(DEFAULT_VIDEO_SETTINGS, scene.videoSettings);

    resolvedScenes.push({
      ...scene,
      resolvedImage,
      resolvedVideo,
      resolvedAudio,
      resolvedVideoSettings,
    });
  }

  const resolvedSettings = resolveStorySettings(config.settings);

  const resolvedConfig: ResolvedStoryConfig = {
    name: config.name,
    description: config.description,
    settings: resolvedSettings,
    scenes: resolvedScenes,
  };

  const baseName = config.name
    ? config.name.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_')
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

  Logger.info('cli', `Scenes: ${resolvedConfig.scenes.length}`);
  Logger.info('cli', `Platform: ${resolvedSettings.platform}`);
  Logger.info('cli', `Resolution: ${resolvedSettings.width}x${resolvedSettings.height} @ ${resolvedSettings.fps}fps`);
  Logger.info('cli', `Video: codec=${resolvedSettings.videoCodec}, crf/cq=${resolvedSettings.crf}, preset=${resolvedSettings.preset}, pix_fmt=${resolvedSettings.pixelFormat}`);
  Logger.info('cli', `Audio: codec=${resolvedSettings.audioCodec}, bitrate=${resolvedSettings.audioBitrate}`);
  Logger.info('cli', `Hardware Acceleration: ${resolvedSettings.gpuAcceleration}`);
  Logger.info('cli', `Parallel Workers: ${resolvedSettings.concurrency}`);
  Logger.info('cli', `Container: ${resolvedSettings.container} (FastStart=${resolvedSettings.fastStart})`);
  Logger.info('cli', `Output: ${outputFilePath}\n`);

  try {
    const startTime = Date.now();

    await renderStoryVideo(resolvedConfig, outputFilePath, absoluteDir);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    const metadata = {
      name: config.name || baseName,
      description: config.description || '',
      videoFile: outputFileName,
      renderedAt: new Date().toISOString(),
      durationSec: parseFloat(durationSec),
      scenesCount: resolvedConfig.scenes.length,
      platform: resolvedSettings.platform,
      resolution: `${resolvedSettings.width}x${resolvedSettings.height}`,
      fps: resolvedSettings.fps,
      videoCodec: resolvedSettings.videoCodec,
      audioCodec: resolvedSettings.audioCodec,
      crf: resolvedSettings.crf,
      preset: resolvedSettings.preset,
      container: resolvedSettings.container,
      gpuAcceleration: resolvedSettings.gpuAcceleration,
      concurrency: resolvedSettings.concurrency,
      captions: resolvedSettings.captions ? {
        preset: resolvedSettings.captions.preset,
        subtitleMode: resolvedSettings.captions.subtitleMode,
      } : undefined,
      upscale: resolvedSettings.upscale,
      transition: resolvedSettings.transition
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    outro(`Video rendering successfully completed in ${durationSec}s!\nFile saved to: ${outputFilePath}\nMetadata saved to: ${metadataPath}`);

  } catch (error) {
    outro(`Render failed: ${error}`);
    process.exit(1);
  }
}

main();
