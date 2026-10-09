import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  StoryConfigToUniversalIRAdapter,
  RelationalDAGCompiler,
  IRMasterRenderer,
  FFIVideoEncoderSink,
  type VideoIRDocument,
} from '../packages/ir';
import { FFmpegManager, initFFI } from '../packages/core';
import { GenerativeStoryPipeline } from '../apps/cli/src/pipelines/04-generative-story/GenerativeStoryPipeline';

describe('Phase D: Parity & Unified Canonical IR Pipeline Transition', () => {
  test('Step D1: StoryConfigToUniversalIRAdapter losslessly adapts J/L-cuts, color grading, SFX, and platform safe zones', () => {
    const rawConfig = {
      name: 'Lossless IR Test Story',
      settings: {
        width: 1080,
        height: 1920,
        fps: 30,
        platform: 'tiktok',
        colorGrading: {
          lutPath: 'assets/luts/cinematic.cube',
          contrast: 1.15,
          saturation: 1.2,
        },
        captions: {
          preset: 'tiktok',
        },
        bgm: {
          source: 'sample-story/bgm.mp3',
          autoDucking: true,
        },
      },
      scenes: [
        {
          text: 'Scene 1 with J-cut',
          video: 'sample-story/input_video.mp4',
          audio: 'sample-story/audio_1.mp3',
          videoOffsetMs: 500, // J-Cut offset
          sfx: [
            {
              source: 'assets/sfx/whoosh.wav',
              time: 0.2,
              duration: 0.5,
              volume: 0.8,
            },
          ],
        },
        {
          text: 'Scene 2 with custom color grading',
          image: 'sample-story/1.png',
          duration: 3,
          colorGrading: {
            contrast: 1.25,
            saturation: 1.0,
          },
        },
      ],
    };

    const irDoc = StoryConfigToUniversalIRAdapter.adapt(rawConfig as any);

    expect(irDoc.version).toBe('1.0.0-stable');
    expect(irDoc.meta.contentId).toBe('Lossless IR Test Story');
    expect(irDoc.meta.canvasSize).toEqual({ w: 1080, h: 1920 });

    // Check V1 Track sequences and modifiers
    const v1Track = irDoc.tracks.find(t => t.id === 'track_v1_main');
    expect(v1Track).toBeDefined();

    const seq1 = v1Track!.sequences[0];
    // Check J-cut offset timing on sequence start
    expect((seq1.time.start as any).offsetFrames).toBe(15); // 500ms at 30fps = 15 frames

    // Check color grading modifier
    const colorMod = seq1.modifiers?.find(m => m.type === 'vfx/color_grading');
    expect(colorMod).toBeDefined();
    expect(colorMod!.params.contrast).toBe(1.15);

    // Check SFX track A3
    const sfxTrack = irDoc.tracks.find(t => t.id === 'track_a3_sfx');
    expect(sfxTrack).toBeDefined();
    expect(sfxTrack!.sequences.length).toBe(1);
    expect(sfxTrack!.sequences[0].assetId).toBeDefined();

    // Check Safe-zone platform forwarding on captions track
    const capTrack = irDoc.tracks.find(t => t.id === 'track_captions');
    if (capTrack) {
      expect((capTrack.style as any)?.platform).toBe('tiktok');
    }
  });

  test('Step D2: GenerativeStoryPipeline successfully routes through the Universal IR Backend', async () => {
    await FFmpegManager.prepare();
    initFFI();

    const sampleStoryPath = path.resolve('sample-story');
    if (!fs.existsSync(sampleStoryPath)) return;

    const pipeline = new GenerativeStoryPipeline();
    const runner = pipeline.buildRunner();

    const outDir = path.resolve('output');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outputPath = path.join(outDir, 'test_ir_backend_story.mp4');

    const { createUnifiedPipelineContext } = await import('../packages/core');
    const ctx = createUnifiedPipelineContext({
      pipelineId: 'story',
      input: sampleStoryPath,
      outDir,
      dryRun: false,
      metadata: {
        useIRBackend: true,
      },
    });

    // Execute pipeline through IR backend
    await runner.run(ctx as any);

    expect(ctx.timings.render).toBeGreaterThan(0);
    expect(ctx.metadata.irRenderResult).toBeDefined();
    expect(ctx.metadata.irRenderResult.cumulativeHash).toBeDefined();
  });
});
