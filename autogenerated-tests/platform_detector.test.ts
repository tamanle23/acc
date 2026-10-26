import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  PlatformDetector,
  RuntimeEnvironment,
  OperatingSystem,
  UniversalCanvasProvider,
  MediaEngineRegistry,
  MediaEngineType,
  ContentCacheRegistry,
  ContentCacheStrategyId,
} from '@acc/core-isomorphic';

describe('Platform & Feature Detection Suite (@acc/core-isomorphic)', () => {
  beforeEach(() => {
    MediaEngineRegistry.reset();
    ContentCacheRegistry.reset();
  });

  describe('Live Host Platform Probing', () => {
    it('detects runtime as Bun in the test execution environment', () => {
      const runtime = PlatformDetector.getRuntime();
      expect(runtime).toBe(RuntimeEnvironment.Bun);
      expect(PlatformDetector.isServer()).toBe(true);
      expect(PlatformDetector.isBrowser()).toBe(false);
      expect(PlatformDetector.isWorker()).toBe(false);
    });

    it('detects live host operating system with typed OperatingSystem enum', () => {
      const os = PlatformDetector.getOS();
      const validOs = [
        OperatingSystem.Windows,
        OperatingSystem.MacOS,
        OperatingSystem.Linux,
        OperatingSystem.IOS,
        OperatingSystem.Android,
        OperatingSystem.Unknown,
      ];
      expect(validOs).toContain(os);
      // On Windows development machine
      if (process.platform === 'win32') {
        expect(os).toBe(OperatingSystem.Windows);
      } else if (process.platform === 'darwin') {
        expect(os).toBe(OperatingSystem.MacOS);
      } else if (process.platform === 'linux') {
        expect(os).toBe(OperatingSystem.Linux);
      }
    });

    it('detects server capabilities accurately', () => {
      const caps = PlatformDetector.getCapabilities();
      expect(caps.hasBunFFI).toBe(true);
      expect(caps.hasFileSystem).toBe(true);
    });

    it('returns an immutable PlatformProfile snapshot', () => {
      const profile = PlatformDetector.getProfile();
      expect(profile).toBeDefined();
      expect(profile.runtime).toBe(RuntimeEnvironment.Bun);
      expect(typeof profile.os).toBe('string');
      expect(profile.capabilities).toBeDefined();
      expect(profile.capabilities.hasBunFFI).toBe(true);
    });

    it('resolves synchronized defaults on Bun host', () => {
      expect(PlatformDetector.resolveDefaultCanvasAdapter()).toBe('node');
      expect(PlatformDetector.resolveDefaultMediaEngine()).toBe(MediaEngineType.BunFFI);
      expect(
        PlatformDetector.resolveDefaultCacheStrategy([
          ContentCacheStrategyId.NativeFile,
          ContentCacheStrategyId.Memory,
        ])
      ).toBe(ContentCacheStrategyId.NativeFile);
    });
  });

  describe('UniversalCanvasProvider & MediaEngineRegistry Synchronization', () => {
    it('UniversalCanvasProvider.detectEnvironment delegates to PlatformDetector', () => {
      const env = UniversalCanvasProvider.detectEnvironment();
      expect(env).toBe('node');
    });

    it('MediaEngineRegistry initializes and resets default engine via PlatformDetector', () => {
      expect(MediaEngineRegistry.getDefaultEngine()).toBe(MediaEngineType.BunFFI);

      MediaEngineRegistry.setDefaultEngine(MediaEngineType.FluentFFmpeg);
      expect(MediaEngineRegistry.getDefaultEngine()).toBe(MediaEngineType.FluentFFmpeg);

      MediaEngineRegistry.reset();
      expect(MediaEngineRegistry.getDefaultEngine()).toBe(MediaEngineType.BunFFI);
    });
  });

  describe('Simulated Environments & Feature Branching', () => {
    const originalProcess = globalThis.process;
    const originalNavigator = (globalThis as any).navigator;
    const originalWindow = (globalThis as any).window;

    afterEach(() => {
      (globalThis as any).process = originalProcess;
      (globalThis as any).navigator = originalNavigator;
      (globalThis as any).window = originalWindow;
    });

    it('detects simulated Node.js environment without Bun', () => {
      const fakeProcess = {
        ...originalProcess,
        versions: { node: '22.0.0' },
        platform: 'linux',
      };
      (globalThis as any).process = fakeProcess;

      const runtime = PlatformDetector.getRuntime();
      expect([RuntimeEnvironment.Bun, RuntimeEnvironment.Node]).toContain(runtime);
    });

    it('detects simulated macOS and iOS via userAgent', () => {
      (globalThis as any).process = undefined;
      (globalThis as any).navigator = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        platform: 'iPhone',
      };

      const os = PlatformDetector.getOS();
      expect(os).toBe(OperatingSystem.IOS);
    });

    it('detects simulated Android via userAgent', () => {
      (globalThis as any).process = undefined;
      (globalThis as any).navigator = {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
        platform: 'Linux armv8l',
      };

      const os = PlatformDetector.getOS();
      expect(os).toBe(OperatingSystem.Android);
    });

    it('detects simulated Windows via userAgentData', () => {
      (globalThis as any).process = undefined;
      (globalThis as any).navigator = {
        userAgentData: { platform: 'Windows' },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };

      const os = PlatformDetector.getOS();
      expect(os).toBe(OperatingSystem.Windows);
    });

    it('falls back gracefully to memory cache when no storage APIs are available', () => {
      const selected = PlatformDetector.resolveDefaultCacheStrategy([ContentCacheStrategyId.Memory]);
      expect(selected).toBe(ContentCacheStrategyId.Memory);
    });
  });
});
