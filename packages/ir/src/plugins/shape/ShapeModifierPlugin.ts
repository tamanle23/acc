import type {
  ModifierPlugin,
  ModifierContext,
  ClipRenderContext,
} from '../ModifierPluginRegistry';

export type ShapeGeometryType =
  | 'rect'
  | 'rounded_rect'
  | 'circle'
  | 'pill'
  | 'star'
  | 'polygon'
  | 'triangle'
  | 'hexagon'
  | 'cross'
  | 'frame';

export interface ShapeModifierParams {
  geometry?: ShapeGeometryType;
  width?: number; // width in px relative to base
  height?: number; // height in px relative to base
  fillColor?: string;
  fillOpacity?: number;
  gradient?: {
    type: 'linear' | 'radial';
    colors: string[];
    angleDeg?: number;
  };
  strokeColor?: string;
  strokeWidth?: number;
  strokeDash?: number[];
  cornerRadius?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  points?: number; // for star or polygon (e.g. 5 for 5-pointed star, 6 for hexagon)
  innerRadiusRatio?: number; // for star (e.g. 0.45)
  [key: string]: any;
}

/**
 * ShapeModifierPlugin:
 * Implements deterministic vector geometry and shape rendering ('shape/draw').
 * Target Scope: 'sequence' (Clip-Space).
 * Target Phase: 2.
 *
 * Renders centered at local coordinate [0, 0] within the sequence's affine matrix stack
 * provided by TransformModifierPlugin, guaranteeing 100% interoperability with
 * on-canvas resize/rotate handles, blend modes, and motion easing curves.
 */
export class ShapeModifierPlugin implements ModifierPlugin<ShapeModifierParams> {
  public readonly type: string;
  public readonly targetScope = 'sequence';
  public readonly targetPhase = 2;
  public readonly schema = {
    fields: {
      geometry: {
        key: 'geometry',
        label: 'Vector Geometry',
        type: 'select' as const,
        defaultValue: 'rounded_rect',
        options: [
          { label: 'Rectangle', value: 'rect' },
          { label: 'Rounded Rectangle', value: 'rounded_rect' },
          { label: 'Circle', value: 'circle' },
          { label: 'Pill Badge', value: 'pill' },
          { label: 'Star', value: 'star' },
          { label: 'Hexagon', value: 'hexagon' },
          { label: 'Triangle', value: 'triangle' },
          { label: 'Cross', value: 'cross' },
          { label: 'Border Frame', value: 'frame' },
        ],
      },
      width: {
        key: 'width',
        label: 'Shape Width',
        type: 'number' as const,
        min: 10,
        max: 1920,
        step: 5,
        defaultValue: 320,
        unit: 'px',
      },
      height: {
        key: 'height',
        label: 'Shape Height',
        type: 'number' as const,
        min: 10,
        max: 1080,
        step: 5,
        defaultValue: 180,
        unit: 'px',
      },
      fillColor: {
        key: 'fillColor',
        label: 'Fill Color',
        type: 'color' as const,
        defaultValue: '#00d4ff',
      },
      strokeWidth: {
        key: 'strokeWidth',
        label: 'Stroke Thickness',
        type: 'number' as const,
        min: 0,
        max: 24,
        step: 1,
        defaultValue: 2,
        unit: 'px',
      },
      strokeColor: {
        key: 'strokeColor',
        label: 'Stroke Color',
        type: 'color' as const,
        defaultValue: '#ffffff',
      },
    },
  };

  constructor(type: string = 'shape/draw') {
    this.type = type;
  }

  public validate(params: unknown): params is ShapeModifierParams {
    return Boolean(params && typeof params === 'object');
  }

  public execute(context: ModifierContext, params: ShapeModifierParams): void {
    if (!context.state) context.state = {};
    context.state.shape = params;
  }

