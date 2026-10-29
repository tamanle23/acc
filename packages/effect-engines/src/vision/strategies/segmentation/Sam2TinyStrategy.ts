import {
  type SegmentationOptions as IsomorphicSegOptions,
  type SubjectSegmentationResult as IsomorphicSegResult,
  type VisionImageInput,
  SegmentationStrategyId,
  type ISubjectSegmentationStrategy as IIsomorphicSegmentationStrategy,
} from '@acc/core-isomorphic';
import type { ISegmentationStrategy, SegmentationOptions, SegmentationResult } from '../../types';
import { createCutoutRgba } from '../../utils';
import { UniversalOnnxRuntimeProvider } from '../../UniversalOnnxRuntimeProvider';

export class Sam2TinyStrategy implements ISegmentationStrategy, IIsomorphicSegmentationStrategy {
  public readonly id = SegmentationStrategyId.Sam2Tiny;
  public readonly name = 'sam2-tiny';
  public readonly modelId = 'onnx-community/sam2.1-hiera-tiny-ONNX';
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
        const tf = await UniversalOnnxRuntimeProvider.getTransformers();
        if (!tf) throw new Error('[Sam2TinyStrategy] @huggingface/transformers unavailable');
        this.rawImageClass = tf.RawImage;
        const [model, processor] = await Promise.all([
          tf.AutoModel.from_pretrained(this.modelId, { dtype: 'fp32' }),
          tf.AutoProcessor.from_pretrained(this.modelId)
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
    const rawImage = await this.rawImageClass.fromBlob(new Blob([imageBytes]));
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
      inputPoints = [[[(bx1 + bx2) / 2 * width, (by1 + by2) / 2 * height]]];
      inputLabels = [[1]];
    } else {
      inputPoints = [[
        [width * 0.50, height * 0.45],
        [width * 0.50, height * 0.26],
        [width * 0.48, height * 0.68],
        [width * 0.58, height * 0.48],
        [width * 0.42, height * 0.45],
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
    if (outputs.iou_predictions) {
      const scores = outputs.iou_predictions.data;
      let maxScore = -Infinity;
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] > maxScore) {
          maxScore = scores[i];
          bestMaskIdx = i;
        }
      }
    }

    const maskTensor = masks[0][bestMaskIdx];
    const maskData = maskTensor.data;
    const maskH = maskTensor.dims[0];
    const maskW = maskTensor.dims[1];

    const uint8Mask = new Uint8Array(maskW * maskH);
    for (let i = 0; i < maskW * maskH; i++) {
      uint8Mask[i] = maskData[i] > 0.0 ? 255 : 0;
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
      width,
      height,
      boundingBox: bbox,
      confidence: 0.95,
      modelUsed: this.modelId
    };
  }
}
