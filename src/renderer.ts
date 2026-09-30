import { FFmpegManager } from './core/FFmpegManager';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import ffmpeg, { getMediaDuration } from './core/FFmpegExecutor';
import type { ResolvedStoryConfig, ResolvedSceneConfig, TransitionSettings } from './types';
import { generateAssContent, getSceneDuration } from './subtitles';
import { buildFfmpegEncodingFlags } from './platforms';
import { renderDepth3DScene } from './depth3d';
import { Logger } from './core/logger';
import { AssetContext } from './core/AssetContext';
import { RenderContext } from './core/IPlugin';
import { UpscalerPlugin } from './plugins/UpscalerPlugin';
import { FFmpegFilterGraph } from './core/FFmpegFilterGraph';

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

    const hasVideo = !!scene.resolvedVideo && fs.existsSync(scene.resolvedVideo);
    const hasImage = !!scene.resolvedImage && fs.existsSync(scene.resolvedImage);
    const hasAudio = fs.existsSync(scene.resolvedAudio);
    const hasSubtitle = !!(assPath && fs.existsSync(assPath));

    const audioInput = hasAudio ? scene.resolvedAudio : fallbackAudioPath;
    const totalDuration = duration + paddingTime;

    const filterGraph = new FFmpegFilterGraph();
    const videoFilters: string[] = [];
    let mapV = '0:v';
    let mapA = '1:a';
    let useShortest = false;

    if (hasVideo) {
      const vSettings = scene.resolvedVideoSettings || {
        timeBase: 'audio', shortVideoMode: 'freeze', longVideoMode: 'trim', volume: 0.0
      };
      
      command = command.input(scene.resolvedVideo!);
      
      if (vSettings.timeBase === 'audio' && vSettings.shortVideoMode === 'loop') {
        command = command.inputOptions(['-stream_loop', '-1']);
      }
      
      command = command.input(audioInput);

      if (vSettings.timeBase === 'audio' && vSettings.shortVideoMode === 'freeze') {
        videoFilters.push(`tpad=stop_mode=clone:stop_duration=9999`);
      }

      if (vSettings.timeBase === 'audio' && vSettings.longVideoMode === 'trim') {
        useShortest = true;
      } else if (vSettings.timeBase === 'audio' && vSettings.shortVideoMode === 'loop') {
        useShortest = true;
      }

      if (vSettings.volume! > 0) {
        const va = filterGraph.createStreamLabel('va');
        const aa = filterGraph.createStreamLabel('aa');
        const aout = filterGraph.createStreamLabel('aout');

        filterGraph.addNode({
          inputs: ['0:a'],
          filter: 'volume',
          options: `${vSettings.volume}`,
          outputs: [va],
        });

        filterGraph.addNode({
          inputs: ['1:a'],
          filter: 'volume=1.0,apad',
          outputs: [aa],
        });

        filterGraph.addNode({
          inputs: [va, aa],
          filter: 'amix',
          options: {
            inputs: 2,
            duration: vSettings.timeBase === 'audio' && vSettings.longVideoMode === 'trim' ? 'first' : 'longest',
          },
          outputs: [aout],
        });

        mapA = aout;
      }

      // Add basic scaling
      videoFilters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`, `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`, `setsar=1`);
    } else {
      const imageInput = hasImage ? scene.resolvedImage! : fallbackImagePath;
      command = command
        .input(imageInput)
        .loop(totalDuration)
        .input(audioInput);
      
      videoFilters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`, `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`, `setsar=1`);
    }

    if (hasSubtitle) {
      if (subtitleMode === 'burn') {
        const escapedAss = assPath!.replace(/\\/g, '/').replace(/:/g, '\\:');
        videoFilters.push(`subtitles='${escapedAss}'`);
      } else {
        command = command.input(assPath!);
      }
    }

    if (videoFilters.length > 0) {
      const vout = filterGraph.createStreamLabel('vout');
      filterGraph.addNode({
        inputs: ['0:v'],
        filter: videoFilters.join(','),
        outputs: [vout],
      });
      mapV = vout;
    }

    if (filterGraph.getNodes().length > 0) {
      command = command.complexFilter(filterGraph.compile());
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

    if (useShortest) {
      outputOptions.push('-shortest');
    }
    
    // Explicit mapping to prevent FFmpeg from doing auto-mapping which can ruin the complex filter output
    outputOptions.push(`-map ${mapV}`);
    outputOptions.push(`-map ${mapA}`);

    // videoFilters are already handled by complexFilter above

    command
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('end', () => resolve({ path: outputPath, duration: totalDuration }))
      .on('error', (err, stdout, stderr) => reject(new Error(`${err.message}\nFFMPEG STDERR:\n${stderr}`)))
      .run();
  });
}

