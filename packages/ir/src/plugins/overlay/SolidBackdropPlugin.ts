import type {
  ModifierPlugin,
  ClipRenderContext,
  ModifierParameterSchema,
} from '../ModifierPluginRegistry';
import type { ModifierTargetScope, SolidBackdropModifierParams } from '../../types/modifiers';
import type { SequenceType } from '../../types/VideoIR';

/**
 * SolidBackdropPlugin:
 * Implements Standalone Procedural Solid & Gradient Backdrop Generator ('generator/solid_backdrop').
 * Target Scope: 'standalone' (Creates sovereign overlay sequences without requiring media assets).
 * Target Phase: 2 (Clip-Space Sequence Evaluation).
 */
export class SolidBackdropPlugin implements ModifierPlugin<SolidBackdropModifierParams> {
  public readonly type = 'generator/solid_backdrop';
  public readonly targetScope: ModifierTargetScope = 'standalone';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['overlay'];
  public readonly targetPhase = 2;

  public readonly schema: ModifierParameterSchema = {
    displayName: 'Solid & Gradient Backdrop Generator',
    category: 'vfx',
    fields: {
      colorA: {
        key: 'colorA',
        label: 'Primary Color',
        type: 'color',
        defaultValue: '#0b0f19',
      },
      colorB: {
        key: 'colorB',
        label: 'Secondary Color',
        type: 'color',
        defaultValue: '#1e293b',
      },
      type: {
        key: 'type',
        label: 'Fill Mode',
        type: 'select',
        defaultValue: 'linear_gradient',
        options: [
          { label: 'Solid Color', value: 'solid' },
          { label: 'Linear Gradient', value: 'linear_gradient' },
          { label: 'Radial Gradient', value: 'radial_gradient' },
        ],
      },
      angleDeg: {
        key: 'angleDeg',
        label: 'Gradient Angle',
        type: 'number',
        min: 0,
        max: 360,
        step: 5,
        defaultValue: 45,
        unit: '°',
      },
      dither: {
        key: 'dither',
        label: 'Apply Dithering',
        type: 'boolean',
        defaultValue: false,
      },
    },
  };

  public validate(params: unknown): params is SolidBackdropModifierParams {
    if (!params || typeof params !== 'object') return false;
    const p = params as SolidBackdropModifierParams;
    return typeof p.colorA === 'string' && p.colorA.length > 0;
  }

  public renderClipSpace(ctx: ClipRenderContext, params: SolidBackdropModifierParams): void {
    if (!ctx || !ctx.ctx) return;
    const canvasCtx = ctx.ctx;
    const width = ctx.width || 1920;
    const height = ctx.height || 1080;

    const fillType = params.type || 'solid';
    const colorA = params.colorA || '#0b0f19';
    const colorB = params.colorB || '#1e293b';

    canvasCtx.save();
    try {
      if (fillType === 'solid' || !params.colorB) {
        canvasCtx.fillStyle = colorA;
        canvasCtx.fillRect(0, 0, width, height);
      } else if (fillType === 'linear_gradient') {
        const angleRad = ((params.angleDeg ?? 45) * Math.PI) / 180;
        const cx = width / 2;
        const cy = height / 2;
        const halfDiag = Math.sqrt(width * width + height * height) / 2;
        const x0 = cx - Math.cos(angleRad) * halfDiag;
        const y0 = cy - Math.sin(angleRad) * halfDiag;
        const x1 = cx + Math.cos(angleRad) * halfDiag;
        const y1 = cy + Math.sin(angleRad) * halfDiag;

        const grad = canvasCtx.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0, colorA);
        grad.addColorStop(1, colorB);
        canvasCtx.fillStyle = grad;
        canvasCtx.fillRect(0, 0, width, height);
      } else if (fillType === 'radial_gradient') {
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.max(width, height) / 2;
        const grad = canvasCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, colorA);
        grad.addColorStop(1, colorB);
        canvasCtx.fillStyle = grad;
        canvasCtx.fillRect(0, 0, width, height);
      }
    } finally {
      canvasCtx.restore();
    }
  }
}
