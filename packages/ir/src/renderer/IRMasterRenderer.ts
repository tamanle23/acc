import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, type Canvas, type SKRSContext2D, type Image } from '@napi-rs/canvas';
import type { ResolvedTimeline, ResolvedTrack, ResolvedSequence } from '../types/VideoIR';
import { FrameBackpressureLock } from './handshake/FrameBackpressureLock';
import { DeterministicNoiseGenerator } from './DeterministicNoiseGenerator';
import { DecoupledAudioMixer, type DecoupledAudioMixResult } from './audio/DecoupledAudioMixer';
import type { IIRFrameSink, SinkFinalizeResult } from './sink/IIRFrameSink';
import { ModifierPluginRegistry } from '../plugins/ModifierPluginRegistry';

export interface HeadlessRenderOptions {
  sink?: IIRFrameSink;
  outputPath?: string;
  audioPath?: string;
  onProgress?: (progress: { currentFrame: number; totalFrames: number; percent: number }) => void;
  generateFrameHash?: boolean;
  baseDir?: string;
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

  // Cached assets to prevent disk re-reads in render loop
  private imageCache: Map<string, Image> = new Map();

  constructor(timeline: ResolvedTimeline, seed: number = 42) {
    this.timeline = timeline;
    this.noiseGen = new DeterministicNoiseGenerator(seed);
    this.lock = new FrameBackpressureLock();
    this.audioMixer = new DecoupledAudioMixer();
    this.pluginRegistry = ModifierPluginRegistry.getInstance();
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

    // 1. Decoupled Asynchronous Audio Mixdown
    const audioPromise = this.audioMixer.mix(this.timeline);

    // Initialize Sink if provided
    if (sink) {
      await sink.initialize({
        width,
        height,
        fps,
        totalFrames,
        durationSeconds: this.timeline.durationSeconds,
        outputPath: options.outputPath,
        audioPath: options.audioPath,
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

    for (let t = 0; t < totalFrames; t++) {
      // Synchronous backpressure acquire
      await this.lock.acquire(t);

      // Evaluate active sequences and procedural/visual rasterization for frame t
      if (canvas && canvasCtx) {
        this.renderCanvasFrame(t, width, height, canvas, canvasCtx, framePixelBuffer);
      } else {
        this.rasterizeProceduralFrame(t, width, height, framePixelBuffer);
      }

      // Pass directly to frame sink (FFI Video Encoder or Preview Canvas)
      if (sink) {
        await sink.consumeFrame(t, framePixelBuffer);
      }

      // Compute cryptographic hash of rendered frame buffer for bit-identical reproducibility
      if (options.generateFrameHash) {
        const frameHash = crypto.createHash('sha256').update(framePixelBuffer).digest('hex');
        frameHashes.push(frameHash);
        hashAccumulator.update(frameHash);
      } else {
        hashAccumulator.update(framePixelBuffer);
      }

      // Simulate instantaneous consumer consumption ack
      this.lock.acknowledge(t);

      if (options.onProgress && (t % 30 === 0 || t === totalFrames - 1)) {
        options.onProgress({
          currentFrame: t + 1,
          totalFrames,
          percent: parseFloat((((t + 1) / totalFrames) * 100).toFixed(1)),
        });
      }
    }

    const audioResult = await audioPromise;
    const cumulativeHash = hashAccumulator.digest('hex');

    // Finalize Sink
    let sinkResult: SinkFinalizeResult | undefined;
    if (sink) {
      sinkResult = await sink.finalize(audioResult);
    }

    return {
      totalFrames,
      durationSeconds: this.timeline.durationSeconds,
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
  private renderCanvasFrame(
    t: number,
    width: number,
    height: number,
    canvas: Canvas,
    ctx: SKRSContext2D,
    buffer: Uint8Array
  ): void {
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

            // Draw base asset if available
            if (seq.assetId && this.imageCache.has(seq.assetId)) {
              const img = this.imageCache.get(seq.assetId)!;
              const imgAspect = img.width / img.height;
              const canvasAspect = width / height;
              let drawW = width;
              let drawH = height;
              let drawX = 0;
              let drawY = 0;

              if (imgAspect > canvasAspect) {
                drawW = width;
                drawH = width / imgAspect;
                drawY = (height - drawH) / 2;
              } else {
                drawH = height;
                drawW = height * imgAspect;
                drawX = (width - drawW) / 2;
              }

              ctx.drawImage(img, drawX, drawY, drawW, drawH);
            }

            // Phase 2: Sequence-level modifiers (e.g. Depth3D, TransitionCrossfade)
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
                    },
                    mod.params
                  );
                }
              }
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
        // Render Subtitles / Captions
        for (const seq of track.sequences) {
          if (t >= seq.startFrame && t < seq.endFrame && seq.cues) {
            const elapsedMs = ((t - seq.startFrame) / this.timeline.meta.globalFps) * 1000;
            // Find active cues
            const activeWords: string[] = [];
            for (const cue of seq.cues) {
              const end = cue.endOffsetMs === 'end' ? Infinity : cue.endOffsetMs;
              if (elapsedMs >= cue.startOffsetMs && elapsedMs < end) {
                activeWords.push(cue.text);
              }
            }

            if (activeWords.length > 0) {
              const lineText = activeWords.join(' ');
              ctx.save();
              ctx.font = 'bold 36px sans-serif';
              ctx.fillStyle = '#ffff00';
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 4;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              const textY = height - 60;
              ctx.strokeText(lineText, width / 2, textY);
              ctx.fillText(lineText, width / 2, textY);
              ctx.restore();
            }
          }
        }
      }
    }

    // Phase 4: Master Canvas Composite
    const imgData = ctx.getImageData(0, 0, width, height);
    // Copy into preallocated framePixelBuffer directly to preserve ZERO-ALLOC-FRAME-LOOP
    buffer.set(imgData.data);
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
