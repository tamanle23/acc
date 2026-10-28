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
} from '@acc/effect-engines';

/**
 * CaptionModifierPlugin:
 * Implements deterministic timed-text rendering and acoustic subtitle positioning ('text/style').
 * Target Scope: 'both' (Sequence Clip Space or Track Stream Space).
 * Target Phase: 2 (Clip-Space Sequence Evaluation).
 *
 * Adheres strictly to:
 * - ZERO-ALLOC-FRAME-LOOP: Scoped sequence caption configs to avoid per-frame mapping.
 * - SAFE-ZONE-COMPLIANCE: Evaluates SafeZoneManager boundaries for TikTok, Reels, Shorts, and YouTube.
 */
export class CaptionModifierPlugin implements ModifierPlugin<CaptionSettings> {
  public readonly type = 'text/style';
  public readonly targetScope = 'both';
  public readonly targetPhase = 2;
  public readonly schema = {
    displayName: 'Typography & Karaoke Glow',
    category: 'text' as const,
    fields: {
      fontFamily: {
        key: 'fontFamily',
        label: 'Font Family',
        type: 'select' as const,
        defaultValue: 'Inter',
        options: [
          { label: 'Inter (Sans-Serif)', value: 'Inter' },
          { label: 'Fira Code (Monospace)', value: 'Fira Code' },
          { label: 'Outfit (Modern Clean)', value: 'Outfit' },
          { label: 'Cinzel (Cinematic Serif)', value: 'Cinzel' },
          { label: 'Montserrat (Geometric)', value: 'Montserrat' },
        ],
      },
      fontSize: {
        key: 'fontSize',
        label: 'Font Size',
        type: 'number' as const,
        min: 12,
        max: 120,
        step: 1,
        defaultValue: 28,
        unit: 'px',
      },
      fontWeight: {
        key: 'fontWeight',
        label: 'Font Weight',
        type: 'number' as const,
        min: 300,
        max: 900,
        step: 100,
        defaultValue: 600,
      },
      letterSpacing: {
        key: 'letterSpacing',
        label: 'Letter Spacing',
        type: 'number' as const,
        min: -2,
        max: 10,
        step: 0.5,
        defaultValue: 0,
        unit: 'px',
      },
      fillColor: {
        key: 'fillColor',
        label: 'Text Fill Color',
        type: 'color' as const,
        defaultValue: '#ffffff',
        presets: [
          { name: 'Pure White', hex: '#ffffff' },
          { name: 'Cyber Yellow', hex: '#facc15' },
          { name: 'Neon Green', hex: '#4ade80' },
          { name: 'Cyan Glow', hex: '#22d3ee' },
          { name: 'Dark Slate', hex: '#0f172a' },
        ],
      },
      glowColor: {
        key: 'glowColor',
        label: 'Glow / Shadow Color',
        type: 'color' as const,
        defaultValue: '#00d4ff',
        presets: [
          { name: 'Cyan Neon', hex: '#00d4ff' },
          { name: 'Electric Violet', hex: '#8b5cf6' },
          { name: 'Hot Pink', hex: '#ec4899' },
          { name: 'Amber Gold', hex: '#f59e0b' },
        ],
      },
      activeWordHighlight: {
        key: 'activeWordHighlight',
        label: 'Active-Word Karaoke Glow',
        type: 'karaoke_group' as const,
        defaultValue: {
          enabled: true,
          animationPreset: 'pop',
          scale: 1.15,
          fillColor: '#facc15',
          glowColor: '#00d4ff',
        },
      },
      karaoke: {
        key: 'karaoke',
        label: 'Active-Word Karaoke Glow',
        type: 'karaoke_group' as const,
        defaultValue: {
          enabled: true,
          animationPreset: 'pop',
          scale: 1.15,
          fillColor: '#facc15',
          glowColor: '#00d4ff',
        },
      },
    },
  };

  private captionStrategy = new BoundedAcousticCaptionStrategy();

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

    let captionConfigs = (sequence as any)._captionConfigs as CaptionConfig[] | undefined;
    const fps = (sequence as any).fps || 30;

    if (!captionConfigs) {
      captionConfigs = sequence.cues.map((c) => ({
        text: c.text,
        start: c.startOffsetMs / 1000,
        end: c.endOffsetMs === 'end' ? (sequence.durationFrames / fps) : (c.endOffsetMs / 1000),
      }));
      (sequence as any)._captionConfigs = captionConfigs;
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
        let captionConfigs = (seq as any)._captionConfigs as CaptionConfig[] | undefined;
        if (!captionConfigs) {
          captionConfigs = seq.cues.map((c) => ({
            text: c.text,
            start: c.startOffsetMs / 1000,
            end: c.endOffsetMs === 'end' ? (seq.durationFrames / fps) : (c.endOffsetMs / 1000),
          }));
          (seq as any)._captionConfigs = captionConfigs;
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
