import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ContentCacheRegistry,
  CacheNamespace,
  type IContentCacheStrategy,
  type CachePayload,
  UniversalCanvasProvider,
} from '@acc/core-isomorphic';
import { Depth3DPlugin } from '../packages/ir/src/plugins/vfx/Depth3DPlugin';
import { Camera3DPlugin } from '../packages/ir/src/plugins/vfx/Camera3DPlugin';
import { AutoReframeModifierPlugin } from '../packages/ir/src/plugins/vfx/AutoReframeModifierPlugin';
import { CanvasParticleOverlayPlugin } from '../packages/ir/src/plugins/overlay/CanvasParticleOverlayPlugin';
import { CaptionModifierPlugin } from '../packages/ir/src/plugins/text/CaptionModifierPlugin';
import { TimeSpaceModifierPlugin } from '../packages/ir/src/plugins/TimeSpaceModifierPlugin';

class MockBlobCacheStrategy implements IContentCacheStrategy {
  readonly id = 'mock-blob-test-strategy';
  private storage = new Map<string, Blob>();

  async has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async get(key: string): Promise<Blob | null> {
    return this.storage.get(key) || null;
  }

  async set(key: string, data: CachePayload): Promise<void> {
    if (data instanceof Blob) {
      this.storage.set(key, data);
    } else if (data instanceof ArrayBuffer) {
      this.storage.set(key, new Blob([data]));
    } else if (ArrayBuffer.isView(data)) {
      const copy = new Uint8Array(data.byteLength);
      copy.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      this.storage.set(key, new Blob([copy.buffer]));
    } else if (data instanceof ReadableStream) {
      const response = new Response(data);
      const blob = await response.blob();
      this.storage.set(key, blob);
    } else {
      this.storage.set(key, new Blob([String(data)]));
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async createWritableStream(key: string): Promise<WritableStream<Uint8Array>> {
    const chunks: Uint8Array[] = [];
    return new WritableStream<Uint8Array>({
      write: (chunk) => {
        chunks.push(chunk);
      },
      close: () => {
        const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        this.storage.set(key, new Blob([merged.buffer]));
      },
    });
  }
}

describe('IR Plugin Cache Elimination & Blob-First ContentCacheRegistry Suite', () => {
  beforeEach(() => {
    ContentCacheRegistry.reset();
    ContentCacheRegistry.register(new MockBlobCacheStrategy(), true);
  });

  describe('Standardized IContentCacheStrategy with First-Class Blob', () => {
    it('stores and retrieves Blob directly via get() and set()', async () => {
      const cache = ContentCacheRegistry.getStrategy();
      const payloadText = 'Standardized Blob payload verification';
      const inputBlob = new Blob([payloadText], { type: 'text/plain' });

      await cache.set('blob_key_1', inputBlob);
      const retrievedBlob = await cache.get('blob_key_1');

      expect(retrievedBlob).not.toBeNull();
      expect(retrievedBlob instanceof Blob).toBe(true);
      const text = await retrievedBlob!.text();
      expect(text).toBe(payloadText);
    });

    it('stores ReadableStream and retrieves as standard Blob', async () => {
      const cache = ContentCacheRegistry.getStrategy();
      const content = new Uint8Array([10, 20, 30, 40, 50]);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(content);
          controller.close();
        },
      });

      await cache.set('stream_key_1', stream);
      const retrievedBlob = await cache.get('stream_key_1');
      expect(retrievedBlob).not.toBeNull();

      const ab = await retrievedBlob!.arrayBuffer();
      const retrievedBytes = new Uint8Array(ab);
      expect(retrievedBytes).toEqual(content);
    });

    it('supports direct writable stream ingestion via createWritableStream()', async () => {
      const cache = ContentCacheRegistry.getStrategy();
      const writable = await cache.createWritableStream!('writable_key_1');
      const writer = writable.getWriter();

      await writer.write(new Uint8Array([1, 2, 3]));
      await writer.write(new Uint8Array([4, 5, 6]));
      await writer.close();

      const retrievedBlob = await cache.get('writable_key_1');
      expect(retrievedBlob).not.toBeNull();
      const ab = await retrievedBlob!.arrayBuffer();
      const retrievedBytes = new Uint8Array(ab);
      expect(retrievedBytes).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
    });

    it('verifies obsolete methods (getBlob, setBlob, getBytes, getStream, setStream) are eliminated', () => {
      const cache = ContentCacheRegistry.getStrategy() as any;
      expect(cache.getBlob).toBeUndefined();
      expect(cache.setBlob).toBeUndefined();
      expect(cache.getBytes).toBeUndefined();
      expect(cache.getStream).toBeUndefined();
      expect(cache.setStream).toBeUndefined();
    });
  });

