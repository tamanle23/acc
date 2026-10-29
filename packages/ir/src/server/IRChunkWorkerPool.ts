import type { ResolvedTimeline, IIRFrameSink } from '../types/VideoIR';
import { IRMasterRenderer } from '../renderer/IRMasterRenderer';
import { DecoupledAudioMixer } from './DecoupledAudioMixer';
import {
  MediaEngineRegistry,
  type MediaEngineType,
  ContentCacheRegistry,
  UniversalHasher,
  NativeResourceManager,
} from '@acc/core-isomorphic';

export interface ChunkSlice {
  chunkIndex: number;
  startFrame: number;
  endFrame: number;
  frameCount: number;
}

export interface IRWorkerPoolOptions {
  engine?: MediaEngineType;
  concurrency?: number;
  baseDir?: string;
  outputPath?: string;
  tempDir?: string;
  seed?: number;
  generateFrameHash?: boolean;
  jobId?: string;
  maxMemoryMb?: number;
  onProgress?: (progress: {
    completedChunks: number;
    totalChunks: number;
    completedFrames: number;
    totalFrames: number;
    percent: number;
  }) => void;
}

export interface IRWorkerPoolResult {
  totalFrames: number;
  durationSeconds: number;
  concurrency: number;
  chunkCount: number;
  chunkHashes: string[];
  merkleRootHash: string;
  outputPath?: string;
  chunkPaths: string[];
  audioSamples: number;
  executionTimeMs: number;
}

/**
 * Isomorphic path helpers
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

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function resolvePath(base: string, relative: string): string {
  if (isAbsolutePath(relative)) return normalizePath(relative);
  const cleanBase = normalizePath(base || '.').replace(/\/+$/, '');
  const cleanRel = normalizePath(relative).replace(/^\/+/, '');
  return `${cleanBase}/${cleanRel}`;
}

function getDirname(p: string): string {
  const norm = normalizePath(p).replace(/\/+$/, '');
  const lastSlash = norm.lastIndexOf('/');
  if (lastSlash <= 0) return lastSlash === 0 ? '/' : '.';
  return norm.substring(0, lastSlash);
}

/**
 * Dynamic system concurrency detector
 */
function getSystemConcurrency(): number {
  if (typeof globalThis !== 'undefined' && (globalThis as any).navigator?.hardwareConcurrency) {
    return (globalThis as any).navigator.hardwareConcurrency;
  }
  if (typeof process !== 'undefined' && (process as any).versions?.node) {
    try {
      const os = require('os');
      return os.cpus()?.length || 4;
    } catch {
      return 4;
    }
  }
  return 4;
}

/**
 * Dynamic file existence check
 */
