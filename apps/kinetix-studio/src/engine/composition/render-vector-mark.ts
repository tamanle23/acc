// ============================================================================
// KINETIX STUDIO v5.0 - SVG VECTOR BRAND MARK & EMBLEM RENDERER
// Stamped vector marks with auto-contrast tinting and layout anchor positioning.
// ============================================================================

import type { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import type { StudioState } from '@/types/studio';
import { getAsset } from '@/lib/asset-store';

export interface RenderVectorMarkOptions {
  sctx: SafeCanvas2D;
  width: number;
  height: number;
  state: StudioState;
  scaleFactor: number;
  marginX: number;
  topHeaderY: number;
  stageX: number;
  stageY: number;
  stageW: number;
  stageH: number;
}

const svgImageCache = new Map<string, HTMLImageElement>();
const pendingVectorLoads = new Set<string>();

export function renderVectorMark(options: RenderVectorMarkOptions): void {
  const { sctx, width: W, state, scaleFactor, marginX, topHeaderY, stageX, stageY, stageW, stageH } = options;

  if (!state.vectorLogoKey) return;

  const key = state.vectorLogoKey;
  const img = svgImageCache.get(key);
  if (!img) {
    if (!pendingVectorLoads.has(key)) {
      pendingVectorLoads.add(key);
      getAsset(key)
        .then((record) => {
          if (!record) {
            pendingVectorLoads.delete(key);
            return;
          }
          const blob =
            record.data instanceof Blob
              ? record.data
              : new Blob([record.data as string], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const newImg = new Image();
          newImg.onload = () => {
            svgImageCache.set(key, newImg);
            pendingVectorLoads.delete(key);
            URL.revokeObjectURL(url);
          };
          newImg.onerror = () => {
            pendingVectorLoads.delete(key);
            URL.revokeObjectURL(url);
          };
          newImg.src = url;
        })
        .catch(() => {
          pendingVectorLoads.delete(key);
        });
    }
    return;
  }

  const baseSize = 36 * scaleFactor * (state.vectorLogoScale ?? 1.0);
  const aspect = img.width / (img.height || 1);
  const markW = aspect >= 1 ? baseSize : baseSize * aspect;
  const markH = aspect >= 1 ? baseSize / aspect : baseSize;

  let posX = marginX;
  let posY = topHeaderY + 24 * scaleFactor;

  const anchor = state.vectorLogoAnchor ?? 'top-left';
  switch (anchor) {
    case 'top-right':
      posX = W - marginX - markW;
      posY = topHeaderY + 24 * scaleFactor;
      break;
    case 'hero-plinth':
      posX = stageX + (stageW - markW) / 2;
      posY = stageY + stageH + 8 * scaleFactor;
      break;
    case 'stage-center':
      posX = stageX + (stageW - markW) / 2;
      posY = stageY + (stageH - markH) / 2;
      break;
    case 'top-left':
    default:
      posX = marginX;
      posY = topHeaderY + 24 * scaleFactor;
      break;
  }

  sctx.save();
  const colorMode = state.vectorLogoColor ?? 'accent';

  if (colorMode === 'accent' || colorMode === 'ink') {
    // Tint monochrome SVG via source-in mask
    const tintColor = colorMode === 'accent' ? state.palette.accent : state.palette.ink;
    sctx.save();
    sctx.drawImage(img, posX, posY, markW, markH);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = tintColor;
    sctx.fillRect(posX, posY, markW, markH);
    sctx.restore();
  } else {
    // Original colors
    sctx.drawImage(img, posX, posY, markW, markH);
  }

  sctx.restore();
}
