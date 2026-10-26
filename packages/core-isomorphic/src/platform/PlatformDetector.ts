import { RuntimeEnvironment, OperatingSystem, type RuntimeCapabilities, type PlatformProfile } from './types';
import { MediaEngineType } from '../media-engine/types';
import { ContentCacheStrategyId } from '../cache/types';

/**
 * PlatformDetector:
 * Zero-dependency, isomorphic runtime and operating system detector with capability probing.
 * Enables synchronized, deterministic defaults across UniversalCanvasProvider, MediaEngineRegistry,
 * and ContentCacheRegistry without native C++ leaks or environment-specific crashes.
 */
export class PlatformDetector {
  private static cachedProfile: PlatformProfile | null = null;

  /**
   * Detects the underlying Operating System.
   * Probes process.platform on server runtimes and navigator on browser/worker runtimes.
   */
  public static getOS(): OperatingSystem {
    // 1. Server environment (Node / Bun)
    if (typeof process !== 'undefined' && typeof process.platform === 'string') {
      const p = process.platform.toLowerCase();
      if (p === 'win32') return OperatingSystem.Windows;
      if (p === 'darwin') return OperatingSystem.MacOS;
      if (p === 'linux') return OperatingSystem.Linux;
      if (p === 'android') return OperatingSystem.Android;
    }

    // 2. Client / Browser / Worker environment
    if (typeof navigator !== 'undefined') {
      // Modern userAgentData
      const uaData = (navigator as any).userAgentData;
      if (uaData && typeof uaData.platform === 'string') {
        const platform = uaData.platform.toLowerCase();
        if (platform.includes('win')) return OperatingSystem.Windows;
        if (platform.includes('mac')) return OperatingSystem.MacOS;
        if (platform.includes('linux')) return OperatingSystem.Linux;
        if (platform.includes('android')) return OperatingSystem.Android;
        if (platform.includes('ios') || platform.includes('iphone') || platform.includes('ipad')) {
          return OperatingSystem.IOS;
        }
      }

      // Fallback: userAgent / platform string matching
      const ua = (navigator.userAgent || '').toLowerCase();
      const legacyPlatform = (navigator.platform || '').toLowerCase();

      if (/iphone|ipad|ipod/.test(ua) || legacyPlatform.includes('iphone') || legacyPlatform.includes('ipad')) {
        return OperatingSystem.IOS;
      }
      if (/android/.test(ua) || legacyPlatform.includes('android')) {
        return OperatingSystem.Android;
      }
      if (/win/.test(legacyPlatform) || ua.includes('windows')) {
        return OperatingSystem.Windows;
      }
      if (/mac/.test(legacyPlatform) || ua.includes('macintosh') || ua.includes('mac os')) {
        return OperatingSystem.MacOS;
      }
      if (/linux/.test(legacyPlatform) || ua.includes('linux')) {
        return OperatingSystem.Linux;
      }
    }

    return OperatingSystem.Unknown;
  }

  /**
   * Detects the JavaScript Runtime Environment.
   */
  public static getRuntime(): RuntimeEnvironment {
    // 1. Bun Runtime
    if (
      typeof (globalThis as any).Bun !== 'undefined' ||
      (typeof process !== 'undefined' && Boolean((process.versions as any)?.bun))
    ) {
      return RuntimeEnvironment.Bun;
    }

    // 2. Node.js Runtime
    if (
      typeof process !== 'undefined' &&
      typeof process.versions !== 'undefined' &&
      Boolean(process.versions.node)
    ) {
      return RuntimeEnvironment.Node;
    }

    // 3. Browser Window Runtime
    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
      return RuntimeEnvironment.Browser;
    }

    // 4. Web Worker Runtime
    if (
      typeof (globalThis as any).WorkerGlobalScope !== 'undefined' ||
      (typeof globalThis !== 'undefined' && typeof (globalThis as any).importScripts === 'function')
    ) {
      return RuntimeEnvironment.WebWorker;
    }

