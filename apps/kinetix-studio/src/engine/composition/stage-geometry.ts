// ============================================================================
// KINETIX STUDIO v4.1 - STAGE GEOMETRY & ASPECT RESOLVER
// High-performance geometry builder and dimension solver for Hero Stage (Layer 2)
// Decouples stage geometry and aspect shape from spatial layouts.
// ============================================================================

import type { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import type { StageShape, StageAspect } from '@/types/studio';

export interface StageShapeItem {
  id: StageShape;
  name: string;
  description: string;
  glyph: string;
}

export interface StageAspectItem {
  id: StageAspect;
  name: string;
  ratio: number | null; // width / height
  description: string;
}

export const STAGE_SHAPES: StageShapeItem[] = [
  { id: 'auto', name: 'Layout Auto', description: 'Follows active spatial layout archetype', glyph: 'AUTO' },
  { id: 'rounded-rect', name: 'Rounded Rect', description: 'Classic architectural window with radius', glyph: '▢' },
  { id: 'sharp-rect', name: 'Sharp Box', description: 'Industrial brutalist 0px razor-sharp corners', glyph: '▭' },
  { id: 'circle', name: 'Radial Lens', description: 'Perfect circular aperture', glyph: '○' },
  { id: 'pill', name: 'Pill / Capsule', description: 'Sleek stadium rounded pill frame', glyph: '⬭' },
  { id: 'squircle', name: 'Squircle', description: 'Smooth continuous curvature superellipse', glyph: '▢' },
  { id: 'hexagon', name: 'Cyber Hexagon', description: 'Futuristic 6-sided geometric matrix', glyph: '⬡' },
  { id: 'chamfer', name: 'Chamfer Cut', description: '45-degree angled cyber HUD cut corners', glyph: '⬟' },
  { id: 'diamond', name: 'Diamond', description: 'Rotated 45-degree diamond viewport', glyph: '◇' },
];

export const STAGE_ASPECTS: StageAspectItem[] = [
  { id: 'auto', name: 'Layout Native', ratio: null, description: 'Natural layout proportion' },
  { id: '1:1', name: '1:1 Square', ratio: 1.0, description: 'Square viewport lens' },
  { id: '4:5', name: '4:5 Portrait', ratio: 4 / 5, description: 'Instagram / editorial portrait' },
  { id: '16:9', name: '16:9 Cinema', ratio: 16 / 9, description: 'Widescreen landscape window' },
  { id: '9:16', name: '9:16 Reel', ratio: 9 / 16, description: 'Vertical mobile feed format' },
  { id: '3:2', name: '3:2 Classic', ratio: 3 / 2, description: '35mm photo aspect' },
  { id: '2:1', name: '2:1 Panoramic', ratio: 2 / 1, description: 'Wide cinematic banner' },
];

export interface ResolveStageDimensionsOptions {
  baseX: number;
  baseY: number;
  baseW: number;
  baseH: number;
  aspect: StageAspect;
  scale: number;
  offsetX?: number;
  offsetY: number;
  scaleFactor: number;
}

export interface ResolvedStageDimensions {
  stageX: number;
  stageY: number;
  stageW: number;
  stageH: number;
}

/**
 * Resolves final stage position and dimensions from base layout bounds,
 * aspect ratio override, scale multiplier, and horizontal/vertical offset.
 */
export function resolveStageDimensions({
  baseX,
  baseY,
  baseW,
  baseH,
  aspect,
  scale,
  offsetX,
  offsetY,
  scaleFactor,
}: ResolveStageDimensionsOptions): ResolvedStageDimensions {
  let targetW = baseW;
  let targetH = baseH;

  // 1. Apply Aspect Ratio Constraint (while keeping center aligned to base)
  const aspectDef = STAGE_ASPECTS.find((a) => a.id === aspect);
  if (aspectDef && aspectDef.ratio !== null) {
    const targetRatio = aspectDef.ratio;
    const currentRatio = baseW / baseH;

    if (currentRatio > targetRatio) {
      // Base is wider than target: constrain width based on base height
      targetW = baseH * targetRatio;
      targetH = baseH;
    } else {
      // Base is taller than target: constrain height based on base width
      targetW = baseW;
      targetH = baseW / targetRatio;
    }
  }

  // 2. Apply Stage Scale Multiplier (clamped safely between 0.5 and 1.6)
  const clampedScale = Math.max(0.5, Math.min(1.6, scale || 1.0));
  targetW *= clampedScale;
  targetH *= clampedScale;

  // 3. Re-center relative to base center + apply offsets
  const centerX = baseX + baseW / 2;
  const centerY = baseY + baseH / 2;

  const stageX = centerX - targetW / 2 + (offsetX || 0) * scaleFactor;
  const stageY = centerY - targetH / 2 + (offsetY || 0) * scaleFactor;

  return {
    stageX,
    stageY,
    stageW: targetW,
    stageH: targetH,
  };
}

/**
 * Draws the vector path for the Hero Stage window into the SafeCanvas2D context.
 * Sets up beginPath and path segments without stroke or fill, allowing the caller
 * to clip, stroke, or fill as needed.
 */
export function drawStagePath(
  sctx: SafeCanvas2D,
  x: number,
  y: number,
  w: number,
  h: number,
  shape: StageShape,
  cornerRadius: number,
  scaleFactor: number,
  isLayoutRadial: boolean
): void {
  sctx.beginPath();

  // Resolve 'auto' to either circle or rounded-rect based on layout spec
  const resolvedShape: StageShape =
    shape === 'auto' ? (isLayoutRadial ? 'circle' : 'rounded-rect') : shape;

  switch (resolvedShape) {
    case 'sharp-rect':
      if (typeof sctx.rect === 'function') {
        sctx.rect(x, y, w, h);
      } else {
        sctx.roundRect(x, y, w, h, 0);
      }
      break;

    case 'circle': {
      const radius = Math.min(w, h) / 2;
      sctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2);
      break;
    }

    case 'pill': {
      const radius = Math.min(w, h) / 2;
      sctx.roundRect(x, y, w, h, radius);
      break;
    }

    case 'squircle': {
      // Continuous curvature superellipse via cubic bezier spline
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      const k = 0.55;
      sctx.moveTo(cx, y);
      sctx.bezierCurveTo(cx + rx * (1 - k), y, x + w, cy - ry * (1 - k), x + w, cy);
      sctx.bezierCurveTo(x + w, cy + ry * (1 - k), cx + rx * (1 - k), y + h, cx, y + h);
      sctx.bezierCurveTo(cx - rx * (1 - k), y + h, x, cy + ry * (1 - k), x, cy);
      sctx.bezierCurveTo(x, cy - ry * (1 - k), cx - rx * (1 - k), y, cx, y);
      sctx.closePath();
      break;
    }

    case 'hexagon': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      sctx.moveTo(cx + rx, cy);
      for (let i = 1; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        sctx.lineTo(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
      }
      sctx.closePath();
      break;
    }

    case 'chamfer': {
      const chamfer = Math.min(
        Math.min(w, h) * 0.22,
        Math.max(4 * scaleFactor, cornerRadius * scaleFactor * 1.4)
      );
      sctx.moveTo(x + chamfer, y);
      sctx.lineTo(x + w - chamfer, y);
      sctx.lineTo(x + w, y + chamfer);
      sctx.lineTo(x + w, y + h - chamfer);
      sctx.lineTo(x + w - chamfer, y + h);
      sctx.lineTo(x + chamfer, y + h);
      sctx.lineTo(x, y + h - chamfer);
      sctx.lineTo(x, y + chamfer);
      sctx.closePath();
      break;
    }

    case 'diamond': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      sctx.moveTo(cx, y);
      sctx.lineTo(x + w, cy);
      sctx.lineTo(cx, y + h);
      sctx.lineTo(x, cy);
      sctx.closePath();
      break;
    }

    case 'rounded-rect':
    default: {
      const radius = Math.min(
        Math.max(0, cornerRadius * scaleFactor),
        Math.min(w, h) / 2
      );
      sctx.roundRect(x, y, w, h, radius);
      break;
    }
  }
}
