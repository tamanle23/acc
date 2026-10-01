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
        [width * 0.50, height * 0.45], // Core body
        [width * 0.50, height * 0.28], // Head & crest
        [width * 0.48, height * 0.65], // Lower body & legs
        [width * 0.58, height * 0.48]  // Flank / arm
      ]];
      inputLabels = [[1, 1, 1, 1]];
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
      width,
      height,
      boundingBox: bbox,
      confidence: 0.98,
      modelUsed: this.modelId
    };
  }
}
