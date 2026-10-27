import {
  VisionEngineRegistry,
  ContentCacheRegistry,
  DepthStrategyId,
  SegmentationStrategyId,
  SurfaceNormalGenerator,
  UniversalCanvasProvider,
} from '@acc/core-isomorphic';
import { bootstrapCoreWeb } from '@acc/core-web';

// Initialize isomorphic client runtime inside worker context
bootstrapCoreWeb();

export interface VisionWorkerMessage {
  type: 'WARMUP' | 'PROCESS_FRAME';
  payload?: {
    sequenceId: string;
    frame: number;
    mediaHash: string;
    imageBitmap?: ImageBitmap;
    width: number;
    height: number;
    depthStrategy?: string;
    segmentationStrategy?: string;
    options?: {
      normalStrength?: number;
      fillHoles?: boolean;
    };
  };
}

export interface VisionWorkerResponse {
  type: 'WARMED_UP' | 'FRAME_PROCESSED' | 'ERROR';
  sequenceId?: string;
  frame?: number;
  cacheKey?: string;
  error?: string;
}

self.onmessage = async (event: MessageEvent<VisionWorkerMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'WARMUP': {
      try {
        // Eager idle warmup: retrieve default depth and segmentation strategies
        const depthStrategy = VisionEngineRegistry.getDepthStrategy();
        if (typeof (depthStrategy as any).init === 'function') {
          await (depthStrategy as any).init();
        }

        const segStrategy = VisionEngineRegistry.getSegmentationStrategy();
        if (typeof (segStrategy as any).init === 'function') {
          await (segStrategy as any).init();
        }

        self.postMessage({ type: 'WARMED_UP' } as VisionWorkerResponse);
      } catch (err: any) {
        self.postMessage({
          type: 'ERROR',
          error: `[VisionWorker:Warmup] ${err?.message || err}`,
        } as VisionWorkerResponse);
      }
      break;
    }

    case 'PROCESS_FRAME': {
      if (!payload) return;
      const {
        sequenceId,
        frame,
        mediaHash,
        imageBitmap,
        width,
        height,
        depthStrategy: targetDepthId,
        segmentationStrategy: targetSegId,
        options,
      } = payload;

      try {
        // Construct standard deterministic cache key
        const cacheKey = `vision:${sequenceId}:${frame}:${mediaHash}`;
        const cache = ContentCacheRegistry.get();

        if (imageBitmap) {
          // Render ImageBitmap into scratch canvas to extract raw ImageData
          const canvas = UniversalCanvasProvider.acquireScratchCanvas(width, height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(imageBitmap, 0, 0, width, height);
          const imgData = ctx.getImageData(0, 0, width, height);

          // 1. Compute depth map
          const depthStrat = VisionEngineRegistry.getDepthStrategy(
            (targetDepthId as DepthStrategyId) || undefined
          );
          const depthResult = await depthStrat.estimateDepth({
            data: imgData.data,
            width,
            height,
          });

          // 2. Compute surface normal vectors
          const normalMap = SurfaceNormalGenerator.generateFromDepth(
            depthResult.depth16Data,
            width,
            height,
            1,
            options?.normalStrength ?? 2.0
          );

          // 3. Compute subject segmentation cutout
          const segStrat = VisionEngineRegistry.getSegmentationStrategy(
            (targetSegId as SegmentationStrategyId) || undefined
          );
          const segResult = await segStrat.segment(
            { data: imgData.data, width, height },
            { fillInternalHoles: options?.fillHoles ?? true }
          );

          // Release scratch canvas
          UniversalCanvasProvider.releaseScratchCanvas(canvas);
          imageBitmap.close();

          // Package serializable payload to store in ContentCacheRegistry
          const cachedPayload = {
            width,
            height,
            depth16Data: Array.from(depthResult.depth16Data),
            normals: Array.from(normalMap.normals),
            maskAlphaData: segResult.maskAlphaData ? Array.from(segResult.maskAlphaData) : null,
            timestamp: Date.now(),
          };

          const encoded = new TextEncoder().encode(JSON.stringify(cachedPayload));
          await cache.set(cacheKey, encoded);

          self.postMessage({
            type: 'FRAME_PROCESSED',
            sequenceId,
            frame,
            cacheKey,
          } as VisionWorkerResponse);
        }
      } catch (err: any) {
        self.postMessage({
          type: 'ERROR',
          sequenceId,
          frame,
          error: `[VisionWorker:ProcessFrame] ${err?.message || err}`,
        } as VisionWorkerResponse);
      }
      break;
    }

    default:
      break;
  }
};
