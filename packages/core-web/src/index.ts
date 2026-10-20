import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { MediaEngineRegistry } from '../../core/src/media-engine/MediaEngineRegistry';
import { WebCanvasAdapter } from './canvas/WebCanvasAdapter';
import { MediabunnyClientStrategy } from '../../core/src/media-engine/strategies/MediabunnyClientStrategy';

export * from './canvas/WebCanvasAdapter';
export { MediabunnyClientStrategy } from '../../core/src/media-engine/strategies/MediabunnyClientStrategy';

export function bootstrapClient(): void {
  UniversalCanvasProvider.registerAdapter(new WebCanvasAdapter(), true);
  if (!MediaEngineRegistry.has('mediabunny-client')) {
    MediaEngineRegistry.register(new MediabunnyClientStrategy());
  }
}
