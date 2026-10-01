import { AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers';
import type { ISegmentationStrategy, SegmentationOptions, SegmentationResult } from '../../types';
import { configureHfEnv, createCutoutRgba } from '../../utils';

export class Sam2TinyStrategy implements ISegmentationStrategy {
  public readonly name = 'sam2-tiny';
  public readonly modelId = 'onnx-community/sam2.1-hiera-tiny-ONNX';

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
          AutoModel.from_pretrained(this.modelId, { dtype: 'fp32' }),
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
    const width = rawImage.width;
    const height = rawImage.height;

    // Build prompt: either explicit points, bounding box, or multi-point centroid prompt
    let inputPoints: number[][][];
    let inputLabels: number[][];

    if (options?.points && options.points.length > 0) {
      inputPoints = [options.points.map(p => [p.x * width, p.y * height])];
      inputLabels = [options.points.map(p => (p.label !== undefined ? p.label : 1))];
    } else if (options?.box) {
      const [bx1, by1, bx2, by2] = options.box;
      inputPoints = [[[ (bx1 + bx2) / 2 * width, (by1 + by2) / 2 * height ]]];
      inputLabels = [[1]];
    } else {
      inputPoints = [[
        // Positive foreground (label 1)
        [width * 0.50, height * 0.45], // Core body
        [width * 0.50, height * 0.26], // Head & crest
        [width * 0.48, height * 0.68], // Lower body & legs
        [width * 0.58, height * 0.48], // Flank / arm
        [width * 0.42, height * 0.45], // Left flank
        // Negative background margin points (label 0)
        [width * 0.05, height * 0.05], // Top-Left corner
        [width * 0.95, height * 0.05], // Top-Right corner
        [width * 0.05, height * 0.95], // Bottom-Left corner
        [width * 0.95, height * 0.95], // Bottom-Right corner
        [width * 0.50, height * 0.03], // Top margin
        [width * 0.50, height * 0.97], // Bottom margin
        [width * 0.03, height * 0.50], // Left margin
        [width * 0.97, height * 0.50]  // Right margin
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

    const maskTensor = Array.isArray(masks) ? (masks[bestMaskIdx] || masks[0]) : masks;
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
      width,
      height,
      boundingBox: bbox,
      confidence: 0.98,
      modelUsed: this.modelId
    };
  }
}