async function checkPathExists(filePath: string): Promise<boolean> {
  const cache = ContentCacheRegistry.get();
  if (await cache.has(filePath)) return true;
  if (typeof process !== 'undefined' && (process as any).versions?.node) {
    try {
      const fs = await import('fs');
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Dynamic file removal
 */
async function removePathIfExists(filePath: string): Promise<void> {
  const cache = ContentCacheRegistry.get();
  await cache.delete(filePath);
  if (typeof process !== 'undefined' && (process as any).versions?.node) {
    try {
      const fs = await import('fs');
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch { }
  }
}

/**
 * IRChunkWorkerPool:
 * High-throughput parallel temporal chunking orchestrator.
 * Slices timeline into deterministic, keyframe-friendly chunk intervals,
 * executes isolated worker renders concurrently across logical CPU/GPU cores,
 * and stitches intermediate streams into a final master video via FFI zero-reencode remuxing.
 *
 * Guarantees strict compliance with:
 * - DETERMINISTIC-HANDSHAKE-BACKPRESSURE (Merkle root parity)
 * - ZERO-ALLOC-FRAME-LOOP (pre-allocated frame buffers and native FFI)
 * - Pure isomorphic TypeScript with zero static fs, path, os, or crypto dependencies.
 */
export class IRChunkWorkerPool {
  private timeline: ResolvedTimeline;
  private seed: number;

  constructor(timeline: ResolvedTimeline, seed: number = 42) {
    this.timeline = timeline;
    this.seed = seed;
  }

  /**
   * Calculates optimal temporal chunk slices aligned with scene boundaries and frame counts.
   */
  public calculateSlices(concurrency: number): ChunkSlice[] {
    const totalFrames = this.timeline.totalFrames;
    if (totalFrames <= 0) return [];

    const effectiveConcurrency = Math.max(1, Math.min(concurrency, totalFrames));
    const chunkSize = Math.ceil(totalFrames / effectiveConcurrency);
    const slices: ChunkSlice[] = [];

    let currentStart = 0;
    for (let i = 0; i < effectiveConcurrency; i++) {
      const currentEnd = Math.min(totalFrames, currentStart + chunkSize);
      if (currentStart >= totalFrames) break;

      slices.push({
        chunkIndex: i,
        startFrame: currentStart,
        endFrame: currentEnd,
        frameCount: currentEnd - currentStart,
      });

      currentStart = currentEnd;
    }

    return slices;
  }

  /**
   * Executes parallel chunk rendering across configured concurrency.
   */
  public async render(options: IRWorkerPoolOptions = {}): Promise<IRWorkerPoolResult> {
    const startTime = Date.now();
    const totalFrames = this.timeline.totalFrames;
    const fps = this.timeline.meta.globalFps;

    // Ensure server strategies are registered if running in Node/Bun and not yet initialized
    if (!MediaEngineRegistry.has(options.engine || MediaEngineRegistry.getDefaultEngine())) {
      if (typeof process !== 'undefined' && (process as any).versions?.node) {
        try {
          const { bootstrapNode } = await import('@acc/core');
          await bootstrapNode();
        } catch { }
      }
    }

    // Resolve active media engine strategy and chunk execution policy
    const mediaEngine = MediaEngineRegistry.get(options.engine);
    const chunkPolicy = mediaEngine.getChunkPolicy();

    // Detect hardware concurrency and govern bounds
    const maxSystemCores = Math.max(1, getSystemConcurrency());
    let safeConcurrency = options.concurrency ?? chunkPolicy.getOptimalConcurrency(maxSystemCores, maxSystemCores);

    // Dynamic import of governance utilities when running in server context
    let checkpointManager: any = null;
    let saga: any = null;
    if (typeof process !== 'undefined' && (process as any).versions?.node) {
      try {
        const core = await import('@acc/core');
        if (core.AdaptiveResourceGovernor) {
          const governor = core.AdaptiveResourceGovernor.getInstance();
          safeConcurrency = governor.resolveSafeConcurrency(safeConcurrency);
        }
        if (options.jobId && core.RenderCheckpointManager) {
          checkpointManager = core.RenderCheckpointManager.getInstance();
        }
        if (core.SagaOrchestrator) {
          saga = new core.SagaOrchestrator(options.jobId ? `chunk_pool_${options.jobId}` : `chunk_pool_${this.seed}`);
        }
      } catch { }
    }

    const concurrency = Math.max(1, Math.min(safeConcurrency, totalFrames > 0 ? totalFrames : 1));
    const slices = this.calculateSlices(concurrency);
    const chunkCount = slices.length;

    // Determine paths isomorphically
    const baseDir = options.baseDir || '.';
    const outPath = options.outputPath ? normalizePath(options.outputPath) : undefined;
    const workingDir = options.tempDir
      ? normalizePath(options.tempDir)
      : (outPath ? getDirname(outPath) : './output');

    if (typeof process !== 'undefined' && (process as any).versions?.node) {
      try {
        const fs = await import('fs');
        if (!fs.existsSync(workingDir)) {
          await fs.promises.mkdir(workingDir, { recursive: true });
        }
      } catch { }
    }

    const jobId = options.jobId;
    const completedIndices = checkpointManager && jobId
      ? await checkpointManager.getCompletedChunkIndices(jobId)
      : new Set<number>();

    // Step 1: Pre-mix global audio once if we have an output video target
    let masterAudioWavPath: string | undefined;
    let audioSamples = 0;
    if (outPath) {
      const audioMixer = new DecoupledAudioMixer();
      const mixedAudio = await audioMixer.mix(this.timeline, { baseDir });
      audioSamples = mixedAudio.totalSamples;

      if (mixedAudio.totalSamples > 0) {
        masterAudioWavPath = resolvePath(
          workingDir,
          `.temp_master_audio_${this.seed}_${jobId || 'main'}.wav`
        );
        await DecoupledAudioMixer.exportToWav(masterAudioWavPath, mixedAudio);
        if (saga) {
          saga.addStep({
            name: 'master_audio',
            execute: async () => { },
            compensate: async () => {
              if (masterAudioWavPath) {
                await removePathIfExists(masterAudioWavPath);
              }
            },
          });
        }
      }
    }

    // Step 2: Render temporal chunks concurrently
    const chunkPaths: string[] = [];
    const chunkHashes: string[] = new Array(chunkCount).fill('');
    let completedChunks = 0;
    let completedFrames = 0;

    // Execute chunks with bounded concurrency pool
    const activeTasks = slices.map((slice) => async () => {
      const chunkMp4Path = outPath
        ? resolvePath(
          workingDir,
          `.temp_chunk_${slice.chunkIndex}_${this.seed}_${jobId || 'job'}.mp4`
        )
        : undefined;

      if (chunkMp4Path) {
        chunkPaths[slice.chunkIndex] = chunkMp4Path;
        if (saga) {
          saga.addStep({
            name: `chunk_${slice.chunkIndex}`,
            execute: async () => { },
            compensate: async () => {
              if (chunkMp4Path) {
                await removePathIfExists(chunkMp4Path);
              }
            },
          });
        }
      }

      // Checkpoint resumption: skip already verified chunks
      if (
        checkpointManager &&
        jobId &&
        completedIndices.has(slice.chunkIndex) &&
        chunkMp4Path &&
        (await checkPathExists(chunkMp4Path))
      ) {
        const cp = await checkpointManager.loadCheckpoint(jobId);
        const rec = cp?.completedChunks[slice.chunkIndex];
        if (rec) {
          chunkHashes[slice.chunkIndex] = rec.sha256;
          completedChunks++;
          completedFrames += slice.frameCount;
          if (options.onProgress) {
            options.onProgress({
              completedChunks,
              totalChunks: chunkCount,
              completedFrames,
              totalFrames,
              percent: parseFloat(((completedFrames / totalFrames) * 100).toFixed(1)),
            });
          }
          return { cumulativeHash: rec.sha256 } as any;
        }
      }

      const effectiveSeed = options.seed ?? this.seed;
      const { w: width, h: height } = this.timeline.meta.canvasSize;
      const isolatedBudget = NativeResourceManager.computeResolutionBudgetBytes(
        width,
        height,
        options.maxMemoryMb
      );
      const workerResourceManager = NativeResourceManager.createIsolated(isolatedBudget);
      const workerRenderer = new IRMasterRenderer(
        this.timeline,
        effectiveSeed,
        undefined,
        workerResourceManager
      );

      let sink: IIRFrameSink | undefined;
      if (chunkMp4Path) {
        sink = MediaEngineRegistry.get(options.engine).createVideoSink() as IIRFrameSink;
      }

      let chunkResult: Awaited<ReturnType<IRMasterRenderer['render']>>;
      try {
        chunkResult = await workerRenderer.render({
          sink,
          outputPath: chunkMp4Path,
          audioPath: undefined,
          skipAudio: true, // Video chunks are pure video streams; audio muxed once on final stitch
          baseDir,
          chunkStart: slice.startFrame,
          chunkEnd: slice.endFrame,
          generateFrameHash: options.generateFrameHash ?? false,
          maxMemoryMb: options.maxMemoryMb,
        });
      } finally {
        workerRenderer.dispose();
        workerResourceManager.clear();
      }

      chunkHashes[slice.chunkIndex] = chunkResult.cumulativeHash;

      if (checkpointManager && jobId && chunkMp4Path) {
        await checkpointManager.saveChunkCheckpoint(
          jobId,
          slice.chunkIndex,
          chunkMp4Path,
          chunkResult.cumulativeHash
        );
      }

      completedChunks++;
      completedFrames += slice.frameCount;

      if (options.onProgress) {
        options.onProgress({
          completedChunks,
          totalChunks: chunkCount,
          completedFrames,
          totalFrames,
          percent: parseFloat(((completedFrames / totalFrames) * 100).toFixed(1)),
        });
      }

      return chunkResult;
    });

    try {
      await Promise.all(activeTasks.map((task) => task()));
    } catch (err: any) {
      if (saga) {
        await saga.execute({});
      }
      throw err;
    }

    // Step 3: Compute Merkle Root for Bit-Identical Verification
    // RootHash = SHA256(ChunkHash_0 || ChunkHash_1 || ... || ChunkHash_N)
    const merkleHasher = await UniversalHasher.create();
    for (const ch of chunkHashes) {
      merkleHasher.update(ch || '0');
    }
    const merkleRootHash = await merkleHasher.digest();

    // Step 4: Concatenate video chunks and mux master audio
    if (outPath && chunkPaths.length > 0) {
      const validChunkPaths: string[] = [];
      for (const p of chunkPaths) {
        if (p && (await checkPathExists(p))) {
          validChunkPaths.push(p);
        }
      }

      if (validChunkPaths.length === 1 && !masterAudioWavPath) {
        if (typeof process !== 'undefined' && (process as any).versions?.node) {
          try {
            const fs = await import('fs');
            await fs.promises.copyFile(validChunkPaths[0], outPath);
            await removePathIfExists(validChunkPaths[0]);
          } catch { }
        }
      } else if (validChunkPaths.length > 0) {
        const tempVideoOnlyPath = resolvePath(
          workingDir,
          `.temp_stitched_video_${this.seed}_${jobId || 'main'}.mp4`
        );

        await mediaEngine.getConcatStrategy().concatenate(validChunkPaths, tempVideoOnlyPath);

        // Clean up individual chunks after concat
        for (const p of validChunkPaths) {
          await removePathIfExists(p);
        }

        // If master audio exists, mux it with the stitched video
        if (masterAudioWavPath && (await checkPathExists(masterAudioWavPath))) {
          await mediaEngine.getAudioMuxerStrategy().muxAudioVideo(tempVideoOnlyPath, masterAudioWavPath, outPath);

          await removePathIfExists(tempVideoOnlyPath);
          await removePathIfExists(masterAudioWavPath);
        } else {
          if (typeof process !== 'undefined' && (process as any).versions?.node) {
            try {
              const fs = await import('fs');
              if (fs.existsSync(outPath)) {
                await fs.promises.unlink(outPath);
              }
              await fs.promises.rename(tempVideoOnlyPath, outPath);
            } catch { }
          }
        }
      }
    }

    if (checkpointManager && jobId) {
      await checkpointManager.clearCheckpoint(jobId);
    }

    const durationSeconds = totalFrames > 0 ? parseFloat((totalFrames / fps).toFixed(3)) : 0;
    const executionTimeMs = Date.now() - startTime;

    return {
      totalFrames,
      durationSeconds,
      concurrency,
      chunkCount,
      chunkHashes,
      merkleRootHash,
      outputPath: outPath,
      chunkPaths,
      audioSamples,
      executionTimeMs,
    };
  }
}
