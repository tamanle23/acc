import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import {
  FFmpegManager,
  Logger,
  AssetContext,
  FFmpegFilterGraph,
  SceneWorkerPool,
  FFISceneEngine,
  FFmpegExecutor,
  getMediaDuration,
  AudioDuckingDSP,
  type RenderContext,
} from '@acc/core';
import type { ResolvedStoryConfig, ResolvedSceneConfig, TransitionSettings } from '@acc/core/types';
import {
  LegacyStoryConfigAdapter,
  type LegacyStoryConfig,
  type ExtendedPipelineIR,
} from '@acc/ir';
import {
  EditingOpFactory,
  ColorGradingEngine,
  SafeZoneManager,
  generateAssContent,
  getSceneDuration,
  renderDepth3DScene,
} from '@acc/effect-engines';
import type { ExportOptions } from '@acc/exporters';
import { buildFfmpegEncodingFlags } from './platforms';
import { UpscalerPlugin } from './plugins/UpscalerPlugin';

const ffmpeg = FFmpegExecutor;

const BLACK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function createSilentMp3Buffer(seconds = 5): Buffer {
  const framesCount = Math.ceil(seconds * 38.28125);
  const frame = Buffer.alloc(417);
  frame[0] = 0xFF; frame[1] = 0xFB; frame[2] = 0x90; frame[3] = 0x04;
  return Buffer.concat(Array(framesCount).fill(frame));
}

function concatenateVideos(videoPaths: string[], outputPath: string): Promise<void> {
  const { FFIConcatMuxer } = require('@acc/core');
  return FFIConcatMuxer.concatenate(videoPaths, outputPath);
}

function concatenateWithTransitions(
  segments: { path: string; duration: number; transition?: TransitionSettings }[],
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
        options: '48000:async=1',
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
        tConfig = { enabled: true, type: 'fade', duration: 0.1, audioBehavior: 'crossfade' };
      }

      const tDur = tConfig.duration || 1.0;
      currentOffset -= tDur;

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

    const encodingFlags = buildFfmpegEncodingFlags(config.settings, currentOffset);

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

export interface PipelineExecutionOptions extends ExportOptions {
  enableColorGrading?: boolean;
  lutPath?: string;
  autoSafeZones?: boolean;
}

export class VideoEditPipelineOrchestrator {
  /**
   * Prepares and enriches ExtendedPipelineIR with safe-zone validation and NLE cut calculations.
   */
  public static prepareIR(
    storyConfig: LegacyStoryConfig,
    options: PipelineExecutionOptions = {}
  ): ExtendedPipelineIR {
    // 1. Adapter Pattern: Normalize legacy config into ExtendedPipelineIR v3.1 AST
    const ir = LegacyStoryConfigAdapter.adapt(storyConfig);

    // 2. Safe Zone Validation
    if (options.autoSafeZones !== false) {
      const platform = ir.settings.platform === 'tiktok' ? 'tiktok' : 'youtube';
      const margins = SafeZoneManager.getMargins(platform);

      // Enforce safe vertical margins on typography overlays
      for (const chunk of ir.extendedChunks) {
        for (const overlay of chunk.typographyOverlays) {
          if (overlay.type === 'dynamic_caption' && platform === 'tiktok') {
            overlay.stylePreset = 'tiktok';
          }
        }
      }
    }

    // 3. Strategy Factory Resolution for Cuts & Compositing
    for (const chunk of ir.extendedChunks) {
      const cutStrategy = EditingOpFactory.getCutStrategy(
        chunk.videoOffsetMs ? 'j_cut' : 'standard_cut'
      );
      const cutCalc = cutStrategy.calculateCut(chunk);

      chunk.metadata = {
        ...(chunk.metadata || {}),
        calculatedCut: cutCalc,
      };
    }

    return ir;
  }

