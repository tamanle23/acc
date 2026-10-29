import type { ResolvedTimeline, ResolvedTrack, ResolvedSequence } from '../types/VideoIR';
import { FrameBackpressureLock } from './handshake/FrameBackpressureLock';
import { DeterministicNoiseGenerator } from './DeterministicNoiseGenerator';
import {
  UniversalAudioMixer,
  type DecoupledAudioMixResult,
} from './audio/UniversalAudioMixer';
import type { IIRFrameSink, SinkFinalizeResult } from './sink/IIRFrameSink';
import { ModifierPluginRegistry, registerCoreModifierPlugins, createIsolatedCoreModifierPlugins } from '../plugins';
import {
  UniversalCanvasProvider,
  CanvasAssetLoader,
  ContentCacheRegistry,
  CacheNamespace,
  NativeResourceManager,
  AssetProtocolRegistry,
} from '@acc/core-isomorphic';
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
  maxMemoryMb?: number;
  signal?: AbortSignal;
  yieldInterval?: number;
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
 * Pure isomorphic path utilities replacing Node.js path module.
 */
function isAbsolutePath(p: string): boolean {
  return (
    p.startsWith('/') ||
    p.startsWith('http://') ||
    p.startsWith('https://') ||
    p.startsWith('data:') ||
    p.startsWith('blob:') ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(p) ||
    /^[a-zA-Z]:[\\/]/.test(p) ||
    p.startsWith('\\\\')
  );
}

function resolveAssetPath(baseDir: string, src: string): string {
  if (isAbsolutePath(src)) {
    return src;
  }
  const cleanBase = (baseDir || '.').replace(/[\\/]+$/, '');
  const cleanSrc = src.replace(/^[\\/]+/, '');
  return `${cleanBase}/${cleanSrc}`;
}

function getFileExtension(filePath: string): string {
  const clean = filePath.split('?')[0].split('#')[0];
  const lastDot = clean.lastIndexOf('.');
  if (lastDot === -1) return '';
  return clean.slice(lastDot).toLowerCase();
}

function getDirectoryPath(filePath: string): string {
  const clean = filePath.replace(/[\\/]+$/, '');
  const idx = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  if (idx <= 0) return idx === 0 ? '/' : '.';
  return clean.slice(0, idx);
}

/**
 * Universal SHA-256 Frame and Timeline Hasher.
 * Dynamically resolves Node crypto or WebCrypto to ensure zero static Node imports.
 */
class UniversalHasher {
  private nodeHash: any | null = null;
  private chunks: (Uint8Array | string)[] = [];

  public static async create(): Promise<UniversalHasher> {
    const hasher = new UniversalHasher();
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).process?.versions?.node) {
        const cryptoModule = await import('crypto');
        if (cryptoModule && typeof cryptoModule.createHash === 'function') {
          hasher.nodeHash = cryptoModule.createHash('sha256');
        }
      }
    } catch {
      hasher.nodeHash = null;
    }
    return hasher;
  }

  public update(data: Uint8Array | string): void {
    if (this.nodeHash) {
      this.nodeHash.update(data);
    } else {
      this.chunks.push(typeof data === 'string' ? data : new Uint8Array(data));
    }
  }

  public async digest(): Promise<string> {
    if (this.nodeHash) {
      return this.nodeHash.digest('hex');
    }
    let totalLength = 0;
    const uint8Chunks: Uint8Array[] = [];
    for (const chunk of this.chunks) {
      const u8 = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
      uint8Chunks.push(u8);
      totalLength += u8.byteLength;
    }
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const u8 of uint8Chunks) {
      combined.set(u8, offset);
      offset += u8.byteLength;
    }
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', combined);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

