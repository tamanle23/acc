import type {
  ModifierPlugin,
  ModifierContext,
  ClipRenderContext,
  StreamRenderContext,
  MasterCompositeContext,
} from '../ModifierPluginRegistry';
import type { ModifierTargetScope } from '../../types/modifiers';
import type { SequenceType } from '../../types/VideoIR';

export interface HologramHUDParams {
  ringRadius?: number; // Normalized radius 0..1 (default 0.35)
  scanlineDensity?: number; // Scanline density count (default 40)
  color?: string; // Hex or CSS color string (default '#00ffff')
  rotationSpeed?: number; // Rad/sec multiplier (default 0.5)
  popOutIntensity?: number;
  centerX?: number; // Normalized 0..1 (default 0.5)
  centerY?: number; // Normalized 0..1 (default 0.5)
}

/**
 * HologramHUDPlugin:
 * Implements Section 3.3 of Document 7 (`overlay/hologram_hud` and alias `overlay/sci_fi_hud`).
 * Deterministic procedural cybernetic HUD telemetry:
 * - Pure closed-form rotation: θ(t) = t * rotationSpeed
 * - Segmented outer tech rings with dashed patterns
 * - Counter-rotating inner telemetry ring
 * - Center targeting crosshairs
 * - Dual-scope: Clip-level, Track-level, or Master-level compositing
 */
export class HologramHUDPlugin implements ModifierPlugin<HologramHUDParams> {
  public readonly type = 'overlay/hologram_hud';
  public readonly targetScope: ModifierTargetScope = 'standalone';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['overlay', 'video', 'image'];
  public readonly targetPhase = 3;
  public readonly schema = {
    fields: {
      ringRadius: {
        key: 'ringRadius',
        label: 'Outer Ring Radius',
        type: 'number' as const,
        min: 0.1,
        max: 0.9,
        step: 0.02,
        defaultValue: 0.35,
      },
      scanlineDensity: {
        key: 'scanlineDensity',
        label: 'Scanline Density',
        type: 'number' as const,
        min: 8,
        max: 120,
        step: 2,
        defaultValue: 40,
      },
      rotationSpeed: {
        key: 'rotationSpeed',
        label: 'Reticle Rotation Speed',
        type: 'number' as const,
        min: -4.0,
        max: 4.0,
        step: 0.1,
        defaultValue: 0.5,
        unit: 'rad/s',
      },
      color: {
        key: 'color',
        label: 'HUD Emission Color',
        type: 'color' as const,
        defaultValue: '#00ffff',
      },
    },
  };

  public validate(params: unknown): params is HologramHUDParams {
    return Boolean(params && typeof params === 'object');
  }

  public async execute(context: ModifierContext, params: HologramHUDParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.hologramHud = {
      ringRadius: params.ringRadius ?? 0.35,
      scanlineDensity: params.scanlineDensity ?? 40,
      color: params.color || '#00ffff',
      rotationSpeed: params.rotationSpeed ?? 0.5,
      popOutIntensity: params.popOutIntensity ?? 1.0,
      active: true,
    };
  }

  public renderClipSpace(ctx: ClipRenderContext, params: HologramHUDParams): void {
    const timeSec = ctx.frame / 30; // 30 FPS deterministic base
    this.drawHUD(ctx.ctx, ctx.width, ctx.height, timeSec, params);
  }

  public renderStreamSpace(ctx: StreamRenderContext, params: HologramHUDParams): void {
    const timeSec = ctx.frame / 30;
    this.drawHUD(ctx.ctx, ctx.width, ctx.height, timeSec, params);
  }

  public renderMasterComposite(ctx: MasterCompositeContext, params: HologramHUDParams): void {
    const timeSec = ctx.frame / 30;
    this.drawHUD(ctx.ctx, ctx.width, ctx.height, timeSec, params);
  }

  /**
   * Pure deterministic rendering routine.
   */
  public drawHUD(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number,
    params?: HologramHUDParams
  ): void {
    const ringRadiusNorm = params?.ringRadius ?? 0.35;
    const color = params?.color || '#00ffff';
    const rotationSpeed = params?.rotationSpeed ?? 0.5;
    const popOut = params?.popOutIntensity ?? 1.0;
    const cx = (params?.centerX ?? 0.5) * w;
    const cy = (params?.centerY ?? 0.5) * h;

    ctx.save();
    const baseRadius = Math.min(w, h) * ringRadiusNorm * popOut;
    const rot = timeSec * rotationSpeed;

    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // 1. Outer Segmented Tech Ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.setLineDash([20, 15, 5, 15]);

    ctx.beginPath();
    ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Inner Reverse Counter-Rotating Ring
    ctx.rotate(-rot * 2);
    ctx.setLineDash([40, 20]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Center Targeting Crosshairs
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    const crossSize = 12;
    ctx.beginPath();
    ctx.moveTo(-crossSize, 0);
    ctx.lineTo(crossSize, 0);
    ctx.moveTo(0, -crossSize);
    ctx.lineTo(0, crossSize);
    ctx.stroke();

    // 4. Subtle Telemetry Ticks
    const tickCount = 8;
    for (let i = 0; i < tickCount; i++) {
      const angle = (i * Math.PI * 2) / tickCount;
      const innerR = baseRadius * 0.85;
      const outerR = baseRadius * 0.95;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      ctx.stroke();
    }

    ctx.restore();
  }
}
