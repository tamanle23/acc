import { test, expect, describe } from 'bun:test';
import {
  ContentStrategyRegistry,
  createPhase1Strategies,
  PHASE_1_DESCRIPTORS,
  StaticWebContentStrategy,
  createUnifiedPipelineContext,
  AssetContext,
} from '@acc/core';

describe('Content Strategies Phase 1: Static Web CMS (Items 1 - 50)', () => {
  test('should have exactly 50 strategy descriptors defined in Phase 1', () => {
    expect(PHASE_1_DESCRIPTORS.length).toBe(50);
  });

  test('should instantiate all 50 strategies with unique contentTypeId', () => {
    const strategies = createPhase1Strategies();
    expect(strategies.length).toBe(50);

    const ids = new Set(strategies.map((s) => s.contentTypeId));
    expect(ids.size).toBe(50);
  });

  test('should register all 50 Phase 1 strategies in ContentStrategyRegistry without error', () => {
    ContentStrategyRegistry.clear();
    const strategies = createPhase1Strategies();
    ContentStrategyRegistry.registerAll(strategies);

    expect(ContentStrategyRegistry.count()).toBe(50);
    expect(ContentStrategyRegistry.getByModality('static-web').length).toBe(50);
  });

  test('should execute strategy process() and generate valid static-web Markdown & HTML', async () => {
    const strategy = ContentStrategyRegistry.getOrThrow('item_001_daily_industry_digest');
    expect(strategy).toBeDefined();

    const ctx = createUnifiedPipelineContext({
      input: {
        title: 'Tech Daily Digest',
        summary: 'AI chip manufacturers report record quarterly revenue.',
      },
      assetContext: new AssetContext({
        storyId: 'test_story_phase1',
        workDir: './scratch/test_phase1',
      }),
      metadata: {
        taskId: 'task_001',
        workflowInstanceId: 'wf_001',
        taskDefName: 'acc.content.render',
        startTime: Date.now(),
      },
    });

    const result = await strategy.process(ctx);
    expect(result.contentTypeId).toBe('item_001_daily_industry_digest');
    expect(result.targetModality).toBe('static-web');
    expect(result.markdown).toContain('# Tech Daily Digest');
    expect(result.html).toContain('<article class="acc-article" data-content-id="item_001_daily_industry_digest">');
    expect(result.ir.chunks.length).toBe(1);
    expect(result.seoMetadata.title).toBe('Tech Daily Digest');
  });

  test('should filter strategies by pipeline ID correctly', () => {
    const p1Strategies = ContentStrategyRegistry.getByPipeline('1');
    const p2Strategies = ContentStrategyRegistry.getByPipeline('2');
    const p5Strategies = ContentStrategyRegistry.getByPipeline('5');

    expect(p1Strategies.length).toBeGreaterThan(0);
    expect(p2Strategies.length).toBeGreaterThan(0);
    expect(p5Strategies.length).toBeGreaterThan(0);
    expect(p1Strategies.length + p2Strategies.length + ContentStrategyRegistry.getByPipeline('3').length + p5Strategies.length).toBe(50);
  });
});
