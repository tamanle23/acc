import {
  HeuristicDepthStrategy as IsomorphicHeuristicDepthStrategy,
  type VisionImageInput,
  type DepthOptions as IsomorphicDepthOptions,
  type DepthEstimationResult as IsomorphicDepthResult,
  type IDepthEstimationStrategy as IIsomorphicDepthStrategy,
  DepthStrategyId,
  UniversalCanvasProvider,
} from '@acc/core-isomorphic';
import type { IDepthEstimationStrategy, DepthOptions, DepthResult } from '../../types';

/**
 * HeuristicDepthStrategy:
 * Re-exported facade backed by `@acc/core-isomorphic`'s zero-download HeuristicDepthStrategy.
 * Supports both legacy Node Buffer API and modern isomorphic VisionImageInput.
 */
export class HeuristicDepthStrategy implements IDepthEstimationStrategy, IIsomorphicDepthStrategy {
  public readonly id = DepthStrategyId.Heuristic;
  public readonly name = 'heuristic-depth';
  public readonly modelId = 'heuristic-luminance-gradient';
  public readonly isSupported = true;
  private isomorphicStrategy = new IsomorphicHeuristicDepthStrategy();

  public async init(): Promise<void> {
    await this.isomorphicStrategy.init();
  }

  public async estimateDepth(
    imageBufferOrInput: Buffer | Uint8Array | VisionImageInput,
    options?: DepthOptions | IsomorphicDepthOptions
  ): Promise<DepthResult & Partial<IsomorphicDepthResult>> {
    let input: VisionImageInput;

    if (
      typeof imageBufferOrInput === 'object' &&
      'width' in imageBufferOrInput &&
      'height' in imageBufferOrInput &&
      ('data' in imageBufferOrInput || 'canvas' in imageBufferOrInput)
    ) {
      input = imageBufferOrInput as VisionImageInput;
    } else {
      // Decode dimensions via UniversalCanvasProvider if raw Buffer / Uint8Array provided
      const bytes = imageBufferOrInput as Uint8Array;
      const { CanvasAssetLoader } = await import('@acc/core-isomorphic');
      const loaded = await CanvasAssetLoader.loadImage(bytes);
      input = {
        data: bytes,
        width: loaded.width,
        height: loaded.height,
      };
    }

    const isoResult = await this.isomorphicStrategy.estimateDepth(input, options);

    // Create backward-compatible depth16Buffer
    let depth16Buffer: Buffer;
    if (isoResult.depthCanvas) {
      depth16Buffer = isoResult.depthCanvas.toBuffer('image/png') as Buffer;
    } else {
      const depthCanvas = UniversalCanvasProvider.acquireScratchCanvas(isoResult.width, isoResult.height);
      try {
        const ctx = depthCanvas.getContext('2d');
        const imgData = ctx.createImageData(isoResult.width, isoResult.height);
        const total = isoResult.width * isoResult.height;
        const d16 = isoResult.depth16Data;

        for (let i = 0; i < total; i++) {
          const val = d16[i] > 255 ? Math.round(d16[i] / 257) : d16[i];
          const pos = i * 4;
          imgData.data[pos] = val;
          imgData.data[pos + 1] = val;
          imgData.data[pos + 2] = val;
          imgData.data[pos + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        depth16Buffer = depthCanvas.toBuffer('image/png') as Buffer;
      } finally {
        UniversalCanvasProvider.releaseScratchCanvas(depthCanvas);
      }
    }

    return {
      depth16Buffer,
      depth16Data: isoResult.depth16Data,
      width: isoResult.width,
      height: isoResult.height,
      minDepth: isoResult.minDepth,
      maxDepth: isoResult.maxDepth,
      modelUsed: this.modelId,
    };
  }
}
