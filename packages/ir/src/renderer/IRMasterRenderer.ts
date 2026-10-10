import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, type Canvas, type SKRSContext2D, type Image } from '@napi-rs/canvas';
import type { ResolvedTimeline, ResolvedTrack, ResolvedSequence } from '../types/VideoIR';
import { FrameBackpressureLock } from './handshake/FrameBackpressureLock';
import { DeterministicNoiseGenerator } from './DeterministicNoiseGenerator';
import { DecoupledAudioMixer, type DecoupledAudioMixResult } from './audio/DecoupledAudioMixer';
import type { IIRFrameSink, SinkFinalizeResult } from './sink/IIRFrameSink';
import { ModifierPluginRegistry, registerCoreModifierPlugins, createIsolatedCoreModifierPlugins } from '../plugins';
import {
  BoundedAcousticCaptionStrategy,
  drawCanvasCaptionsFromSnapshot,
  type CaptionConfig,
  type CaptionSettings,
} from '@acc/effect-engines';
import { FFIVideoDecoder } from '@acc/core';

export interface HeadlessRenderOptions {
  sink?: IIRFrameSink;
  outputPath?: string;
  audioPath?: string;
  onProgress?: (progress: { currentFrame: number; totalFrames: number; percent: number }) => void;
  generateFrameHash?: boolean;
  baseDir?: string;
  chunkStart?: number;
  chunkEnd?: number;
  skipAudio?: boolean;
}

export interface HeadlessRenderResult {
  totalFrames: number;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  frameHashes?: string[];
  cumulativeHash: string;
  audioResult: DecoupledAudioMixResult;
  sinkResult?: SinkFinalizeResult;
}

/**
 * IRMasterRenderer:
 * Headless, deterministic rasterizer and timeline executor.
 * Advances discrete integer frames (t ∈ [0, N-1]) synchronously via backpressure locks,
 * evaluating seeded shaders, modifier plugins, and audio mixdown without wall-clock drift.
 * Feeds dual target sinks (FFIVideoEncoderSink or PreviewCanvasSink).
 */
export class IRMasterRenderer {
  private timeline: ResolvedTimeline;
  private noiseGen: DeterministicNoiseGenerator;
  private lock: FrameBackpressureLock;
  private audioMixer: DecoupledAudioMixer;
  private pluginRegistry: ModifierPluginRegistry;
  private captionStrategy: BoundedAcousticCaptionStrategy;
  private captionConfigCache: WeakMap<ResolvedSequence, CaptionConfig[]> = new WeakMap();

  // Cached assets to prevent disk re-reads in render loop
  private imageCache: Map<string, Image> = new Map();
  private videoDecoders: Map<string, FFIVideoDecoder> = new Map();

  constructor(timeline: ResolvedTimeline, seed: number = 42, pluginRegistry?: ModifierPluginRegistry) {
    this.timeline = timeline;
    this.noiseGen = new DeterministicNoiseGenerator(seed);
    this.lock = new FrameBackpressureLock();
    this.audioMixer = new DecoupledAudioMixer();
    // Use passed isolated registry or create an isolated one for deterministic multi-worker safety
    this.pluginRegistry = pluginRegistry ?? createIsolatedCoreModifierPlugins();
    this.captionStrategy = new BoundedAcousticCaptionStrategy();
  }

