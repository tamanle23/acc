import type { ISegmentationStrategy, SegmentationOptions, SegmentationResult } from '../../types';
import { configureHfEnv, createCutoutRgba } from '../../utils';

export class SamVitBaseStrategy implements ISegmentationStrategy {
  public readonly name = 'sam-vit-base';
  public readonly modelId = 'Xenova/sam-vit-base';

  private model: any = null;
  private processor: any = null;
  private rawImageClass: any = null;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.model && this.processor) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const { SamModel, AutoProcessor, RawImage, env } = await import('@huggingface/transformers');
      configureHfEnv(env);
      this.rawImageClass = RawImage;
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

    const RawImage = this.rawImageClass || (await import('@huggingface/transformers')).RawImage;
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
        // Positive foreground (label 1)
        [width * 0.50, height * 0.45],
        [width * 0.50, height * 0.26],
        [width * 0.48, height * 0.68],
        [width * 0.58, height * 0.48],
        [width * 0.42, height * 0.45],
        // Negative background margin points (label 0)
        [width * 0.05, height * 0.05],
        [width * 0.95, height * 0.05],
        [width * 0.05, height * 0.95],
        [width * 0.95, height * 0.95],
        [width * 0.50, height * 0.03],
        [width * 0.50, height * 0.97],
        [width * 0.03, height * 0.50],
        [width * 0.97, height * 0.50]
      ]];
      inputLabels = [[1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]];
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

    let bestMaskIdx = 0;
    if (outputs.iou_scores) {
      const scores = outputs.iou_scores.data || outputs.iou_scores;
      let maxScore = -Infinity;
      for (let s = 0; s < scores.length; s++) {
        if (scores[s] > maxScore) {
          maxScore = scores[s];
          bestMaskIdx = s;
        }
      }
    }

    const maskTensor = Array.isArray(masks) ? masks[0] : masks;
    const allMasksData = maskTensor.data || maskTensor;
    const singleMaskData = allMasksData.subarray
      ? allMasksData.subarray(bestMaskIdx * width * height, (bestMaskIdx + 1) * width * height)
      : allMasksData.slice(bestMaskIdx * width * height, (bestMaskIdx + 1) * width * height);

    const { rgbaBuffer, alphaBuffer, bbox } = await createCutoutRgba(
      imageBuffer,
      singleMaskData,
      width,
      height,
      { fillHoles: options?.fillInternalHoles ?? true, featherRadius: options?.featherRadius ?? 2 }
    );

    return {
      maskRgbaBuffer: rgbaBuffer,
      maskAlphaBuffer: alphaBuffer,
      width,
      height,
      boundingBox: bbox,
      confidence: 0.98,
      modelUsed: this.modelId
    };
  }
}