/**
 * IRMasterRenderer:
 * Headless, deterministic rasterizer and timeline executor.
 * Advances discrete integer frames (t ∈ [0, N-1]) synchronously via backpressure locks,
 * evaluating seeded shaders, modifier plugins, and audio mixdown without wall-clock drift.
 * Feeds dual target sinks (FFIVideoEncoderSink or PreviewCanvasSink).
 * Pure isomorphic TS with zero static fs or path dependencies.
 */
export class IRMasterRenderer implements Disposable {
  private timeline: ResolvedTimeline;
  private noiseGen: DeterministicNoiseGenerator;
  private lock: FrameBackpressureLock;
  private audioMixer: UniversalAudioMixer;
  private pluginRegistry: ModifierPluginRegistry;
  private resourceManager: NativeResourceManager;

  // Cached assets to prevent disk/network re-reads in render loop
  private imageCache: Map<string, any> = new Map();
  private videoDecoders: Map<string, IVideoDecoder> = new Map();

  // Lookahead asset lifespan tracking for sliding hybrid sequence eviction
  private assetLastEndFrame: Map<string, number> = new Map();
  private sequencesByAssetKey: Map<string, ResolvedSequence[]> = new Map();
  private evictedAssetKeys: Set<string> = new Set();

  constructor(
    timeline: ResolvedTimeline,
    seed: number = 42,
    pluginRegistry?: ModifierPluginRegistry,
    resourceManager?: NativeResourceManager
  ) {
    this.timeline = timeline;
    this.noiseGen = new DeterministicNoiseGenerator(seed);
    this.lock = new FrameBackpressureLock();
    this.audioMixer = new UniversalAudioMixer([], 48000);
    // Use passed isolated registry or create an isolated one for deterministic multi-worker safety
    this.pluginRegistry = pluginRegistry ?? createIsolatedCoreModifierPlugins();
    this.resourceManager = resourceManager ?? NativeResourceManager.getInstance();
    this.computeAssetLifespans();
  }

  public getResourceManager(): NativeResourceManager {
    return this.resourceManager;
  }

  public getAudioMixer(): UniversalAudioMixer {
    return this.audioMixer;
  }

  /**
   * Computes the canonical asset key for a sequence to identify shared asset reuse across cuts.
   */
  private getSequenceAssetKey(seq: ResolvedSequence): string {
    return seq.assetId || (seq as any).src || seq.id;
  }

  /**
   * Scans the timeline to map each asset/cache key to the final frame it is referenced on.
   * Enables deterministic sliding eviction as soon as an asset's final sequence completes.
   */
  private computeAssetLifespans(): void {
    this.assetLastEndFrame.clear();
    this.sequencesByAssetKey.clear();

    for (const track of this.timeline.tracks.values()) {
      if ((track as any).muted === true || (track.style as any)?.visible === false) {
        continue;
      }
      for (const seq of track.sequences) {
        if ((seq as any).enabled === false) continue;
        const key = this.getSequenceAssetKey(seq);
        const prevMax = this.assetLastEndFrame.get(key) ?? 0;
        if (seq.endFrame > prevMax) {
          this.assetLastEndFrame.set(key, seq.endFrame);
        }
        let list = this.sequencesByAssetKey.get(key);
        if (!list) {
          list = [];
          this.sequencesByAssetKey.set(key, list);
        }
        list.push(seq);
      }
    }
  }

