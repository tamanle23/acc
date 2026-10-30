import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ContentCacheRegistry,
  CacheNamespace,
  type IContentCacheStrategy,
  type CachePayload,
  type CacheEntryMetadata,
} from '../packages/core-isomorphic/src/cache';
import {
  resolveLutPreset,
  LUT_PRESET_KEYS,
  applyLutToImageData,
  ColorPipeline,
  CubeLUTGenerator,
  CubeLUTParser,
  type RGB,
} from '../packages/ir/src/plugins/lut';
import { ColorGradingPlugin, type ColorGradingParams } from '../packages/ir/src/plugins/vfx/ColorGradingPlugin';

class MockMemoryCacheStrategy implements IContentCacheStrategy {
  public readonly id = 'mock-memory-cache';
  public readonly name = 'Mock In-Memory Cache';
  private storage = new Map<string, Blob>();
  private metadataStorage = new Map<string, CacheEntryMetadata>();

  public async has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  public async get(key: string): Promise<Blob | null> {
    return this.storage.get(key) || null;
  }

  public async set(key: string, data: CachePayload, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      blob = new Blob([data as any]);
    } else {
      blob = new Blob([String(data)]);
    }
    this.storage.set(key, blob);
    if (metadata) {
      this.metadataStorage.set(key, {
        checksum: metadata.checksum || key,
        createdAt: metadata.createdAt || Date.now(),
        lastAccessedAt: metadata.lastAccessedAt || Date.now(),
        expiresAt: metadata.expiresAt,
        sizeBytes: metadata.sizeBytes || blob.size,
        namespace: metadata.namespace || 'default',
        metadata: metadata.metadata,
      });
    }
  }

  public async getMetadata(key: string): Promise<CacheEntryMetadata | null> {
    return this.metadataStorage.get(key) || null;
  }

  public async delete(key: string): Promise<boolean> {
    const had = this.storage.has(key);
    this.storage.delete(key);
    this.metadataStorage.delete(key);
    return had;
  }

  public async getKeys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  public async clear(): Promise<void> {
    this.storage.clear();
    this.metadataStorage.clear();
  }
}

