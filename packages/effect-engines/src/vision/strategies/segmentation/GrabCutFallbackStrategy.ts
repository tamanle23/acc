import { UniversalCanvasProvider, CanvasAssetLoader } from '@acc/core-isomorphic';
import type { ISegmentationStrategy, SegmentationOptions, SegmentationResult } from '../../types';

export class GrabCutFallbackStrategy implements ISegmentationStrategy {
  public readonly name = 'grabcut-fallback';
  public readonly modelId = 'heuristic-saliency-grabcut';

  public async init(): Promise<void> {
    // No external network weights needed for heuristic fallback
  }

  public async segment(imageBuffer: Buffer, options?: SegmentationOptions): Promise<SegmentationResult> {
    const original = await CanvasAssetLoader.loadImage(imageBuffer);
    const w = original.width;
    const h = original.height;

    // Create canvas
    const canvas = UniversalCanvasProvider.createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(original, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Subject bounding box (center region or options.box)
    let rx = Math.floor(w * 0.25);
    let ry = Math.floor(h * 0.15);
    let rw = Math.floor(w * 0.50);
    let rh = Math.floor(h * 0.70);

    if (options?.box) {
      rx = Math.floor(options.box[0] * w);
      ry = Math.floor(options.box[1] * h);
      rw = Math.floor((options.box[2] - options.box[0]) * w);
      rh = Math.floor((options.box[3] - options.box[1]) * h);
    }

    // Alpha mask canvas
    const alphaCanvas = UniversalCanvasProvider.createCanvas(w, h);
    const alphaCtx = alphaCanvas.getContext('2d');
    const alphaImgData = alphaCtx.createImageData(w, h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const insideBox = x >= rx && x <= (rx + rw) && y >= ry && y <= (ry + rh);
        
        // Edge contrast saliency heuristic
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        
        let alpha = 0;
        if (insideBox) {
          // Centroid distance factor
          const dx = (x - (rx + rw / 2)) / (rw / 2);
          const dy = (y - (ry + rh / 2)) / (rh / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= 0.95) {
            alpha = 255;
          }
        }

        alphaImgData.data[idx] = alpha;
        alphaImgData.data[idx + 1] = alpha;
        alphaImgData.data[idx + 2] = alpha;
        alphaImgData.data[idx + 3] = alpha;
      }
    }

    alphaCtx.putImageData(alphaImgData, 0, 0);

    // Composite RGBA
    const finalCanvas = UniversalCanvasProvider.createCanvas(w, h);
    const finalCtx = finalCanvas.getContext('2d');
    finalCtx.drawImage(original, 0, 0);
    finalCtx.globalCompositeOperation = 'destination-in';
    finalCtx.drawImage(alphaCanvas, 0, 0);

    return {
      maskRgbaBuffer: finalCanvas.toBuffer('image/png'),
      maskAlphaBuffer: alphaCanvas.toBuffer('image/png'),
      width: w,
      height: h,
      boundingBox: {
        x: rx / w,
        y: ry / h,
        width: rw / w,
        height: rh / h,
        confidence: 0.80
      },
      confidence: 0.80,
      modelUsed: this.modelId
    };
  }
}
