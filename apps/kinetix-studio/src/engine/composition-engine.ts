// ============================================================================
// KINETIX STUDIO v4.1 - MODULAR POSTER COMPOSITION ENGINE
// Unified Canvas2D deterministic rendering pipeline for:
// - Live Studio Viewport Stage
// - High-DPI Multi-Resolution Snapshots (1x, 2x 4K, 4x Print Master)
// - Offline Deterministic Video Recording
// ============================================================================

import type { StudioState, LayerVisibility } from '@/types/studio';
import type { ChoreographyEnvelope, AudioTelemetry } from '@/types/motion';
import { SafeCanvas2D, type AnyCanvas2DContext } from '@/lib/safe-canvas-2d';
import { getSpatialSkeletonSpec } from '@/engine/spatial-skeleton';

import { renderBackground } from './composition/render-background';
import { renderAmbientLayer } from './composition/render-ambient-layer';
import { renderTypographyLayer } from './composition/render-typography-layer';
import { renderHeroLayer } from './composition/render-hero-layer';
import { renderOverlaysLayer } from './composition/render-overlays-layer';
import { renderVectorMark } from './composition/render-vector-mark';
import { resolveStageDimensions } from './composition/stage-geometry';
import { resolveLayoutGeometry } from './composition/layout-geometry';
import { webGpuShaderBridge } from './shaders/webgpu-bridge';
import { hexToRgbNormalized } from '@/core/domain/color';

// Re-export modular layer renderers for individual consumption
export * from './composition/render-background';
export * from './composition/render-ambient-layer';
export * from './composition/render-typography-layer';
export * from './composition/render-hero-layer';
export * from './composition/render-overlays-layer';
export * from './composition/render-vector-mark';
export * from './composition/stage-geometry';
export * from './composition/layout-geometry';

export interface PosterCompositionOptions {
  width: number;
  height: number;
  state: StudioState;
  frame: number;
  totalFrames: number;
  choreo: ChoreographyEnvelope;
  scale?: number;
  layerVisibility?: LayerVisibility;
  audioTelemetry?: AudioTelemetry;
}

/**
 * Pure, deterministic master composition renderer.
 * Orchestrates modular background, ambient, typography, hero, and overlay layers.
 */
