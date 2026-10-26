import {
  UniversalCanvasProvider,
  MediaEngineRegistry,
  ContentCacheRegistry,
  PlatformDetector,
  type MediaEngineType,
} from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from './native/canvas/NapiCanvasAdapter';
import { NativeFileCacheStrategy, type NativeFileCacheOptions } from './cache/NativeFileCacheStrategy';
import { BunFFIEngineStrategy } from './media-engine/strategies/BunFFIEngineStrategy';
import { MediabunnyServerStrategy } from './media-engine/strategies/MediabunnyServerStrategy';
import { FluentFFmpegEngineStrategy } from './media-engine/strategies/FluentFFmpegEngineStrategy';
import { FFmpegManager } from './FFmpegManager';

export interface BootstrapNodeOptions {
  /**
   * If true, prepares FFmpeg binary paths synchronously or awaits FFmpegManager.prepare().
   * Defaults to false (lazy/explicit preparation when needed).
   */
  prepareFFmpeg?: boolean;
  /**
   * Optional default media engine ID to select after registering available strategies.
   * Defaults to 'bun-ffi' on Bun or 'mediabunny-server' / 'fluent-ffmpeg' depending on environment.
   */
  defaultMediaEngine?: MediaEngineType;
  /**
   * Configuration options for NativeFileCacheStrategy.
   */
  cacheOptions?: NativeFileCacheOptions;
}

/**
 * Bootstraps the Node.js / Bun runtime environment by registering native Skia canvas,
 * filesystem cache strategies, and server-side media engines into their respective registries.
 *
 * Analogous to `bootstrapClient()` in `@acc/core-web`.
 *
 * Invariants:
 * - Registers `NapiCanvasAdapter` with `UniversalCanvasProvider` as the default canvas adapter.
 * - Registers `NativeFileCacheStrategy` with `ContentCacheRegistry` (as default if not already present).
 * - Registers `bun-ffi`, `mediabunny-server`, and `fluent-ffmpeg` engines with `MediaEngineRegistry`.
 * - Optionally awaits `FFmpegManager.prepare()` if `prepareFFmpeg: true` is configured.
 */
export async function bootstrapNode(options: BootstrapNodeOptions = {}): Promise<void> {
  // 1. Register native canvas adapter
  UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);

  // 2. Register native disk cache strategy
  if (!ContentCacheRegistry.has('native-file')) {
    ContentCacheRegistry.register(new NativeFileCacheStrategy(options.cacheOptions), true);
  }

  // 3. Register server media engines
  if (!MediaEngineRegistry.has('bun-ffi')) {
    MediaEngineRegistry.register(new BunFFIEngineStrategy());
  }

  if (!MediaEngineRegistry.has('mediabunny-server')) {
    MediaEngineRegistry.register(new MediabunnyServerStrategy());
  }

  if (!MediaEngineRegistry.has('fluent-ffmpeg')) {
    MediaEngineRegistry.register(new FluentFFmpegEngineStrategy());
  }

  // 4. Set the default media engine (explicit option or coordinated PlatformDetector resolution)
  const resolvedDefaultEngine = options.defaultMediaEngine || PlatformDetector.resolveDefaultMediaEngine();
  MediaEngineRegistry.setDefaultEngine(resolvedDefaultEngine);

  // 5. Optionally prepare FFmpeg if requested
  if (options.prepareFFmpeg) {
    await FFmpegManager.prepare();
  }
}
