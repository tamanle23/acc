import type { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import type { PaletteTokens } from '@/types/studio';

export interface BackgroundGeneratorOptions {
  sctx: SafeCanvas2D;
  w: number;
  h: number;
  palette: PaletteTokens;
  theta: number;
  motion: boolean;
  scaleFactor: number;
}

/**
 * 1. Duotone Gradient Mesh
 * Multi-point radial gradient blend creating smooth, organic light volume.
 */
export function renderDuotoneMesh({
  sctx,
  w,
  h,
  palette,
  theta,
  motion,
}: BackgroundGeneratorOptions): void {
  const drift = motion ? theta * 0.25 : 0;

  // Blob 1: Top-Left Accent Flare
  const p1x = w * (0.25 + 0.12 * Math.sin(drift));
  const p1y = h * (0.28 + 0.1 * Math.cos(drift));
  const grad1 = sctx.createRadialGradient(p1x, p1y, 10, p1x, p1y, w * 0.75);
  grad1.addColorStop(0, palette.accent + '99');
  grad1.addColorStop(0.5, palette.surface + '44');
  grad1.addColorStop(1, 'transparent');

  sctx.save();
  sctx.fillStyle = grad1;
  sctx.fillRect(0, 0, w, h);

  // Blob 2: Bottom-Right Secondary Accent
  const p2x = w * (0.75 - 0.1 * Math.cos(drift * 1.2));
  const p2y = h * (0.72 - 0.1 * Math.sin(drift * 1.2));
  const grad2 = sctx.createRadialGradient(p2x, p2y, 10, p2x, p2y, w * 0.8);
  grad2.addColorStop(0, palette.accent2 + '88');
  grad2.addColorStop(0.6, palette.bg + '33');
  grad2.addColorStop(1, 'transparent');

  sctx.fillStyle = grad2;
  sctx.fillRect(0, 0, w, h);
  sctx.restore();
}
