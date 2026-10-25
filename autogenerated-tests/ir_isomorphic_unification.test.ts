import { describe, it, expect } from 'bun:test';
import {
  RelationalDAGCompiler,
  IRPreviewEngine,
  IRMasterRenderer,
  PipelineIRToUniversalIRAdapter,
  VideoIRSchemaValidator,
  type VideoIRDocument,
  type IIRFrameSink,
} from '@acc/ir';
import { StoryConfigToUniversalIRAdapter } from '@acc/legacy-story-renderer';

describe('Phase 5: Pure Isomorphic Video IR Suite (@acc/ir)', () => {
  it('exports only root . in @acc/ir without client or server subpaths', async () => {
    const pkgJson = await import('../packages/ir/package.json');
    expect(pkgJson.exports).toEqual({ '.': './src/index.ts' });
    expect(pkgJson.dependencies['@acc/core']).toBeUndefined();
    expect(pkgJson.dependencies['@acc/core-isomorphic']).toBeDefined();
  });

  it('compiles and validates VideoIR document isomorphically', async () => {
    const doc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'isomorphic_ir_test',
        globalFps: 30,
        canvasSize: { w: 1280, h: 720 },
      },
      tracks: [
        {
          id: 'v_main',
          type: 'video',
          sequences: [
            {
              id: 'seq_1',
              type: 'video',
              time: { start: 0, duration: 30 },
              assetId: 'asset_1',
            },
          ],
        },
      ],
      assets: {
        asset_1: {
          type: 'image',
          src: 'https://example.com/test.jpg',
        },
      },
    };

    const validation = VideoIRSchemaValidator.validate(doc);
    expect(validation.valid).toBe(true);

    const compiler = new RelationalDAGCompiler();
    const timeline = await compiler.compile(doc);
    expect(timeline.totalFrames).toBe(30);
    expect(timeline.tracks.size).toBe(1);
  });

  it('adapts StoryConfig and PipelineIR without Node.js path module dependency', () => {
    const sampleConfig = {
      settings: { fps: 30, width: 1920, height: 1080 },
      scenes: [
        {
          text: 'Scene 1 text',
          image: 'https://example.com/image1.png',
          duration: 3,
        },
      ],
    };

    const irDoc = StoryConfigToUniversalIRAdapter.adapt(sampleConfig as any, undefined, '/tmp/base');
    expect(irDoc.tracks.length).toBeGreaterThan(0);
    expect(irDoc.assets).toBeDefined();

    const samplePipelineIR = {
      pipelineId: 'pipeline-1',
      chunks: [
        {
          chunkIndex: 0,
          visualAsset: { sourcePathOrBuffer: 'relative/path.mp4' },
          spokenAudioPath: 'relative/audio.mp3',
        },
      ],
    };

    const adaptedDoc = PipelineIRToUniversalIRAdapter.adapt(samplePipelineIR as any, undefined, '/tmp/base');
    expect(adaptedDoc.tracks.length).toBeGreaterThan(0);
    const resolvedAsset = Object.values(adaptedDoc.assets || {})[0];
    expect(resolvedAsset.src).toBe('/tmp/base/relative/path.mp4');
  });

  it('exposes IRMasterRenderer and IRPreviewEngine from root @acc/ir', () => {
    expect(IRMasterRenderer).toBeDefined();
    expect(IRPreviewEngine).toBeDefined();
  });
});
