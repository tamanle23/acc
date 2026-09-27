import { FFmpegManager } from './core/FFmpegManager';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import type { ResolvedStoryConfig, ResolvedSceneConfig, TransitionSettings } from './types';
import { generateAssContent, getSceneDuration } from './subtitles';
import { buildFfmpegEncodingFlags } from './platforms';
import { upscaleImage, checkAndDownloadUpscaler } from './upscaler';
import { renderFrameBreakerScene } from './depth3d/frame-breaker';

function getFileChecksum(filePath: string): string {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex').substring(0, 8); // 8 ký tự là đủ để cache busting
  } catch (e) {
    return Date.now().toString(); // Fallback if file read fails
  }
}

function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve(0);
    }
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata?.format?.duration) {
        return resolve(0);
      }
      resolve(metadata.format.duration);
    });
  });
}

const BLACK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function createSilentWavBuffer(seconds = 5): Buffer {
  const sampleRate = 44100;
  const numChannels = 2;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const numSamples = Math.ceil(sampleRate * seconds);
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function renderSingleScene(
  scene: ResolvedSceneConfig,
  duration: number,
  assPath: string | null,
  config: ResolvedStoryConfig,
  outputPath: string,
  fallbackImagePath: string,
  fallbackAudioPath: string,
  paddingTime: number = 0,
  useHighQualityIntermediate: boolean = false
): Promise<{ path: string, duration: number }> {
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    const { width, height, container, captions } = config.settings;
    const subtitleMode = captions?.subtitleMode || 'burn';

    const hasImage = fs.existsSync(scene.resolvedImage);
    const hasAudio = fs.existsSync(scene.resolvedAudio);
    const hasSubtitle = !!(assPath && fs.existsSync(assPath));

    const imageInput = hasImage ? scene.resolvedImage : fallbackImagePath;
    const audioInput = hasAudio ? scene.resolvedAudio : fallbackAudioPath;

    // Extend video duration by paddingTime
    const totalDuration = duration + paddingTime;

    command = command
      .input(imageInput)
      .loop(totalDuration)
      .input(audioInput);

    const videoFilters: string[] = [
      `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
      `setsar=1`
    ];

    if (hasSubtitle) {
      if (subtitleMode === 'burn') {
        const escapedAss = assPath!
          .replace(/\\/g, '/')
          .replace(/:/g, '\\:');

        videoFilters.push(`subtitles='${escapedAss}'`);
      } else {
        command = command.input(assPath!);
      }
    }

    const encodingFlags = buildFfmpegEncodingFlags(config.settings, totalDuration);
    const outputOptions = [...encodingFlags.outputOptions];

    // If using xfade later, we need a high quality intermediate render to prevent generation loss
    if (useHighQualityIntermediate) {
      if (config.settings.fastIntermediate) {
        // Fast intermediate mode: force ultrafast preset if CPU, bypass heavy compression
        const encoderIndex = outputOptions.findIndex(o => o.startsWith('-c:v'));
        if (encoderIndex !== -1 && !outputOptions[encoderIndex].includes('nvenc')) {
          const presetIndex = outputOptions.findIndex(o => o.startsWith('-preset'));
          if (presetIndex !== -1) {
            outputOptions[presetIndex] = '-preset ultrafast';
          } else {
            outputOptions.push('-preset ultrafast');
          }
        }
        // Use CRF 12 to ensure extremely fast but lossless quality
        for (let i = 0; i < outputOptions.length; i++) {
          if (outputOptions[i].startsWith('-crf ')) {
            outputOptions[i] = '-crf 12';
          } else if (outputOptions[i].startsWith('-cq ')) {
            outputOptions[i] = '-cq 12';
          }
        }
      } else {
        // Find and replace CRF or CQ flags with higher quality for intermediate (old behavior)
        for (let i = 0; i < outputOptions.length; i++) {
          if (outputOptions[i].startsWith('-crf ')) {
            outputOptions[i] = '-crf 15';
          } else if (outputOptions[i].startsWith('-cq ')) {
            outputOptions[i] = '-cq 15';
          } else if (outputOptions[i] === '-crf' || outputOptions[i] === '-cq') {
            outputOptions[i + 1] = '15'; // Handle legacy space-separated format just in case
          }
        }
      }
    }

    if (paddingTime > 0) {
      // Pad audio with silence at the end
      outputOptions.push('-af', `apad=pad_dur=${paddingTime}`);
    }

    if (hasSubtitle && subtitleMode === 'soft') {
      if (container === 'mkv') {
        outputOptions.push('-c:s ass');
      } else if (container === 'mp4' || container === 'mov') {
        outputOptions.push('-c:s mov_text');
      } else if (container === 'webm') {
        outputOptions.push('-c:s webvtt');
      }
    }

    command
      .videoFilters(videoFilters)
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('end', () => resolve({ path: outputPath, duration: totalDuration }))
      .on('error', (err) => reject(err))
      .run();
  });
}

function concatenateVideos(videoPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const listFilePath = path.join(os.tmpdir(), `concat_list_${Date.now()}.txt`);
    const fileContent = videoPaths
      .map((p) => `file '${p.replace(/\\/g, '/')}'`)
      .join('\n');

    fs.writeFileSync(listFilePath, fileContent, 'utf-8');

    ffmpeg()
      .input(listFilePath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy', '-map 0'])
      .output(outputPath)
      .on('end', () => {
        try { fs.unlinkSync(listFilePath); } catch {}
        resolve();
      })
      .on('error', (err) => {
        try { fs.unlinkSync(listFilePath); } catch {}
        reject(err);
      })
      .run();
  });
}

function concatenateWithTransitions(
  segments: { path: string, duration: number, transition?: TransitionSettings }[],
  outputPath: string,
  config: ResolvedStoryConfig
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (segments.length < 2) {
      return concatenateVideos(segments.map(s => s.path), outputPath).then(resolve).catch(reject);
    }

    let command = ffmpeg();
    segments.forEach(seg => command.input(seg.path));

    let filterComplex = '';
    let lastV = '[0:v]';
    let lastA = '[0:a]';
    let currentOffset = segments[0].duration;

    const finalTransitions: TransitionSettings[] = [];

    // Build transition params
    for (let i = 0; i < segments.length - 1; i++) {
      let tConfig = segments[i].transition || config.settings.transition;
      if (!tConfig || !tConfig.enabled) {
        // Fallback to a fast cut if no transition is enabled between these
        tConfig = { enabled: true, type: 'fade', duration: 0.1, audioBehavior: 'crossfade' };
      }
      
      const tDur = tConfig.duration || 1.0;
      currentOffset -= tDur; // offset shrinks because we overlap
      
      const nextV = `[${i + 1}:v]`;
      const nextA = `[${i + 1}:a]`;
      const outV = `[v_out${i}]`;
      const outA = `[a_out${i}]`;

      const tType = tConfig.type === 'random' ? 'fade' : (tConfig.type || 'fade');

      filterComplex += `${lastV}${nextV}xfade=transition=${tType}:duration=${tDur}:offset=${currentOffset}${outV};`;
      filterComplex += `${lastA}${nextA}acrossfade=d=${tDur}${outA};`;

      lastV = outV;
      lastA = outA;

      currentOffset += segments[i + 1].duration;
    }

    const encodingFlags = buildFfmpegEncodingFlags(config.settings, currentOffset); // approximate final duration

    command
      .complexFilter(filterComplex, [lastV.replace(/[[\]]/g, ''), lastA.replace(/[[\]]/g, '')])
      .outputOptions(encodingFlags.outputOptions)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

async function runConcurrentPool<T, R>(
  items: T[],
  concurrencyLimit: number,
  workerFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await workerFn(items[index], index);
    }
  }

  const poolSize = Math.max(1, Math.min(concurrencyLimit, items.length));
  const workers = Array.from({ length: poolSize }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function renderStoryVideo(
  config: ResolvedStoryConfig,
  outputFilePath: string,
  baseDir: string = process.cwd()
): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-render-'));
  const { width, height, container, captions, concurrency, upscale } = config.settings;
  const totalScenes = config.scenes.length;
  const activeConcurrency = Math.max(1, Math.min(concurrency || 1, totalScenes));

  // 1. AI Upscaling Pre-processing
  if (upscale?.enabled) {
    const modelName = upscale.model || 'realesrgan-x4plus';
    console.log(`\n✨ AI Auto-Upscale is enabled. Checking dependencies for ${modelName}...`);
    await checkAndDownloadUpscaler(modelName);
    
    const cacheDir = path.join(baseDir, '.cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const upscalerConcurrency = Math.min(2, activeConcurrency);
    console.log(`🚀 Starting AI Upscaling (${totalScenes} images, parallel workers: ${upscalerConcurrency})...`);
    await runConcurrentPool(config.scenes, upscalerConcurrency, async (scene, i) => {
      if (fs.existsSync(scene.resolvedImage)) {
        const ext = path.extname(scene.resolvedImage);
        
        // Cache file naming based on original filename, MD5 checksum, and model
        const baseName = path.basename(scene.resolvedImage, ext);
        const checksum = getFileChecksum(scene.resolvedImage);
        const upscaledFilename = `upscaled_${baseName}_${checksum}_${modelName}${ext}`;
        const upscaledPath = path.join(cacheDir, upscaledFilename);
        
        if (fs.existsSync(upscaledPath)) {
          console.log(`▶ [Scene ${i + 1}/${totalScenes}] Using cached upscaled image/video: ${upscaledFilename}`);
          scene.resolvedImage = upscaledPath;
        } else {
          console.log(`▶ [Scene ${i + 1}/${totalScenes}] Upscaling using ${modelName}...`);
          await upscaleImage(scene.resolvedImage, upscaledPath, modelName);
          scene.resolvedImage = upscaledPath;
          console.log(`✓ [Scene ${i + 1}/${totalScenes}] Upscaling complete.`);
        }
      }
    });
  }

  const fallbackImagePath = path.join(tempDir, '_fallback_black.png');
  fs.writeFileSync(fallbackImagePath, Buffer.from(BLACK_PNG_BASE64, 'base64'));

  const fallbackAudioPath = path.join(tempDir, '_fallback_silent.wav');
  fs.writeFileSync(fallbackAudioPath, createSilentWavBuffer(15));

  try {
    console.log(`\n🚀 Starting scene rendering (${totalScenes} scenes, parallel workers: ${activeConcurrency})...\n`);

    const hasAnyTransition = config.scenes.some(s => s.transition?.enabled) || config.settings.transition?.enabled;

    const segments = await runConcurrentPool(
      config.scenes,
      activeConcurrency,
      async (scene, i) => {
        const audioDuration = await getMediaDuration(scene.resolvedAudio);
        const duration = getSceneDuration(scene, audioDuration);

        let assPath: string | null = null;
        if (scene.captions && scene.captions.length > 0) {
          assPath = path.join(tempDir, `scene_${i}.ass`);
          const assContent = generateAssContent(scene.captions, captions, width, height);
          fs.writeFileSync(assPath, assContent, 'utf-8');
        }

        const segmentPath = path.join(tempDir, `scene_${i}.${container}`);
        const startTime = Date.now();
        
        // Determine transition padding
        let paddingTime = 0;
        const tConfig = scene.transition || config.settings.transition;
        if (tConfig?.enabled && tConfig.audioBehavior === 'pad' && i < totalScenes - 1) {
          paddingTime = tConfig.duration || 1.0;
        }

        const pauseTime = scene.pauseAfter !== undefined ? scene.pauseAfter : (config.settings.pauseBetweenScenes || 0);
        if (pauseTime > 0 && i < totalScenes - 1) {
          paddingTime += pauseTime;
        }

        const depthConfig = scene.depth3d || config.settings.depth3d;
        let result;

        if (depthConfig?.enabled !== false && (depthConfig?.mode === 'frame_breaker' || (depthConfig?.enabled && !depthConfig?.mode))) {
          console.log(`▶ [Scene ${i + 1}/${totalScenes}] Rendering 3D Frame-Breaker (${(duration+paddingTime).toFixed(2)}s)...`);
          result = await renderFrameBreakerScene({
            scene,
            duration,
            assPath,
            config,
            outputPath: segmentPath,
            paddingTime,
            useHighQualityIntermediate: hasAnyTransition
          });
        } else {
          console.log(`▶ [Scene ${i + 1}/${totalScenes}] Rendering (duration: ${(duration+paddingTime).toFixed(2)}s)...`);
          result = await renderSingleScene(
            scene,
            duration,
            assPath,
            config,
            segmentPath,
            fallbackImagePath,
            fallbackAudioPath,
            paddingTime,
            hasAnyTransition // use High Quality if transitioning later
          );
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✓ [Scene ${i + 1}/${totalScenes}] Completed in ${elapsed}s`);

        return { path: result.path, duration: result.duration, transition: scene.transition };
      }
    );

    console.log('\nConcatenating scenes into final video...');
    
    let currentVideoPath = path.join(tempDir, 'concat_output.mp4');

    if (segments.length === 1) {
      fs.copyFileSync(segments[0].path, currentVideoPath);
    } else {
      if (hasAnyTransition) {
        console.log('Applying video transition filtergraph (xfade)...');
        await concatenateWithTransitions(segments, currentVideoPath, config);
      } else {
        await concatenateVideos(segments.map(s => s.path), currentVideoPath);
      }
    }

    if (config.settings.overlayComposite) {
      const nextVideoPath = path.join(tempDir, 'with_overlay.mp4');
      console.log(`\n=== Applying Overlay Composite: ${config.settings.overlayComposite} ===`);
      const { RegistryManager } = await import('./core/Registry');
      const { renderEffectLayer } = await import('./overlay-effects/engine');
      const { applyPolyrhythmicOverlays } = await import('./overlay-effects/stacker');

      const registry = new RegistryManager();
      const compositeConfig = registry.getCompositeConfig(config.settings.overlayComposite);
      
      const outDir = path.join(baseDir, 'autogenerated', 'overlay-effects');
      console.log(`Generating/Fetching ${compositeConfig.layers.length} prime-duration layers...`);
      
      const renderPromises = compositeConfig.layers.map(layer => {
        return renderEffectLayer(registry, layer.effect, layer.variant, layer.duration, outDir);
      });
      const overlayPaths = await Promise.all(renderPromises);

      console.log('Stacking infinite polyrhythmic layers over the main video...');
      await applyPolyrhythmicOverlays(currentVideoPath, overlayPaths, nextVideoPath);
      console.log('✅ Compositing completed successfully!');
      currentVideoPath = nextVideoPath;
    }

    if (config.settings.bgm) {
      const nextVideoPath = path.join(tempDir, 'with_bgm.mp4');
      console.log(`\n=== Applying Background Music ===`);
      await new Promise<void>((resolve, reject) => {
        const bgm = config.settings.bgm!;
        const bgmPath = path.isAbsolute(bgm.source) ? bgm.source : path.resolve(baseDir, bgm.source);
        if (!fs.existsSync(bgmPath)) {
          console.warn(`[BGM] Không tìm thấy file nhạc nền tại ${bgmPath}. Bỏ qua BGM.`);
          fs.copyFileSync(currentVideoPath, nextVideoPath);
          return resolve();
        }

        const volume = bgm.volume !== undefined ? bgm.volume : 0.1;
        const isLoop = bgm.loop !== false;
        const fadeIn = bgm.fadeIn || 0;

        let command = ffmpeg().input(currentVideoPath);

        command = command.input(bgmPath);
        if (isLoop) {
          command = command.inputOption('-stream_loop', '-1');
        }

        let audioFilter = `[1:a]volume=${volume}`;
        if (fadeIn > 0) {
          audioFilter += `,afade=t=in:st=0:d=${fadeIn}`;
        }
        
        const filterComplex = `${audioFilter}[bgm_processed];[0:a][bgm_processed]amix=inputs=2:duration=first:dropout_transition=2[a_out]`;

        console.log(`Mixing audio with volume ${volume}${isLoop ? ' (looped)' : ''}...`);
        command
          .complexFilter(filterComplex)
          .outputOptions([
            '-map 0:v',
            '-map [a_out]',
            '-c:v copy', // Just copy the video stream, no re-encoding needed!
            `-c:a ${config.settings.audioCodec}`,
            `-b:a ${config.settings.audioBitrate}`
          ])
          .output(nextVideoPath)
          .on('end', () => resolve())
          .on('error', (err) => {
            console.error(`[BGM] Lỗi mix nhạc nền:`, err);
            reject(err);
          })
          .run();
      });
      console.log('✅ Background Music applied successfully!');
      currentVideoPath = nextVideoPath;
    }

    // Final copy to output
    fs.copyFileSync(currentVideoPath, outputFilePath);

  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}