function concatenateVideos(videoPaths: string[], outputPath: string): Promise<void> {
  const { FFIConcatMuxer } = require('./core/ffmpeg-ffi/FFIConcatMuxer');
  return FFIConcatMuxer.concatenate(videoPaths, outputPath);
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

    const filterGraph = new FFmpegFilterGraph();
    let lastV = '[0:v]';
    let lastA = '[0:a]';
    let currentOffset = segments[0].duration;

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
      const outV = filterGraph.createStreamLabel(`v_trans_${i}`);
      const outA = filterGraph.createStreamLabel(`a_trans_${i}`);

      const tType = tConfig.type === 'random' ? 'fade' : (tConfig.type || 'fade');

      filterGraph.addNode({
        inputs: [lastV, nextV],
        filter: 'xfade',
        options: {
          transition: tType,
          duration: tDur,
          offset: currentOffset,
        },
        outputs: [outV],
      });

      filterGraph.addNode({
        inputs: [lastA, nextA],
        filter: 'acrossfade',
        options: {
          d: tDur,
        },
        outputs: [outA],
      });

      lastV = outV;
      lastA = outA;

      currentOffset += segments[i + 1].duration;
    }

    const encodingFlags = buildFfmpegEncodingFlags(config.settings, currentOffset); // approximate final duration

    command
      .complexFilter(filterGraph.compile(), [FFmpegFilterGraph.stripLabel(lastV), FFmpegFilterGraph.stripLabel(lastA)])
      .outputOptions(encodingFlags.outputOptions)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err, stdout, stderr) => reject(new Error(`${err.message}\nFFMPEG STDERR:\n${stderr}`)))
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

  const renderContext: RenderContext = {
    config,
    assets: new AssetContext(),
    baseDir,
    cacheDir: path.join(baseDir, '.cache'),
    tempDir
  };

  const plugins = [
    new UpscalerPlugin()
  ];

  for (const plugin of plugins) {
    try {
      await plugin.execute(renderContext);
    } catch (e: any) {
      Logger.error('Pipeline', `Plugin ${plugin.name} fatally crashed: ${e.message}`);
    }
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

        const currentImagePath = renderContext.assets.getPreferred(`scene_${i}`, ['image:upscaled', 'image:original']) || scene.resolvedImage;
        const sceneToRender = { ...scene, resolvedImage: currentImagePath };

        const depthConfig = sceneToRender.depth3d || config.settings.depth3d;
        let result;

        if (depthConfig?.enabled !== false && (depthConfig?.enabled || depthConfig?.mode)) {
          const modeName = depthConfig.mode || 'frame_breaker';
          Logger.info('Pipeline', `[Scene ${i + 1}/${totalScenes}] Rendering 3D Depth [${modeName}] (${(duration+paddingTime).toFixed(2)}s)...`);
          try {
            result = await renderDepth3DScene({
              scene: sceneToRender,
              duration,
              assPath,
              config,
              outputPath: segmentPath,
              fallbackAudioPath,
              paddingTime,
              useHighQualityIntermediate: hasAnyTransition
            });
          } catch (depthErr: any) {
            Logger.warn('Pipeline', `[Scene ${i + 1}/${totalScenes}] 3D Depth rendering failed: ${depthErr.message}. Falling back to 2D render.`);
            result = await renderSingleScene(
              sceneToRender,
              duration,
              assPath,
              config,
              segmentPath,
              fallbackImagePath,
              fallbackAudioPath,
              paddingTime,
              hasAnyTransition
            );
          }
        } else {
          Logger.info('Pipeline', `[Scene ${i + 1}/${totalScenes}] Rendering (duration: ${(duration+paddingTime).toFixed(2)}s)...`);
          result = await renderSingleScene(
            sceneToRender,
            duration,
            assPath,
            config,
            segmentPath,
            fallbackImagePath,
            fallbackAudioPath,
            paddingTime,
            hasAnyTransition
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

        const bgmGraph = new FFmpegFilterGraph();
        const bgmProcessed = bgmGraph.createStreamLabel('bgm_proc');

        let bgmChain = `volume=${volume}`;
        if (fadeIn > 0) {
          bgmChain += `,afade=t=in:st=0:d=${fadeIn}`;
        }
        bgmGraph.addNode({
          inputs: ['1:a'],
          filter: bgmChain,
          outputs: [bgmProcessed]
        });

        const aOut = bgmGraph.createStreamLabel('a_out');
        const autoDuck = bgm.autoDucking !== false;

        if (autoDuck) {
          const fgOut = bgmGraph.createStreamLabel('fg_out');
          const fgSc = bgmGraph.createStreamLabel('fg_sc');
          const bgDucked = bgmGraph.createStreamLabel('bg_ducked');

          bgmGraph.addNode({
            inputs: ['0:a'],
            filter: 'asplit=2',
            outputs: [fgOut, fgSc]
          });

          bgmGraph.addNode({
            inputs: [bgmProcessed, fgSc],
            filter: 'sidechaincompress',
            options: {
              threshold: '-24dB',
              ratio: 5,
              attack: 10,
              release: 300
            },
            outputs: [bgDucked]
          });

          bgmGraph.addNode({
            inputs: [bgDucked, fgOut],
            filter: 'amix',
            options: {
              inputs: 2,
              duration: 'first',
              dropout_transition: 2
            },
            outputs: [aOut]
          });
        } else {
          bgmGraph.addNode({
            inputs: ['0:a', bgmProcessed],
            filter: 'amix',
            options: {
              inputs: 2,
              duration: 'first',
              dropout_transition: 2
            },
            outputs: [aOut]
          });
        }

        console.log(`Mixing audio with volume ${volume}${isLoop ? ' (looped)' : ''}...`);
        command
          .complexFilter(bgmGraph.compile())
          .outputOptions([
            '-map 0:v',
            `-map ${aOut}`,
            '-c:v copy', // Just copy the video stream, no re-encoding needed!
            `-c:a ${config.settings.audioCodec}`,
            `-b:a ${config.settings.audioBitrate}`
          ])
          .output(nextVideoPath)
          .on('end', () => resolve())
          .on('error', (err, stdout, stderr) => {
            console.error(`[BGM] Lỗi mix nhạc nền:`, err);
            reject(new Error(`${err.message}\nFFMPEG STDERR:\n${stderr}`));
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



