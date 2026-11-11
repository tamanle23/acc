import type { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import type { PaletteTokens, StudioState, BackgroundBlendMode } from '@/types/studio';
import { getCachedImage } from '@/lib/opfs-storage';
import { PROCEDURAL_BACKGROUND_STRATEGIES, applyDuotoneFilter } from './background';
import { isHighKeyBackground } from '@/core/domain/color';
import { processDarkroomGrading } from '@/lib/darkroom-processor';
import { videoTextureEngine } from '@/lib/video-texture-engine';

export interface RenderBackgroundOptions {
  sctx: SafeCanvas2D;
  width: number;
  height: number;
  palette: PaletteTokens;
  marginX: number;
  marginY: number;
  state?: StudioState;
  theta?: number;
  scaleFactor?: number;
}

function mapCanvasBlendMode(mode?: BackgroundBlendMode, isHighKey = false): GlobalCompositeOperation {
  if (isHighKey && (!mode || mode === 'normal')) {
    // Subtractive ink physics for daylight/paper canvases
    return 'multiply';
  }
  switch (mode) {
    case 'multiply':
      return 'multiply';
    case 'screen':
      return 'screen';
    case 'overlay':
      return 'overlay';
    case 'soft-light':
      return 'soft-light';
    case 'luminosity':
      return 'luminosity';
    case 'normal':
    default:
      return 'source-over';
  }
}

/**
 * Layer 0: Background Plate, Generative Graphics, Image & Border Framing
 */
export function renderBackground({
  sctx,
  width: W,
  height: H,
  palette,
  marginX,
  marginY,
  state,
  theta = 0,
  scaleFactor = 1,
}: RenderBackgroundOptions): void {
  // 1. Base Fill
  const isHighKey = isHighKeyBackground(palette.bg);
  sctx.clearRect(0, 0, W, H);
  sctx.fillStyle = palette.bg;
  sctx.fillRect(0, 0, W, H);

  // 2. Layer 0 Graphics & Custom Imagery (if active)
  if (state && state.layerVisibility.background) {
    const { bgGraphicId, bgOpacity, bgScale, bgBlendMode, bgDuotone, bgMotion, bgCustomImageKey } =
      state;

    // A. Real-World Looping Motion Video Footage (Layer 0)
    if (state.bgVideoUrl) {
      const video = videoTextureEngine.getVideoFrame(state.bgVideoUrl);
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        sctx.save();
        sctx.globalAlpha = Math.max(0, Math.min(1, bgOpacity));
        sctx.raw.globalCompositeOperation = mapCanvasBlendMode(bgBlendMode, isHighKey);

        const videoRatio = video.videoWidth / video.videoHeight;
        const canvasRatio = W / H;
        let dw: number;
        let dh: number;

        if (videoRatio > canvasRatio) {
          dh = H * bgScale;
          dw = dh * videoRatio;
        } else {
          dw = W * bgScale;
          dh = dw / videoRatio;
        }

        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;

        const gradingMode = state.bgDarkroomMode || (bgDuotone ? 'duotone' : 'natural');
        if (gradingMode !== 'natural') {
          const sourceToDraw = processDarkroomGrading(video, {
            mode: gradingMode,
            palette,
            misregistration: state.bgDarkroomMisreg,
            ditherScale: state.bgDarkroomDitherScale,
          });
          sctx.raw.drawImage(sourceToDraw, dx, dy, dw, dh);
        } else {
          sctx.raw.drawImage(video, dx, dy, dw, dh);
        }

        sctx.restore();
      }
    }
    // B. Custom User / Curated Image from OPFS Cache
    else if (bgGraphicId === 'custom-image' && bgCustomImageKey) {
      const img = getCachedImage(bgCustomImageKey);
      if (img && img.width > 0 && img.height > 0) {
        sctx.save();
        sctx.globalAlpha = Math.max(0, Math.min(1, bgOpacity));
        sctx.raw.globalCompositeOperation = mapCanvasBlendMode(bgBlendMode, isHighKey);

        // Aspect Fill / Cover Math with scale
        const imgRatio = img.width / img.height;
        const canvasRatio = W / H;
        let dw: number;
        let dh: number;

        if (imgRatio > canvasRatio) {
          dh = H * bgScale;
          dw = dh * imgRatio;
        } else {
          dw = W * bgScale;
          dh = dw / imgRatio;
        }

        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;

        // Studio Darkroom Media Processor (Tritone, Duotone, 8x8 Bayer Dither, Misregistration)
        let sourceToDraw: HTMLImageElement | HTMLCanvasElement = img;
        const gradingMode = state.bgDarkroomMode || (bgDuotone ? 'duotone' : 'natural');

        if (gradingMode !== 'natural') {
          const cacheKey = `${bgCustomImageKey}-${gradingMode}-${palette.bg}-${palette.accent}-${palette.surface || palette.bg}-${state.bgDarkroomMisreg ? 'misreg' : 'clean'}-${state.bgDarkroomDitherScale ?? 1}`;
          sourceToDraw = processDarkroomGrading(
            img,
            {
              mode: gradingMode,
              palette,
              misregistration: state.bgDarkroomMisreg,
              ditherScale: state.bgDarkroomDitherScale,
            },
            cacheKey
          );
        }

        sctx.raw.drawImage(sourceToDraw, dx, dy, dw, dh);

        sctx.restore();
      }
    } else if (bgGraphicId !== 'solid') {
      // B. 12 Procedural Graphic Engines
      const generator = PROCEDURAL_BACKGROUND_STRATEGIES[bgGraphicId as keyof typeof PROCEDURAL_BACKGROUND_STRATEGIES];
      if (generator) {
        sctx.save();
        // Subtle tactile calibration on light/paper mode
        const effectiveOpacity = Math.max(0, Math.min(1, bgOpacity * (isHighKey ? 0.8 : 1.0)));
        sctx.globalAlpha = effectiveOpacity;
        sctx.raw.globalCompositeOperation = mapCanvasBlendMode(bgBlendMode, isHighKey);

        if (bgScale !== 1) {
          sctx.translate(W * 0.5, H * 0.5);
          sctx.scale(bgScale, bgScale);
          sctx.translate(-W * 0.5, -H * 0.5);
        }

        generator({
          sctx,
          w: W,
          h: H,
          palette,
          theta,
          motion: bgMotion,
          scaleFactor,
        });

        // Optional Algorithmic Duotone Pass
        if (bgDuotone) {
          applyDuotoneFilter(sctx.raw, W, H, palette.bg, palette.accent);
        }

        sctx.restore();
      }
    }
  }

  // 3. Outer Architectural Margin Framing Border
  sctx.strokeStyle = palette.ink;
  sctx.globalAlpha = isHighKey ? 0.08 : 0.12;
  sctx.lineWidth = 1;
  sctx.strokeRect(marginX * 0.4, marginY * 0.4, W - marginX * 0.8, H - marginY * 0.8);
  sctx.globalAlpha = 1;
}
