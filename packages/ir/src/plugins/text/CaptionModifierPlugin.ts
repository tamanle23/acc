import type {
  ModifierPlugin,
  ModifierContext,
  ClipRenderContext,
  StreamRenderContext,
} from '../ModifierPluginRegistry';
import {
  BoundedAcousticCaptionStrategy,
  drawCanvasCaptionsFromSnapshot,
  type CaptionConfig,
  type CaptionSettings,
  type SafeZonePlatform,
} from '@acc/effect-engines/client';

/**
 * CaptionModifierPlugin:
 * Implements deterministic timed-text rendering and acoustic subtitle positioning ('text/style').
 * Target Scope: 'both' (Sequence Clip Space or Track Stream Space).
 * Target Phase: 2 (Clip-Space Sequence Evaluation).
 *
 * Adheres strictly to:
 * - ZERO-ALLOC-FRAME-LOOP: WeakMap cache for CaptionConfig arrays to avoid per-frame mapping.
 * - SAFE-ZONE-COMPLIANCE: Evaluates SafeZoneManager boundaries for TikTok, Reels, Shorts, and YouTube.
 */
export class CaptionModifierPlugin implements ModifierPlugin<CaptionSettings> {
  public readonly type = 'text/style';
  public readonly targetScope = 'both';
  public readonly targetPhase = 2;

  private captionStrategy = new BoundedAcousticCaptionStrategy();
  private captionConfigCache = new WeakMap<any, CaptionConfig[]>();

  public validate(params: unknown): params is CaptionSettings {
    return Boolean(params && typeof params === 'object');
  }

  public execute(context: ModifierContext, params: CaptionSettings): void {
    if (!context.state) context.state = {};
    context.state.captionSettings = params;
  }

  /**
   * Phase 2: Sequence-Level (Clip Space) Subtitle Rendering.
   */
  public renderClipSpace(ctx: ClipRenderContext, params: CaptionSettings): void {
    const { ctx: canvasCtx, width, height, sequence, localFrame } = ctx;
    if (!sequence.cues || sequence.cues.length === 0) return;

    let captionConfigs = this.captionConfigCache.get(sequence);
    const fps = (sequence as any).fps || 30;

    if (!captionConfigs) {
      captionConfigs = sequence.cues.map((c) => ({
        text: c.text,
        start: c.startOffsetMs / 1000,
        end: c.endOffsetMs === 'end' ? (sequence.durationFrames / fps) : (c.endOffsetMs / 1000),
      }));
      this.captionConfigCache.set(sequence, captionConfigs);
    }

    const localTimeSec = localFrame / fps;
    const snapshot = this.captionStrategy.evaluate(captionConfigs, localTimeSec, params);

    if (snapshot.shouldRender) {
      const platform = (params as any)?.platform as SafeZonePlatform | undefined;
      drawCanvasCaptionsFromSnapshot(canvasCtx, snapshot, params, width, height, platform);
    }
  }

  /**
   * Phase 3: Track-Level (Stream Space) Subtitle Rendering across active sequences.
   */
  public renderStreamSpace(ctx: StreamRenderContext, params: CaptionSettings): void {
    const { ctx: canvasCtx, width, height, frame, activeSequences, track } = ctx;
    const fps = 30;
    const trackStyle = (track.style as CaptionSettings) || {};
    const effectiveParams: CaptionSettings = { ...trackStyle, ...params };
    const platform = (effectiveParams as any)?.platform as SafeZonePlatform | undefined;

    for (const seq of activeSequences) {
      if (seq.cues && seq.cues.length > 0) {
        let captionConfigs = this.captionConfigCache.get(seq);
        if (!captionConfigs) {
          captionConfigs = seq.cues.map((c) => ({
            text: c.text,
            start: c.startOffsetMs / 1000,
            end: c.endOffsetMs === 'end' ? (seq.durationFrames / fps) : (c.endOffsetMs / 1000),
          }));
          this.captionConfigCache.set(seq, captionConfigs);
        }

        const localTimeSec = Math.max(0, (frame - seq.startFrame) / fps);
        const snapshot = this.captionStrategy.evaluate(captionConfigs, localTimeSec, effectiveParams);

        if (snapshot.shouldRender) {
          drawCanvasCaptionsFromSnapshot(canvasCtx, snapshot, effectiveParams, width, height, platform);
        }
      }
    }
  }
}