  /**
   * Pre-load static visual image assets declared in timeline.assets into memory.
   */
  public async preloadAssets(baseDir: string = '.'): Promise<void> {
    if (!this.timeline.assets) return;

    for (const [assetId, assetDef] of Object.entries(this.timeline.assets)) {
      if (assetDef.type === 'image' || assetDef.type === 'media') {
        const resolvedPath = path.isAbsolute(assetDef.src)
          ? assetDef.src
          : path.resolve(baseDir, assetDef.src);

        if (fs.existsSync(resolvedPath)) {
          try {
            const ext = path.extname(resolvedPath).toLowerCase();
            // Load if image format
            if (['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(ext)) {
              const img = await loadImage(resolvedPath);
              this.imageCache.set(assetId, img);
            } else if (['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext)) {
              const decoder = new FFIVideoDecoder(
                resolvedPath,
                this.timeline.meta.canvasSize.w,
                this.timeline.meta.canvasSize.h
              );
              if (await decoder.open()) {
                this.videoDecoders.set(assetId, decoder);
              }
            }
          } catch {
            // Non-critical, fallback to procedural rasterizer
          }
        }
      }
    }
  }

  /**
   * Renders the entire timeline deterministically.
   */
  public async render(options: HeadlessRenderOptions = {}): Promise<HeadlessRenderResult> {
    const totalFrames = this.timeline.totalFrames;
    const { w: width, h: height } = this.timeline.meta.canvasSize;
    const fps = this.timeline.meta.globalFps;
    const sink = options.sink;

    // Preload assets if baseDir provided or assets exist
    if (this.timeline.assets && this.imageCache.size === 0) {
      await this.preloadAssets(options.baseDir || '.');
    }

    // Pre-flight execution for all modifiers (e.g. Depth3D cutout pre-resolution, asset analysis)
    for (const track of this.timeline.tracks.values()) {
      if (track.modifiers) {
        for (const mod of track.modifiers) {
          const plugin = this.pluginRegistry.get(mod.type);
          if (plugin && plugin.execute) {
            await plugin.execute(
              {
                targetType: 'track',
                targetEntity: track,
                timeline: new Map(),
                fps,
                canvas: { width, height },
              },
              mod.params
            );
          }
        }
      }
      for (const seq of track.sequences) {
        if (seq.modifiers) {
          for (const mod of seq.modifiers) {
            const plugin = this.pluginRegistry.get(mod.type);
            if (plugin && plugin.execute) {
              await plugin.execute(
                {
                  targetType: 'sequence',
                  targetEntity: seq,
                  timeline: new Map(),
                  fps,
                  canvas: { width, height },
                },
                mod.params
              );
            }
          }
        }
      }
    }

    // 1. Decoupled Asynchronous Audio Mixdown
    let audioResult: DecoupledAudioMixResult = {
      sampleRate: 48000,
      channels: 2,
      totalSamples: 0,
      channelData: [new Float32Array(0), new Float32Array(0)],
    };
    let tempAudioWavPath: string | undefined;

    if (!options.skipAudio) {
      // If sink is active and no explicit audioPath was passed, pre-render mixed audio to temp WAV
      if (sink && !options.audioPath) {
        audioResult = await this.audioMixer.mix(this.timeline, { baseDir: options.baseDir });
        if (audioResult.totalSamples > 0) {
          const outDir = options.outputPath ? path.dirname(options.outputPath) : '.';
          tempAudioWavPath = path.resolve(outDir, `.temp_${Date.now()}_master_audio.wav`);
          await DecoupledAudioMixer.exportToWav(tempAudioWavPath, audioResult);
        }
      } else {
        audioResult = await this.audioMixer.mix(this.timeline, { baseDir: options.baseDir });
      }
    }

    const effectiveAudioPath = !options.skipAudio ? (options.audioPath || tempAudioWavPath) : undefined;

    // Initialize Sink if provided
    if (sink) {
      await sink.initialize({
        width,
        height,
        fps,
        totalFrames,
        durationSeconds: this.timeline.durationSeconds,
        outputPath: options.outputPath,
        audioPath: effectiveAudioPath,
      });
    }

    // 2. Discrete Frame-Step Scheduling (Zero Wall-Clock Dependency)
    const frameHashes: string[] = [];
    const hashAccumulator = crypto.createHash('sha256');

    // Pre-allocate single native-sized RGBA pixel buffer to guarantee ZERO-ALLOC-FRAME-LOOP
    const framePixelBuffer = new Uint8Array(width * height * 4);

    // Pre-allocate reusable 2D canvas & context for hardware/software blitting
    let canvas: Canvas | undefined;
    let canvasCtx: SKRSContext2D | undefined;
    if (this.imageCache.size > 0 || this.hasVisualTracks()) {
      canvas = createCanvas(width, height);
      canvasCtx = canvas.getContext('2d');
    }

    // Calculate frame loop bounds
    const startFrame = options.chunkStart !== undefined ? Math.max(0, options.chunkStart) : 0;
    const endFrame = options.chunkEnd !== undefined ? Math.min(totalFrames, options.chunkEnd) : totalFrames;
    const framesToRender = Math.max(0, endFrame - startFrame);

    for (let f = 0; f < framesToRender; f++) {
      const globalFrame = startFrame + f;

      // Synchronous backpressure acquire
      await this.lock.acquire(f);

      // Evaluate active sequences and procedural/visual rasterization for frame t
      if (canvas && canvasCtx) {
        await this.renderCanvasFrame(globalFrame, width, height, canvas, canvasCtx, framePixelBuffer);
      } else {
        this.rasterizeProceduralFrame(globalFrame, width, height, framePixelBuffer);
      }

      // Pass directly to frame sink (FFI Video Encoder or Preview Canvas)
      if (sink) {
        await sink.consumeFrame(f, framePixelBuffer);
      }

      // Compute cryptographic hash of rendered frame buffer for bit-identical reproducibility
      if (options.generateFrameHash) {
        const frameHash = crypto.createHash('sha256').update(framePixelBuffer).digest('hex');
        frameHashes.push(frameHash);
        hashAccumulator.update(frameHash);
      }

      // Simulate instantaneous consumer consumption ack
      this.lock.acknowledge(f);

      if (options.onProgress && (f % 30 === 0 || f === framesToRender - 1)) {
        options.onProgress({
          currentFrame: f + 1,
          totalFrames: framesToRender,
          percent: parseFloat((((f + 1) / framesToRender) * 100).toFixed(1)),
        });
      }
    }

    const cumulativeHash = hashAccumulator.digest('hex');

    // Finalize Sink
    let sinkResult: SinkFinalizeResult | undefined;
    if (sink) {
      sinkResult = await sink.finalize(audioResult);
    }

    // Clean up temporary audio file if generated
    if (tempAudioWavPath && fs.existsSync(tempAudioWavPath)) {
      try {
        await fs.promises.unlink(tempAudioWavPath);
      } catch {
        // Ignored
      }
    }

    // Close all open video decoders
    for (const decoder of this.videoDecoders.values()) {
      try {
        decoder.close();
      } catch {}
    }
    this.videoDecoders.clear();

    return {
      totalFrames: framesToRender,
      durationSeconds: framesToRender > 0 ? parseFloat((framesToRender / fps).toFixed(3)) : 0,
      width,
      height,
      fps,
      frameHashes: options.generateFrameHash ? frameHashes : undefined,
      cumulativeHash,
      audioResult,
      sinkResult,
    };
  }

  private hasVisualTracks(): boolean {
    for (const track of this.timeline.tracks.values()) {
      if (track.type === 'video' || track.type === 'timed_text') {
        return true;
      }
    }
    return false;
  }

  /**
   * Zero-Allocation Frame Loop:
   * Composites active visual and timed-text layers onto reusable canvas and copies raw bytes into preallocated buffer.
   */
  private async renderCanvasFrame(
    t: number,
    width: number,
    height: number,
    canvas: Canvas,
    ctx: SKRSContext2D,
    buffer: Uint8Array
  ): Promise<void> {
    // Clear canvas
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // 1. Render Video Tracks (Phase 2 & Phase 3)
    for (const track of this.timeline.tracks.values()) {
      if (track.type === 'video') {
        const activeSeqs: ResolvedSequence[] = [];
        for (const seq of track.sequences) {
          if (t >= seq.startFrame && t < seq.endFrame) {
            activeSeqs.push(seq);
            const localFrame = t - seq.startFrame;

            // Phase 2: Sequence-level modifiers (e.g. Depth3D, TransitionCrossfade)
            ctx.save();
            try {
              if (seq.modifiers) {
                for (const mod of seq.modifiers) {
                  const plugin = this.pluginRegistry.get(mod.type);
                  if (plugin && plugin.renderClipSpace) {
                    plugin.renderClipSpace(
                      {
                        canvas,
                        ctx,
                        frame: t,
                        localFrame,
                        width,
                        height,
                        sequence: seq,
                        baseAsset: seq.assetId ? this.imageCache.get(seq.assetId) : undefined,
                      },
                      mod.params
                    );
                  }
                }
              }

              const hasDepth3DModifier = seq.modifiers?.some(m => m.type === 'vfx/depth3d');

              // Draw base asset if available and not already drawn by specialized 3D depth modifier
              if (!hasDepth3DModifier && seq.assetId) {
                let frameSource: Canvas | Image | null = null;
                if (this.videoDecoders.has(seq.assetId)) {
                  frameSource = await this.videoDecoders.get(seq.assetId)!.readNextFrame();
                } else if (this.imageCache.has(seq.assetId)) {
                  frameSource = this.imageCache.get(seq.assetId)!;
                }

                if (frameSource) {
                  const srcAspect = frameSource.width / frameSource.height;
                  const canvasAspect = width / height;
                  let drawW = width;
                  let drawH = height;
                  let drawX = 0;
                  let drawY = 0;

                  if (srcAspect > canvasAspect) {
                    drawW = width;
                    drawH = width / srcAspect;
                    drawY = (height - drawH) / 2;
                  } else {
                    drawH = height;
                    drawW = height * srcAspect;
                    drawX = (width - drawW) / 2;
                  }

                  ctx.drawImage(frameSource, drawX, drawY, drawW, drawH);
                }
              }
            } finally {
              ctx.restore();
            }
          }
        }

        // Phase 3: Track-level stream modifiers (e.g. CanvasParticleOverlay)
        if (track.modifiers) {
          for (const mod of track.modifiers) {
            const plugin = this.pluginRegistry.get(mod.type);
            if (plugin && plugin.renderStreamSpace) {
              plugin.renderStreamSpace(
                {
                  canvas,
                  ctx,
                  frame: t,
                  width,
                  height,
                  track,
                  activeSequences: activeSeqs,
                },
                mod.params
              );
            }
          }
        }
      } else if (track.type === 'timed_text') {
        // Render Subtitles / Captions with Karaoke Active Word Highlighting
        const captionSettings = track.style as CaptionSettings | undefined;

        for (const seq of track.sequences) {
          if (t >= seq.startFrame && t < seq.endFrame && seq.cues && seq.cues.length > 0) {
            // Retrieve cached CaptionConfig array to guarantee ZERO-ALLOC-FRAME-LOOP
            let captionConfigs = this.captionConfigCache.get(seq);
            if (!captionConfigs) {
              captionConfigs = seq.cues.map(c => ({
                text: c.text,
                start: c.startOffsetMs / 1000,
                end: c.endOffsetMs === 'end' ? (seq.durationFrames / this.timeline.meta.globalFps) : (c.endOffsetMs / 1000),
              }));
              this.captionConfigCache.set(seq, captionConfigs);
            }

            const localTimeSec = (t - seq.startFrame) / this.timeline.meta.globalFps;
            const snapshot = this.captionStrategy.evaluate(captionConfigs, localTimeSec, captionSettings);

            if (snapshot.shouldRender) {
              drawCanvasCaptionsFromSnapshot(ctx, snapshot, captionSettings, width, height);
            }
          }
        }
      }
    }

    // Phase 4: Master Canvas Composite
    for (const track of this.timeline.tracks.values()) {
      if (track.modifiers) {
        for (const mod of track.modifiers) {
          const plugin = this.pluginRegistry.get(mod.type);
          if (plugin && plugin.renderMasterComposite) {
            plugin.renderMasterComposite(
              {
                canvas,
                ctx,
                frame: t,
                width,
                height,
                pixelBuffer: buffer,
              },
              mod.params
            );
          }
        }
      }
    }

    // Copy into preallocated framePixelBuffer directly to preserve ZERO-ALLOC-FRAME-LOOP
    buffer.set(canvas.data());
  }

  private rasterizeProceduralFrame(t: number, width: number, height: number, buffer: Uint8Array): void {
    // Generate seeded procedural noise for frame t
    const noiseVal = this.noiseGen.sample1D(t, 1, 0.5);
    const pixelByte = Math.floor(Math.abs(noiseVal) * 255) & 255;

    // Fill buffer with deterministic pattern (reusable memory loop)
    // To ensure zero allocation, we mutate buffer in-place
    buffer.fill(pixelByte);
  }
}
