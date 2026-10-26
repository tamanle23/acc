import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { ResolvedTimeline, IIRFrameSink } from '@acc/ir';
import { IRMasterRenderer, DecoupledAudioMixer } from '@acc/ir';
import { MediaEngineRegistry, type MediaEngineType } from '@acc/core-isomorphic';

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
 * IRChunkWorkerPool:
 * High-throughput parallel temporal chunking orchestrator.
 * Slices timeline into deterministic, keyframe-friendly chunk intervals,
 * executes isolated worker renders concurrently across logical CPU/GPU cores,
 * and stitches intermediate streams into a final master video via FFI zero-reencode remuxing.
 *
 * Guarantees strict compliance with:
 * - DETERMINISTIC-HANDSHAKE-BACKPRESSURE (Merkle root parity)
 * - ZERO-ALLOC-FRAME-LOOP (pre-allocated frame buffers and native FFI)
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
    const { w: width, h: height } = this.timeline.meta.canvasSize;
    const fps = this.timeline.meta.globalFps;

    // Resolve active media engine strategy and chunk execution policy
    const {
      AdaptiveResourceGovernor,
      RenderCheckpointManager,
      SagaOrchestrator,
    } = await import('@acc/core');
    const mediaEngine = MediaEngineRegistry.get(options.engine);
    const chunkPolicy = mediaEngine.getChunkPolicy();

    // Detect hardware concurrency and govern memory bounds
    const maxSystemCores = Math.max(1, os.cpus().length);
    const governor = AdaptiveResourceGovernor.getInstance();
    const suggestedConcurrency = options.concurrency ?? chunkPolicy.getOptimalConcurrency(maxSystemCores, maxSystemCores);
    const safeConcurrency = governor.resolveSafeConcurrency(suggestedConcurrency);
    const concurrency = Math.max(1, Math.min(safeConcurrency, totalFrames > 0 ? totalFrames : 1));

    const slices = this.calculateSlices(concurrency);
    const chunkCount = slices.length;

    // Determine paths
    const baseDir = options.baseDir || '.';
    const outPath = options.outputPath ? path.resolve(options.outputPath) : undefined;
    const workingDir = options.tempDir
      ? path.resolve(options.tempDir)
      : (outPath ? path.dirname(outPath) : path.resolve('./output'));

    if (!fs.existsSync(workingDir)) {
      await fs.promises.mkdir(workingDir, { recursive: true });
    }

    const jobId = options.jobId;
    const checkpointManager = jobId ? RenderCheckpointManager.getInstance() : null;
    const completedIndices = checkpointManager && jobId ? await checkpointManager.getCompletedChunkIndices(jobId) : new Set<number>();
    const saga = new SagaOrchestrator(jobId ? `chunk_pool_${jobId}` : `chunk_pool_${this.seed}`);

    // Step 1: Pre-mix global audio once if we have an output video target
    let masterAudioWavPath: string | undefined;
    let audioSamples = 0;
    if (outPath) {
      const audioMixer = new DecoupledAudioMixer();
      const mixedAudio = await audioMixer.mix(this.timeline, { baseDir });
      audioSamples = mixedAudio.totalSamples;

      if (mixedAudio.totalSamples > 0) {
        masterAudioWavPath = path.resolve(
          workingDir,
          `.temp_master_audio_${this.seed}_${jobId || 'main'}.wav`
        );
        await DecoupledAudioMixer.exportToWav(masterAudioWavPath, mixedAudio);
        saga.addStep({
          name: 'master_audio',
          execute: async () => {},
          compensate: async () => {
            if (masterAudioWavPath && fs.existsSync(masterAudioWavPath)) {
              try { await fs.promises.unlink(masterAudioWavPath); } catch {}
            }
          },
        });
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
        ? path.resolve(
            workingDir,
            `.temp_chunk_${slice.chunkIndex}_${this.seed}_${jobId || 'job'}.mp4`
          )
        : undefined;

      if (chunkMp4Path) {
        chunkPaths[slice.chunkIndex] = chunkMp4Path;
        saga.addStep({
          name: `chunk_${slice.chunkIndex}`,
          execute: async () => {},
          compensate: async () => {
            if (chunkMp4Path && fs.existsSync(chunkMp4Path)) {
              try { await fs.promises.unlink(chunkMp4Path); } catch {}
            }
          },
        });
      }

      // Checkpoint resumption: skip already verified chunks
      if (checkpointManager && jobId && completedIndices.has(slice.chunkIndex) && chunkMp4Path && fs.existsSync(chunkMp4Path)) {
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

      // Each worker gets an isolated renderer instance seeded deterministically with the global seed
      const workerRenderer = new IRMasterRenderer(this.timeline, this.seed);

      let sink: IIRFrameSink | undefined;
      if (chunkMp4Path) {
        sink = MediaEngineRegistry.get(options.engine).createVideoSink() as IIRFrameSink;
      }

      const chunkResult = await workerRenderer.render({
        sink,
        outputPath: chunkMp4Path,
        audioPath: undefined,
        skipAudio: true, // Video chunks are pure video streams; audio muxed once on final stitch
        baseDir,
        chunkStart: slice.startFrame,
        chunkEnd: slice.endFrame,
        generateFrameHash: options.generateFrameHash ?? false,
      });

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
      // Execute tasks in parallel (Bun resolves native threads/microtasks)
      await Promise.all(activeTasks.map((task) => task()));
    } catch (err: any) {
      // SAGA Compensation on failure: clean up chunk artifacts and record failure
      await saga.execute({});
      throw err;
    }

    // Step 3: Compute Merkle Root for Bit-Identical Verification
    // RootHash = SHA256(ChunkHash_0 || ChunkHash_1 || ... || ChunkHash_N)
    const merkleHasher = crypto.createHash('sha256');
    for (const ch of chunkHashes) {
      merkleHasher.update(ch || '0');
    }
    const merkleRootHash = merkleHasher.digest('hex');

    // Step 4: Concatenate video chunks and mux master audio
    if (outPath && chunkPaths.length > 0) {
      const validChunkPaths = chunkPaths.filter((p) => p && fs.existsSync(p));

      if (validChunkPaths.length === 1 && !masterAudioWavPath) {
        // Single chunk and no separate audio, rename or copy directly
        await fs.promises.copyFile(validChunkPaths[0], outPath);
        try {
          await fs.promises.unlink(validChunkPaths[0]);
        } catch {}
      } else if (validChunkPaths.length > 0) {
        // First stitch video chunks losslessly via active media engine strategy
        const tempVideoOnlyPath = path.resolve(
          workingDir,
          `.temp_stitched_video_${this.seed}_${jobId || 'main'}.mp4`
        );

        await mediaEngine.getConcatStrategy().concatenate(validChunkPaths, tempVideoOnlyPath);

        // Clean up individual chunks after concat
        for (const p of validChunkPaths) {
          try {
            if (fs.existsSync(p)) await fs.promises.unlink(p);
          } catch {}
        }

        // If master audio exists, mux it with the stitched video
        if (masterAudioWavPath && fs.existsSync(masterAudioWavPath)) {
          await mediaEngine.getAudioMuxerStrategy().muxAudioVideo(tempVideoOnlyPath, masterAudioWavPath, outPath);

          // Clean up temp intermediate files
          try {
            if (fs.existsSync(tempVideoOnlyPath)) await fs.promises.unlink(tempVideoOnlyPath);
            if (fs.existsSync(masterAudioWavPath)) await fs.promises.unlink(masterAudioWavPath);
          } catch {}
        } else {
          // No audio, move stitched video to final output
          if (fs.existsSync(outPath)) {
            await fs.promises.unlink(outPath);
          }
          await fs.promises.rename(tempVideoOnlyPath, outPath);
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
