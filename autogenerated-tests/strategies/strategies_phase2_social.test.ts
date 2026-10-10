import { test, expect, describe } from 'bun:test';
import {
  ContentStrategyRegistry,
  createPhase2Strategies,
  PHASE_2_DESCRIPTORS,
  createUnifiedPipelineContext,
  AssetContext,
} from '@acc/core';

describe('Content Strategies Phase 2: Social Media Automation (Items 51 - 100)', () => {
  test('should have exactly 50 strategy descriptors defined in Phase 2', () => {
    expect(PHASE_2_DESCRIPTORS.length).toBe(50);
  });

  test('should instantiate all 50 social strategies with unique contentTypeId', () => {
    const strategies = createPhase2Strategies();
    expect(strategies.length).toBe(50);

    const ids = new Set(strategies.map((s) => s.contentTypeId));
    expect(ids.size).toBe(50);
  });

  test('should register all 50 Phase 2 strategies into ContentStrategyRegistry', () => {
    const strategies = createPhase2Strategies();
    ContentStrategyRegistry.registerAll(strategies);

    expect(ContentStrategyRegistry.getByModality('social').length).toBe(50);
  });

  test('should execute social strategy process() and generate valid Twitter thread & LinkedIn post', async () => {
    const strategy = ContentStrategyRegistry.getOrThrow('item_051_curated_tweet_threads');
    expect(strategy).toBeDefined();

    const ctx = createUnifiedPipelineContext({
      input: {
        title: 'Open Source AI Revolution',
        summary: 'New frontier models surpass proprietary benchmarks.',
      },
      assetContext: new AssetContext({
        storyId: 'test_story_phase2',
        workDir: './scratch/test_phase2',
      }),
      metadata: {
        taskId: 'task_051',
        workflowInstanceId: 'wf_051',
        taskDefName: 'acc.social.render',
        startTime: Date.now(),
      },
    });

    const result = await strategy.process(ctx);
    expect(result.contentTypeId).toBe('item_051_curated_tweet_threads');
    expect(result.targetModality).toBe('social');
    expect(result.threadTweets.length).toBe(3);
    expect(result.threadTweets[0]).toContain('Open Source AI Revolution');
    expect(result.linkedinPost).toContain('📌 **Open Source AI Revolution**');
    expect(result.quoteCard.headline).toBe('Open Source AI Revolution');
    expect(result.ir.chunks[0].text).toContain('New frontier models');
  });
});
