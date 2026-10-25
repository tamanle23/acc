import { UniversalCanvasProvider, MediaEngineRegistry, ContentCacheRegistry } from '@acc/core-isomorphic';
import { WebCanvasAdapter } from './canvas/WebCanvasAdapter';
import { MediabunnyClientStrategy } from './media-engine/MediabunnyClientStrategy';
import { IndexedDbCacheStrategy } from './cache/IndexedDbCacheStrategy';

export * from './canvas/WebCanvasAdapter';
export * from './media-engine/MediabunnyClientSink';
export * from './media-engine/MediabunnyClientStrategy';
export * from './cache/IndexedDbCacheStrategy';

export function bootstrapClient(): void {
  UniversalCanvasProvider.registerAdapter(new WebCanvasAdapter(), true);
  if (!MediaEngineRegistry.has('mediabunny-client')) {
    MediaEngineRegistry.register(new MediabunnyClientStrategy());
  }
  if (!ContentCacheRegistry.has('indexeddb')) {
    ContentCacheRegistry.register(new IndexedDbCacheStrategy(), true);
  }
}
