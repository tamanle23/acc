import {
  UniversalCanvasProvider,
  type IDepthEstimationStrategy as IIsomorphicDepthStrategy,
  DepthStrategyId,
  type VisionImageInput,
  HeuristicDepthStrategy,
} from '@acc/core-isomorphic';
import type { IDepthEstimationStrategy, DepthOptions, DepthResult } from '../../types';
import { UniversalOnnxRuntimeProvider } from '../../UniversalOnnxRuntimeProvider';

export class DepthAnythingV2SmallStrategy implements IDepthEstimationStrategy, IIsomorphicDepthStrategy {
  public readonly id = DepthStrategyId.DepthAnythingV2Small;
  public readonly name = 'depth-anything-v2-small';
  public readonly modelId = 'onnx-community/depth-anything-v2-small';
  public readonly isSupported = true;

  private depthPipeline: any = null;
  private rawImageClass: any = null;
  private initPromise: Promise<void> | null = null;
  private fallbackStrategy = new HeuristicDepthStrategy();

  public async init(): Promise<void> {
    if (this.depthPipeline) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const tf = await UniversalOnnxRuntimeProvider.getTransformers();
      if (!tf) throw new Error('[DepthAnythingV2SmallStrategy] @huggingface/transformers unavailable');
      this.rawImageClass = tf.RawImage;
      this.depthPipeline = await tf.pipeline('depth-estimation', this.modelId, { dtype: 'fp32' });
    })();

    return this.initPromise;
  }

  public async estimateDepth(imageBufferOrInput: Buffer | VisionImageInput, options?: DepthOptions): Promise<any> {
    try {
      await this.init();

      const imageBytes = (imageBufferOrInput as any).data || imageBufferOrInput;
      const rawImage = await this.rawImageClass.fromBlob(new Blob([imageBytes]));
      const output = await this.depthPipeline(rawImage);

      // output contains depth map image or depth tensor
      const depthRaw = output.depth;
      const w = depthRaw.width || rawImage.width;
      const h = depthRaw.height || rawImage.height;

      // Convert depth values to 16-bit PNG buffer
      const depthCanvas = UniversalCanvasProvider.createCanvas(w, h);
      const depthCtx = depthCanvas.getContext('2d');
      const imgData = depthCtx.createImageData(w, h);
      const depth16Data = new Uint16Array(w * h);

      const data = depthRaw.data || depthRaw;
      for (let i = 0; i < w * h; i++) {
        const val = data[i];
        const norm = typeof val === 'number' && val <= 1.0 ? Math.round(val * 255) : Math.round(Number(val));
        const pos = i * 4;
        imgData.data[pos] = norm;
        imgData.data[pos + 1] = norm;
        imgData.data[pos + 2] = norm;
        imgData.data[pos + 3] = 255;
        depth16Data[i] = norm * 257;
      }

      depthCtx.putImageData(imgData, 0, 0);

      const [minD, maxD] = options?.normalizeRange ?? [0.5, 8.5];
      return {
        depth16Buffer: depthCanvas.toBuffer('image/png'),
        depth16Data,
        width: w,
        height: h,
        minDepth: minD,
        maxDepth: maxD,
        modelUsed: this.modelId,
        depthCanvas,
      };
    } catch (err: any) {
      console.warn(`[DepthAnythingV2SmallStrategy] Neural inference failed (${err.message}), cascading to HeuristicDepthStrategy.`);
      const input: VisionImageInput = (imageBufferOrInput as any).data
        ? (imageBufferOrInput as VisionImageInput)
        : {
            data: new Uint8Array(imageBufferOrInput as Buffer),
            width: (imageBufferOrInput as any).width || 800,
            height: (imageBufferOrInput as any).height || 600,
          };
      const res = await this.fallbackStrategy.estimateDepth(input, options);
      return {
        ...res,
        depth16Buffer: res.depthCanvas ? (res.depthCanvas as any).toBuffer('image/png') : Buffer.alloc(0),
      };
    }
  }
}
