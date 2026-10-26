import { UniversalCanvasProvider, CanvasAssetLoader } from '../../canvas';
import {
  type IDepthEstimationStrategy,
  DepthStrategyId,
  type VisionImageInput,
  type DepthOptions,
  type DepthEstimationResult,
} from '../types';

/**
 * HeuristicDepthStrategy:
 * Zero-dependency, isomorphic depth estimation strategy based on luminance gradient
 * and perspective falloff. Runs on both server and client in ~1ms without downloading neural weights.
 */
export class HeuristicDepthStrategy implements IDepthEstimationStrategy {
  public readonly id = DepthStrategyId.Heuristic;
  public readonly name = 'heuristic-depth';
  public readonly isSupported = true;

  public async init(): Promise<void> {
    // Zero dependencies/weights needed
  }

  public async estimateDepth(input: VisionImageInput, options?: DepthOptions): Promise<DepthEstimationResult> {
    const w = input.width;
    const h = input.height;

    const canvas = input.canvas || UniversalCanvasProvider.acquireScratchCanvas(w, h);
    const depthCanvas = UniversalCanvasProvider.acquireScratchCanvas(w, h);

    try {
      const ctx = canvas.getContext('2d');
      let data: Uint8ClampedArray | Uint8Array;

      if (!input.canvas && input.data && input.data.length >= w * h * 4) {
        data = input.data;
      } else {
        if (!input.canvas && input.data) {
          const img = await CanvasAssetLoader.loadImage(input.data);
          ctx.drawImage(img, 0, 0, w, h);
        }
        const imgData = ctx.getImageData(0, 0, w, h);
        data = imgData.data;
      }

      const depthCtx = depthCanvas.getContext('2d');
      const depthData = depthCtx.createImageData(w, h);
      const depth16Data = new Uint16Array(w * h);

      for (let y = 0; y < h; y++) {
        const yGradient = (y / h) * 0.4 + 0.2; // Perspective depth gradient
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const pixelIdx = y * w + x;
          const r = data[idx] ?? 0;
          const g = data[idx + 1] ?? 0;
          const b = data[idx + 2] ?? 0;
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;

          // Inverted luminance + vertical perspective gradient
          const depthVal = Math.min(255, Math.max(0, Math.round(((1.0 - lum) * 0.6 + yGradient) * 255)));

          depthData.data[idx] = depthVal;
          depthData.data[idx + 1] = depthVal;
          depthData.data[idx + 2] = depthVal;
          depthData.data[idx + 3] = 255;

          depth16Data[pixelIdx] = depthVal * 257; // Scale to 16-bit
        }
      }

      depthCtx.putImageData(depthData, 0, 0);

      const [minD, maxD] = options?.normalizeRange ?? [0.5, 8.5];
      return {
        depth16Data,
        width: w,
        height: h,
        minDepth: minD,
        maxDepth: maxD,
        modelUsed: this.id,
        depthCanvas,
      };
    } finally {
      if (!input.canvas) {
        UniversalCanvasProvider.releaseScratchCanvas(canvas);
      }
    }
  }
}
