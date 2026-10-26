import {
  type SegmentationOptions as IsomorphicSegOptions,
  type SubjectSegmentationResult as IsomorphicSegResult,
  type VisionImageInput,
  SegmentationStrategyId,
} from '@acc/core-isomorphic';
import type { ISegmentationStrategy, SegmentationOptions, SegmentationResult } from '../../types';
import { AutoProcessor, PreTrainedModel, RawImage } from '@huggingface/transformers';
import { createCutoutRgba } from '../../utils';

export class BiRefNetStrategy implements ISegmentationStrategy {
  public readonly id = SegmentationStrategyId.BiRefNet;
  public readonly name = 'birefnet-general';
  public readonly modelId = 'onnx-community/BiRefNet-general-ONNX';

  private model: any = null;
  private processor: any = null;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.model && this.processor) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const [model, processor] = await Promise.all([
          PreTrainedModel.from_pretrained(this.modelId, { dtype: 'fp16' }).catch(() => PreTrainedModel.from_pretrained(this.modelId)),
          AutoProcessor.from_pretrained(this.modelId)
        ]);
        this.model = model;
        this.processor = processor;
      } finally {
      }
    })();

    return this.initPromise;
  }

  public async segment(
    imageBufferOrInput: Buffer | Uint8Array | VisionImageInput,
    options?: SegmentationOptions | IsomorphicSegOptions
  ): Promise<SegmentationResult & Partial<IsomorphicSegResult>> {

    await this.init();

    const imageBytes = (imageBufferOrInput as any).data || imageBufferOrInput;
    const rawImage = await RawImage.fromBlob(new Blob([imageBytes]));
    const origW = rawImage.width;
    const origH = rawImage.height;

    const inputs = await this.processor(rawImage);
    const outputs = await this.model({ input_image: inputs.pixel_values });

    const maskData = outputs.output_image.data;
    const maskW = 1024;
    const maskH = 1024;

    const uint8Mask = new Uint8Array(maskW * maskH);
    for (let i = 0; i < maskW * maskH; i++) {
      const raw = maskData[i];
      const val = raw < 0 || raw > 1 ? 1 / (1 + Math.exp(-raw)) : raw;
      const clamped = Math.max(0, Math.min(1, val));
      const smoothVal = clamped * clamped * (3 - 2 * clamped);
      uint8Mask[i] = Math.round(smoothVal * 255);
    }

    const { rgbaBuffer, alphaBuffer, bbox } = await createCutoutRgba(
      Buffer.isBuffer(imageBytes) ? imageBytes : Buffer.from(imageBytes),
      uint8Mask,
      maskW,
      maskH,
      { fillHoles: options?.fillInternalHoles ?? true, featherRadius: options?.featherRadius ?? 2 }
    );

    return {
      maskRgbaBuffer: rgbaBuffer,
      maskAlphaBuffer: alphaBuffer,
      maskAlphaData: uint8Mask,
      width: origW,
      height: origH,
      boundingBox: bbox,
      confidence: 0.98,
      modelUsed: this.modelId
    };
  }
}
