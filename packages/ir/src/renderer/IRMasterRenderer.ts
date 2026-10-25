import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { ResolvedTimeline, ResolvedTrack, ResolvedSequence } from '../types/VideoIR';
import { FrameBackpressureLock } from './handshake/FrameBackpressureLock';
import { DeterministicNoiseGenerator } from './DeterministicNoiseGenerator';
import {
  UniversalAudioMixer,
  type DecoupledAudioMixResult,
} from './audio/UniversalAudioMixer';
import type { IIRFrameSink, SinkFinalizeResult } from './sink/IIRFrameSink';
import { ModifierPluginRegistry, registerCoreModifierPlugins, createIsolatedCoreModifierPlugins } from '../plugins';
import { UniversalCanvasProvider, CanvasAssetLoader } from '@acc/core-isomorphic';
import { MediaEngineRegistry, type IVideoDecoder, type MediaEngineType } from '@acc/core-isomorphic';
import { IRCanvasCompositor, type IAssetSourceResolver } from './shared/IRCanvasCompositor';

export interface HeadlessRenderOptions {
  engine?: MediaEngineType;
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
  private audioMixer: UniversalAudioMixer;
  private pluginRegistry: ModifierPluginRegistry;

  // Cached assets to prevent disk re-reads in render loop
  private imageCache: Map<string, any> = new Map();
  private videoDecoders: Map<string, IVideoDecoder> = new Map();

  constructor(timeline: ResolvedTimeline, seed: number = 42, pluginRegistry?: ModifierPluginRegistry) {
    this.timeline = timeline;
    this.noiseGen = new DeterministicNoiseGenerator(seed);
    this.lock = new FrameBackpressureLock();
    this.audioMixer = new UniversalAudioMixer([], 48000);
    // Use passed isolated registry or create an isolated one for deterministic multi-worker safety
    this.pluginRegistry = pluginRegistry ?? createIsolatedCoreModifierPlugins();
  }


  /**
   * Pre-load static visual image assets declared in timeline.assets into memory.
   */
  public async preloadAssets(baseDir: string = '.', engineType?: MediaEngineType): Promise<void> {
    if (!this.timeline.assets) return;

    let strategy: any;
    try {
      strategy = MediaEngineRegistry.has(engineType)
        ? MediaEngineRegistry.get(engineType)
        : (MediaEngineRegistry.has('bun-ffi') ? MediaEngineRegistry.get('bun-ffi') : undefined);
    } catch {
      // Strategy not available or prerequisites (e.g. FFmpegManager) not initialized in lightweight test
      strategy = undefined;
    }

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
              const img = await CanvasAssetLoader.loadImage(resolvedPath);
              this.imageCache.set(assetId, img);
            } else if (['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext)) {
              if (strategy && typeof strategy.createVideoDecoder === 'function') {
                const decoder = strategy.createVideoDecoder(
                  resolvedPath,
                  this.timeline.meta.canvasSize.w,
                  this.timeline.meta.canvasSize.h
                );
                if (await decoder.open()) {
                  this.videoDecoders.set(assetId, decoder);
                }
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
        audioResult = await this.audioMixer.mixTimeline(this.timeline, { baseDir: options.baseDir });
        if (audioResult.totalSamples > 0) {
          const outDir = options.outputPath ? path.dirname(options.outputPath) : '.';
          tempAudioWavPath = path.resolve(outDir, `.temp_${Date.now()}_master_audio.wav`);
          await UniversalAudioMixer.exportToWav(tempAudioWavPath, audioResult);
        }
      } else {
        audioResult = await this.audioMixer.mixTimeline(this.timeline, { baseDir: options.baseDir });
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
    let canvasInstance: any | undefined;
    let canvas: any | undefined;
    let canvasCtx: any | undefined;
    if (this.imageCache.size > 0 || this.hasVisualTracks()) {
      canvasInstance = UniversalCanvasProvider.createCanvas(width, height);
      canvas = canvasInstance.getRawCanvas ? canvasInstance.getRawCanvas() : canvasInstance;
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
   * Delegates directly to the canonical IRCanvasCompositor.
   */
  private async renderCanvasFrame(
    t: number,
    width: number,
    height: number,
    canvas: any,
    ctx: any,
    buffer: Uint8Array
  ): Promise<void> {
    // 1. Asynchronously pre-fetch next frame from active video decoders if required
    const activeVideoFrames = new Map<string, any>();
    for (const [assetId, decoder] of this.videoDecoders) {
      try {
        const frame = await decoder.readNextFrame();
        if (frame) {
          activeVideoFrames.set(assetId, frame);
        }
      } catch {}
    }

    // 2. Build asset source resolver combining static imageCache and dynamic activeVideoFrames
    const assetResolver: IAssetSourceResolver = {
      has: (id: string) => activeVideoFrames.has(id) || this.imageCache.has(id),
      get: (id: string) => activeVideoFrames.get(id) || this.imageCache.get(id),
    };

    // 3. Delegate to canonical IRCanvasCompositor with 'master' execution profile
    IRCanvasCompositor.renderFrame(ctx, this.timeline, t, {
      pluginRegistry: this.pluginRegistry,
      assetResolver,
      clearColor: '#000000',
      executionProfile: 'master',
      generatePixelBuffer: buffer,
    });
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