  describe('Zero In-Memory Cache Verification on IR Plugins', () => {
    it('verifies Depth3DPlugin has no in-memory Map or WeakMap cache properties', () => {
      const plugin = new Depth3DPlugin() as any;
      // Previous in-memory caches were:
      // cutoutCache, depthLayerCache, bgCanvasCache, particlesCache,
      // dustParticlesCache, baseCanvasCache, normalMapCache, relightCanvasCache
      expect(plugin.cutoutCache).toBeUndefined();
      expect(plugin.depthLayerCache).toBeUndefined();
      expect(plugin.bgCanvasCache).toBeUndefined();
      expect(plugin.particlesCache).toBeUndefined();
      expect(plugin.dustParticlesCache).toBeUndefined();
      expect(plugin.baseCanvasCache).toBeUndefined();
      expect(plugin.normalMapCache).toBeUndefined();
      expect(plugin.relightCanvasCache).toBeUndefined();

      // Ensure no properties on plugin instance are Map or WeakMap
      for (const key of Object.keys(plugin)) {
        expect(plugin[key] instanceof Map).toBe(false);
        expect(plugin[key] instanceof WeakMap).toBe(false);
      }
    });

    it('verifies Camera3DPlugin has no in-memory Map cache properties and persists trajectory to ContentCacheRegistry', async () => {
      const plugin = new Camera3DPlugin() as any;
      expect(plugin.trajectoryCache).toBeUndefined();
      expect(plugin.focalZoneCache).toBeUndefined();

      for (const key of Object.keys(plugin)) {
        expect(plugin[key] instanceof Map).toBe(false);
        expect(plugin[key] instanceof WeakMap).toBe(false);
      }

      const canvas: any = {
        width: 320,
        height: 180,
        getContext: () => ({
          save: () => {},
          restore: () => {},
          translate: () => {},
          rotate: () => {},
          scale: () => {},
        }),
      };
      const mockContext: any = {
        canvas,
        fps: 30,
        targetEntity: { id: 'camera_seq_1', durationFrames: 60 },
      };

      await plugin.execute(mockContext, {
        keyframes: [
          { time: 0, position: [0, 0, 1], target: [0, 0, 0], roll: 0, fov: 60, focalZ: 0.2, focalAperture: 0.5 },
          { time: 1, position: [0.1, 0, 0.9], target: [0, 0, 0], roll: 1, fov: 58, focalZ: 0.5, focalAperture: 0.7 },
        ],
      });

      // Verify trajectory was cached in ContentCacheRegistry as Blob under VFX namespace
      const cacheKey = 'camera3d_traj_camera_seq_1_60';
      const hasKey = await ContentCacheRegistry.namespace(CacheNamespace.VFX).has(cacheKey);
      expect(hasKey).toBe(true);

      const cachedBlob = await ContentCacheRegistry.namespace(CacheNamespace.VFX).get(cacheKey);
      expect(cachedBlob).not.toBeNull();
      const ab = await cachedBlob!.arrayBuffer();
      const trajArray = new Float32Array(ab);
      expect(trajArray.length).toBeGreaterThan(0);

      // Verify renderClipSpace renders with rack focus crossfade without throwing
      let drawImageCalls = 0;
      const renderCanvasCtx: any = {
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        drawImage: () => {
          drawImageCalls++;
        },
      };

      const mockSeq: any = { id: 'camera_seq_1', durationFrames: 60 };
      mockSeq._focalZones = {
        sharpCanvas: null,
        nearBlurCanvas: {},
        farBlurCanvas: {},
      };

      await plugin.renderClipSpace(
        {
          ctx: renderCanvasCtx,
          canvas: canvas as any,
          frame: 0,
          localFrame: 0,
          width: 320,
          height: 180,
          sequence: mockSeq,
          baseAsset: undefined,
        },
        {}
      );

      // At frame 0, focalZ is 0.2 (< 0.5), so farBlurCanvas should be drawn with bokeh crossfade
      expect(drawImageCalls).toBe(1);
    });

    it('verifies AutoReframeModifierPlugin has no in-memory strategyCache Map', () => {
      const plugin = new AutoReframeModifierPlugin() as any;
      expect(plugin.strategyCache).toBeUndefined();
      for (const key of Object.keys(plugin)) {
        expect(plugin[key] instanceof Map).toBe(false);
        expect(plugin[key] instanceof WeakMap).toBe(false);
      }
    });

    it('verifies CanvasParticleOverlayPlugin has no in-memory scratchCanvasCache Map', () => {
      const plugin = new CanvasParticleOverlayPlugin() as any;
      expect(plugin.scratchCanvasCache).toBeUndefined();
      for (const key of Object.keys(plugin)) {
        expect(plugin[key] instanceof Map).toBe(false);
        expect(plugin[key] instanceof WeakMap).toBe(false);
      }
    });

    it('verifies CaptionModifierPlugin has no in-memory captionConfigCache WeakMap', () => {
      const plugin = new CaptionModifierPlugin() as any;
      expect(plugin.captionConfigCache).toBeUndefined();
      for (const key of Object.keys(plugin)) {
        expect(plugin[key] instanceof Map).toBe(false);
        expect(plugin[key] instanceof WeakMap).toBe(false);
      }
    });

    it('verifies TimeSpaceModifierPlugin has no in-memory machineCache Map', () => {
      const plugin = new TimeSpaceModifierPlugin() as any;
      expect(plugin.machineCache).toBeUndefined();
      for (const key of Object.keys(plugin)) {
        expect(plugin[key] instanceof Map).toBe(false);
        expect(plugin[key] instanceof WeakMap).toBe(false);
      }
    });
  });
});