  public renderClipSpace(ctx: ClipRenderContext, params: ShapeModifierParams): void {
    const canvasCtx = ctx.ctx;
    if (!canvasCtx) return;

    const geometry = params.geometry || 'rounded_rect';
    const w = params.width ?? 320;
    const h = params.height ?? 180;
    const halfW = w * 0.5;
    const halfH = h * 0.5;

    // Position origin at center of viewport (default: 50% width, 50% height) + offset
    const originX = ctx.width * (params.normX ?? 0.5) + (params.x ?? 0);
    const originY = ctx.height * (params.normY ?? 0.5) + (params.y ?? 0);

    canvasCtx.save();
    try {
      canvasCtx.translate(originX, originY);

      // 1. Configure drop shadow if specified
      if (params.shadowBlur && params.shadowBlur > 0) {
        canvasCtx.shadowColor = params.shadowColor || 'rgba(0,0,0,0.5)';
        canvasCtx.shadowBlur = params.shadowBlur;
        canvasCtx.shadowOffsetX = params.shadowOffsetX ?? 0;
        canvasCtx.shadowOffsetY = params.shadowOffsetY ?? 4;
      }

      // 2. Configure fill style (gradient vs flat color)
      if (params.gradient && params.gradient.colors && params.gradient.colors.length >= 2) {
        const colors = params.gradient.colors;
        if (params.gradient.type === 'radial') {
          const radGrad = canvasCtx.createRadialGradient(0, 0, 0, 0, 0, Math.max(halfW, halfH));
          colors.forEach((c, idx) => radGrad.addColorStop(idx / (colors.length - 1), c));
          canvasCtx.fillStyle = radGrad;
        } else {
          const angleRad = ((params.gradient.angleDeg ?? 45) * Math.PI) / 180;
          const x1 = -halfW * Math.cos(angleRad);
          const y1 = -halfH * Math.sin(angleRad);
          const x2 = halfW * Math.cos(angleRad);
          const y2 = halfH * Math.sin(angleRad);
          const linGrad = canvasCtx.createLinearGradient(x1, y1, x2, y2);
          colors.forEach((c, idx) => linGrad.addColorStop(idx / (colors.length - 1), c));
          canvasCtx.fillStyle = linGrad;
        }
      } else {
        canvasCtx.fillStyle = params.fillColor || '#4f46e5';
      }

      if (params.fillOpacity !== undefined) {
        canvasCtx.globalAlpha = Math.max(0, Math.min(1, canvasCtx.globalAlpha * params.fillOpacity));
      }

      // 3. Draw vector path based on geometry type
      canvasCtx.beginPath();

      switch (geometry) {
        case 'circle': {
          const radius = Math.min(halfW, halfH);
          canvasCtx.arc(0, 0, radius, 0, Math.PI * 2);
          break;
        }

        case 'pill': {
          const radius = Math.min(halfW, halfH);
          this.drawRoundedRect(canvasCtx, -halfW, -halfH, w, h, radius);
          break;
        }

        case 'rounded_rect': {
          const radius = params.cornerRadius ?? 16;
          this.drawRoundedRect(canvasCtx, -halfW, -halfH, w, h, radius);
          break;
        }

        case 'triangle': {
          canvasCtx.moveTo(0, -halfH);
          canvasCtx.lineTo(halfW, halfH);
          canvasCtx.lineTo(-halfW, halfH);
          canvasCtx.closePath();
          break;
        }

        case 'star': {
          const points = params.points ?? 5;
          const outerR = Math.min(halfW, halfH);
          const innerR = outerR * (params.innerRadiusRatio ?? 0.45);
          for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const px = r * Math.cos(angle);
            const py = r * Math.sin(angle);
            if (i === 0) canvasCtx.moveTo(px, py);
            else canvasCtx.lineTo(px, py);
          }
          canvasCtx.closePath();
          break;
        }

        case 'hexagon': {
          const radius = Math.min(halfW, halfH);
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3 - Math.PI / 6;
            const px = radius * Math.cos(angle);
            const py = radius * Math.sin(angle);
            if (i === 0) canvasCtx.moveTo(px, py);
            else canvasCtx.lineTo(px, py);
          }
          canvasCtx.closePath();
          break;
        }

        case 'cross': {
          const armW = w * 0.35;
          const armH = h * 0.35;
          canvasCtx.moveTo(-armW * 0.5, -halfH);
          canvasCtx.lineTo(armW * 0.5, -halfH);
          canvasCtx.lineTo(armW * 0.5, -armH * 0.5);
          canvasCtx.lineTo(halfW, -armH * 0.5);
          canvasCtx.lineTo(halfW, armH * 0.5);
          canvasCtx.lineTo(armW * 0.5, armH * 0.5);
          canvasCtx.lineTo(armW * 0.5, halfH);
          canvasCtx.lineTo(-armW * 0.5, halfH);
          canvasCtx.lineTo(-armW * 0.5, armH * 0.5);
          canvasCtx.lineTo(-halfW, armH * 0.5);
          canvasCtx.lineTo(-halfW, -armH * 0.5);
          canvasCtx.lineTo(-armW * 0.5, -armH * 0.5);
          canvasCtx.closePath();
          break;
        }

        case 'frame': {
          const borderThickness = params.strokeWidth ?? 8;
          canvasCtx.rect(-halfW, -halfH, w, h);
          canvasCtx.rect(
            -halfW + borderThickness,
            -halfH + borderThickness,
            w - borderThickness * 2,
            h - borderThickness * 2
          );
          break;
        }

        case 'rect':
        default: {
          canvasCtx.rect(-halfW, -halfH, w, h);
          break;
        }
      }

      // 4. Fill path (using evenodd for frame cutouts)
      if (geometry === 'frame') {
        canvasCtx.fill('evenodd');
      } else if (params.fillColor !== 'transparent' && params.fillOpacity !== 0) {
        canvasCtx.fill();
      }

      // 5. Stroke path if specified
      if (params.strokeWidth && params.strokeWidth > 0 && params.strokeColor && params.strokeColor !== 'transparent') {
        canvasCtx.lineWidth = params.strokeWidth;
        canvasCtx.strokeStyle = params.strokeColor;
        if (params.strokeDash && Array.isArray(params.strokeDash)) {
          canvasCtx.setLineDash(params.strokeDash);
        }
        canvasCtx.stroke();
      }
    } finally {
      canvasCtx.restore();
    }
  }

  private drawRoundedRect(
    ctx: any,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
