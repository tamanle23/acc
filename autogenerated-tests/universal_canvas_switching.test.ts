import { describe, it, expect, beforeEach } from 'bun:test';
import {
  UniversalCanvasProvider,
  CanvasAssetLoader,
  WebCanvasAdapter,
  NodeCanvasAdapter,
  type CanvasInstance,
  type CanvasAdapter,
} from '../packages/effect-engines/src';
import { CanvasAdapterFactory } from '../packages/effect-engines/src/overlay-effects/canvas-strategies/factory';

describe('Phase 8: Universal Canvas Abstraction Layer & Environment Switching Suite', () => {
  beforeEach(() => {
    // Reset engine to auto between tests
    UniversalCanvasProvider.setEngine('auto');
  });

  describe('Environment Detection & Adapter Resolution', () => {
    it('should accurately detect Node/Bun execution environment', () => {
      const detected = UniversalCanvasProvider.detectEnvironment();
      expect(detected).toBe('node');
    });

    it('should resolve NodeCanvasAdapter by default in Bun runtime', () => {
      const adapter = UniversalCanvasProvider.getAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.environment).toBe('node');
      expect(adapter.name).toBe('node-napi-rs');
      expect(adapter.isSupported()).toBe(true);
    });

    it('should allow explicit engine switching between node, web, and auto', () => {
      UniversalCanvasProvider.setEngine('web');
      expect(UniversalCanvasProvider.getInstance().getEngine()).toBe('web');
      const webAdapter = UniversalCanvasProvider.getAdapter();
      expect(webAdapter.environment).toBe('web');

      UniversalCanvasProvider.setEngine('node');
      expect(UniversalCanvasProvider.getInstance().getEngine()).toBe('node');
      const nodeAdapter = UniversalCanvasProvider.getAdapter();
      expect(nodeAdapter.environment).toBe('node');

      UniversalCanvasProvider.setEngine('auto');
      expect(UniversalCanvasProvider.getInstance().getEngine()).toBe('auto');
      const autoAdapter = UniversalCanvasProvider.getAdapter();
      expect(autoAdapter.environment).toBe('node'); // On Bun, auto resolves to node
    });
  });

  describe('NodeCanvasAdapter Drawing & Pixel Extraction Fidelity', () => {
    it('should create a canvas instance, perform 2D drawing, and extract raw RGBA pixels', () => {
      const adapter = new NodeCanvasAdapter();
      expect(adapter.isSupported()).toBe(true);

      const width = 160;
      const height = 90;
      const canvas = adapter.createCanvas(width, height);

      expect(canvas.width).toBe(width);
      expect(canvas.height).toBe(height);

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeDefined();

      // Clear & fill red background
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, width, height);

      // Draw blue box in center
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(40, 20, 80, 50);

      // Extract raw pixels
      const rawPixels = canvas.toBuffer('raw');
      expect(rawPixels).toBeDefined();
      expect(rawPixels.length).toBe(width * height * 4); // 160 * 90 * 4 = 57,600 bytes

      // First pixel should be red (RGBA: 255, 0, 0, 255)
      expect(rawPixels[0]).toBe(255);
      expect(rawPixels[1]).toBe(0);
      expect(rawPixels[2]).toBe(0);
      expect(rawPixels[3]).toBe(255);

      // Center pixel (x=80, y=45) should be blue (RGBA: 0, 0, 255, 255)
      const centerIdx = (45 * width + 80) * 4;
      expect(rawPixels[centerIdx]).toBe(0);
      expect(rawPixels[centerIdx + 1]).toBe(0);
      expect(rawPixels[centerIdx + 2]).toBe(255);
      expect(rawPixels[centerIdx + 3]).toBe(255);
    });

    it('should export valid data URL in Node', () => {
      const adapter = new NodeCanvasAdapter();
      const canvas = adapter.createCanvas(64, 64);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(0, 0, 64, 64);

      const dataUrl = canvas.toDataURL?.('image/png');
      expect(typeof dataUrl).toBe('string');
      expect(dataUrl?.startsWith('data:image/png;base64,')).toBe(true);
    });
  });

  describe('WebCanvasAdapter Simulation & Interface Compliance', () => {
    it('should accurately report support status based on globalThis primitives', () => {
      const adapter = new WebCanvasAdapter();
      expect(adapter.name).toBe('web-canvas');
      expect(adapter.environment).toBe('web');
      // In headless Bun without browser DOM/OffscreenCanvas by default, isSupported should reflect truth
      const hasOffscreen = typeof (globalThis as any).OffscreenCanvas !== 'undefined';
      const hasDoc = typeof document !== 'undefined';
      expect(adapter.isSupported()).toBe(hasOffscreen || hasDoc);
    });

    it('should successfully instantiate and execute when OffscreenCanvas is provided', () => {
      // Mock minimal OffscreenCanvas for web testing in Bun
      const origOffscreen = (globalThis as any).OffscreenCanvas;

      class MockOffscreenCanvas {
        public width: number;
        public height: number;
        private buffer: Uint8Array;

        constructor(w: number, h: number) {
          this.width = w;
          this.height = h;
          this.buffer = new Uint8Array(w * h * 4);
        }

        getContext(type: string) {
          const self = this;
          return {
            fillStyle: '#000000',
            fillRect(x: number, y: number, w: number, h: number) {
              // Fill simulated red if #ff0000
              for (let i = 0; i < self.buffer.length; i += 4) {
                self.buffer[i] = 255;
                self.buffer[i + 1] = 0;
                self.buffer[i + 2] = 0;
                self.buffer[i + 3] = 255;
              }
            },
            getImageData(sx: number, sy: number, sw: number, sh: number) {
              return { data: self.buffer, width: sw, height: sh };
            },
          };
        }

        convertToBlob() {
          return Promise.resolve(new Blob(['mock-blob']));
        }
      }

      (globalThis as any).OffscreenCanvas = MockOffscreenCanvas;

      try {
        const adapter = new WebCanvasAdapter();
        expect(adapter.isSupported()).toBe(true);

        const canvas = adapter.createCanvas(100, 100);
        expect(canvas.width).toBe(100);
        expect(canvas.height).toBe(100);

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 100, 100);

        const raw = canvas.toBuffer('raw');
        expect(raw.length).toBe(100 * 100 * 4);
        expect(raw[0]).toBe(255);
        expect(raw[1]).toBe(0);
        expect(raw[2]).toBe(0);
        expect(raw[3]).toBe(255);
      } finally {
        (globalThis as any).OffscreenCanvas = origOffscreen;
      }
    });
  });

  describe('CanvasAssetLoader Isomorphic Processing', () => {
    it('should extract raw RGBA pixels consistently using extractRawPixels', () => {
      const canvas = UniversalCanvasProvider.createCanvas(50, 50);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(0, 0, 50, 50);

      const pixels = CanvasAssetLoader.extractRawPixels(canvas);
      expect(pixels instanceof Uint8Array).toBe(true);
      expect(pixels.length).toBe(50 * 50 * 4);
    });

    it('should load an image from a buffer in Node environment', async () => {
      // 1. Generate small 16x16 PNG buffer
      const canvas = UniversalCanvasProvider.createCanvas(16, 16);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(0, 0, 16, 16);
      const pngBuffer = canvas.toBuffer('png');

      // 2. Load it back via CanvasAssetLoader
      const loadedImg = await CanvasAssetLoader.loadImage(pngBuffer);
      expect(loadedImg).toBeDefined();
      expect(loadedImg.width).toBe(16);
      expect(loadedImg.height).toBe(16);
    });
  });

  describe('CanvasAdapterFactory Backward Compatibility', () => {
    it('should seamlessly route CanvasAdapterFactory calls to UniversalCanvasProvider', () => {
      const adapterAuto = CanvasAdapterFactory.getAdapter('auto');
      expect(adapterAuto).toBeDefined();
      expect(typeof adapterAuto.createCanvas).toBe('function');

      const adapterNapi = CanvasAdapterFactory.getAdapter('napi-rs');
      expect(adapterNapi).toBeDefined();

      const adapterWeb = CanvasAdapterFactory.getAdapter('web');
      expect(adapterWeb).toBeDefined();

      const detected = CanvasAdapterFactory.getDetectedEngine();
      expect(['gpu', 'napi-rs']).toContain(detected);
    });
  });
});
