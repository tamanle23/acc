import { describe, it, expect } from 'bun:test';
import path from 'path';
import fs from 'fs';
import {
  RelationalDAGCompiler,
  IRMasterRenderer,
  } from '@acc/ir';
import { StoryConfigToUniversalIRAdapter, LegacyStoryConfigAdapter, type LegacyStoryConfig } from '@acc/legacy-story-renderer';

describe('Video IR Phase 5: Pioneer End-to-End Parity Audit', () => {
  it('verifies strict functional parity between story-config.json and IR compiled timeline', async () => {
    const storyConfigPath = path.resolve('sample-story/story-config.json');
    const rawJson = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8')) as LegacyStoryConfig;

    // 1. Adapt and Compile IR
    const baseDir = path.resolve('sample-story');
    const irDoc = StoryConfigToUniversalIRAdapter.adapt(rawJson, undefined, baseDir);
    const compiler = new RelationalDAGCompiler();
    const timeline = await compiler.compile(irDoc);

    // 2. Parity Invariants:
    // Every scene in rawJson.scenes must have a corresponding sequence in both video and voiceover
    expect(timeline.tracks.has('track_v1_main')).toBe(true);
    expect(timeline.tracks.has('track_a1_voiceover')).toBe(true);

    const vTrack = timeline.tracks.get('track_v1_main')!;
    const aTrack = timeline.tracks.get('track_a1_voiceover')!;

    expect(vTrack.sequences.length).toBe(rawJson.scenes!.length);
    expect(aTrack.sequences.length).toBe(rawJson.scenes!.length);

    // Total duration in seconds must match the cumulative end frame divided by FPS
    const expectedDuration = timeline.totalFrames / rawJson.settings!.fps!;
    expect(timeline.durationSeconds).toBeCloseTo(expectedDuration, 2);

    // 3. Render Headless IR Frame Pass for first 15 frames
    timeline.totalFrames = 15;
    const renderer = new IRMasterRenderer(timeline);
    const result = await renderer.render({ generateFrameHash: true });

    expect(result.totalFrames).toBe(15);
    expect(result.frameHashes!.length).toBe(15);
    expect(result.audioResult.totalSamples).toBeGreaterThan(0);
  });

  it('executes GenerativeStoryPipeline stage with useIRBackend flag enabled', async () => {
    const { createStoryOrchestratedRenderStage } = await import(
      '../apps/cli/src/pipelines/04-generative-story/stages/StoryOrchestratedRenderStage'
    );

    const stage = createStoryOrchestratedRenderStage();

    const mockCtx: any = {
      pipelineId: 'story',
      dryRun: false,
      resolvedConfig: {
        name: 'ParityTest',
        settings: { width: 640, height: 360, fps: 30, concurrency: 1 },
        scenes: [
          {
            image: 'assets/test.jpg',
            duration: 1.0,
          },
        ],
      },
      outputFilePath: 'output/test.mp4',
      absoluteDir: process.cwd(),
      timings: {},
      metadata: {
        useIRBackend: true, // Pioneer Flywheel toggle
      },
    };

    let nextCalled = false;
    await stage.execute(mockCtx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(mockCtx.metadata.irRenderResult).toBeDefined();
    expect(mockCtx.metadata.irRenderResult.totalFrames).toBe(30); // 1.0s * 30fps
    expect(mockCtx.timings.render).toBeGreaterThanOrEqual(0);
  });
});