describe('LUT ↔ ColorGrading Integration Suite', () => {
  beforeEach(async () => {
    ContentCacheRegistry.reset();
    ContentCacheRegistry.register(new MockMemoryCacheStrategy(), true);
  });

  describe('1. LutPresetRegistry Resolution & ContentCache Caching', () => {
    const canonicalPresets = [
      'teal_and_orange',
      'kodak_2383',
      'bleach_bypass',
      'sci_fi_moody',
      'light_and_airy',
      'cyberpunk',
      'vintage_faded',
      'monochrome_noir',
    ];
    const aliasPresets = ['warm_golden', 'cool_steel'];

    it('resolves all canonical presets to valid Float32Array data at size 9', async () => {
      for (const presetKey of canonicalPresets) {
        const resolved = await resolveLutPreset(presetKey, 9);
        expect(resolved).not.toBeNull();
        expect(resolved?.size).toBe(9);
        expect(resolved?.data).toBeInstanceOf(Float32Array);
        // 9^3 * 3 = 729 * 3 = 2187
        expect(resolved?.data.length).toBe(9 * 9 * 9 * 3);
      }
    });

    it('resolves alias presets correctly', async () => {
      for (const aliasKey of aliasPresets) {
        const resolved = await resolveLutPreset(aliasKey, 9);
        expect(resolved).not.toBeNull();
        expect(resolved?.size).toBe(9);
        expect(resolved?.data.length).toBe(9 * 9 * 9 * 3);
      }
    });

    it('caches generated presets into ContentCacheRegistry and serves cache hits', async () => {
      const vfxCache = ContentCacheRegistry.namespace(CacheNamespace.VFX);
      const cacheKey = 'lut-preset/teal_and_orange/9';

      // First call -> cache miss & bake
      const first = await resolveLutPreset('teal_and_orange', 9);
      expect(first).not.toBeNull();
      const hasCached = await vfxCache.has(cacheKey);
      expect(hasCached).toBe(true);

      // Second call -> cache hit
      const second = await resolveLutPreset('teal_and_orange', 9);
      expect(second).not.toBeNull();
      expect(second?.size).toBe(9);
      expect(second?.data.length).toBe(first!.data.length);
      expect(second?.data[0]).toBe(first!.data[0]);
    });

    it('returns null for unregistered or invalid preset keys', async () => {
      const invalid = await resolveLutPreset('non_existent_preset_key', 9);
      expect(invalid).toBeNull();
    });

    it('exports all supported preset keys in LUT_PRESET_KEYS', () => {
      expect(LUT_PRESET_KEYS).toContain('teal_and_orange');
      expect(LUT_PRESET_KEYS).toContain('cool_steel');
      expect(LUT_PRESET_KEYS.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('2. Tetrahedral Interpolation Accuracy & Identity Invariant', () => {
    it('preserves exact pixel colors when applying an Identity LUT (within 1 LSB tolerance)', async () => {
      // Identity pipeline: returns color unchanged
      const identityPipeline = new ColorPipeline([(c: RGB): RGB => [c[0], c[1], c[2]]]);
      const streamRes = CubeLUTGenerator.generateStream('identity', identityPipeline, 9);
      expect(streamRes.ok).toBe(true);

      if (!streamRes.ok) return;
      const parseRes = await CubeLUTParser.parseStream(streamRes.value);
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const lutData = parseRes.value.data;

      // Create a test 4-pixel ImageData
      const pixelArray = new Uint8ClampedArray([
        0, 0, 0, 255,          // Black
        255, 255, 255, 255,    // White
        128, 64, 192, 255,     // Mixed midtones
        255, 0, 128, 200,      // Partial alpha & saturated
      ]);
      const mockImageData: ImageData = {
        data: pixelArray,
        width: 2,
        height: 2,
        colorSpace: 'srgb',
      };

      const originalR = [0, 255, 128, 255];
      const originalG = [0, 255, 64, 0];
      const originalB = [0, 255, 192, 128];

      applyLutToImageData(mockImageData, lutData, 9);

      for (let p = 0; p < 4; p++) {
        const i = p * 4;
        expect(Math.abs(mockImageData.data[i]! - originalR[p]!)).toBeLessThanOrEqual(1);
        expect(Math.abs(mockImageData.data[i + 1]! - originalG[p]!)).toBeLessThanOrEqual(1);
        expect(Math.abs(mockImageData.data[i + 2]! - originalB[p]!)).toBeLessThanOrEqual(1);
        // Alpha must remain unchanged
        if (p === 3) {
          expect(mockImageData.data[i + 3]).toBe(200);
        } else {
          expect(mockImageData.data[i + 3]).toBe(255);
        }
      }
    });

    it('converts all channels to monochrome equal levels under monochromeNoir pipeline', async () => {
      const resolved = await resolveLutPreset('monochrome_noir', 9);
      expect(resolved).not.toBeNull();
      if (!resolved) return;

      const pixelArray = new Uint8ClampedArray([
        200, 50, 20, 255,
        30, 220, 40, 255,
        10, 30, 250, 255,
      ]);
      const mockImageData: ImageData = {
        data: pixelArray,
        width: 3,
        height: 1,
        colorSpace: 'srgb',
      };

      applyLutToImageData(mockImageData, resolved.data, resolved.size);

      for (let p = 0; p < 3; p++) {
        const i = p * 4;
        const r = mockImageData.data[i];
        const g = mockImageData.data[i + 1];
        const b = mockImageData.data[i + 2];
        // Monochrome definition: R == G == B
        expect(r).toBe(g);
        expect(g).toBe(b);
      }
    });
  });

  describe('3. ColorGradingPlugin Isomorphic Execution & FFmpeg Parity', () => {
    it('generates correct FFmpeg filters with and without lutPath', () => {
      const plugin = new ColorGradingPlugin();

      const filterNoLut = plugin.generateFFmpegFilter({
        contrast: 1.2,
        saturation: 1.1,
        exposure: 0.1,
      });
      expect(filterNoLut).toContain('eq=contrast=1.20:saturation=1.10:brightness=0.10');
      expect(filterNoLut).not.toContain('lut3d');

      const filterWithLut = plugin.generateFFmpegFilter({
        contrast: 1.0,
        saturation: 1.0,
        exposure: 0.0,
        lutPath: '/tmp/preset-teal.cube',
      });
      expect(filterWithLut).toBe("lut3d=file='/tmp/preset-teal.cube':interp=tetrahedral");
    });

    it('ColorGradingPlugin schema defines lut select field with all supported options', () => {
      const plugin = new ColorGradingPlugin();
      const lutField = plugin.schema.fields.lut;

      expect(lutField.type).toBe('select');
      expect(lutField.key).toBe('lut');
      const optionValues = lutField.options.map((o) => o.value);
      expect(optionValues).toContain('teal_and_orange');
      expect(optionValues).toContain('cool_steel');
      expect(optionValues).toContain('bleach_bypass');
      expect(optionValues).toContain('kodak_2383');
      expect(optionValues).toContain('');
    });

    it('ColorGradingPlugin applyLutToCanvas safely performs pixel grading on Canvas context', () => {
      const plugin = new ColorGradingPlugin();
      const pixelBuffer = new Uint8ClampedArray(4 * 4 * 4); // 4x4 RGBA
      pixelBuffer.fill(128);

      const mockCtx = {
        canvas: { width: 4, height: 4 },
        getImageData: (sx: number, sy: number, sw: number, sh: number) => ({
          data: pixelBuffer,
          width: sw,
          height: sh,
          colorSpace: 'srgb' as PredefinedColorSpace,
        }),
        putImageData: (imgData: ImageData, dx: number, dy: number) => {
          // verify write back
          expect(imgData.data.length).toBe(pixelBuffer.length);
        },
      } as unknown as CanvasRenderingContext2D;

      const dummyLut = new Float32Array(9 * 9 * 9 * 3);
      dummyLut.fill(0.5);

      // Should run without throwing
      expect(() => {
        plugin.applyLutToCanvas(mockCtx, dummyLut, 9);
      }).not.toThrow();
    });

    it('ColorGradingPlugin renderClipSpace executes asynchronously with preset resolution', async () => {
      const plugin = new ColorGradingPlugin();
      const pixelBuffer = new Uint8ClampedArray(2 * 2 * 4);
      pixelBuffer.fill(100);

      const mockCtx = {
        canvas: { width: 2, height: 2 },
        filter: 'none',
        getImageData: () => ({
          data: pixelBuffer,
          width: 2,
          height: 2,
          colorSpace: 'srgb' as PredefinedColorSpace,
        }),
        putImageData: () => {},
      } as unknown as CanvasRenderingContext2D;

      const clipContext = {
        ctx: mockCtx,
        frame: 10,
        fps: 30,
        sequence: { id: 'seq-test', type: 'video' as const, startFrame: 0, durationFrames: 100 },
        track: { id: 'track-v1', type: 'video' as const },
        doc: { fps: 30, width: 1920, height: 1080 } as any,
      };

      const params: ColorGradingParams = {
        lut: 'cool_steel',
        contrast: 1.1,
      };

      // Executes smoothly with async LUT resolution
      await expect(plugin.renderClipSpace(clipContext, params)).resolves.toBeUndefined();
    });
  });
});
