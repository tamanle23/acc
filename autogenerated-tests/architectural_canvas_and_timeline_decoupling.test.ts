import { describe, it, expect, beforeEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  UniversalCanvasProvider,
  CanvasAssetLoader,
  wrapCanvasContext,
  type ICanvasInstance,
} from '../packages/core/src/isomorphic';
import { NapiCanvasAdapter } from '../packages/core/src/native';
import { WebCanvasAdapter } from '../packages/core/src/web';
import {
  RelationalDAGCompiler,
  VideoIRSchemaValidator,
  type VideoIRDocument,
  type IAssetMetadataProber,
  type AssetMetadata,
} from '../packages/ir/src';
import {
  AssetProtocolRegistry,
  FileAssetBlob,
  DataUriAssetBlob,
} from '../packages/core-isomorphic/src';
import { VideoExporter } from '../packages/exporters/src/video/VideoExporter';

describe('Iteration 16: Architectural Canvas & Timeline Decoupling Suite', () => {
  beforeEach(() => {
    UniversalCanvasProvider.unregisterAll();
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter());
  });

  describe('Pillar 1: Transparent Canvas Subtyping (LSP Compliance)', () => {
    it('should draw an ICanvasInstance directly into another ICanvasInstance without native TypeError', () => {
      const srcCanvas = UniversalCanvasProvider.createCanvas(100, 100);
      const srcCtx = srcCanvas.getContext('2d');
      srcCtx.fillStyle = '#ff0000';
      srcCtx.fillRect(0, 0, 100, 100);

      const destCanvas = UniversalCanvasProvider.createCanvas(200, 200);
      const destCtx = destCanvas.getContext('2d');

      // Fulfilling LSP: Passing ICanvasInstance directly into drawImage
      expect(() => {
        destCtx.drawImage(srcCanvas, 0, 0);
        destCtx.drawImage(srcCanvas, 10, 10, 50, 50);
        destCtx.drawImage(srcCanvas, 0, 0, 100, 100, 50, 50, 100, 100);
      }).not.toThrow();

      const pixelData = destCanvas.toBuffer('raw');
      expect(pixelData.length).toBe(200 * 200 * 4);
    });

    it('should support createPattern with an ICanvasInstance transparently', () => {
      const patternCanvas = UniversalCanvasProvider.createCanvas(10, 10);
      const patCtx = patternCanvas.getContext('2d');
      patCtx.fillStyle = '#00ff00';
      patCtx.fillRect(0, 0, 10, 10);

      const destCanvas = UniversalCanvasProvider.createCanvas(50, 50);
      const destCtx = destCanvas.getContext('2d');

      expect(() => {
        const pattern = destCtx.createPattern(patternCanvas, 'repeat');
        expect(pattern).not.toBeNull();
      }).not.toThrow();
    });
  });

  describe('Pillar 2: Declarative Timeline-Bound Durations (matchLengthOf: "timeline")', () => {
    it('should validate VideoIR documents with matchLengthOf: "timeline" and loop: true', () => {
      const doc: VideoIRDocument = {
        version: '1.0.0-stable',
        meta: {
          contentId: 'timeline_test',
          globalFps: 30,
          canvasSize: { w: 1920, h: 1080 },
        },
        tracks: [
          {
            id: 'track_v1',
            type: 'video',
            sequences: [
              {
                id: 'seq_v1',
                type: 'image',
                time: { start: 0, duration: 90 },
              },
            ],
          },
          {
            id: 'track_a1_bgm',
            type: 'audio',
            sequences: [
              {
                id: 'seq_bgm',
                type: 'audio',
                time: {
                  start: 0,
                  duration: { matchLengthOf: 'timeline', loop: true },
                },
              },
            ],
          },
        ],
      };

      const result = VideoIRSchemaValidator.validate(doc);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should compile terminal timeline bounds and assign full duration to matchLengthOf: "timeline"', async () => {
      const mockProber: IAssetMetadataProber = {
        async probe(id: string, src: string, type: string, fps: number): Promise<AssetMetadata> {
          return { id, durationFrames: 120, fps };
        },
      };

      const compiler = new RelationalDAGCompiler({ prober: mockProber });
      const doc: VideoIRDocument = {
        version: '1.0.0-stable',
        meta: {
          contentId: 'multi_scene_timeline',
          globalFps: 30,
          canvasSize: { w: 1920, h: 1080 },
        },
        tracks: [
          {
            id: 'track_video',
            type: 'video',
            sequences: [
              {
                id: 'scene_1',
                type: 'image',
                time: { start: 0, duration: 150 }, // 5s
              },
              {
                id: 'scene_2',
                type: 'image',
                time: { start: { after: 'scene_1' }, duration: 150 }, // 5s -> ends at 300
              },
            ],
          },
          {
            id: 'track_bgm',
            type: 'audio',
            sequences: [
              {
                id: 'bgm_full',
                type: 'audio',
                time: {
                  start: 0,
                  duration: { matchLengthOf: 'timeline', loop: true },
                },
              },
              {
                id: 'ambient_padded',
                type: 'audio',
                time: {
                  start: 0,
                  duration: { matchLengthOf: 'timeline', paddingFrames: 30 },
                },
              },
            ],
          },
        ],
      };

      const compiled = await compiler.compile(doc);

      // Verify scene durations & start frames
      const scene1 = compiled.sequences.get('scene_1')!;
      expect(scene1.startFrame).toBe(0);
      expect(scene1.durationFrames).toBe(150);
      expect(scene1.endFrame).toBe(150);

      const scene2 = compiled.sequences.get('scene_2')!;
      expect(scene2.startFrame).toBe(150);
      expect(scene2.durationFrames).toBe(150);
      expect(scene2.endFrame).toBe(300);

      // Verify BGM resolves to exact timeline length
      const bgm = compiled.sequences.get('bgm_full')!;
      expect(bgm.startFrame).toBe(0);
      expect(bgm.durationFrames).toBe(300);
      expect(bgm.endFrame).toBe(300);

      // Verify padded timeline duration
      const ambient = compiled.sequences.get('ambient_padded')!;
      expect(ambient.startFrame).toBe(0);
      expect(ambient.durationFrames).toBe(330);
      expect(ambient.endFrame).toBe(330);

      // Overall compiled timeline bounds
      expect(compiled.totalFrames).toBe(330);
      expect(compiled.durationSeconds).toBe(11);
    });
  });

  describe('Pillar 4: Universal Streaming Asset Blobs (IAssetBlob)', () => {
    it('should stream data chunk-by-chunk and convert to arrayBuffer using FileAssetBlob', async () => {
      const tempPath = path.resolve(process.cwd(), 'autogenerated-tests', 'test_stream_blob.tmp');
      const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      await fs.promises.writeFile(tempPath, testData);

      try {
        const blob = new FileAssetBlob(tempPath);
        expect(blob.getNativePath()).toBe(tempPath);
        expect(blob.mimeType).toBe('application/octet-stream');

        const stream = blob.stream();
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }

        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        expect(totalLength).toBe(10);

        const ab = await blob.arrayBuffer();
        expect(ab.byteLength).toBe(10);
      } finally {
        if (fs.existsSync(tempPath)) {
          await fs.promises.unlink(tempPath);
        }
      }
    });

    it('should decode data URIs via DataUriAssetBlob', async () => {
      const base64Data = Buffer.from('Hello Video IR').toString('base64');
      const dataUri = `data:text/plain;base64,${base64Data}`;
      const blob = new DataUriAssetBlob(dataUri);

      expect(blob.mimeType).toBe('text/plain');
      const ab = await blob.arrayBuffer();
      const text = new TextDecoder().decode(ab);
      expect(text).toBe('Hello Video IR');
    });

    it('should resolve URIs dynamically via AssetProtocolRegistry', () => {
      const registry = AssetProtocolRegistry.getInstance();

      const fileBlob = registry.resolve('./assets/scene1.jpg', '/root/project');
      expect(fileBlob.getNativePath()).toBe('/root/project/assets/scene1.jpg');
      expect(fileBlob.mimeType).toBe('image/jpeg');

      const dataBlob = registry.resolve('data:image/png;base64,iVBORw0KGgo=');
      expect(dataBlob.mimeType).toBe('image/png');
    });

    it('should consume IAssetBlob in CanvasAssetLoader.loadImage', async () => {
      // 1x1 transparent PNG data URI
      const pngDataUri =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const blob = new DataUriAssetBlob(pngDataUri);

      const loaded = await CanvasAssetLoader.loadImage(blob);
      expect(loaded).toBeDefined();
      expect(loaded.width).toBe(1);
      expect(loaded.height).toBe(1);
    });
  });

  describe('Pillar 3: Default Video IR Persistence', () => {
    it('should automatically persist video-ir.json alongside exported video', async () => {
      const exporter = new VideoExporter();
      const outDir = path.resolve(process.cwd(), 'autogenerated-tests', 'export_persistence_test');

      const mockIR: any = {
        pipelineId: 'story',
        metadata: { jobId: 'test_persist_job' },
        chunks: [],
      };

      try {
        const result = await exporter.export(mockIR, {
          outputDir: outDir,
          width: 320,
          height: 180,
          fps: 15,
        });

        expect(result.outputPath).toBeDefined();
        const expectedIrPath = path.join(outDir, 'video-ir.json');
        expect(fs.existsSync(expectedIrPath)).toBe(true);

        const irContent = JSON.parse(await fs.promises.readFile(expectedIrPath, 'utf-8'));
        expect(irContent.version).toBe('1.0.0-stable');
        expect(irContent.meta.canvasSize).toEqual({ w: 320, h: 180 });
      } finally {
        if (fs.existsSync(outDir)) {
          await fs.promises.rm(outDir, { recursive: true, force: true });
        }
      }
    });
  });
});
