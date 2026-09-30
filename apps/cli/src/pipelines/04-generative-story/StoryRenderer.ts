import {
  FFmpegManager,
  Logger,
  AssetContext,
  FFmpegFilterGraph,
  SceneWorkerPool,
  FFISceneEngine,
  type RenderContext,
} from '@acc/core';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { FFmpegExecutor, getMediaDuration } from '@acc/core';
const ffmpeg = FFmpegExecutor;
import type { ResolvedStoryConfig, ResolvedSceneConfig, TransitionSettings } from './types';
import { generateAssContent, getSceneDuration, renderDepth3DScene } from '@acc/effect-engines';
import { buildFfmpegEncodingFlags } from './platforms';
import { UpscalerPlugin } from './plugins/UpscalerPlugin';

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

function createSilentMp3Buffer(seconds = 5): Buffer {
  const framesCount = Math.ceil(seconds * 38.28125);
  const frame = Buffer.alloc(417);
  frame[0] = 0xFF; frame[1] = 0xFB; frame[2] = 0x90; frame[3] = 0x04;
  return Buffer.concat(Array(framesCount).fill(frame));
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
  return FFISceneEngine.renderScene({
    scene,
    duration,
    assPath,
    config,
    outputPath,
    fallbackImagePath,
    fallbackAudioPath,
    paddingTime
  });
}

function concatenateVideos(videoPaths: string[], outputPath: string): Promise<void> {
  const { FFIConcatMuxer } = require('@acc/core');
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

    // Normalize all input timebases to AVTB so xfade never mismatches
    for (let idx = 0; idx < segments.length; idx++) {
      filterGraph.addNode({
        inputs: [`[${idx}:v]`],
        filter: 'settb',
        options: 'AVTB',
        outputs: [`[v_norm_${idx}]`],
      });
      filterGraph.addNode({
        inputs: [`[${idx}:a]`],
        filter: 'aresample',
        options: '44100:async=1',
        outputs: [`[a_norm_${idx}]`],
      });
    }

    let lastV = '[v_norm_0]';
    let lastA = '[a_norm_0]';
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
      
      const nextV = `[v_norm_${i + 1}]`;
      const nextA = `[a_norm_${i + 1}]`;
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
  await FFmpegManager.prepare();
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

  const fallbackAudioPath = path.join(tempDir, '_fallback_silent.mp3');
  fs.writeFileSync(fallbackAudioPath, createSilentMp3Buffer(15));

  // Pre-warm AI daemon once in main thread to prevent worker port collisions
  const needsAI = config.scenes.some(s => s.depth3d?.enabled && (s.depth3d?.autoSegment || s.depth3d?.autoDepth || s.depth3d?.mode === 'frame_breaker' || s.depth3d?.mode === 'volumetric_sandwich')) || config.settings.captions?.autoTranscribe;
  if (needsAI) {
    try {
      console.log('[Pipeline] Pre-warming AI Subsystem (SAM 2 & Depth Anything v2)...');
      const { defaultIPCFacade } = await import('@acc/core');
      await defaultIPCFacade.ensureDaemonRunning();
    } catch (err: any) {
      console.warn('[Pipeline] Pre-warming error:', err.message);
    }
  }

  try {
    console.log(`\n🚀 Starting scene rendering (${totalScenes} scenes, parallel workers: ${activeConcurrency})...\n`);

    const hasAnyTransition = config.scenes.some(s => s.transition?.enabled) || config.settings.transition?.enabled;

    let workerPool: SceneWorkerPool | null = null;
    if (activeConcurrency > 1) {
      try {
        workerPool = new SceneWorkerPool(activeConcurrency, FFmpegManager.getBinDir());
        await workerPool.initialize();
      } catch (err: any) {
        Logger.warn('Pipeline', `Worker pool initialization failed: ${err.message}. Running in main thread.`);
        workerPool = null;
      }
    }

    let segments;
    try {
      segments = await runConcurrentPool(
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
          const is3D = depthConfig?.enabled !== false && (depthConfig?.enabled || depthConfig?.mode);
          const modeName = depthConfig?.mode || 'frame_breaker';

          if (is3D) {
            Logger.info('Pipeline', `[Scene ${i + 1}/${totalScenes}] Rendering 3D Depth [${modeName}] (${(duration+paddingTime).toFixed(2)}s)...`);
          } else {
            Logger.info('Pipeline', `[Scene ${i + 1}/${totalScenes}] Rendering (duration: ${(duration+paddingTime).toFixed(2)}s)...`);
          }

          let result;
          if (workerPool) {
            result = await workerPool.runTask({
              sceneIndex: i,
              scene: sceneToRender,
              duration,
              assPath,
              config,
              outputPath: segmentPath,
              fallbackImagePath,
              fallbackAudioPath,
              paddingTime,
              hasAnyTransition,
              is3D: !!is3D
            });
          } else if (is3D) {
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
    } finally {
      if (workerPool) {
        workerPool.terminate();
        workerPool = null;
      }
    }

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