  /**
   * Sliding Hybrid Sequence Scope Eviction:
   * Immediately disposes a sequence's SequenceResourceScope when its out-point passes,
   * unless a subsequent sequence on the timeline shares the exact same asset key.
   */
  private evictExpiredSequences(completedFrame: number): void {
    const nextFrame = completedFrame + 1;

    for (const track of this.timeline.tracks.values()) {
      for (const seq of track.sequences) {
        if (nextFrame >= seq.endFrame) {
          const assetKey = this.getSequenceAssetKey(seq);
          if (this.evictedAssetKeys.has(assetKey)) {
            continue;
          }

          const lastReferencedFrame = this.assetLastEndFrame.get(assetKey) ?? seq.endFrame;
          if (nextFrame >= lastReferencedFrame) {
            // No future sequence on the timeline references this asset key -> evict all sibling scopes
            this.evictedAssetKeys.add(assetKey);
            const siblings = this.sequencesByAssetKey.get(assetKey) || [seq];
            for (const s of siblings) {
              this.resourceManager.disposeSequenceScope(s.id);
              if (this.resourceManager !== NativeResourceManager.getInstance()) {
                NativeResourceManager.getInstance().disposeSequenceScope(s.id);
              }
            }

            if (seq.assetId && this.imageCache.has(seq.assetId)) {
              const img = this.imageCache.get(seq.assetId);
              this.imageCache.delete(seq.assetId);
              if (img && typeof img.close === 'function') {
                try {
                  img.close();
                } catch {}
              }
            }

            if (seq.assetId && this.videoDecoders.has(seq.assetId)) {
              const dec = this.videoDecoders.get(seq.assetId);
              this.videoDecoders.delete(seq.assetId);
              if (dec) {
                try {
                  dec.close();
                } catch {}
              }
            }
          }
        }
      }
    }
  }