    return RuntimeEnvironment.Unknown;
  }

  /**
   * Probes runtime feature capabilities.
   */
  public static getCapabilities(): RuntimeCapabilities {
    const runtime = this.getRuntime();

    // Check Bun FFI capability
    const hasBunFFI = runtime === RuntimeEnvironment.Bun && typeof (globalThis as any).Bun !== 'undefined';

    // Check FileSystem capability
    const hasFileSystem =
      runtime === RuntimeEnvironment.Bun ||
      runtime === RuntimeEnvironment.Node ||
      (typeof process !== 'undefined' && Boolean(process.versions?.node));

    // Check IndexedDB capability (defensive check against security exception in iframe/private mode)
    let hasIndexedDb = false;
    try {
      hasIndexedDb = typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
      hasIndexedDb = false;
    }

    // Check Web Cache API (CacheStorage in window.caches or self.caches)
    let hasWebCache = false;
    try {
      hasWebCache =
        typeof globalThis !== 'undefined' &&
        'caches' in globalThis &&
        typeof (globalThis as any).caches?.open === 'function';
    } catch {
      hasWebCache = false;
    }

    // Check WebCodecs (VideoEncoder / VideoDecoder)
    let hasWebCodecs = false;
    try {
      hasWebCodecs =
        typeof (globalThis as any).VideoEncoder !== 'undefined' &&
        typeof (globalThis as any).VideoDecoder !== 'undefined';
    } catch {
      hasWebCodecs = false;
    }

    return {
      hasBunFFI,
      hasFileSystem,
      hasIndexedDb,
      hasWebCache,
      hasWebCodecs,
    };
  }

  /**
   * Returns a complete immutable snapshot profile of the current platform.
   */
  public static getProfile(): PlatformProfile {
    return {
      os: this.getOS(),
      runtime: this.getRuntime(),
      capabilities: this.getCapabilities(),
    };
  }

  /**
   * Synchronized resolver: resolves the default canvas adapter environment ('web' | 'node')
   * based on runtime environment.
   */
  public static resolveDefaultCanvasAdapter(): 'web' | 'node' {
    const runtime = this.getRuntime();
    if (runtime === RuntimeEnvironment.Browser || runtime === RuntimeEnvironment.WebWorker) {
      return 'web';
    }
    return 'node';
  }

  /**
   * Synchronized resolver: resolves the optimal default media engine.
   * - Bun -> MediaEngineType.BunFFI
   * - Node -> MediaEngineType.MediabunnyServer
   * - Browser / Worker -> MediaEngineType.MediabunnyClient
   */
  public static resolveDefaultMediaEngine(): MediaEngineType {
    const runtime = this.getRuntime();
    if (runtime === RuntimeEnvironment.Bun) {
      return MediaEngineType.BunFFI;
    }
    if (runtime === RuntimeEnvironment.Browser || runtime === RuntimeEnvironment.WebWorker) {
      return MediaEngineType.MediabunnyClient;
    }
    return MediaEngineType.MediabunnyServer;
  }

  /**
   * Synchronized resolver: resolves the optimal default content cache strategy ID.
   * - Server with FS -> ContentCacheStrategyId.NativeFile (or Memory)
   * - Browser/Client -> ContentCacheStrategyId.IndexedDb (if available) -> WebCache -> Memory
   */
  public static resolveDefaultCacheStrategy(registeredIds?: (ContentCacheStrategyId | string)[]): ContentCacheStrategyId {
    const runtime = this.getRuntime();
    const capabilities = this.getCapabilities();
    const ids = registeredIds ? new Set<string>(registeredIds as string[]) : null;

    if (runtime === RuntimeEnvironment.Bun || runtime === RuntimeEnvironment.Node) {
      if (capabilities.hasFileSystem && (!ids || ids.has(ContentCacheStrategyId.NativeFile))) {
        return ContentCacheStrategyId.NativeFile;
      }
      return ContentCacheStrategyId.Memory;
    }
    if (capabilities.hasWebCache && (!ids || ids.has(ContentCacheStrategyId.WebCache))) {
      return ContentCacheStrategyId.WebCache;
    }
    // Browser / Worker client
    if (capabilities.hasIndexedDb && (!ids || ids.has(ContentCacheStrategyId.IndexedDb))) {
      return ContentCacheStrategyId.IndexedDb;
    }
    return ContentCacheStrategyId.Memory;
  }

  public static isServer(): boolean {
    const runtime = this.getRuntime();
    return runtime === RuntimeEnvironment.Bun || runtime === RuntimeEnvironment.Node;
  }

  public static isBrowser(): boolean {
    return this.getRuntime() === RuntimeEnvironment.Browser;
  }

  public static isWorker(): boolean {
    return this.getRuntime() === RuntimeEnvironment.WebWorker;
  }
}
