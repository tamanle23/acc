import { pipeline, RawImage } from '@huggingface/transformers';
import { createCanvas } from '@napi-rs/canvas';
import type { IDepthEstimationStrategy, DepthOptions, DepthResult } from '../../types';
import { configureHfEnv } from '../../utils';

export class DepthAnythingV2SmallStrategy implements IDepthEstimationStrategy {
  public readonly name = 'depth-anything-v2-small';
  public readonly modelId = 'onnx-community/depth-anything-v2-small';

  private depthPipeline: any = null;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.depthPipeline) return;
    if (this.initPromise) return this.initPromise;

    configureHfEnv();
    this.initPromise = (async () => {
      this.depthPipeline = await pipeline('depth-estimation', this.modelId, { dtype: 'fp32' });
    })();

    return this.initPromise;
  }

  public async estimateDepth(imageBuffer: Buffer, options?: DepthOptions): Promise<DepthResult> {
    await this.init();

    const rawImage = await RawImage.fromBlob(new Blob([imageBuffer]));
    const output = await this.depthPipeline(rawImage);

    // output contains depth map image or depth tensor
    const depthRaw = output.depth;
    const w = depthRaw.width || rawImage.width;
    const h = depthRaw.height || rawImage.height;

    // Convert depth values to 16-bit PNG buffer
    const depthCanvas = createCanvas(w, h);
    const depthCtx = depthCanvas.getContext('2d');
    const imgData = depthCtx.createImageData(w, h);

    const data = depthRaw.data || depthRaw;
    for (let i = 0; i < w * h; i++) {
      const val = data[i];
      const norm = typeof val === 'number' && val <= 1.0 ? Math.round(val * 255) : Math.round(Number(val));
      const pos = i * 4;
      imgData.data[pos] = norm;
      imgData.data[pos + 1] = norm;
      imgData.data[pos + 2] = norm;
      imgData.data[pos + 3] = 255;
    }

    depthCtx.putImageData(imgData, 0, 0);

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
