import { UniversalCanvasProvider } from '../isomorphic/canvas/UniversalCanvasProvider';
import { MediaEngineRegistry } from '../media-engine/MediaEngineRegistry';
import { WebCanvasAdapter } from './canvas/WebCanvasAdapter';
import { MediabunnyClientStrategy } from '../media-engine/strategies/MediabunnyClientStrategy';

export * from './canvas/WebCanvasAdapter';
export { MediabunnyClientStrategy } from '../media-engine/strategies/MediabunnyClientStrategy';

export function bootstrapClient(): void {
  UniversalCanvasProvider.registerAdapter(new WebCanvasAdapter(), true);
  if (!MediaEngineRegistry.has('mediabunny-client')) {
    MediaEngineRegistry.register(new MediabunnyClientStrategy());
  }
}
