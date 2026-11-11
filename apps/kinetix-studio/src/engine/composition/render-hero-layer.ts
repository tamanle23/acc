import type { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import type { StudioState, StageShape } from '@/types/studio';
import type { ChoreographyEnvelope, AudioTelemetry } from '@/types/motion';
import type { SpatialSkeletonSpec } from '@/types/spatial';
import { renderHeroSubject } from '@/engine/heroes';
import { drawStagePath } from './stage-geometry';
import { toRgbaString } from '@/core/domain/color';
import { getCutoutImageSync, getCutoutImage } from '@/lib/image-cutout';

export interface RenderHeroLayerOptions {
  sctx: SafeCanvas2D;
  stageX: number;
  stageY: number;
  stageW: number;
  stageH: number;
  scaleFactor: number;
  state: StudioState;
  spec: SpatialSkeletonSpec;
  theta: number;
  pulse: number;
  choreo: ChoreographyEnvelope;
  audioTelemetry?: AudioTelemetry;
  stageRotation?: number;
  resolvedShape?: StageShape;
  resolvedCornerRadius?: number;
}

let sharedBlurCanvas: HTMLCanvasElement | null = null;

function getSharedBlurCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (!sharedBlurCanvas) {
    sharedBlurCanvas = document.createElement('canvas');
  }
  return sharedBlurCanvas;
}

/**
 * Layer 3: Hero Stage Window Frame & Hero Focal Subject
 */
