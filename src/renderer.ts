import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import type { ResolvedStoryConfig, ResolvedSlideConfig, TransitionSettings } from './types';
import { generateAssContent, getSlideDuration } from './subtitles';
import { buildFfmpegEncodingFlags } from './platforms';
import { upscaleImage, checkAndDownloadUpscaler } from './upscaler';

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

function renderSingleSlide(
  slide: ResolvedSlideConfig,
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

    const hasImage = fs.existsSync(slide.resolvedImage);
    const hasAudio = fs.existsSync(slide.resolvedAudio);
    const hasSubtitle = !!(assPath && fs.existsSync(assPath));

    const imageInput = hasImage ? slide.resolvedImage : fallbackImagePath;
    const audioInput = hasAudio ? slide.resolvedAudio : fallbackAudioPath;

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
  const totalSlides = config.slides.length;
  const activeConcurrency = Math.max(1, Math.min(concurrency || 1, totalSlides));

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
    console.log(`🚀 Starting AI Upscaling (${totalSlides} images, parallel workers: ${upscalerConcurrency})...`);
    await runConcurrentPool(config.slides, upscalerConcurrency, async (slide, i) => {
      if (fs.existsSync(slide.resolvedImage)) {
        const ext = path.extname(slide.resolvedImage);
        
        // Cache file naming based on original filename, MD5 checksum, and model
        const baseName = path.basename(slide.resolvedImage, ext);
        const checksum = getFileChecksum(slide.resolvedImage);
        const upscaledFilename = `upscaled_${baseName}_${checksum}_${modelName}${ext}`;
        const upscaledPath = path.join(cacheDir, upscaledFilename);
        
        if (fs.existsSync(upscaledPath)) {
          console.log(`▶ [Slide ${i + 1}/${totalSlides}] Using cached upscaled image: ${upscaledFilename}`);
          slide.resolvedImage = upscaledPath;
        } else {
          console.log(`▶ [Slide ${i + 1}/${totalSlides}] Upscaling image using ${modelName}...`);
          await upscaleImage(slide.resolvedImage, upscaledPath, modelName);
          slide.resolvedImage = upscaledPath;
          console.log(`✓ [Slide ${i + 1}/${totalSlides}] Upscaling complete.`);
        }
      }
    });
  }

  const fallbackImagePath = path.join(tempDir, '_fallback_black.png');
  fs.writeFileSync(fallbackImagePath, Buffer.from(BLACK_PNG_BASE64, 'base64'));

  const fallbackAudioPath = path.join(tempDir, '_fallback_silent.wav');
  fs.writeFileSync(fallbackAudioPath, createSilentWavBuffer(15));

  try {
    console.log(`\n🚀 Starting slide rendering (${totalSlides} slides, parallel workers: ${activeConcurrency})...\n`);

    const hasAnyTransition = config.slides.some(s => s.transition?.enabled) || config.settings.transition?.enabled;

    const segments = await runConcurrentPool(
      config.slides,
      activeConcurrency,
      async (slide, i) => {
        const audioDuration = await getMediaDuration(slide.resolvedAudio);
        const duration = getSlideDuration(slide, audioDuration);

        let assPath: string | null = null;
        if (slide.captions && slide.captions.length > 0) {
          assPath = path.join(tempDir, `slide_${i}.ass`);
          const assContent = generateAssContent(slide.captions, captions, width, height);
          fs.writeFileSync(assPath, assContent, 'utf-8');
        }

        const segmentPath = path.join(tempDir, `slide_${i}.${container}`);
        const startTime = Date.now();
        
        // Determine transition padding
        let paddingTime = 0;
        const tConfig = slide.transition || config.settings.transition;
        if (tConfig?.enabled && tConfig.audioBehavior === 'pad' && i < totalSlides - 1) {
          paddingTime = tConfig.duration || 1.0;
        }

        console.log(`▶ [Slide ${i + 1}/${totalSlides}] Rendering (duration: ${(duration+paddingTime).toFixed(2)}s)...`);

        const result = await renderSingleSlide(
          slide,
          duration,
          assPath,
          config,
          segmentPath,
          fallbackImagePath,
          fallbackAudioPath,
          paddingTime,
          hasAnyTransition // use High Quality if transitioning later
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✓ [Slide ${i + 1}/${totalSlides}] Completed in ${elapsed}s`);

        return { path: result.path, duration: result.duration, transition: slide.transition };
      }
    );

    console.log('\nConcatenating slides into final video...');
    if (segments.length === 1) {
      fs.copyFileSync(segments[0].path, outputFilePath);
    } else {
      if (hasAnyTransition) {
        console.log('Applying video transition filtergraph (xfade)...');
        await concatenateWithTransitions(segments, outputFilePath, config);
      } else {
        await concatenateVideos(segments.map(s => s.path), outputFilePath);
      }
    }
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}
