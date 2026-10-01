import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { IDepthEstimationStrategy, DepthOptions, DepthResult } from '../../types';

export class HeuristicDepthStrategy implements IDepthEstimationStrategy {
  public readonly name = 'heuristic-depth';
  public readonly modelId = 'heuristic-luminance-gradient';

  public async init(): Promise<void> {
    // No external weights needed
  }

  public async estimateDepth(imageBuffer: Buffer, options?: DepthOptions): Promise<DepthResult> {
    const original = await loadImage(imageBuffer);
    const w = original.width;
    const h = original.height;

    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(original, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const depthCanvas = createCanvas(w, h);
    const depthCtx = depthCanvas.getContext('2d');
    const depthData = depthCtx.createImageData(w, h);

    for (let y = 0; y < h; y++) {
      const yGradient = (y / h) * 0.4 + 0.2; // Perspective depth gradient
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;

        // Inverted luminance + vertical perspective gradient
        const depthVal = Math.min(255, Math.max(0, Math.round(((1.0 - lum) * 0.6 + yGradient) * 255)));

        depthData.data[idx] = depthVal;
        depthData.data[idx + 1] = depthVal;
        depthData.data[idx + 2] = depthVal;
        depthData.data[idx + 3] = 255;
      }
    }

    depthCtx.putImageData(depthData, 0, 0);

    const [minD, maxD] = options?.normalizeRange ?? [0.5, 8.5];
    return {
      depth16Buffer: depthCanvas.toBuffer('image/png'),
      width: w,
      height: h,
      minDepth: minD,
      maxDepth: maxD,
      modelUsed: this.modelId
    };
  }
}
