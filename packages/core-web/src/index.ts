import {
  UniversalCanvasProvider,
  MediaEngineRegistry,
  MediaEngineType,
  ContentCacheRegistry,
  ContentCacheStrategyId,
  PlatformDetector,
  VisionEngineRegistry,
  DepthStrategyId,
  SegmentationStrategyId,
  IDepthEstimationStrategy,
  ISubjectSegmentationStrategy,
  HeuristicDepthStrategy,
  GrabCutFallbackStrategy,
} from '@acc/core-isomorphic';
import { WebCanvasAdapter } from './canvas/WebCanvasAdapter';
import { MediabunnyClientStrategy } from './media-engine/MediabunnyClientStrategy';
import { IndexedDbCacheStrategy } from './cache/IndexedDbCacheStrategy';
import { WebCacheStrategy } from './cache/WebCacheStrategy';
import { OpfsCacheStrategy } from './cache/OpfsCacheStrategy';

export * from './canvas/WebCanvasAdapter';
export * from './canvas/CanvasTransferTracker';
export * from './media-engine/MediabunnyClientSink';
export * from './media-engine/MediabunnyClientStrategy';
export * from './cache/IndexedDbCacheStrategy';
export * from './cache/WebCacheStrategy';
export * from './cache/OpfsCacheStrategy';
// Lightweight lazy proxies for neural vision models to avoid bundling Transformers.js and ONNX on the main thread
export class LazyNeuralDepthStrategy implements IDepthEstimationStrategy {
  public readonly id = DepthStrategyId.DepthAnythingV2Small;
  public readonly name = 'depth-anything-v2-small';
  public readonly modelId = 'onnx-community/depth-anything-v2-small';
  public readonly isSupported = true;
  private delegate: IDepthEstimationStrategy | null = null;

  public async init(): Promise<void> {
    if (!this.delegate) {
      const { DepthAnythingV2SmallStrategy } = await import('@acc/effect-engines');
      this.delegate = new DepthAnythingV2SmallStrategy();
    }
    if (typeof this.delegate.init === 'function') {
      await this.delegate.init();
    }
  }

  public async estimateDepth(input: any, options?: any): Promise<any> {
    await this.init();
    return this.delegate!.estimateDepth(input, options);
  }
}

export class LazyNeuralSegmentationStrategy implements ISubjectSegmentationStrategy {
  public readonly id = SegmentationStrategyId.Rmbg14;
  public readonly name = 'rmbg-1.4';
  public readonly modelId = 'briaai/RMBG-1.4';
  public readonly isSupported = true;
  private delegate: ISubjectSegmentationStrategy | null = null;

  public async init(): Promise<void> {
    if (!this.delegate) {
      const { RmbgStrategy } = await import('@acc/effect-engines');
      this.delegate = new RmbgStrategy();
    }
    if (typeof this.delegate.init === 'function') {
      await this.delegate.init();
    }
  }

  public async segment(input: any, options?: any): Promise<any> {
    await this.init();
    return this.delegate!.segment(input, options);
  }
}


export interface BootstrapClientOptions {
  /**
   * Optional custom default cache strategy ID ('indexeddb' | 'web-cache' | 'memory').
   * If not specified, automatically probed via PlatformDetector.
   */
  defaultCacheStrategy?: ContentCacheStrategyId | string;
}

export function bootstrapCoreWeb(options: BootstrapClientOptions = {}): void {
  // 1. Synchronized Canvas & Media Engine Registration
  UniversalCanvasProvider.registerAdapter(new WebCanvasAdapter(), true);

  if (!MediaEngineRegistry.has(MediaEngineType.MediabunnyClient)) {
    MediaEngineRegistry.register(new MediabunnyClientStrategy());
  }
  MediaEngineRegistry.setDefaultEngine(MediaEngineType.MediabunnyClient);

  // 2. Client Cache Strategies Registration
  const opfsStrategy = new OpfsCacheStrategy();
  if (!ContentCacheRegistry.hasStrategy(ContentCacheStrategyId.Opfs)) {
    ContentCacheRegistry.register(opfsStrategy);
  }
  if (!ContentCacheRegistry.hasStrategy(ContentCacheStrategyId.WebCache)) {
    ContentCacheRegistry.register(new WebCacheStrategy());
  }
  if (!ContentCacheRegistry.hasStrategy(ContentCacheStrategyId.IndexedDb)) {
    ContentCacheRegistry.register(new IndexedDbCacheStrategy());
  }

  // 3. Resilient Default Cache Resolution via PlatformDetector
  // Defaults to 'opfs' if supported, otherwise 'indexeddb' for browser client parity.
  const resolvedCacheStrategy =
    options.defaultCacheStrategy ||
    (opfsStrategy.isSupported()
      ? ContentCacheStrategyId.Opfs
      : ContentCacheRegistry.hasStrategy(ContentCacheStrategyId.IndexedDb)
        ? ContentCacheStrategyId.IndexedDb
        : PlatformDetector.resolveDefaultCacheStrategy([
          ContentCacheStrategyId.IndexedDb,
          ContentCacheStrategyId.WebCache,
        ]));

  if (ContentCacheRegistry.hasStrategy(resolvedCacheStrategy)) {
    ContentCacheRegistry.setDefault(resolvedCacheStrategy);
  }

  // 4. Client-Safe Vision Strategies Registration (Heuristic & Algorithmic Defaults)
  VisionEngineRegistry.registerDepthStrategy(new HeuristicDepthStrategy(), true);
  VisionEngineRegistry.registerDepthStrategy(new LazyNeuralDepthStrategy(), false);

  VisionEngineRegistry.registerSegmentationStrategy(new GrabCutFallbackStrategy(), true);
  VisionEngineRegistry.registerSegmentationStrategy(new LazyNeuralSegmentationStrategy(), false);
}

export const bootstrapClient = bootstrapCoreWeb;

