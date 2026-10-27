import {
  GrabCutFallbackStrategy as IsomorphicGrabCutStrategy,
  type VisionImageInput,
  type SegmentationOptions as IsomorphicSegOptions,
  type SubjectSegmentationResult as IsomorphicSegResult,
  type ISubjectSegmentationStrategy as IIsomorphicSegmentationStrategy,
  SegmentationStrategyId,
  UniversalCanvasProvider,
} from '@acc/core-isomorphic';
import type { ISegmentationStrategy, SegmentationOptions, SegmentationResult } from '../../types';

/**
 * GrabCutFallbackStrategy:
 * Re-exported facade backed by `@acc/core-isomorphic`'s zero-download GrabCutFallbackStrategy.
 * Supports both legacy Node Buffer API and modern isomorphic VisionImageInput.
 */
export class GrabCutFallbackStrategy implements ISegmentationStrategy, IIsomorphicSegmentationStrategy {
  public readonly id = SegmentationStrategyId.GrabCutFallback;
  public readonly name = 'grabcut-fallback';
  public readonly modelId = 'heuristic-saliency-grabcut';
  public readonly isSupported = true;
  private isomorphicStrategy = new IsomorphicGrabCutStrategy();

  public async init(): Promise<void> {
    await this.isomorphicStrategy.init();
  }

  public async segment(
    imageBufferOrInput: Buffer | Uint8Array | VisionImageInput,
    options?: SegmentationOptions | IsomorphicSegOptions
  ): Promise<SegmentationResult & Partial<IsomorphicSegResult>> {
    let input: VisionImageInput;

    if (
      typeof imageBufferOrInput === 'object' &&
      'width' in imageBufferOrInput &&
      'height' in imageBufferOrInput &&
      ('data' in imageBufferOrInput || 'canvas' in imageBufferOrInput)
    ) {
      input = imageBufferOrInput as VisionImageInput;
    } else {
      const bytes = imageBufferOrInput as Uint8Array;
      const { CanvasAssetLoader } = await import('@acc/core-isomorphic');
      const loaded = await CanvasAssetLoader.loadImage(bytes);
      input = {
        data: bytes,
        width: loaded.width,
        height: loaded.height,
      };
    }

    const isoResult = await this.isomorphicStrategy.segment(input, options);

    // Create legacy maskRgbaBuffer and maskAlphaBuffer
    const alphaCanvas = UniversalCanvasProvider.acquireScratchCanvas(isoResult.width, isoResult.height);
    const finalCanvas = UniversalCanvasProvider.acquireScratchCanvas(isoResult.width, isoResult.height);

    try {
      const alphaCtx = alphaCanvas.getContext('2d');
      const alphaImgData = alphaCtx.createImageData(isoResult.width, isoResult.height);
      const total = isoResult.width * isoResult.height;
      const alphaData = isoResult.maskAlphaData;

      for (let i = 0; i < total; i++) {
        const a = alphaData[i];
        const pos = i * 4;
        alphaImgData.data[pos] = a;
        alphaImgData.data[pos + 1] = a;
        alphaImgData.data[pos + 2] = a;
        alphaImgData.data[pos + 3] = a;
      }
      alphaCtx.putImageData(alphaImgData, 0, 0);

      const { CanvasAssetLoader } = await import('@acc/core-isomorphic');
      const original = await CanvasAssetLoader.loadImage(input.canvas || input.data);

      const finalCtx = finalCanvas.getContext('2d');
      finalCtx.drawImage(original, 0, 0);
      finalCtx.globalCompositeOperation = 'destination-in';
      finalCtx.drawImage(alphaCanvas, 0, 0);

      const maskRgbaBuffer = finalCanvas.toBuffer('image/png') as Buffer;
      const maskAlphaBuffer = alphaCanvas.toBuffer('image/png') as Buffer;

      return {
        maskRgbaBuffer,
        maskAlphaBuffer,
        maskAlphaData: isoResult.maskAlphaData,
        width: isoResult.width,
        height: isoResult.height,
        boundingBox: isoResult.boundingBox,
        confidence: isoResult.confidence,
        modelUsed: this.modelId,
      };
    } finally {
      UniversalCanvasProvider.releaseScratchCanvas(alphaCanvas);
      UniversalCanvasProvider.releaseScratchCanvas(finalCanvas);
    }
  }
}
