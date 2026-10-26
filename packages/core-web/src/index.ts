import {
  UniversalCanvasProvider,
  MediaEngineRegistry,
  ContentCacheRegistry,
  PlatformDetector,
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

export interface BootstrapClientOptions {
  /**
   * Optional custom default cache strategy ID ('indexeddb' | 'web-cache' | 'memory').
   * If not specified, automatically probed via PlatformDetector.
   */
  defaultCacheStrategy?: string;
}

export function bootstrapClient(options: BootstrapClientOptions = {}): void {
  // 1. Synchronized Canvas & Media Engine Registration
  UniversalCanvasProvider.registerAdapter(new WebCanvasAdapter(), true);

  if (!MediaEngineRegistry.has('mediabunny-client')) {
    MediaEngineRegistry.register(new MediabunnyClientStrategy());
  }
  MediaEngineRegistry.setDefaultEngine('mediabunny-client');

  // 2. Client Cache Strategies Registration
  if (!ContentCacheRegistry.has('web-cache')) {
    ContentCacheRegistry.register(new WebCacheStrategy());
  }
  if (!ContentCacheRegistry.has('indexeddb')) {
    ContentCacheRegistry.register(new IndexedDbCacheStrategy());
  }

  // 3. Resilient Default Cache Resolution via PlatformDetector
  // If registered strategies contains indexeddb (which has built-in in-memory fallback),
  // bootstrapClient defaults to 'indexeddb' for browser client parity, unless explicitly overridden.
  const resolvedCacheStrategy =
    options.defaultCacheStrategy ||
    (ContentCacheRegistry.has('indexeddb')
      ? 'indexeddb'
      : PlatformDetector.resolveDefaultCacheStrategy(['indexeddb', 'web-cache', 'memory']));

  if (ContentCacheRegistry.has(resolvedCacheStrategy)) {
    ContentCacheRegistry.setDefault(resolvedCacheStrategy);
  }
}

