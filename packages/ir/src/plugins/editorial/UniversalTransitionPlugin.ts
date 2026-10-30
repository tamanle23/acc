import type { ModifierPlugin, ModifierContext, ClipRenderContext } from '../ModifierPluginRegistry';
import type { SequenceType } from '../../types/VideoIR';
import type {
  TransitionModifierParams,
  TransitionType,
  TransitionDirection,
  TransitionAlignment,
} from '../../types/modifiers';

/**
 * Calculates transition progress t ∈ [0, 1] based on ease function.
 */
export function calculateTransitionProgress(rawProgress: number, ease?: string): number {
  const p = Math.max(0, Math.min(1, rawProgress));
  switch (ease) {
    case 'ease_in':
      return p * p;
    case 'ease_out':
      return p * (2 - p);
    case 'ease_in_out':
    case 'power2_in_out':
      return p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
    case 'linear':
    default:
      return p;
  }
}

/**
 * UniversalTransitionPlugin:
 * Comprehensive multi-mode transition engine supporting:
 * - crossfade (Dissolve)
 * - dip (Dip to Color, Black, White)
 * - wipe (Directional edge progression)
 * - push (Directional slide-in translation)
 * - zoom (Whip zoom / scale transition)
 * - glitch (Procedural line shifting)
 * - light_leak (Additive bloom / flash)
 * - radial_wipe (Clock sweep angle)
 * - iris (Circular aperture expansion)
 *
 * Implements deterministic integer frame math without wall-clock dependencies.
 */
export class UniversalTransitionPlugin implements ModifierPlugin<TransitionModifierParams> {
  public readonly type: string;
  public readonly targetScope = 'sequence' as const;
  public readonly allowedSequenceTypes = ['video', 'image', 'overlay', 'audio'] as const;
  public readonly targetPhase = 2 as const;

  constructor(customType: string = 'transition/crossfade') {
    this.type = customType;
  }

