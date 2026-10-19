import path from 'path';
import fs from 'fs';
import {
  FFmpegManager,
  Logger,
} from '@acc/core';
import {
  AssetMetadataProber,
  RelationalDAGCompiler,
  type VideoIRDocument,
  type ResolvedTimeline,
} from '@acc/ir';
import {
  IRMasterRenderer,
  FFIVideoEncoderSink,
} from '@acc/ir/server';
import { StudioTimelineState } from './StudioTimelineState';
import type {
  ResolvedFramePreview,
  StudioRenderOptions,
  StudioRenderResult,
  ActiveClipInfo,
} from './types';

/**
 * UIStudioPreviewEngine:
 * Implements the Hybrid Dual-Pipeline Architecture (Option D):
 * - Frontend Preview: Resolves lightweight compositing frames (geometry, shaders, text overlays)
 *   in real time at interactive frame rates without triggering heavy FFI encoder locks.
 * - Backend Dispatch: Dispatches headless deterministic export via IRMasterRenderer
 *   preserving ZERO-ALLOC-FRAME-LOOP and monotonic timestamp bitstream integrity.
 */
export class UIStudioPreviewEngine {
  private timelineState: StudioTimelineState;
  private baseDir: string;

  constructor(timelineState: StudioTimelineState, baseDir: string = process.cwd()) {
    this.timelineState = timelineState;
    this.baseDir = baseDir;
  }

  public getTimelineState(): StudioTimelineState {
    return this.timelineState;
  }

  /**
   * Resolves the current frame's preview payload for real-time frontend canvas rendering.
   */
  public resolveFramePreview(targetFrame?: number): ResolvedFramePreview {
    const playhead = this.timelineState.getPlayheadState();
    const frame = targetFrame !== undefined ? targetFrame : playhead.currentFrame;
    const doc = this.timelineState.getDocument();
    const activeClips = this.timelineState.getActiveClipsAtFrame(frame);

    const activeTextCues: ResolvedFramePreview['activeTextCues'] = [];
    const activeModifiers: ResolvedFramePreview['activeModifiers'] = [];

    for (const clip of activeClips) {
      if (clip.activeCues) {
        for (const cue of clip.activeCues) {
          activeTextCues.push({
            text: cue.text,
            startOffsetMs: cue.startOffsetMs,
            endOffsetMs: cue.endOffsetMs,
            sequenceId: clip.sequenceId,
            trackId: clip.trackId,
          });
        }
      }

      if (clip.modifiers) {
        for (const mod of clip.modifiers) {
          activeModifiers.push({
            type: mod.type,
            params: mod.params,
            sequenceId: clip.sequenceId,
            trackId: clip.trackId,
          });
        }
      }
    }

    return {
      frame,
      timeSeconds: Number((frame / playhead.fps).toFixed(3)),
      totalFrames: playhead.totalFrames,
      fps: playhead.fps,
      canvasSize: doc.meta.canvasSize,
      activeClips,
      activeTextCues,
      activeModifiers,
    };
  }

  /**
   * Dispatches headless deterministic backend export using the current VideoIRDocument AST.
   */
  public async dispatchBackendRender(options: StudioRenderOptions = {}): Promise<StudioRenderResult> {
    const startTime = performance.now();
    await FFmpegManager.prepare();

    const doc = this.timelineState.getDocument();
    const prober = new AssetMetadataProber(this.baseDir);
    const compiler = new RelationalDAGCompiler({ prober });
    const timeline = await compiler.compile(doc);

    const outPath = options.outputPath
      ? path.resolve(options.outputPath)
      : path.join(this.baseDir, `studio_export_${Date.now()}.mp4`);

    if (options.dryRun) {
      return {
        success: true,
        outputPath: outPath,
        totalFrames: timeline.totalFrames,
        durationSeconds: timeline.durationSeconds,
        fps: timeline.meta.globalFps,
        renderTimeMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true });

      const sink = new FFIVideoEncoderSink({
        outputPath: outPath,
        width: timeline.meta.canvasSize.w,
        height: timeline.meta.canvasSize.h,
        fps: timeline.meta.globalFps,
        crf: options.crf ?? 20,
      });

      const masterRenderer = new IRMasterRenderer({
        prober,
        sink,
      });

      await masterRenderer.render(timeline, {
        frameStart: options.chunkStart,
        frameEnd: options.chunkEnd,
      });

      const elapsed = Math.round(performance.now() - startTime);
      Logger.info('UIStudioPreviewEngine', `✓ Export finished: ${outPath} (${timeline.totalFrames} frames in ${elapsed}ms)`);

      return {
        success: true,
        outputPath: outPath,
        totalFrames: timeline.totalFrames,
        durationSeconds: timeline.durationSeconds,
        fps: timeline.meta.globalFps,
        renderTimeMs: elapsed,
      };
    } catch (err: any) {
      Logger.error('UIStudioPreviewEngine', `Render dispatch failed: ${err.message}`);
      return {
        success: false,
        error: err.message,
        totalFrames: timeline.totalFrames,
        durationSeconds: timeline.durationSeconds,
        fps: timeline.meta.globalFps,
        renderTimeMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
