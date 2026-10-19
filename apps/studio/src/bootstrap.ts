import { UniversalCanvasProvider, MediaEngineRegistry } from '@acc/core-isomorphic';
import { WebCanvasAdapter, MediabunnyClientStrategy } from '@acc/core-web';

export function bootstrapClient(): void {
  UniversalCanvasProvider.registerAdapter(new WebCanvasAdapter(), true);
  if (!MediaEngineRegistry.has('mediabunny-client')) {
    MediaEngineRegistry.register(new MediabunnyClientStrategy());
  }
}
