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
import { OpfsCacheStrategy } from './cache/OpfsCacheStrategy';

export * from './canvas/WebCanvasAdapter';
export * from './media-engine/MediabunnyClientSink';
export * from './media-engine/MediabunnyClientStrategy';
export * from './cache/IndexedDbCacheStrategy';
export * from './cache/WebCacheStrategy';
export * from './cache/OpfsCacheStrategy';
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
  VisionEngineRegistry.registerDepthStrategy(new DepthAnythingV2SmallStrategy(), false);

  VisionEngineRegistry.registerSegmentationStrategy(new GrabCutFallbackStrategy(), true);
  VisionEngineRegistry.registerSegmentationStrategy(new RmbgStrategy(), false);
}

export const bootstrapClient = bootstrapCoreWeb;