  /**
   * Native Multi-Scene Rendering Engine: Worker pool, 3D depth, transitions, overlays, and BGM.
   */
  public static async renderStoryVideo(
    config: ResolvedStoryConfig,
    outputFilePath: string,
    baseDir: string = process.cwd()
  ): Promise<void> {
    await FFmpegManager.prepare();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-render-'));
    const { width, height, container, captions, concurrency } = config.settings;
    const totalScenes = config.scenes.length;
    const activeConcurrency = Math.max(1, Math.min(concurrency || 1, totalScenes));

    const renderContext: RenderContext = {
      config,
      assets: new AssetContext(),
      baseDir,
      cacheDir: path.join(baseDir, '.cache'),
      tempDir,
    };

    const plugins = [new UpscalerPlugin()];
    for (const plugin of plugins) {
      try {
        await plugin.execute(renderContext);
      } catch (e: any) {
        Logger.error('VideoEditPipelineOrchestrator', `Plugin ${plugin.name} fatally crashed: ${e.message}`);
      }
    }

    const fallbackImagePath = path.join(tempDir, '_fallback_black.png');
    fs.writeFileSync(fallbackImagePath, Buffer.from(BLACK_PNG_BASE64, 'base64'));

    const fallbackAudioPath = path.join(tempDir, '_fallback_silent.mp3');
    fs.writeFileSync(fallbackAudioPath, createSilentMp3Buffer(15));

    // Pre-warm AI daemon once in main thread to prevent worker port collisions
    const needsAI =
      config.scenes.some(
        s =>
          s.depth3d?.enabled &&
          (s.depth3d?.autoSegment ||
            s.depth3d?.autoDepth ||
            s.depth3d?.mode === 'frame_breaker' ||
            s.depth3d?.mode === 'volumetric_sandwich')
      ) || config.settings.captions?.autoTranscribe;

    if (needsAI) {
      try {
        Logger.info('VideoEditPipelineOrchestrator', '[Pipeline] Pre-warming AI Subsystem (SAM 2 & Depth Anything v2)...');
        const { defaultIPCFacade } = await import('@acc/core');
        await defaultIPCFacade.ensureDaemonRunning();
      } catch (err: any) {
        Logger.warn('VideoEditPipelineOrchestrator', `[Pipeline] Pre-warming error: ${err.message}`);
      }
    }

    try {
      Logger.info('VideoEditPipelineOrchestrator',
        `🚀 Starting scene rendering (${totalScenes} scenes, parallel workers: ${activeConcurrency})...`
      );

      const hasAnyTransition =
        config.scenes.some(s => s.transition?.enabled) || config.settings.transition?.enabled || false;

      let workerPool: SceneWorkerPool | null = null;
      if (activeConcurrency > 1) {
        try {
          workerPool = new SceneWorkerPool(activeConcurrency, FFmpegManager.getBinDir());
          await workerPool.initialize();
        } catch (err: any) {
          Logger.warn('VideoEditPipelineOrchestrator', `Worker pool initialization failed: ${err.message}. Running in main thread.`);
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
              const assContent = generateAssContent(scene.captions, captions, width, height, config.settings.platform as any);
              fs.writeFileSync(assPath, assContent, 'utf-8');
            }

            const segmentPath = path.join(tempDir, `scene_${i}.${container}`);
            const startTime = Date.now();

            let paddingTime = 0;

            // J-Cut / Split Edit offset support: ensure audio lead-in or video offset doesn't clip scene timing
            const videoOffsetMs = (scene as any).videoOffsetMs ?? 0;
            if (videoOffsetMs > 0) {
              paddingTime += videoOffsetMs / 1000;
            }

            const tConfig = scene.transition || config.settings.transition;
            const audioBehavior = tConfig?.audioBehavior ?? config.settings.transition?.audioBehavior ?? 'pad';
            if (tConfig?.enabled && i < totalScenes - 1) {
              const tDur = tConfig.duration || 1.0;
              if (audioBehavior === 'pad') {
                paddingTime += tDur;
              } else if (audioBehavior === 'crossfade') {
                const lastCaptionEnd = scene.captions?.length ? scene.captions[scene.captions.length - 1].end : 0;
                if (duration - tDur < lastCaptionEnd) {
                  paddingTime += Math.max(0, (lastCaptionEnd + 0.2) - (duration - tDur));
                }
              }
            }

            const pauseTime = scene.pauseAfter !== undefined ? scene.pauseAfter : (config.settings.pauseBetweenScenes || 0);
            if (pauseTime > 0 && i < totalScenes - 1) {
              paddingTime += pauseTime;
            }

            const currentImagePath =
              renderContext.assets.getPreferred(`scene_${i}`, ['image:upscaled', 'image:original']) || scene.resolvedImage;
            const sceneToRender = { ...scene, resolvedImage: currentImagePath };

            const depthConfig = sceneToRender.depth3d || config.settings.depth3d;
            const is3D = depthConfig?.enabled !== false && (depthConfig?.enabled || depthConfig?.mode);
            const modeName = depthConfig?.mode || 'frame_breaker';

            if (is3D) {
              Logger.info('VideoEditPipelineOrchestrator', `[Scene ${i + 1}/${totalScenes}] Rendering 3D Depth [${modeName}] (${(duration + paddingTime).toFixed(2)}s)...`);
            } else {
              Logger.info('VideoEditPipelineOrchestrator', `[Scene ${i + 1}/${totalScenes}] Rendering (duration: ${(duration + paddingTime).toFixed(2)}s)...`);
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
                is3D: !!is3D,
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
                  useHighQualityIntermediate: hasAnyTransition,
                });
              } catch (depthErr: any) {
                Logger.warn('VideoEditPipelineOrchestrator', `[Scene ${i + 1}/${totalScenes}] 3D Depth rendering failed: ${depthErr.message}. Falling back to 2D render.`);
                result = await FFISceneEngine.renderScene({
                  scene: sceneToRender,
                  duration,
                  assPath,
                  config,
                  outputPath: segmentPath,
                  fallbackImagePath,
                  fallbackAudioPath,
                  paddingTime,
                });
              }
            } else {
              result = await FFISceneEngine.renderScene({
                scene: sceneToRender,
                duration,
                assPath,
                config,
                outputPath: segmentPath,
                fallbackImagePath,
                fallbackAudioPath,
                paddingTime,
              });
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            Logger.info('VideoEditPipelineOrchestrator', `✓ [Scene ${i + 1}/${totalScenes}] Completed in ${elapsed}s`);

            return { path: result.path, duration: result.duration, transition: scene.transition };
          }
        );
      } finally {
        if (workerPool) {
          workerPool.terminate();
          workerPool = null;
        }
      }

      Logger.info('VideoEditPipelineOrchestrator', 'Concatenating scenes into final video...');

      let currentVideoPath = path.join(tempDir, 'concat_output.mp4');

      if (segments.length === 1) {
        fs.copyFileSync(segments[0].path, currentVideoPath);
      } else {
        if (hasAnyTransition && !config.settings.fastIntermediate) {
          Logger.info('VideoEditPipelineOrchestrator', 'Applying video transition filtergraph (xfade)...');
          await concatenateWithTransitions(segments, currentVideoPath, config);
        } else {
          Logger.info('VideoEditPipelineOrchestrator', 'Fast zero-copy stream concatenation (FFIConcatMuxer)...');
          await concatenateVideos(segments.map(s => s.path), currentVideoPath);
        }
      }

      // Check for Master Audio Track (audioTrack)
      if (config.settings.audioTrack && config.settings.audioTrack.source) {
        let masterAudioPath = config.settings.audioTrack.source;
        if (!path.isAbsolute(masterAudioPath)) {
          masterAudioPath = path.resolve(baseDir, masterAudioPath);
        }
        if (fs.existsSync(masterAudioPath)) {
          Logger.info('VideoEditPipelineOrchestrator', `=== Remuxing Master Voiceover Track: ${path.basename(masterAudioPath)} ===`);
          const masterVoicePath = path.join(tempDir, 'with_master_voice.mp4');
          const vol = config.settings.audioTrack.volume ?? 1.0;
          await new Promise<void>((resolve, reject) => {
            ffmpeg()
              .input(currentVideoPath)
              .input(masterAudioPath)
              .outputOptions([
                '-map 0:v:0',
                '-map 1:a:0',
                '-c:v copy',
                `-af volume=${vol}`,
                `-c:a ${config.settings.audioCodec}`,
                `-b:a ${config.settings.audioBitrate}`,
                '-shortest',
              ])
              .output(masterVoicePath)
              .on('end', () => resolve())
              .on('error', (err: any) => reject(new Error(`Failed to remux master voice track: ${err.message}`)))
              .run();
          });
          currentVideoPath = masterVoicePath;
        } else {
          Logger.warn('VideoEditPipelineOrchestrator', `Master audio track file not found at ${masterAudioPath}`);
        }
      }

      // Collect all SFX clips (global + per-scene with calculated offsets)
      const allSfxClips: Array<{ source: string; time: number; volume: number; duckBgm: boolean }> = [];
      if (config.settings.sfx && Array.isArray(config.settings.sfx)) {
        for (const clip of config.settings.sfx) {
          if (clip.source && fs.existsSync(clip.source)) {
            allSfxClips.push({
              source: clip.source,
              time: clip.time ?? 0,
              volume: clip.volume ?? 1.0,
              duckBgm: clip.duckBgm ?? true,
            });
          }
        }
      }

      let cumulativeSceneTime = 0;
      for (let i = 0; i < config.scenes.length; i++) {
        const sc = config.scenes[i];
        const segDuration = segments[i]?.duration ?? (sc.duration || 3);
        if (sc.sfx && Array.isArray(sc.sfx)) {
          for (const clip of sc.sfx) {
            let sfxPath = clip.source;
            if (!path.isAbsolute(sfxPath)) {
              sfxPath = path.resolve(baseDir, sfxPath);
            }
            if (fs.existsSync(sfxPath)) {
              allSfxClips.push({
                source: sfxPath,
                time: cumulativeSceneTime + (clip.time ?? 0),
                volume: clip.volume ?? 1.0,
                duckBgm: clip.duckBgm ?? true,
              });
            }
          }
        }
        cumulativeSceneTime += segDuration;
      }

      if (allSfxClips.length > 0) {
        Logger.info('VideoEditPipelineOrchestrator', `=== Mixing ${allSfxClips.length} Sound Effects (SFX) Track(s) ===`);
        const sfxMixedPath = path.join(tempDir, 'with_sfx.mp4');
        await new Promise<void>((resolve, reject) => {
          let sfxCmd = ffmpeg().input(currentVideoPath);
          allSfxClips.forEach(clip => {
            sfxCmd = sfxCmd.input(clip.source);
          });

          const sfxGraph = new FFmpegFilterGraph();
          const delayedSfxLabels: string[] = [];

          allSfxClips.forEach((clip, idx) => {
            const inputIdx = idx + 1;
            const delayMs = Math.round((clip.time || 0) * 1000);
            const delayedOut = sfxGraph.createStreamLabel(`sfx_d_${idx}`);
            sfxGraph.addNode({
              inputs: [`${inputIdx}:a`],
              filter: `volume=${clip.volume},adelay=${delayMs}|${delayMs}`,
              outputs: [delayedOut],
            });
            delayedSfxLabels.push(delayedOut);
          });

          const finalAudioOut = sfxGraph.createStreamLabel('a_sfx_mix');
          sfxGraph.addNode({
            inputs: ['0:a', ...delayedSfxLabels],
            filter: 'amix',
            options: {
              inputs: 1 + delayedSfxLabels.length,
              duration: 'first',
              dropout_transition: 2,
            },
            outputs: [finalAudioOut],
          });

          sfxCmd
            .complexFilter(sfxGraph.compile())
            .outputOptions([
              '-map 0:v',
              `-map ${finalAudioOut}`,
              '-c:v copy',
              `-c:a ${config.settings.audioCodec}`,
              `-b:a ${config.settings.audioBitrate}`,
            ])
            .output(sfxMixedPath)
            .on('end', () => resolve())
            .on('error', (err: any) => reject(new Error(`Failed to mix SFX: ${err.message}`)))
            .run();
        });
        currentVideoPath = sfxMixedPath;
        Logger.info('VideoEditPipelineOrchestrator', '✅ SFX mixing completed!');
      }


      if (config.settings.overlayComposite) {
        const nextVideoPath = path.join(tempDir, 'with_overlay.mp4');
        Logger.info('VideoEditPipelineOrchestrator', `\n=== Applying Overlay Composite: ${config.settings.overlayComposite} ===`);
        const { RegistryManager } = await import('@acc/core/Registry');
        const { renderEffectLayer } = await import('@acc/effect-engines/overlay-effects/engine');
        const { applyPolyrhythmicOverlays } = await import('@acc/effect-engines/overlay-effects/stacker');

        const registry = new RegistryManager();
        const compositeConfig = registry.getCompositeConfig(config.settings.overlayComposite);

        const outDir = path.join(baseDir, 'autogenerated', 'overlay-effects');
        Logger.info('VideoEditPipelineOrchestrator', `Generating/Fetching ${compositeConfig.layers.length} prime-duration layers...`);

        const renderPromises = compositeConfig.layers.map(layer => {
          return renderEffectLayer(registry, layer.effect, layer.variant, layer.duration, outDir);
        });
        const overlayPaths = await Promise.all(renderPromises);

        Logger.info('VideoEditPipelineOrchestrator', 'Stacking infinite polyrhythmic layers over the main video...');
        await applyPolyrhythmicOverlays(currentVideoPath, overlayPaths, nextVideoPath);
        Logger.info('VideoEditPipelineOrchestrator', '✅ Compositing completed successfully!');
        currentVideoPath = nextVideoPath;
      }

      if (config.settings.bgm) {
        const nextVideoPath = path.join(tempDir, 'with_bgm.mp4');
        Logger.info('VideoEditPipelineOrchestrator', `=== Applying Background Music ===`);
        await new Promise<void>((resolve, reject) => {
          const bgm = config.settings.bgm!;
          let bgmPath = path.isAbsolute(bgm.source) ? bgm.source : path.resolve(baseDir, bgm.source);
          if (!fs.existsSync(bgmPath)) {
            const candidate = path.resolve(baseDir, 'assets', path.basename(bgm.source));
            if (fs.existsSync(candidate)) {
              bgmPath = candidate;
            }
          }
          if (!fs.existsSync(bgmPath)) {
            Logger.warn('VideoEditPipelineOrchestrator', `[BGM] Background music file not found at ${bgmPath}. Skipping BGM.`);
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
            outputs: [bgmProcessed],
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
              outputs: [fgOut, fgSc],
            });

            const duckingCfg = (bgm as any).ducking || {};
            const duckThreshold = duckingCfg.threshold || (duckingCfg.attenuationDb !== undefined ? `${duckingCfg.attenuationDb}dB` : '-24dB');
            const duckRatio = duckingCfg.ratio || 5;
            const duckAttack = duckingCfg.attackMs || duckingCfg.attack || 10;
            const duckRelease = duckingCfg.releaseMs || duckingCfg.release || 300;

            bgmGraph.addNode({
              inputs: [bgmProcessed, fgSc],
              filter: 'sidechaincompress',
              options: {
                threshold: duckThreshold,
                ratio: duckRatio,
                attack: duckAttack,
                release: duckRelease,
              },
              outputs: [bgDucked],
            });

            bgmGraph.addNode({
              inputs: [fgOut, bgDucked],
              filter: 'amix',
              options: {
                inputs: 2,
                duration: 'first',
                dropout_transition: 2,
              },
              outputs: [aOut],
            });
          } else {
            bgmGraph.addNode({
              inputs: ['0:a', bgmProcessed],
              filter: 'amix',
              options: {
                inputs: 2,
                duration: 'first',
                dropout_transition: 2,
              },
              outputs: [aOut],
            });
          }

          Logger.info('VideoEditPipelineOrchestrator', `Mixing audio with volume ${volume}${isLoop ? ' (looped)' : ''}...`);
          command
            .complexFilter(bgmGraph.compile())
            .outputOptions([
              '-map 0:v',
              `-map ${aOut}`,
              '-c:v copy',
              `-c:a ${config.settings.audioCodec}`,
              `-b:a ${config.settings.audioBitrate}`,
              '-shortest',
            ])
            .output(nextVideoPath)
            .on('end', () => resolve())
            .on('error', (err, stdout, stderr) => {
              Logger.error('VideoEditPipelineOrchestrator', '[BGM] Background music mixing error:', err);
              reject(new Error(`${err.message}\nFFMPEG STDERR:\n${stderr}`));
            })
            .run();
        });
        Logger.info('VideoEditPipelineOrchestrator', '✅ Background Music applied successfully!');
        currentVideoPath = nextVideoPath;
      }

      await fs.promises.copyFile(currentVideoPath, outputFilePath);
    } finally {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch { }
    }
  }
}
