import { UniversalCanvasProvider } from '../isomorphic/canvas/UniversalCanvasProvider';
import { MediaEngineRegistry } from '../media-engine/MediaEngineRegistry';
import { NapiCanvasAdapter } from './canvas/NapiCanvasAdapter';
import { BunFFIEngineStrategy } from '../media-engine/strategies/BunFFIEngineStrategy';
import { FFmpegManager } from '../FFmpegManager';

export * from './canvas/NapiCanvasAdapter';
export * from '../../../../packages/core-native/src/buffer/NativeBufferPool';
export { BunFFIEngineStrategy } from '../media-engine/strategies/BunFFIEngineStrategy';
export { FFmpegManager } from '../FFmpegManager';

export async function bootstrapServer(): Promise<void> {
  await FFmpegManager.prepare();
  UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
  if (!MediaEngineRegistry.has('bun-ffi')) {
    MediaEngineRegistry.register(new BunFFIEngineStrategy());
  }
}

// Auto-register default native adapter on server module load
UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
