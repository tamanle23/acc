import {
  type DepthOptions as IsomorphicDepthOptions,
  type DepthEstimationResult as IsomorphicDepthResult,
  type VisionImageInput,
  DepthStrategyId,
  UniversalCanvasProvider,
} from '@acc/core-isomorphic';
import type { IDepthEstimationStrategy, DepthOptions, DepthResult } from '../../types';
import { HeuristicDepthStrategy } from './HeuristicDepthStrategy';
import { AutoModelForDepthEstimation, AutoProcessor, RawImage } from '@huggingface/transformers';

export class GlpnMetricStrategy implements IDepthEstimationStrategy {
  public readonly id = DepthStrategyId.GlpnMetric;
  public readonly name = 'glpn-metric';
  public readonly modelId = 'Xenova/glpn-nyu';

  private model: any = null;
  private processor: any = null;
  private rawImageClass: any = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private fallbackStrategy = new HeuristicDepthStrategy();

  public async init(): Promise<void> {
    if (this.model && this.processor) return;
    if (this.initPromise) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        const [model, processor] = await Promise.all([
          AutoModelForDepthEstimation.from_pretrained(this.modelId),
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

  public async estimateDepth(
    imageBufferOrInput: Buffer | Uint8Array | VisionImageInput,
    options?: DepthOptions | IsomorphicDepthOptions
  ): Promise<DepthResult & Partial<IsomorphicDepthResult>> {
    try {
      await this.init();

      const imageBytes = (imageBufferOrInput as any).data || imageBufferOrInput;
      const rawImage = await RawImage.fromBlob(new Blob([imageBytes]));
      const origW = rawImage.width;
      const origH = rawImage.height;

      const inputs = await this.processor(rawImage);
      const outputs = await this.model(inputs);

      const depthTensor = outputs.predicted_depth;
      const depthData = depthTensor.data;
      const dims = depthTensor.dims;
      const [depthH, depthW] = dims.length === 3 ? [dims[1], dims[2]] : [dims[0], dims[1]];

      // GLPN outputs metric depth in meters
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
      const depth16Data = new Uint16Array(depthW * depthH);

      for (let i = 0; i < depthData.length; i++) {
        // Normalize metric depth into grayscale z-map (closer = brighter)
        const norm = Math.max(0, Math.min(1, 1.0 - (depthData[i] - minVal) / range));
        const byteVal = Math.round(norm * 255);
        const pos = i * 4;
        imgData.data[pos] = byteVal;
        imgData.data[pos + 1] = byteVal;
        imgData.data[pos + 2] = byteVal;
        imgData.data[pos + 3] = 255;
        depth16Data[i] = byteVal * 257;
      }

      depthCtx.putImageData(imgData, 0, 0);

      const fullCanvas = UniversalCanvasProvider.createCanvas(origW, origH);
      const fullCtx = fullCanvas.getContext('2d');
      fullCtx.drawImage(depthCanvas, 0, 0, origW, origH);

      const [minD, maxD] = options?.normalizeRange ?? [0.5, 8.5];
      const depth16Buffer = fullCanvas.toBuffer('image/png') as Buffer;

      return {
        depth16Buffer,
        depth16Data,
        width: origW,
        height: origH,
        minDepth: minD,
        maxDepth: maxD,
        modelUsed: this.modelId,
        depthCanvas: fullCanvas,
      };
    } catch (err: any) {
      console.warn(`[GlpnMetricStrategy] Neural inference failed (${err?.message || err}), cascading to HeuristicDepthStrategy.`);
      return await this.fallbackStrategy.estimateDepth(imageBufferOrInput, options);
    }
  }
}