  public readonly schema = {
    fields: {
      transitionType: {
        key: 'transitionType',
        label: 'Transition Type',
        type: 'select' as const,
        defaultValue: 'crossfade',
        options: [
          { label: 'Crossfade (Dissolve)', value: 'crossfade' },
          { label: 'Dip to Color', value: 'dip' },
          { label: 'Wipe', value: 'wipe' },
          { label: 'Push (Slide)', value: 'push' },
          { label: 'Whip Zoom', value: 'zoom' },
          { label: 'Glitch', value: 'glitch' },
          { label: 'Light Leak', value: 'light_leak' },
          { label: 'Radial Clock Wipe', value: 'radial_wipe' },
          { label: 'Iris Aperture', value: 'iris' },
        ],
      },
      durationFrames: {
        key: 'durationFrames',
        label: 'Duration (Frames)',
        type: 'number' as const,
        min: 1,
        max: 120,
        step: 1,
        defaultValue: 15,
        unit: 'f',
      },
      ease: {
        key: 'ease',
        label: 'Easing',
        type: 'select' as const,
        defaultValue: 'linear',
        options: [
          { label: 'Linear', value: 'linear' },
          { label: 'Ease In', value: 'ease_in' },
          { label: 'Ease Out', value: 'ease_out' },
          { label: 'Ease In-Out', value: 'ease_in_out' },
        ],
      },
      alignment: {
        key: 'alignment',
        label: 'Cut Alignment',
        type: 'select' as const,
        defaultValue: 'center_on_cut',
        options: [
          { label: 'Center on Cut', value: 'center_on_cut' },
          { label: 'Start at Cut', value: 'start_at_cut' },
          { label: 'End at Cut', value: 'end_at_cut' },
        ],
      },
      direction: {
        key: 'direction',
        label: 'Direction',
        type: 'select' as const,
        defaultValue: 'left',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
          { label: 'Up', value: 'up' },
          { label: 'Down', value: 'down' },
        ],
      },
      dipColor: {
        key: 'dipColor',
        label: 'Dip Color',
        type: 'color' as const,
        defaultValue: '#000000',
      },
      outgoingSeqId: {
        key: 'outgoingSeqId',
        label: 'Outgoing Sequence ID',
        type: 'string' as const,
        defaultValue: '',
      },
    },
  };

  public validate(params: unknown): params is TransitionModifierParams {
    if (!params || typeof params !== 'object') return false;
    const p = params as Record<string, unknown>;
    const dur = p.durationFrames ?? p.durationSec;
    return dur === undefined || (typeof dur === 'number' && dur >= 0);
  }

  public async execute(context: ModifierContext, params: TransitionModifierParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.transition = {
      type: params.transitionType || 'crossfade',
      durationFrames: params.durationFrames ?? 15,
      outgoingSeqId: params.outgoingSeqId || params.overlapTarget,
      alignment: params.alignment || 'center_on_cut',
    };
  }

  public renderClipSpace(ctx: ClipRenderContext, params: TransitionModifierParams): void {
    if (params.enabled === false) return;

    const { ctx: canvasCtx, localFrame, width, height } = ctx;
    const durationFrames = Math.max(1, params.durationFrames ?? (params.durationSec ? Math.round(params.durationSec * 30) : 15));

    // Only apply transition effects during the transition window at the sequence start
    if (localFrame >= durationFrames) {
      return;
    }

    const rawProgress = localFrame / durationFrames;
    const progress = calculateTransitionProgress(rawProgress, params.ease);
    const transType = (params.transitionType as TransitionType) || 'crossfade';
    const direction = params.direction || 'left';

    switch (transType) {
      case 'crossfade': {
        canvasCtx.globalAlpha = Math.max(0, Math.min(1, canvasCtx.globalAlpha * progress));
        break;
      }

      case 'dip': {
        const dipColor = params.dipColor || '#000000';
        // In incoming clip: starts at 50% (full dipColor) and fades to full clip
        const dipAlpha = Math.max(0, Math.min(1, progress));
        canvasCtx.globalAlpha = Math.max(0, Math.min(1, canvasCtx.globalAlpha * dipAlpha));

        // Overlay the dip color fading out
        if (progress < 1.0) {
          canvasCtx.save();
          canvasCtx.fillStyle = dipColor;
          canvasCtx.globalAlpha = 1.0 - progress;
          canvasCtx.fillRect(0, 0, width, height);
          canvasCtx.restore();
        }
        break;
      }

      case 'wipe': {
        canvasCtx.beginPath();
        if (direction === 'left') {
          canvasCtx.rect(0, 0, width * progress, height);
        } else if (direction === 'right') {
          canvasCtx.rect(width * (1 - progress), 0, width * progress, height);
        } else if (direction === 'up') {
          canvasCtx.rect(0, 0, width, height * progress);
        } else if (direction === 'down') {
          canvasCtx.rect(0, height * (1 - progress), width, height * progress);
        }
        canvasCtx.clip();
        break;
      }

      case 'push': {
        let translateX = 0;
        let translateY = 0;
        if (direction === 'left') {
          translateX = width * (1 - progress);
        } else if (direction === 'right') {
          translateX = -width * (1 - progress);
        } else if (direction === 'up') {
          translateY = height * (1 - progress);
        } else if (direction === 'down') {
          translateY = -height * (1 - progress);
        }
        canvasCtx.translate(translateX, translateY);
        break;
      }

      case 'zoom': {
        const scale = 0.5 + progress * 0.5;
        const cx = width * 0.5;
        const cy = height * 0.5;
        canvasCtx.translate(cx, cy);
        canvasCtx.scale(scale, scale);
        canvasCtx.translate(-cx, -cy);
        canvasCtx.globalAlpha = Math.max(0, Math.min(1, canvasCtx.globalAlpha * progress));
        break;
      }

      case 'iris': {
        const maxRadius = Math.hypot(width, height) * 0.5;
        const currentRadius = maxRadius * progress;
        canvasCtx.beginPath();
        canvasCtx.arc(width * 0.5, height * 0.5, currentRadius, 0, Math.PI * 2);
        canvasCtx.clip();
        break;
      }

      case 'radial_wipe': {
        const cx = width * 0.5;
        const cy = height * 0.5;
        const maxRadius = Math.hypot(width, height);
        const endAngle = -Math.PI / 2 + progress * Math.PI * 2;
        canvasCtx.beginPath();
        canvasCtx.moveTo(cx, cy);
        canvasCtx.arc(cx, cy, maxRadius, -Math.PI / 2, endAngle, false);
        canvasCtx.closePath();
        canvasCtx.clip();
        break;
      }

      case 'glitch': {
        canvasCtx.globalAlpha = Math.max(0, Math.min(1, canvasCtx.globalAlpha * progress));
        // Pseudo-random discrete scanline shift
        if (progress < 0.8) {
          const shift = ((localFrame * 37) % 21) - 10;
          canvasCtx.translate(shift, 0);
        }
        break;
      }

      case 'light_leak': {
        canvasCtx.globalAlpha = Math.max(0, Math.min(1, canvasCtx.globalAlpha * progress));
        // Additive warm flash during initial transition frames
        if (progress < 0.7) {
          const flash = Math.sin((progress / 0.7) * Math.PI) * 0.4;
          canvasCtx.save();
          canvasCtx.globalCompositeOperation = 'lighter';
          canvasCtx.fillStyle = `rgba(255, 200, 100, ${flash.toFixed(3)})`;
          canvasCtx.fillRect(0, 0, width, height);
          canvasCtx.restore();
        }
        break;
      }

      default:
        canvasCtx.globalAlpha = Math.max(0, Math.min(1, canvasCtx.globalAlpha * progress));
        break;
    }
  }
}
