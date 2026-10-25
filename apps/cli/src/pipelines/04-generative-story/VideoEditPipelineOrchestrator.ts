import os from 'os';
import { FFmpegManager, Logger } from '@acc/core';
import type { ResolvedStoryConfig } from '@acc/core/types';
import type { ExtendedPipelineIR } from '@acc/ir';
import type { LegacyStoryConfig } from '@acc/legacy-story-renderer';
import {
  LegacyIRPreparationAdapter,
  type PipelineExecutionOptions,
} from '@acc/legacy-story-renderer';

export type { PipelineExecutionOptions };

/**
 * VideoEditPipelineOrchestrator:
 * High-level orchestration facade for multi-scene video editing and rendering.
 *
 * Directs incoming requests directly to the Canonical Universal Video IR Engine
 * with zero-copy NVENC/FFI sinks. Legacy disk-based rendering is quarantined
 * strictly to the direct CLI entrypoint in `@acc/legacy-story-renderer`.
 */
export class VideoEditPipelineOrchestrator {
  /**
   * Prepares and enriches ExtendedPipelineIR with safe-zone validation and NLE cut calculations.
   * Delegated to quarantined `LegacyIRPreparationAdapter`.
   *
   * @deprecated Use Universal Video IR documents (`VideoIRDocument`) and `RelationalDAGCompiler`.
   */
  public static prepareIR(
    storyConfig: LegacyStoryConfig,
    options: PipelineExecutionOptions = {}
  ): ExtendedPipelineIR {
    return LegacyIRPreparationAdapter.prepareIR(storyConfig, options);
  }

  /**
   * Native Multi-Scene Rendering Engine: Canonical Universal Video IR transition.
   * Routes strictly into IRChunkWorkerPool with zero intermediate disk files.
   */
  public static async renderStoryVideo(
    config: ResolvedStoryConfig,
    outputFilePath: string,
    baseDir: string = process.cwd()
  ): Promise<void> {
    await FFmpegManager.prepare();

    Logger.info(
      'VideoEditPipelineOrchestrator',
      '⚡ Routing via Canonical Universal Video IR Engine & IRChunkWorkerPool...'
    );
    const {
      RelationalDAGCompiler,
      AssetMetadataProber,
      IRMasterRenderer,
    } = await import('@acc/ir');
    const { StoryConfigToUniversalIRAdapter } = await import('@acc/legacy-story-renderer');
    const { FFIVideoEncoderSink, IRChunkWorkerPool } = await import('@acc/core');

    const irDoc = StoryConfigToUniversalIRAdapter.adapt(config, undefined, baseDir);
    const prober = new AssetMetadataProber(baseDir);
    const compiler = new RelationalDAGCompiler({ prober });
    const timeline = await compiler.compile(irDoc);

    const cpuCount = os.cpus().length || 4;
    const requestedConcurrency =
      typeof config.settings.concurrency === 'number'
        ? config.settings.concurrency
        : config.settings.concurrency === 'auto'
          ? cpuCount
          : 1;
    const concurrency = Math.max(1, Math.min(requestedConcurrency, cpuCount));

    if (concurrency > 1) {
      const pool = new IRChunkWorkerPool(timeline, 42);
      await pool.render({
        concurrency,
        outputPath: outputFilePath,
        baseDir,
        seed: 42,
        generateFrameHash: false,
      });
    } else {
      const renderer = new IRMasterRenderer(timeline, 42);
      const sink = new FFIVideoEncoderSink();
      await renderer.render({
        sink,
        outputPath: outputFilePath,
        baseDir,
      });
    }
    Logger.info(
      'VideoEditPipelineOrchestrator',
      `✅ Canonical IR rendering completed: ${outputFilePath}`
    );
  }
}
