import { UniversalCanvasProvider, MediaEngineRegistry } from '@acc/core-isomorphic';
import { NapiCanvasAdapter, BunFFIEngineStrategy, FFmpegManager } from '@acc/core';

export async function bootstrapServer(): Promise<void> {
  await FFmpegManager.prepare();
  UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
  if (!MediaEngineRegistry.has('bun-ffi')) {
    MediaEngineRegistry.register(new BunFFIEngineStrategy());
  }
}