export function renderPosterComposition(
  targetCtx: AnyCanvas2DContext | SafeCanvas2D,
  options: PosterCompositionOptions
): void {
  const sctx = targetCtx instanceof SafeCanvas2D ? targetCtx : new SafeCanvas2D(targetCtx);
  const {
    width: W,
    height: H,
    state,
    frame,
    totalFrames,
    choreo,
    scale = 1,
    layerVisibility = state.layerVisibility,
    audioTelemetry,
  } = options;

  sctx.save();
  if (scale !== 1) {
    sctx.scale(scale, scale);
  }

  // Deterministic normalized progress & angular time
  const progress = totalFrames > 0 ? (frame % totalFrames) / totalFrames : 0;
  const theta = progress * Math.PI * 2;
  const isLandscape = W > H * 1.3;
  const scaleFactor = isLandscape ? Math.max(0.85, H / 324) : (W / 344);

  // Optical Safety Guard: Clamp audio/BPM modulation frequency to <= 3Hz (Three Flashes Rule)
  const safePulseFreq = Math.min(3, Math.max(1, Math.round(state.bpm / 60)));
  const pulse = state.audioReactive
    ? 1 + 0.16 * Math.sin(theta * safePulseFreq)
    : 1 + 0.04 * Math.sin(theta * 2);

  const spec = getSpatialSkeletonSpec(state);
  const { palette } = state;

  // Coordinate Margins (responsive to orientation & mobile safe zone)
  const marginX = state.gridMarginPx * (isLandscape ? W / 576 : W / 344);
  const marginY = state.gridMarginPx * (isLandscape ? H / 324 : H / 612);
  const bottomMargin = state.safeZone916 ? Math.max(marginY, H * 0.21) : marginY;
  const rightMargin = state.safeZone916 ? Math.max(marginX, W * 0.16) : marginX;

  // --------------------------------------------------------------------------
  // LAYER 0: Background Plate & Border Framing
  // --------------------------------------------------------------------------
  renderBackground({
    sctx,
    width: W,
    height: H,
    palette,
    marginX,
    marginY,
    state,
    theta,
    scaleFactor,
  });

  // --------------------------------------------------------------------------
  // LAYER 1: Ambient Environment Plate (24 Shaders + Post-FX)
  // --------------------------------------------------------------------------
  if (layerVisibility.shader) {
    let renderedGpu = false;
    if (state.webGpuEnabled && webGpuShaderBridge.getSupported()) {
      renderedGpu = webGpuShaderBridge.renderRefractiveAcrylic(sctx.raw, W, H, {
        time: theta,
        width: W,
        height: H,
        turbulence: state.shaderTurbulence,
        bass: audioTelemetry?.bass ?? 0,
        mid: audioTelemetry?.mid ?? 0,
        high: audioTelemetry?.high ?? 0,
        chromaticAberration: state.chromaticAberration ?? 0.25,
        paletteBg: hexToRgbNormalized(state.palette.bg),
        paletteAccent: hexToRgbNormalized(state.palette.accent),
      });
    }

    if (!renderedGpu) {
      renderAmbientLayer({
        sctx,
        width: W,
        height: H,
        state,
        theta,
        progress,
        pulse,
        choreo,
        scaleFactor,
        audioTelemetry,
      });
    }
  }

  // Calculate Layout Boundaries for Hero and Typography
  const topHeaderY = marginY + 14 * scaleFactor;
  let contentTopY = topHeaderY + 16 * scaleFactor;
  if ((state.layoutVariant === 'marquee-header' || state.layoutId === 'ticker-band') && layerVisibility.typography) {
    contentTopY += 16 * scaleFactor + 8 * scaleFactor;
  }
  // Reserve vertical space for secondary info footer (divider, date/location, sponsor/billing block)
  const footerHeight = Math.round(34 * scaleFactor);
  const footerY = H - bottomMargin - footerHeight;
  const usableH = Math.max(120, footerY - contentTopY);

  // Resolve Mathematical Spatial Geometry across 6 Layout Engines
  const geom = resolveLayoutGeometry({
    engine: state.layoutEngine,
    variant: state.layoutVariant,
    layoutId: state.layoutId,
    width: W,
    height: H,
    scaleFactor,
    marginX,
    marginY,
    contentTopY,
    footerY,
    usableH,
    topHeadlineFlow: state.topHeadlineFlow,
    isLandscape,
    manualStageShape: state.stageShape,
    manualStageCornerRadius: state.stageCornerRadius,
  });

  // --------------------------------------------------------------------------
  // LAYER 4: Blueprint Grid & Architectural Overlays
  // --------------------------------------------------------------------------
  renderOverlaysLayer({
    sctx,
    width: W,
    height: H,
    state,
    spec,
    geom,
    scaleFactor,
    marginX,
    bottomMargin,
    rightMargin,
    contentTopY,
    footerY,
    usableH,
    theta,
  });

  // Resolve Stage Geometry & Aspect Overrides (decouples manual aspect/scale override from spatial layout base)
  const resolvedStage = resolveStageDimensions({
    baseX: geom.stageX,
    baseY: geom.stageY,
    baseW: geom.stageW,
    baseH: geom.stageH,
    aspect: state.stageAspect ?? 'auto',
    scale: state.stageScale ?? 1.0,
    offsetX: state.stageOffsetX ?? 0,
    offsetY: state.stageOffsetY ?? 0,
    scaleFactor,
  });
  const stageX = resolvedStage.stageX;
  const stageY = resolvedStage.stageY;
  const stageW = resolvedStage.stageW;
  const stageH = resolvedStage.stageH;

  // --------------------------------------------------------------------------
  // LAYER 2 & 3: Hero Stage Window Frame & Hero Focal Subject
  // --------------------------------------------------------------------------
  if (layerVisibility.hero) {
    renderHeroLayer({
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
      stageRotation: geom.stageRotation,
      resolvedShape: geom.stageShape,
      resolvedCornerRadius: geom.stageCornerRadius,
    });
  }

  // --------------------------------------------------------------------------
  // LAYER 5 & 6: Kinetic Typography Engine & Telemetry Footer
  // --------------------------------------------------------------------------
  if (layerVisibility.typography) {
    renderTypographyLayer({
      sctx,
      width: W,
      height: H,
      state,
      spec,
      theta,
      choreo,
      scaleFactor,
      marginX,
      marginY,
      topHeaderY,
      contentTopY,
      typeX: geom.typeX,
      typeY: geom.typeY,
      typeW: geom.typeW,
      footerY,
      audioTelemetry,
      typeAlign: geom.typeAlign,
      typeScale: geom.typeScale,
    });
  }

  // --------------------------------------------------------------------------
  // LAYER 7: Stamped SVG Vector Brand Mark
  // --------------------------------------------------------------------------
  if (state.vectorLogoKey) {
    renderVectorMark({
      sctx,
      width: W,
      height: H,
      state,
      scaleFactor,
      marginX,
      topHeaderY,
      stageX,
      stageY,
      stageW,
      stageH,
    });
  }

  sctx.restore();
}