  /**
   * Pre-load static visual image assets declared in timeline.assets into memory.
   * Utilizes Universal Content Cache Registry (ContentCacheRegistry) to verify and cache asset buffers.
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

    const cache = ContentCacheRegistry.namespace(CacheNamespace.Assets);
    const protocolRegistry = AssetProtocolRegistry.getInstance();

    for (const [assetId, assetDef] of Object.entries(this.timeline.assets)) {
      if (assetDef.type === 'image' || assetDef.type === 'video') {
        const rawSrc = assetDef.src || assetId;
        const resolvedPath = resolveAssetPath(baseDir, rawSrc);
        const ext = getFileExtension(resolvedPath);

        let assetExists = (await cache.has(resolvedPath)) || (await cache.has(assetId));
        let cachedBytes: Uint8Array | null = null;

        if (assetExists) {
          const cachedVal = (await cache.get(resolvedPath)) || (await cache.get(assetId));
          if (cachedVal instanceof Blob) {
            cachedBytes = new Uint8Array(await cachedVal.arrayBuffer());
          } else if (cachedVal instanceof Uint8Array) {
            cachedBytes = cachedVal;
          }
        } else {
          // Resolve transparently via isomorphic AssetProtocolRegistry (supports http:, blob:, data:, cache:, file:)
          try {
            const assetBlob = protocolRegistry.resolve(rawSrc, baseDir);
            const blobData = await assetBlob.blob();
            if (blobData && blobData.size > 0) {
              cachedBytes = new Uint8Array(await blobData.arrayBuffer());
              assetExists = true;
              await cache.set(resolvedPath, blobData);
            }
          } catch {
            if (typeof process !== 'undefined' && process.versions?.node) {
              try {
                const fsModule = await import('fs');
                if (fsModule.existsSync(resolvedPath)) {
                  assetExists = true;
                }
              } catch {
                assetExists = false;
              }
            }
          }
        }

        if (assetExists || isAbsolutePath(resolvedPath)) {
          try {
            // Load if image format
            if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.svg'].includes(ext) || assetDef.type === 'image') {
              const imageSource = cachedBytes || resolvedPath;
              const img = await CanvasAssetLoader.loadImage(imageSource);
              this.imageCache.set(assetId, img);
            } else if (['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext) || assetDef.type === 'video') {
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

    // Configure dynamic resolution-aware native GPU/heap memory ceiling
    const budgetBytes = NativeResourceManager.computeResolutionBudgetBytes(
      width,
      height,
      options.maxMemoryMb
    );
    this.resourceManager.setMaxGpuBytes(budgetBytes);
    if (this.resourceManager !== NativeResourceManager.getInstance()) {
      NativeResourceManager.getInstance().setMaxGpuBytes(budgetBytes);
    }

    // Recompute lookahead lifespans for current timeline state
    this.computeAssetLifespans();
    this.evictedAssetKeys.clear();

    // Calculate frame loop bounds
    const startFrame = options.chunkStart !== undefined ? Math.max(0, options.chunkStart) : 0;
    const endFrame = options.chunkEnd !== undefined ? Math.min(totalFrames, options.chunkEnd) : totalFrames;
    const framesToRender = Math.max(0, endFrame - startFrame);

    // Preload assets if baseDir provided or assets exist
    if (this.timeline.assets && this.imageCache.size === 0) {
      await this.preloadAssets(options.baseDir || '.');
    }

    // Pre-flight execution for track-level and sequence-level modifiers
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
                assets: this.timeline.assets,
              },
              mod.params
            );
          }
        }
      }
      for (const seq of track.sequences) {
        if (seq.endFrame <= startFrame || seq.startFrame >= endFrame) continue;
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
                  assets: this.timeline.assets,
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
          const outDir = options.outputPath ? getDirectoryPath(options.outputPath) : '.';
          tempAudioWavPath = `${outDir.replace(/[\\/]+$/, '')}/.temp_${Date.now()}_master_audio.wav`;
          await UniversalAudioMixer.exportToWav(tempAudioWavPath, audioResult);

          // Store mixed audio buffer into Universal Content Cache Registry
          try {
            const wavBytes = UniversalAudioMixer.encodeToWav(audioResult);
            const audioCache = ContentCacheRegistry.namespace(CacheNamespace.Audio);
            await audioCache.set(tempAudioWavPath, new Blob([wavBytes as any], { type: 'audio/wav' }), {
              mimeType: 'audio/wav',
              sizeBytes: wavBytes.byteLength,
            });
          } catch {
            // Non-critical cache persistence
          }
        }
      } else {
        audioResult = await this.audioMixer.mixTimeline(this.timeline, { baseDir: options.baseDir });
      }
    }

    const effectiveAudioPath = !options.skipAudio ? (options.audioPath || tempAudioWavPath) : undefined;

    // Initialize Sink if provided and not already initialized by caller
    if (sink) {
      const isAlreadyInit = typeof (sink as any).isInitialized === 'function'
        ? (sink as any).isInitialized()
        : Boolean((sink as any).output);

      if (!isAlreadyInit) {
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
    }

    // 2. Discrete Frame-Step Scheduling (Zero Wall-Clock Dependency)
    const frameHashes: string[] = [];
    const hashAccumulator = await UniversalHasher.create();

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

    const yieldInterval = options.yieldInterval ?? 5;
    let actualFramesConsumed = 0;

    for (let f = 0; f < framesToRender; f++) {
      if (options.signal?.aborted) {
        break;
      }

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
      actualFramesConsumed++;

      // Compute cryptographic hash of rendered frame buffer for bit-identical reproducibility
      if (options.generateFrameHash) {
        const frameHasher = await UniversalHasher.create();
        frameHasher.update(framePixelBuffer);
        const frameHash = await frameHasher.digest();
        frameHashes.push(frameHash);
        hashAccumulator.update(frameHash);
      }

      // Sliding Hybrid Eviction: free SequenceResourceScopes whose out-point has passed without downstream reuse
      this.evictExpiredSequences(globalFrame);

      // Simulate instantaneous consumer consumption ack
      this.lock.acknowledge(f);

      if (options.onProgress && (f % 5 === 0 || f === framesToRender - 1)) {
        options.onProgress({
          currentFrame: f + 1,
          totalFrames: framesToRender,
          percent: parseFloat((((f + 1) / framesToRender) * 100).toFixed(1)),
        });
      }

      // Cooperative yield for browser/worker responsiveness
      if (yieldInterval > 0 && (f + 1) % yieldInterval === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const cumulativeHash = await hashAccumulator.digest();

    // Finalize Sink
    let sinkResult: SinkFinalizeResult | undefined;
    if (sink) {
      sinkResult = await sink.finalize(audioResult);
    }

    // Clean up temporary audio file from cache and disk if generated
    if (tempAudioWavPath) {
      try {
        await ContentCacheRegistry.namespace(CacheNamespace.Audio).delete(tempAudioWavPath);
      } catch {}

      if (typeof process !== 'undefined' && process.versions?.node) {
        try {
          const fsModule = await import('fs');
          if (fsModule.existsSync(tempAudioWavPath)) {
            await fsModule.promises.unlink(tempAudioWavPath);
          }
        } catch {}
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
      totalFrames: options.signal?.aborted ? actualFramesConsumed : framesToRender,
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
      if (track.type === 'video' || track.type === 'image' || track.type === 'overlay' || track.type === 'timed_text') {
        return true;
      }
    }
    return false;
  }

  /**
   * Zero-Allocation Frame Loop with Transient FrameResourceScope RAII:
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
    const frameScope = this.resourceManager.createFrameScope(`master-frame-${t}`);

    // 1. Asynchronously pre-fetch next frame from active video decoders if required
    const activeVideoFrames = new Map<string, any>();
    for (const [assetId, decoder] of this.videoDecoders) {
      try {
        const frame = await decoder.readNextFrame();
        if (frame) {
          activeVideoFrames.set(assetId, frame);
          this.resourceManager.register(`video-frame-${t}-${assetId}`, frame, {
            scope: frameScope,
          });
        }
      } catch {}
    }

    // 2. Build asset source resolver combining static imageCache and dynamic activeVideoFrames
    const assetResolver: IAssetSourceResolver = {
      has: (id: string) => activeVideoFrames.has(id) || this.imageCache.has(id),
      get: (id: string) => activeVideoFrames.get(id) || this.imageCache.get(id),
      onAssetDrawn: (assetId: string) => {
        if (activeVideoFrames.has(assetId)) {
          const frame = activeVideoFrames.get(assetId);
          activeVideoFrames.delete(assetId);
          try {
            if (frame && typeof frame.close === 'function') {
              frame.close();
            }
          } catch {}
        }
      },
    };

    // 3. Delegate to canonical IRCanvasCompositor with 'master' execution profile and active frameScope
    try {
      await IRCanvasCompositor.renderFrame(ctx, this.timeline, t, {
        pluginRegistry: this.pluginRegistry,
        assetResolver,
        clearColor: '#000000',
        executionProfile: 'master',
        generatePixelBuffer: buffer,
        frameScope,
        resourceManager: this.resourceManager,
      });
    } finally {
      // Ensure any remaining frames (e.g. from culled or hidden tracks) and scratch buffers are closed immediately
      for (const frame of activeVideoFrames.values()) {
        try {
          if (frame && typeof frame.close === 'function') {
            frame.close();
          }
        } catch {}
      }
      activeVideoFrames.clear();
      frameScope.dispose();
    }
  }

  private rasterizeProceduralFrame(t: number, width: number, height: number, buffer: Uint8Array): void {
    // Generate seeded procedural noise for frame t
    const noiseVal = this.noiseGen.sample1D(t, 1, 0.5);
    const pixelByte = Math.floor(Math.abs(noiseVal) * 255) & 255;

    // Fill buffer with deterministic pattern (reusable memory loop)
    // To ensure zero allocation, we mutate buffer in-place
    buffer.fill(pixelByte);
  }

  /**
   * Explicitly disposes all sequence scopes, cached images, and video decoders owned by this renderer.
   */
  public dispose(): void {
    this.resourceManager.disposeAllSequenceScopes();
    for (const img of this.imageCache.values()) {
      if (img && typeof img.close === 'function') {
        try {
          img.close();
        } catch {}
      }
    }
    this.imageCache.clear();

    for (const dec of this.videoDecoders.values()) {
      try {
        dec.close();
      } catch {}
    }
    this.videoDecoders.clear();
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }
}
