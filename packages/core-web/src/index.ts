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
  HeuristicDepthStrategy,
  GrabCutFallbackStrategy,
} from '@acc/core-isomorphic';
import { WebCanvasAdapter } from './canvas/WebCanvasAdapter';
import { MediabunnyClientStrategy } from './media-engine/MediabunnyClientStrategy';
import { IndexedDbCacheStrategy } from './cache/IndexedDbCacheStrategy';
import { WebCacheStrategy } from './cache/WebCacheStrategy';

export * from './canvas/WebCanvasAdapter';
export * from './media-engine/MediabunnyClientSink';
export * from './media-engine/MediabunnyClientStrategy';
export * from './cache/IndexedDbCacheStrategy';
export * from './cache/WebCacheStrategy';
import { DepthAnythingV2SmallStrategy, RmbgStrategy } from '@acc/effect-engines';


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
  if (!ContentCacheRegistry.has(ContentCacheStrategyId.WebCache)) {
    ContentCacheRegistry.register(new WebCacheStrategy());
  }
  if (!ContentCacheRegistry.has(ContentCacheStrategyId.IndexedDb)) {
    ContentCacheRegistry.register(new IndexedDbCacheStrategy());
  }

  // 3. Resilient Default Cache Resolution via PlatformDetector
  // If registered strategies contains indexeddb (which has built-in in-memory fallback),
  // bootstrapClient defaults to 'indexeddb' for browser client parity, unless explicitly overridden.
  const resolvedCacheStrategy =
    options.defaultCacheStrategy ||
    (ContentCacheRegistry.has(ContentCacheStrategyId.IndexedDb)
      ? ContentCacheStrategyId.IndexedDb
      : PlatformDetector.resolveDefaultCacheStrategy([
        ContentCacheStrategyId.IndexedDb,
        ContentCacheStrategyId.WebCache,
        ContentCacheStrategyId.Memory,
      ]));

  if (ContentCacheRegistry.has(resolvedCacheStrategy)) {
    ContentCacheRegistry.setDefault(resolvedCacheStrategy);
  }

  // 4. Client-Safe Vision Strategies Registration (Heuristic & Algorithmic Fallbacks)
  VisionEngineRegistry.registerDepthStrategy(new HeuristicDepthStrategy());
  VisionEngineRegistry.registerDepthStrategy(new DepthAnythingV2SmallStrategy(), true);

  VisionEngineRegistry.registerSegmentationStrategy(new GrabCutFallbackStrategy());
  VisionEngineRegistry.registerSegmentationStrategy(new RmbgStrategy(), true);
}

export const bootstrapClient = bootstrapCoreWeb;

