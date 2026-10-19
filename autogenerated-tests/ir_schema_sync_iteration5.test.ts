import { describe, it, expect } from 'bun:test';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  VideoIRSchemaValidator,
  StoryConfigToUniversalIRAdapter,
  PipelineIRToUniversalIRAdapter,
  RelationalDAGCompiler,
  type VideoIRDocument,
} from '../packages/ir/src';
import {
  IRMasterRenderer,
  MediaSinkFactory,
} from '../packages/ir/src/server';
import { MediaEngineRegistry } from '../packages/core/src/media-engine/MediaEngineRegistry';
import { BunFFIEngineStrategy } from '../packages/core/src/media-engine/strategies/BunFFIEngineStrategy';
import { FluentFFmpegEngineStrategy } from '../packages/core/src/media-engine/strategies/FluentFFmpegEngineStrategy';
import { MediabunnyServerStrategy } from '../packages/core/src/media-engine/strategies/MediabunnyServerStrategy';
import { MediabunnyClientStrategy } from '../packages/core/src/media-engine/strategies/MediabunnyClientStrategy';

import { FFmpegManager } from '../packages/core/src/FFmpegManager';
import { beforeAll } from 'bun:test';

describe('Phase 4: VideoIR Schema 8-Point Sync & Multi-Engine Parity Testing', () => {
  beforeAll(async () => {
    await FFmpegManager.prepare();
  });

  // Ensure all 4 production engines are registered
  MediaEngineRegistry.register(new BunFFIEngineStrategy());
  MediaEngineRegistry.register(new FluentFFmpegEngineStrategy());
  MediaEngineRegistry.register(new MediabunnyServerStrategy());
  MediaEngineRegistry.register(new MediabunnyClientStrategy());

  it('Point 1-3: should validate VideoIR V1.0-Stable document with Camera3D, Relighting, and Particle VFX', () => {
    const doc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'iteration5_schema_test',
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
              time: { start: 0, duration: 60 },
              modifiers: [
                {
                  type: 'vfx/depth3d',
                  target: 'video',
                  params: {
                    mode: 'frame_breaker',
                    relighting: {
                      enabled: true,
                      lightPosition: [0.5, -0.5, 1.2],
                      diffuse: 0.8,
                      specular: 0.6,
                      shininess: 24,
                    },
                  },
                },
                {
                  type: 'vfx/camera_3d',
                  target: 'video',
                  params: {
                    keyframes: [
                      { time: 0, position: [0, 0, 1.2] },
                      { time: 1, position: [0.1, -0.1, 0.9], roll: 2.0 },
                    ],
                    rackFocus: { enabled: true, aperture: 0.4 },
                  },
                },
                {
                  type: 'overlay/canvas_particles',
                  target: 'video',
                  params: {
                    type: 'snow',
                    intensity: 1.2,
                    useSIMD: true,
                    shaders: {
                      bloom: { enabled: true, threshold: 0.6 },
                      chromaticAberration: { enabled: true, offsetPx: 2 },
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const validation = VideoIRSchemaValidator.validate(doc);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);

    // Serialization & Deserialization roundtrip
    const serialized = VideoIRSchemaValidator.serialize(doc);
    expect(typeof serialized).toBe('string');
    const deserialized = VideoIRSchemaValidator.deserialize(serialized);
    expect(deserialized.meta.contentId).toBe('iteration5_schema_test');
  });

  it('Point 5: should adapt StoryConfig and PipelineIR with Iteration 5 visual modifier directives', () => {
    // 1. StoryConfig Adapter
    const storyConfig: any = {
      settings: { width: 1280, height: 720, fps: 30 },
      scenes: [
        {
          duration: 2.0,
          camera3d: {
            keyframes: [{ time: 0, position: [0, 0, 1] }, { time: 1, position: [0, 0, 0.8] }],
          },
          particleOverlay: { type: 'embers', useSIMD: true },
        },
      ],
    };
    const irFromStory = StoryConfigToUniversalIRAdapter.adapt(storyConfig);
    expect(irFromStory.tracks[0].sequences[0].modifiers?.some(m => m.type === 'vfx/camera_3d')).toBe(true);
    expect(irFromStory.tracks[0].sequences[0].modifiers?.some(m => m.type === 'overlay/canvas_particles')).toBe(true);

    // 2. PipelineIR Adapter
    const pipelineIR: any = {
      pipelineId: 'p4_generative_story',
      chunks: [{ spokenDurationSeconds: 2.0, visualDurationSeconds: 2.0 }],
    };
    const directorConfig: any = {
      timeline: {
        segments: [
          {
            cameraMotion: {
              type: '3d_spline',
              keyframes: [{ time: 0, position: [0, 0, 1.2] }, { time: 1, position: [0.1, 0, 0.9] }],
            },
          },
        ],
      },
    };
    const irFromPipeline = PipelineIRToUniversalIRAdapter.adapt(pipelineIR, 'test_p4', undefined, directorConfig);
    expect(irFromPipeline.tracks[0].sequences[0].modifiers?.some(m => m.type === 'vfx/camera_3d')).toBe(true);
  });

  it('Multi-Engine Parity Matrix: should render identical VideoIR document across all 4 media backend strategies', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc_parity_iteration5_'));

    const testDoc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'multi_engine_parity_vfx',
        globalFps: 30,
        canvasSize: { w: 320, h: 240 },
      },
      tracks: [
        {
          id: 'v_parity',
          type: 'video',
          sequences: [
            {
              id: 'seq_parity_1',
              type: 'video',
              time: { start: 0, duration: 15 },
              modifiers: [
                {
                  type: 'vfx/camera_3d',
                  target: 'video',
                  params: {
                    keyframes: [
                      { time: 0, position: [0, 0, 1.0] },
                      { time: 1, position: [0.05, 0, 0.9] },
                    ],
                  },
                },
                {
                  type: 'overlay/canvas_particles',
                  target: 'video',
                  params: {
                    type: 'dust',
                    intensity: 0.5,
                    useSIMD: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const engines: Array<'bun-ffi' | 'fluent-ffmpeg' | 'mediabunny-server' | 'mediabunny-client'> = [
      'bun-ffi',
      'fluent-ffmpeg',
      'mediabunny-server',
      'mediabunny-client',
    ];

    const results: Record<string, any> = {};

    const compiler = new RelationalDAGCompiler();
    const timeline = await compiler.compile(testDoc);

    for (const engine of engines) {
      const outPath = path.join(tmpDir, `render_${engine}.mp4`);
      const sink = MediaSinkFactory.createVideoSink(engine, {
        width: 320,
        height: 240,
        fps: 30,
        totalFrames: 15,
        durationSeconds: 0.5,
        outputPath: outPath,
      });

      const renderer = new IRMasterRenderer(timeline);
      const res = await renderer.render({
        sink: sink as any,
        outputPath: outPath,
        generateFrameHash: true,
      });

      results[engine] = {
        totalFrames: res.totalFrames,
        cumulativeHash: res.cumulativeHash,
        width: res.width,
        height: res.height,
        fps: res.fps,
      };

      expect(res.totalFrames).toBe(15);
      expect(res.width).toBe(320);
      expect(res.height).toBe(240);
    }

    // Parity Assertion: Frame loop hash across identical IR AST must match 100% identically!
    expect(results['bun-ffi'].cumulativeHash).toBe(results['fluent-ffmpeg'].cumulativeHash);
    expect(results['bun-ffi'].cumulativeHash).toBe(results['mediabunny-server'].cumulativeHash);
    expect(results['bun-ffi'].cumulativeHash).toBe(results['mediabunny-client'].cumulativeHash);

    // Clean up temp dir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });
});
