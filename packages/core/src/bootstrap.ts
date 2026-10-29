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
import { DepthAnythingV2SmallStrategy, RmbgStrategy } from '@acc/effect-engines';
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
  if (!ContentCacheRegistry.hasStrategy(ContentCacheStrategyId.NativeFile)) {
    ContentCacheRegistry.register(new NativeFileCacheStrategy(options.cacheOptions), true);
  }

  // 3. Register server media engines
  if (!MediaEngineRegistry.has(MediaEngineType.BunFFI)) {
    MediaEngineRegistry.register(new BunFFIEngineStrategy());
  }

  if (!MediaEngineRegistry.has(MediaEngineType.MediabunnyServer)) {
    MediaEngineRegistry.register(new MediabunnyServerStrategy());
  }

  if (!MediaEngineRegistry.has(MediaEngineType.FluentFFmpeg)) {
    MediaEngineRegistry.register(new FluentFFmpegEngineStrategy());
  }

  // 4. Set the default media engine (explicit option or coordinated PlatformDetector resolution)
  const resolvedDefaultEngine = options.defaultMediaEngine || PlatformDetector.resolveDefaultMediaEngine();
  MediaEngineRegistry.setDefaultEngine(resolvedDefaultEngine);

  // 5. Register server vision strategies
  if (!VisionEngineRegistry.hasDepthStrategy(DepthStrategyId.Heuristic)) {
    VisionEngineRegistry.registerDepthStrategy(new HeuristicDepthStrategy());
  }
  if (!VisionEngineRegistry.hasDepthStrategy(DepthStrategyId.DepthAnythingV2Small)) {
    VisionEngineRegistry.registerDepthStrategy(new DepthAnythingV2SmallStrategy(), true);
  }

  if (!VisionEngineRegistry.hasSegmentationStrategy(SegmentationStrategyId.GrabCutFallback)) {
    VisionEngineRegistry.registerSegmentationStrategy(new GrabCutFallbackStrategy());
  }
  if (!VisionEngineRegistry.hasSegmentationStrategy(SegmentationStrategyId.Rmbg14)) {
    VisionEngineRegistry.registerSegmentationStrategy(new RmbgStrategy(), true);
  }

  // 6. Optionally prepare FFmpeg if requested
  if (options.prepareFFmpeg) {
    await FFmpegManager.prepare();
  }
}
