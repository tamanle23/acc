import { PreTrainedModel, AutoProcessor, RawImage } from '@huggingface/transformers';
import type { ISegmentationStrategy, SegmentationOptions, SegmentationResult } from '../../types';
import { configureHfEnv, createCutoutRgba } from '../../utils';

export class RmbgStrategy implements ISegmentationStrategy {
  public readonly name = 'rmbg-1.4';
  public readonly modelId = 'briaai/RMBG-1.4';

  private model: any = null;
  private processor: any = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.model && this.processor) return;
    if (this.initPromise) return this.initPromise;

    configureHfEnv();
    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        const [model, processor] = await Promise.all([
          PreTrainedModel.from_pretrained(this.modelId),
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

  public async segment(imageBuffer: Buffer, options?: SegmentationOptions): Promise<SegmentationResult> {
    await this.init();

    const rawImage = await RawImage.fromBlob(new Blob([imageBuffer]));
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
      imageBuffer,
      uint8Mask,
      maskW,
      maskH,
      { fillHoles: options?.fillInternalHoles ?? true, featherRadius: options?.featherRadius ?? 2 }
    );

    return {
      maskRgbaBuffer: rgbaBuffer,
      maskAlphaBuffer: alphaBuffer,
      width: origW,
      height: origH,
      boundingBox: bbox,
      confidence: 0.97,
      modelUsed: this.modelId
    };
  }
}