export function renderHeroLayer({
  sctx,
  stageX,
  stageY,
  stageW,
  stageH,
  scaleFactor,
  state,
  spec,
  theta,
  pulse,
  choreo,
  audioTelemetry,
  stageRotation = 0,
  resolvedShape,
  resolvedCornerRadius,
}: RenderHeroLayerOptions): void {
  const { palette } = state;
  const isRadial = spec.heroPosition === 'radial';

  sctx.save();

  // Dynamic Angular Posture for layouts with native skew/rotation (e.g., constructivist, diagonal-slanted, chaotic-grunge)
  if (stageRotation !== 0) {
    const cx = stageX + stageW / 2;
    const cy = stageY + stageH / 2;
    sctx.translate(cx, cy);
    sctx.rotate(stageRotation);
    sctx.translate(-cx, -cy);
  }

  const stageShape = state.stageShape !== 'auto' ? (state.stageShape ?? 'auto') : (resolvedShape ?? 'auto');
  const cornerRadius = state.stageCornerRadius ?? resolvedCornerRadius ?? 10;
  const stageOpacity = typeof state.stageOpacity === 'number'
    ? Math.max(0, Math.min(1, state.stageOpacity))
    : 0.5;
  const stageBlurPx = typeof state.stageBlurPx === 'number'
    ? Math.max(0, state.stageBlurPx)
    : 0;

  // Backdrop blur is only active when there is a visible surface (stageOpacity > 0.01),
  // acrylic blur is dialed above 0, and not 100% solid. If stageOpacity is 0%, interior is 100% transparent.
  const hasBackdropBlur = stageOpacity > 0.01 && stageOpacity < 0.99 && stageBlurPx > 0.5;
  const hasSurfaceFill = stageOpacity > 0.01;

  // 1. Sample Background Plate & Ambient Shaders behind stage before any foreground draws
  let hasSampledBlur = false;
  const blurCanvas = getSharedBlurCanvas();
  if (hasBackdropBlur && typeof document !== 'undefined' && blurCanvas) {
    try {
      const rawCanvas = sctx.raw.canvas;
      if (rawCanvas && rawCanvas.width > 0 && rawCanvas.height > 0) {
        const matrix = sctx.raw.getTransform ? sctx.raw.getTransform() : null;
        const currentScaleX = matrix ? matrix.a : 1;
        const currentScaleY = matrix ? matrix.d : 1;
        const offsetX = matrix ? matrix.e : 0;
        const offsetY = matrix ? matrix.f : 0;

        const srcX = Math.max(0, Math.round(stageX * currentScaleX + offsetX));
        const srcY = Math.max(0, Math.round(stageY * currentScaleY + offsetY));
        const srcW = Math.min(rawCanvas.width - srcX, Math.round(stageW * currentScaleX));
        const srcH = Math.min(rawCanvas.height - srcY, Math.round(stageH * currentScaleY));

        if (srcW > 0 && srcH > 0) {
          const bufferW = Math.max(1, Math.round(stageW / 2));
          const bufferH = Math.max(1, Math.round(stageH / 2));
          if (blurCanvas.width !== bufferW || blurCanvas.height !== bufferH) {
            blurCanvas.width = bufferW;
            blurCanvas.height = bufferH;
          }
          const bCtx = blurCanvas.getContext('2d');
          if (bCtx) {
            bCtx.clearRect(0, 0, bufferW, bufferH);
            bCtx.drawImage(rawCanvas, srcX, srcY, srcW, srcH, 0, 0, bufferW, bufferH);
            hasSampledBlur = true;
          }
        }
      }
    } catch {
      // Graceful fallback for cross-origin or headless contexts
      hasSampledBlur = false;
    }
  }

  // 2. Stage Outer Drop Shadow (Only cast when stage is a solid card >= 0.70 to avoid blotting out transparent glass)
  if (stageOpacity >= 0.7) {
    sctx.save();
    const shadowAlpha = Math.min(0.7, stageOpacity * 0.6);
    sctx.shadowColor = `rgba(0, 0, 0, ${shadowAlpha})`;
    sctx.shadowBlur = 24 * scaleFactor;
    sctx.shadowOffsetY = 12 * scaleFactor;
    sctx.fillStyle = toRgbaString(palette.bg, stageOpacity);
    drawStagePath(sctx, stageX, stageY, stageW, stageH, stageShape, cornerRadius, scaleFactor, isRadial);
    sctx.fill();
    sctx.restore();
  }

  // 3. Stage Interior Fill & Frosted Glass Backdrop (Clipped to Window Shape)
  // Completely independent: blur runs if stageBlurPx > 0; fill runs if stageOpacity > 0
  if (hasBackdropBlur || hasSurfaceFill) {
    sctx.save();
    drawStagePath(sctx, stageX, stageY, stageW, stageH, stageShape, cornerRadius, scaleFactor, isRadial);
    sctx.clip();

    // A. Backdrop Blur pass (Opacity-proportional blending: scales linearly with Surface Opacity)
    if (hasBackdropBlur && hasSampledBlur && blurCanvas) {
      sctx.save();
      sctx.globalAlpha = stageOpacity;
      const effectiveBlurPx = stageBlurPx * scaleFactor;
      sctx.filter = `blur(${effectiveBlurPx}px)`;
      sctx.drawImage(blurCanvas, stageX, stageY, stageW, stageH);
      sctx.filter = 'none';
      sctx.restore();
    }

    // B. Surface Fill Tint pass
    if (hasSurfaceFill) {
      const colorMode = state.stageColor ?? 'auto';

      if (colorMode === 'auto') {
        const acrylicGrad = sctx.createLinearGradient(stageX, stageY, stageX, stageY + stageH);
        const topSheenAlpha = 0.16 * stageOpacity;
        acrylicGrad.addColorStop(0, `rgba(255, 255, 255, ${topSheenAlpha.toFixed(3)})`);
        acrylicGrad.addColorStop(0.18, toRgbaString(palette.surface, stageOpacity * 0.95));
        acrylicGrad.addColorStop(0.7, toRgbaString(palette.surface, stageOpacity * 0.75));
        acrylicGrad.addColorStop(1, toRgbaString(palette.bg, stageOpacity * 0.5));
        sctx.fillStyle = acrylicGrad;
      } else {
        let resolvedBase = palette.surface;
        if (colorMode === 'surface') resolvedBase = palette.surface;
        else if (colorMode === 'bg') resolvedBase = palette.bg;
        else if (colorMode === 'accent') resolvedBase = palette.accent;
        else if (colorMode === 'accent2') resolvedBase = palette.accent2;
        else if (colorMode === 'ink') resolvedBase = palette.ink;
        else if (colorMode.startsWith('#')) resolvedBase = colorMode;

        sctx.fillStyle = toRgbaString(resolvedBase, stageOpacity);
      }

      drawStagePath(sctx, stageX, stageY, stageW, stageH, stageShape, cornerRadius, scaleFactor, isRadial);
      sctx.fill();
    }

    sctx.restore(); // Restore clipping
  }

  // 4. Crisp Frame Border Stroke Generator
  const renderFrameBorder = () => {
    if (state.stageBorderOpacity <= 0.01) return;
    sctx.save();
    let borderBase = palette.accent;
    const borderMode = state.stageBorderColor ?? 'accent';
    if (borderMode === 'accent') borderBase = palette.accent;
    else if (borderMode === 'accent2') borderBase = palette.accent2;
    else if (borderMode === 'ink') borderBase = palette.ink;
    else if (borderMode === 'surface') borderBase = palette.surface;
    else if (borderMode.startsWith('#')) borderBase = borderMode;

    const strokeWidth = (state.stageBorderWidth ?? 1.5) * scaleFactor;
    sctx.strokeStyle = toRgbaString(borderBase, state.stageBorderOpacity);
    sctx.lineWidth = Math.max(0.5, strokeWidth);
    drawStagePath(sctx, stageX, stageY, stageW, stageH, stageShape, cornerRadius, scaleFactor, isRadial);
    sctx.stroke();
    sctx.restore();
  };

  // If heroBreakout is enabled, draw border behind the popping hero elements
  if (state.heroBreakout) {
    renderFrameBorder();
  }

  // Stage Badge Text Pill (only on non-minimalist / non-typography-first and when stage surface is visible)
  if (
    state.layoutId !== 'minimalist-void' &&
    state.layoutId !== 'typography-first' &&
    stageOpacity > 0.05
  ) {
    sctx.save();
    const badgeStr = spec.badgeText;
    sctx.font = `700 ${Math.round(8 * scaleFactor)}px "Space Mono", monospace`;
    const bMetrics = sctx.measureText(badgeStr);
    const bW = bMetrics.width + 10 * scaleFactor;
    const bH = 13 * scaleFactor;
    const bX = stageX + stageW - bW - 6 * scaleFactor;
    const bY = stageY + 6 * scaleFactor;

    sctx.fillStyle = palette.bg + 'bb';
    sctx.roundRect(bX, bY, bW, bH, 2 * scaleFactor);
    sctx.fill();
    sctx.strokeStyle = palette.ink;
    sctx.lineWidth = 0.5;
    sctx.stroke();

    sctx.fillStyle = palette.accent;
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText(badgeStr, bX + bW / 2, bY + bH / 2);
    sctx.restore();
  }

  // Render Hero Subject Centered inside Stage Window
  sctx.save();
  sctx.translate(stageX, stageY);

  // If heroBreakout is disabled, clip to the stage window bounds
  if (!state.heroBreakout) {
    sctx.save();
    drawStagePath(sctx, 0, 0, stageW, stageH, stageShape, cornerRadius, scaleFactor, isRadial);
    sctx.clip();
  }

  // Scale so that authored hero units scale proportionally across 344p preview and 1080p/2160p export
  sctx.save();
  sctx.scale(scaleFactor, scaleFactor);

  if (state.heroBreakout) {
    sctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    sctx.shadowBlur = 18;
    sctx.shadowOffsetY = 12;
  }

  // Bass frequency energy augments pulse impact
  const bassImpactBoost = state.audioReactive && audioTelemetry ? 1 + audioTelemetry.bass * 0.18 : 1;
  const heroPulse = pulse * (state.heroBreakout ? 1.08 : 1.0) * bassImpactBoost;

  if (state.userPhotoCutoutKey) {
    const cutoutImg = getCutoutImageSync(state.userPhotoCutoutKey);
    if (cutoutImg) {
      const sw = stageW / scaleFactor;
      const sh = stageH / scaleFactor;
      const cx = sw / 2;
      const cy = sh / 2;
      sctx.save();
      sctx.translate(cx, cy);
      const floatY = Math.sin(theta) * 6;
      sctx.translate(0, floatY);
      sctx.scale(heroPulse, heroPulse);

      const aspect = cutoutImg.width / (cutoutImg.height || 1);
      const targetSize = Math.min(sw, sh) * (state.heroBreakout ? 1.25 : 0.95);
      const iw = aspect >= 1 ? targetSize : targetSize * aspect;
      const ih = aspect >= 1 ? targetSize / aspect : targetSize;

      sctx.drawImage(cutoutImg, -iw / 2, -ih / 2, iw, ih);
      sctx.restore();
    } else {
      getCutoutImage(state.userPhotoCutoutKey);
      renderHeroSubject(
        sctx,
        stageW / scaleFactor,
        stageH / scaleFactor,
        state,
        theta + choreo.heroSpinBoost,
        heroPulse,
        choreo
      );
    }
  } else {
    renderHeroSubject(
      sctx,
      stageW / scaleFactor,
      stageH / scaleFactor,
      state,
      theta + choreo.heroSpinBoost,
      heroPulse,
      choreo
    );
  }
  sctx.restore();

  if (!state.heroBreakout) {
    sctx.restore(); // Restore clip
  }

  sctx.restore(); // Restore translate

  // If heroBreakout is disabled, draw crisp frame border on top of stage window so it acts as a bezel
  if (!state.heroBreakout) {
    renderFrameBorder();
  }
  sctx.restore();
}
