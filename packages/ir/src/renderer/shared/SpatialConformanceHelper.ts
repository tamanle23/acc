import type { FitMode, NormalizedCrop } from '../../types/conformance';

export interface CalculatedDrawMapping {
  /** Source crop rectangle in native asset pixels */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Destination bounding box on target canvas */
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  /** Whether the asset scale ratio exceeds 2.0x downscale, warranting power-of-two mipmapping */
  needsDownsamplePyramid: boolean;
  pyramidSteps: number;
}

/**
 * SpatialConformanceHelper:
 * Canonical mathematical utility for mapping media asset bounds onto target timeline dimensions.
 * Resolves:
 * - Normalized sequence crop ({ top, bottom, left, right })
 * - Non-square Pixel Aspect Ratio (PAR) anamorphic desqueeze
 * - Aspect conformity modes: 'cover' (fill & crop), 'fit' (pillar/letterbox), 'stretch', and 'center' (1:1)
 * - Multi-step anti-aliased downsampling thresholding
 */
export class SpatialConformanceHelper {
  public static calculateDrawMapping(
    targetW: number,
    targetH: number,
    srcW: number,
    srcH: number,
    fitMode: FitMode = 'cover',
    crop?: NormalizedCrop,
    par: number = 1.0
  ): CalculatedDrawMapping {
    const cl = Math.max(0, Math.min(0.9, crop?.left ?? 0));
    const cr = Math.max(0, Math.min(0.9 - cl, crop?.right ?? 0));
    const ct = Math.max(0, Math.min(0.9, crop?.top ?? 0));
    const cb = Math.max(0, Math.min(0.9 - ct, crop?.bottom ?? 0));

    const sx = Math.round(srcW * cl);
    const sy = Math.round(srcH * ct);
    const sw = Math.max(1, Math.round(srcW * (1 - cl - cr)));
    const sh = Math.max(1, Math.round(srcH * (1 - ct - cb)));

    const effectiveSw = sw * (Number.isFinite(par) && par > 0 ? par : 1.0);
    let dw = targetW;
    let dh = targetH;

    switch (fitMode) {
      case 'stretch':
        dw = targetW;
        dh = targetH;
        break;
      case 'center':
        dw = effectiveSw;
        dh = sh;
        break;
      case 'fit': {
        const scale = Math.min(targetW / effectiveSw, targetH / sh);
        dw = effectiveSw * scale;
        dh = sh * scale;
        break;
      }
      case 'cover':
      default: {
        const scale = Math.max(targetW / effectiveSw, targetH / sh);
        dw = effectiveSw * scale;
        dh = sh * scale;
        break;
      }
    }

    const dx = (targetW - dw) * 0.5;
    const dy = (targetH - dh) * 0.5;

    const downscaleRatio = Math.max(effectiveSw / Math.max(1, dw), sh / Math.max(1, dh));
    const needsDownsamplePyramid = downscaleRatio > 2.0;
    const pyramidSteps = needsDownsamplePyramid ? Math.floor(Math.log2(downscaleRatio)) : 0;

    return { sx, sy, sw, sh, dx, dy, dw, dh, needsDownsamplePyramid, pyramidSteps };
  }
}
