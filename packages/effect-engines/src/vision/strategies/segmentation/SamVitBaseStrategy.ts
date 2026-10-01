import { SamModel, AutoProcessor, RawImage } from '@huggingface/transformers';
import type { ISegmentationStrategy, SegmentationOptions, SegmentationResult } from '../../types';
import { configureHfEnv, createCutoutRgba } from '../../utils';

export class SamVitBaseStrategy implements ISegmentationStrategy {
  public readonly name = 'sam-vit-base';
  public readonly modelId = 'Xenova/sam-vit-base';

  private model: any = null;
  private processor: any = null;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.model && this.processor) return;
    if (this.initPromise) return this.initPromise;

    configureHfEnv();
    this.initPromise = (async () => {
      const [model, processor] = await Promise.all([
        SamModel.from_pretrained(this.modelId, { dtype: 'fp32' }),
        AutoProcessor.from_pretrained(this.modelId)
      ]);
      this.model = model;
      this.processor = processor;
    })();

    return this.initPromise;
  }

  public async segment(imageBuffer: Buffer, options?: SegmentationOptions): Promise<SegmentationResult> {
    await this.init();

    const rawImage = await RawImage.fromBlob(new Blob([imageBuffer]));
    const width = rawImage.width;
    const height = rawImage.height;

    let inputPoints: number[][][];
    let inputLabels: number[][];

    if (options?.points && options.points.length > 0) {
      inputPoints = [options.points.map(p => [p.x * width, p.y * height])];
      inputLabels = [options.points.map(p => (p.label !== undefined ? p.label : 1))];
    } else {
      inputPoints = [[
        [width * 0.50, height * 0.45],
        [width * 0.50, height * 0.28],
        [width * 0.48, height * 0.65]
      ]];
      inputLabels = [[1, 1, 1]];
    }

    const inputs = await this.processor(rawImage, {
      input_points: inputPoints,
      input_labels: inputLabels
    });

    const outputs = await this.model(inputs);
    const masks = await this.processor.post_process_masks(
      outputs.pred_masks,
      inputs.original_sizes,
      inputs.reshaped_input_sizes
    );

    const maskTensor = Array.isArray(masks) ? masks[0] : masks;
    const maskData = maskTensor.data || maskTensor;

    const { rgbaBuffer, alphaBuffer, bbox } = await createCutoutRgba(
      imageBuffer,
      maskData,
      width,
      height,
      { fillHoles: options?.fillInternalHoles ?? true, featherRadius: options?.featherRadius ?? 2 }
    );

    return {
      maskRgbaBuffer: rgbaBuffer,
      maskAlphaBuffer: alphaBuffer,
      boundingBox: bbox,
      confidence: 0.98,
      modelUsed: this.modelId
    };
  }
}
