import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import type { IDepthEstimationStrategy, DepthOptions, DepthResult } from '../../types';
import { configureHfEnv } from '../../utils';

export class DepthAnythingV2BaseStrategy implements IDepthEstimationStrategy {
  public readonly name = 'depth-anything-v2-base';
  public readonly modelId = 'onnx-community/depth-anything-v2-base';

  private model: any = null;
  private processor: any = null;
  private rawImageClass: any = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.model && this.processor) return;
    if (this.initPromise) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        const { AutoModelForDepthEstimation, AutoProcessor, RawImage, env } = await import('@huggingface/transformers');
        configureHfEnv(env);
        this.rawImageClass = RawImage;
        const [model, processor] = await Promise.all([
          AutoModelForDepthEstimation.from_pretrained(this.modelId, { dtype: 'fp32' }),
          AutoProcessor.from_pretrained(this.modelId)
        ]);
        this.model = model;
        this.processor = processor;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  public async estimateDepth(imageBuffer: Buffer, options?: DepthOptions): Promise<DepthResult> {
    await this.init();

    const RawImage = this.rawImageClass || (await import('@huggingface/transformers')).RawImage;
    const rawImage = await RawImage.fromBlob(new Blob([imageBuffer]));
    const origW = rawImage.width;
    const origH = rawImage.height;

    const inputs = await this.processor(rawImage);
    const outputs = await this.model(inputs);

    const depthTensor = outputs.predicted_depth;
    const depthData = depthTensor.data;
    const dims = depthTensor.dims;
    const [depthH, depthW] = dims.length === 3 ? [dims[1], dims[2]] : [dims[0], dims[1]];

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < depthData.length; i++) {
      const v = depthData[i];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }

    const range = maxVal - minVal || 1.0;
    const depthCanvas = UniversalCanvasProvider.createCanvas(depthW, depthH);
    const depthCtx = depthCanvas.getContext('2d');
    const imgData = depthCtx.createImageData(depthW, depthH);

    for (let i = 0; i < depthData.length; i++) {
      const norm = Math.max(0, Math.min(1, (depthData[i] - minVal) / range));
      const byteVal = Math.round(norm * 255);
      const pos = i * 4;
      imgData.data[pos] = byteVal;
      imgData.data[pos + 1] = byteVal;
      imgData.data[pos + 2] = byteVal;
      imgData.data[pos + 3] = 255;
    }

    depthCtx.putImageData(imgData, 0, 0);

    const fullCanvas = UniversalCanvasProvider.createCanvas(origW, origH);
    const fullCtx = fullCanvas.getContext('2d');
    fullCtx.drawImage(depthCanvas, 0, 0, origW, origH);

    const [targetMin, targetMax] = options?.normalizeRange ?? [0.5, 8.5];
    return {
      depth16Buffer: fullCanvas.toBuffer('image/png'),
      width: origW,
      height: origH,
      minDepth: targetMin,
      maxDepth: targetMax,
      modelUsed: this.modelId
    };
  }
}
