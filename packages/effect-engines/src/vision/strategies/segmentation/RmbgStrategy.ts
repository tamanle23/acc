import {
  type ISubjectSegmentationStrategy as IIsomorphicSegmentationStrategy,
  SegmentationStrategyId,
  type VisionImageInput,
  GrabCutFallbackStrategy,
} from '@acc/core-isomorphic';
import type { ISegmentationStrategy, SegmentationOptions, SegmentationResult } from '../../types';
import { configureHfEnv, createCutoutRgba, loadUniversalTransformers } from '../../utils';
import { AutoProcessor, PreTrainedModel } from '@huggingface/transformers';

export class RmbgStrategy implements ISegmentationStrategy, IIsomorphicSegmentationStrategy {
  public readonly id = SegmentationStrategyId.Rmbg14;
  public readonly name = 'rmbg-1.4';
  public readonly modelId = 'briaai/RMBG-1.4';
  public readonly isSupported = true;

  private model: any = null;
  private processor: any = null;
  private rawImageClass: any = null;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.model && this.processor) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const [model, processor] = await Promise.all([
          PreTrainedModel.from_pretrained(this.modelId),
          AutoProcessor.from_pretrained(this.modelId)
        ]);
        this.model = model;
        this.processor = processor;
      } finally {
      }
    })();

    return this.initPromise;
  }

  public async segment(imageBufferOrInput: Buffer | VisionImageInput, options?: SegmentationOptions): Promise<any> {
    await this.init();

    const imageBytes = (imageBufferOrInput as any).data || imageBufferOrInput;
    const RawImage = this.rawImageClass || (await loadUniversalTransformers())?.RawImage;
    if (!RawImage) throw new Error('[RmbgStrategy] RawImage class unavailable.');
    const rawImage = await RawImage.fromBlob(new Blob([imageBytes]));
    const origW = rawImage.width;
    const origH = rawImage.height;

    const inputs = await this.processor(rawImage);
    const outputs = await this.model({ input: inputs.pixel_values });

    const maskData = outputs.output.data;
    const maskW = 1024;
    const maskH = 1024;

    const uint8Mask = new Uint8Array(maskW * maskH);
    for (let i = 0; i < maskW * maskH; i++) {
      const raw = Math.max(0, Math.min(1, maskData[i]));
      // Hermite smoothstep for anti-aliased alpha borders
      const smoothVal = raw * raw * (3 - 2 * raw);
      uint8Mask[i] = Math.round(smoothVal * 255);
    }

    const { rgbaBuffer, alphaBuffer, bbox } = await createCutoutRgba(
      Buffer.from(imageBytes),
      uint8Mask,
      maskW,
      maskH,
      { fillHoles: options?.fillInternalHoles ?? true, featherRadius: options?.featherRadius ?? 2 }
    );

    return {
      maskRgbaBuffer: rgbaBuffer,
      maskAlphaBuffer: alphaBuffer,
      maskAlphaData: new Uint8Array(alphaBuffer),
      width: origW,
      height: origH,
      boundingBox: bbox,
      confidence: 0.97,
      modelUsed: this.modelId
    };
  }
}
