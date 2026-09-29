import fs from 'fs';
import path from 'path';
import readline from 'readline';
import type { StoryConfig, ResolvedStoryConfig, ResolvedSceneConfig } from './src/types';
import { renderStoryVideo } from './src/renderer';
import { resolveStorySettings } from './src/platforms';

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

import { FFmpegManager } from './src/core/FFmpegManager';

async function main() {
  await FFmpegManager.prepare();
  let targetDir = process.argv.slice(2)[0];

  if (!targetDir) {
    targetDir = await askQuestion('Please enter the path to your story folder: ');
  }

  if (!targetDir || targetDir.trim() === '') {
    console.error('No folder path provided. Exiting.');
    process.exit(1);
  }

  // Clean quotes if user pasted path with quotes
  targetDir = targetDir.trim().replace(/^["']|["']$/g, '');

  const absoluteDir = path.resolve(targetDir);
  const configPath = path.join(absoluteDir, 'story-config.json');

  if (!fs.existsSync(absoluteDir)) {
    console.error(`Directory not found: ${absoluteDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  const rawConfig = fs.readFileSync(configPath, 'utf-8');
  let config: StoryConfig;
  try {
    config = JSON.parse(rawConfig);
  } catch (error) {
    console.error('Failed to parse story-config.json:', error);
    process.exit(1);
  }

  function resolveMediaPath(filePath: string, baseDir: string, type: 'image' | 'audio'): string {
    if (!filePath) return '';

    // 1. Kiểm tra trực tiếp theo đường dẫn tuyệt đối hoặc tương đối
    const directPath = path.isAbsolute(filePath)
      ? path.normalize(filePath)
      : path.resolve(baseDir, filePath);

    if (fs.existsSync(directPath)) {
      return directPath;
    }

    // 2. Tìm trong các thư mục con media phổ biến (images/, voiceover/, audio/...)
    const baseName = path.basename(filePath);
    const subFolders = ['assets'];

    for (const folder of subFolders) {
      const candidate = path.resolve(baseDir, folder, baseName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // 3. Tìm ở thư mục gốc story
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

  // Hỗ trợ backward compatibility cho file cũ sử dụng "slides"
  const rawScenes = config.scenes || config.slides || [];

  if (rawScenes.length === 0) {
    console.error('No scenes found in story-config.json');
    process.exit(1);
  }

  const resolvedScenes: ResolvedSceneConfig[] = [];
  for (let idx = 0; idx < rawScenes.length; idx++) {
    const scene = rawScenes[idx];
    const resolvedImage = scene.image ? resolveMediaPath(scene.image, absoluteDir, 'image') : undefined;
    const resolvedVideo = scene.video ? resolveMediaPath(scene.video, absoluteDir, 'image') : undefined;
    let resolvedAudio = resolveMediaPath(scene.audio || '', absoluteDir, 'audio');

    if (scene.image && !fs.existsSync(resolvedImage || '')) {
      console.warn(`⚠️ [Scene ${idx + 1}] Cảnh báo: Không tìm thấy file ảnh: ${scene.image} (đã thử: ${resolvedImage})`);
    }
    if (scene.video && !fs.existsSync(resolvedVideo || '')) {
      console.warn(`⚠️ [Scene ${idx + 1}] Cảnh báo: Không tìm thấy file video: ${scene.video} (đã thử: ${resolvedVideo})`);
    }

    if (scene.audio && !fs.existsSync(resolvedAudio)) {
      console.warn(`⚠️ [Scene ${idx + 1}] Cảnh báo: Không tìm thấy file âm thanh: ${scene.audio} (đã thử: ${resolvedAudio})`);
    } else if (!scene.audio) {
      console.warn(`⚠️ [Scene ${idx + 1}] Cảnh báo: Scene không có cấu hình audio.`);
    }

    const defaultVideoSettings = {
      timeBase: 'audio' as const,
      shortVideoMode: 'freeze' as const,
      longVideoMode: 'trim' as const,
      volume: 0.0,
    };

    const resolvedVideoSettings = scene.videoSettings
      ? { ...defaultVideoSettings, ...scene.videoSettings }
      : defaultVideoSettings;

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

  // outputDir đã được tạo ở trên

  const baseName = config.name
    ? config.name.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_') // allow unicode/vietnamese
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

  console.log(`\n=== Storyteller Video Generator ===`);
  console.log(`Scenes: ${resolvedConfig.scenes.length}`);
  console.log(`Platform: ${resolvedSettings.platform}`);
  console.log(`Resolution: ${resolvedSettings.width}x${resolvedSettings.height} @ ${resolvedSettings.fps}fps`);
  console.log(`Video: codec=${resolvedSettings.videoCodec}, crf/cq=${resolvedSettings.crf}, preset=${resolvedSettings.preset}, pix_fmt=${resolvedSettings.pixelFormat}`);
  console.log(`Audio: codec=${resolvedSettings.audioCodec}, bitrate=${resolvedSettings.audioBitrate}`);
  console.log(`Hardware Acceleration: ${resolvedSettings.gpuAcceleration}`);
  console.log(`Parallel Workers: ${resolvedSettings.concurrency}`);
  console.log(`Container: ${resolvedSettings.container} (FastStart=${resolvedSettings.fastStart})`);
  console.log(`Output: ${outputFilePath}\n`);

  try {
    const startTime = Date.now();
    await renderStoryVideo(resolvedConfig, outputFilePath, absoluteDir);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nVideo rendering successfully completed in ${durationSec}s!`);
    console.log(`File saved to: ${outputFilePath}`);

    // Generate JSON Metadata for History Tracing
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
    console.log(`Metadata saved to: ${metadataPath}\n`);

  } catch (error) {
    console.error('\nRender failed:', error);
    process.exit(1);
  }
}

main();
