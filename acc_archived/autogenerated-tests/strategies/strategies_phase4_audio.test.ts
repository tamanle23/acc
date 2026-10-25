import { test, expect, describe } from 'bun:test';
import {
  ContentStrategyRegistry,
  createPhase4Strategies,
  PHASE_4_DESCRIPTORS,
  createUnifiedPipelineContext,
  AssetContext,
} from '@acc/core';

describe('Content Strategies Phase 4: Audio & Podcasts (Items 151 - 200)', () => {
  test('should have exactly 50 strategy descriptors defined in Phase 4', () => {
    expect(PHASE_4_DESCRIPTORS.length).toBe(50);
  });

  test('should instantiate all 50 audio strategies with unique contentTypeId', () => {
    const strategies = createPhase4Strategies();
    expect(strategies.length).toBe(50);

    const ids = new Set(strategies.map((s) => s.contentTypeId));
    expect(ids.size).toBe(50);
  });

  test('should register all 50 Phase 4 strategies into ContentStrategyRegistry', () => {
    const strategies = createPhase4Strategies();
    ContentStrategyRegistry.registerAll(strategies);

    expect(ContentStrategyRegistry.getByModality('audio').length).toBe(50);
  });

  test('should execute audio strategy process() and generate valid broadcast audio parameters', async () => {
    const strategy = ContentStrategyRegistry.getOrThrow('item_151_solo_deep_dive_podcast');
    expect(strategy).toBeDefined();

    const ctx = createUnifiedPipelineContext({
      input: {
        title: 'Distributed Systems & SAGA Orchestration',
        summary: 'Deep dive into event-driven transactional compensations.',
        durationMs: 120000,
        audioFormat: 'mp3',
      },
      assetContext: new AssetContext({
        storyId: 'test_story_phase4',
        workDir: './scratch/test_phase4',
      }),
      metadata: {
        taskId: 'task_151',
        workflowInstanceId: 'wf_audio_151',
        taskDefName: 'acc.audio.synthesize_podcast',
        startTime: Date.now(),
      },
    });

    const result = await strategy.process(ctx);
    expect(result.contentTypeId).toBe('item_151_solo_deep_dive_podcast');
    expect(result.targetModality).toBe('audio');
    expect(result.audioSpecs.format).toBe('mp3');
    expect(result.audioSpecs.sampleRate).toBe(48000);
    expect(result.audioSpecs.channels).toBe(2);
    expect(result.audioSpecs.loudnessLufs).toBe(-14.0); // EBU R128 Podcast Standard
    expect(result.audioComposition.ducking.enabled).toBe(true);
    expect(result.audioComposition.ducking.attenuationDb).toBe(-16);
  });
});
