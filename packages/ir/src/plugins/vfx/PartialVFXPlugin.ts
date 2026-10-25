import type {
  ModifierPlugin,
  ModifierContext,
  ClipRenderContext,
  StreamRenderContext,
  MasterCompositeContext,
} from '../ModifierPluginRegistry';

export type PartialVFXType = 'blur' | 'spotlight' | 'glitch' | 'point_emitter' | string;

export interface PartialVFXRegionConfig {
  id?: string;
  type: PartialVFXType;
  x: number; // Normalized center X (0..1)
  y: number; // Normalized center Y (0..1)
  width?: number; // Normalized width (0..1, default 0.3)
  height?: number; // Normalized height (0..1, default 0.2)
  radius?: number; // Spot radius in pixels (default 160)
  intensity?: number; // Multiplier (default 1.0)
  color?: string; // CSS or Hex color string (default '#00d4ff')
}

export interface PartialVFXPluginParams {
  regions: PartialVFXRegionConfig[];
}

/**
 * PartialVFXPlugin:
 * Implements Section 3.3 of Document 7 (`vfx/partial`).
 * Provides high-speed canvas-native localized effects:
 * - 'spotlight': Radial specular beam lighting
 * - 'glitch': Multi-band RGB chromatic slice shifts
 * - 'blur': Localized privacy/frosted glass vignette
 * - 'point_emitter': Pure-math deterministic spark particle bursts
 */
export class PartialVFXPlugin implements ModifierPlugin<PartialVFXPluginParams> {
  public readonly type = 'vfx/partial';
  public readonly targetScope = 'both';
  public readonly targetPhase = 3;
  public readonly schema = {
    fields: {
      regions: {
        key: 'regions',
        label: 'Localized VFX Regions',
        type: 'regions_array' as const,
        description: 'Interactive localized regions for spotlights, chromatic glitch slices, blur, or spark emitters',
        fields: {
          type: {
            key: 'type',
            label: 'Region Effect Type',
            type: 'select' as const,
            defaultValue: 'spotlight',
            options: [
              { label: 'Spotlight Beam', value: 'spotlight' },
              { label: 'Chromatic Glitch', value: 'glitch' },
              { label: 'Privacy Blur', value: 'blur' },
              { label: 'Spark Point Emitter', value: 'point_emitter' },
            ],
          },
          x: {
            key: 'x',
            label: 'Center X',
            type: 'number' as const,
            min: 0,
            max: 1,
            step: 0.01,
            defaultValue: 0.5,
          },
          y: {
            key: 'y',
            label: 'Center Y',
            type: 'number' as const,
            min: 0,
            max: 1,
            step: 0.01,
            defaultValue: 0.5,
          },
          radius: {
            key: 'radius',
            label: 'Radius',
            type: 'number' as const,
            min: 20,
            max: 600,
            step: 5,
            defaultValue: 160,
            unit: 'px',
          },
          width: {
            key: 'width',
            label: 'Region Width',
            type: 'number' as const,
            min: 0.05,
            max: 1.0,
            step: 0.05,
            defaultValue: 0.3,
          },
          height: {
            key: 'height',
            label: 'Region Height',
            type: 'number' as const,
            min: 0.05,
            max: 1.0,
            step: 0.05,
            defaultValue: 0.2,
          },
          intensity: {
            key: 'intensity',
            label: 'Intensity',
            type: 'number' as const,
            min: 0.1,
            max: 4.0,
            step: 0.1,
            defaultValue: 1.5,
          },
          color: {
            key: 'color',
            label: 'Tint Color',
            type: 'color' as const,
            defaultValue: '#00d4ff',
          },
        },
      },
    },
  };

  public validate(params: unknown): params is PartialVFXPluginParams {
    return Boolean(params && typeof params === 'object' && Array.isArray((params as any).regions));
  }

  public async execute(context: ModifierContext, params: PartialVFXPluginParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.partialVfx = {
      regions: params.regions || [],
      active: true,
    };
  }

  public renderClipSpace(ctx: ClipRenderContext, params: PartialVFXPluginParams): void {
    const timeSec = ctx.frame / 30;
    this.drawPartialVFX(ctx.ctx, ctx.width, ctx.height, timeSec, params);
  }

  public renderStreamSpace(ctx: StreamRenderContext, params: PartialVFXPluginParams): void {
    const timeSec = ctx.frame / 30;
    this.drawPartialVFX(ctx.ctx, ctx.width, ctx.height, timeSec, params);
  }

  public renderMasterComposite(ctx: MasterCompositeContext, params: PartialVFXPluginParams): void {
    const timeSec = ctx.frame / 30;
    this.drawPartialVFX(ctx.ctx, ctx.width, ctx.height, timeSec, params);
  }

  /**
   * Deterministic drawing loop for all active partial VFX regions.
   */
  public drawPartialVFX(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number,
    params: PartialVFXPluginParams
  ): void {
    if (!params.regions || params.regions.length === 0) return;

    ctx.save();

    for (const reg of params.regions) {
      const rx = reg.x * w;
      const ry = reg.y * h;
      const rw = (reg.width ?? 0.3) * w;
      const rh = (reg.height ?? 0.2) * h;
      const color = reg.color ?? '#00d4ff';
      const intensity = reg.intensity ?? 1.5;

      if (reg.type === 'spotlight') {
        const rad = Math.max(20, (reg.radius ?? 160) * (w / 1920) * intensity);
        const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rad);
        grad.addColorStop(0, color);
        grad.addColorStop(0.4, `${color}88`);
        grad.addColorStop(0.75, `${color}22`);
        grad.addColorStop(1, 'transparent');

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(rx, ry, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (reg.type === 'glitch') {
        // Multi-band RGB chromatic slice shifts
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const sliceH = rh / 4;
        for (let s = 0; s < 4; s++) {
          const jitter = Math.sin(timeSec * 35 + s * 2.5 + rx) * 12 * intensity;
          const sliceY = ry - rh / 2 + s * sliceH;

          // Magenta band
          ctx.fillStyle = 'rgba(236, 72, 153, 0.45)';
          ctx.fillRect(rx - rw / 2 + jitter, sliceY, rw, sliceH * 0.9);

          // Cyan band
          ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
          ctx.fillRect(rx - rw / 2 - jitter * 0.8, sliceY, rw, sliceH * 0.9);
        }
        ctx.restore();
      } else if (reg.type === 'blur') {
        // Localized soft frosted privacy vignette
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = 18;
        ctx.fillRect(rx - rw / 2, ry - rh / 2, rw, rh);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rx - rw / 2, ry - rh / 2, rw, rh);
        ctx.restore();
      } else if (reg.type === 'point_emitter') {
        // Closed-form deterministic spark emitter burst
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const sparkCount = 16;
        for (let i = 0; i < sparkCount; i++) {
          const spAngle = (i / sparkCount) * Math.PI * 2 + timeSec * 3;
          const life = Math.sin(timeSec * 6 + i * 1.2) * 0.5 + 0.5;
          const spDist = life * 45 * intensity;
          const sx = rx + Math.cos(spAngle) * spDist;
          const sy = ry + Math.sin(spAngle) * spDist;
          const spRad = Math.max(1, (1 - life) * 3 * intensity);

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(sx, sy, spRad, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }
}
