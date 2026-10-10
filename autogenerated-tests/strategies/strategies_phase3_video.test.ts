import { test, expect, describe } from 'bun:test';
import {
  ContentStrategyRegistry,
  createPhase3Strategies,
  PHASE_3_DESCRIPTORS,
  createUnifiedPipelineContext,
  AssetContext,
} from '@acc/core';

describe('Content Strategies Phase 3: Video & Universal Video IR (Items 101 - 150)', () => {
  test('should have exactly 50 strategy descriptors defined in Phase 3', () => {
    expect(PHASE_3_DESCRIPTORS.length).toBe(50);
  });

  test('should instantiate all 50 video strategies with unique contentTypeId', () => {
    const strategies = createPhase3Strategies();
    expect(strategies.length).toBe(50);

    const ids = new Set(strategies.map((s) => s.contentTypeId));
    expect(ids.size).toBe(50);
  });

  test('should register all 50 Phase 3 strategies into ContentStrategyRegistry', () => {
    const strategies = createPhase3Strategies();
    ContentStrategyRegistry.registerAll(strategies);

    expect(ContentStrategyRegistry.getByModality('video').length).toBe(50);
  });

  test('should execute video strategy and compile directly into canonical Universal Video IR (VideoIRDocument)', async () => {
    const strategy = ContentStrategyRegistry.getOrThrow('item_111_bar_chart_race_animation');
    expect(strategy).toBeDefined();

    const ctx = createUnifiedPipelineContext({
      input: {
        title: 'Global Tech Giants Market Cap 2000-2026',
        summary: 'Visualizing the exponential rise of AI computing companies.',
        durationMs: 30000,
      },
      assetContext: new AssetContext({
        storyId: 'test_story_phase3',
        workDir: './scratch/test_phase3',
      }),
      metadata: {
        taskId: 'task_111',
        workflowInstanceId: 'wf_video_111',
        taskDefName: 'acc.video.render_barchart_race',
        startTime: Date.now(),
      },
    });

    const result = await strategy.process(ctx);
    expect(result.contentTypeId).toBe('item_111_bar_chart_race_animation');
    expect(result.targetModality).toBe('video');
    expect(result.videoSettings.aspectRatio).toBe('9:16');
    expect(result.videoSettings.fps).toBe(30);

    // Verify Universal Video IR Document structure
    expect(result.videoIRDoc).toBeDefined();
    expect(result.videoIRDoc.version).toBe('1.0.0-stable');
    expect(result.videoIRDoc.tracks.length).toBeGreaterThanOrEqual(1);
    expect(result.videoIRDoc.tracks[0].type).toBe('video');
    expect(result.videoIRDoc.tracks[0].sequences.length).toBeGreaterThanOrEqual(1);
  });
});
