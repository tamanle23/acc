import { test, expect, describe } from 'bun:test';
import {
  ContentStrategyRegistry,
  createPhase5Strategies,
  PHASE_5_DESCRIPTORS,
  createUnifiedPipelineContext,
  AssetContext,
} from '@acc/core';

describe('Content Strategies Phase 5: Interactive Web & Logic (Items 201 - 250)', () => {
  test('should have exactly 50 strategy descriptors defined in Phase 5', () => {
    expect(PHASE_5_DESCRIPTORS.length).toBe(50);
  });

  test('should instantiate all 50 interactive strategies with unique contentTypeId', () => {
    const strategies = createPhase5Strategies();
    expect(strategies.length).toBe(50);

    const ids = new Set(strategies.map((s) => s.contentTypeId));
    expect(ids.size).toBe(50);
  });

  test('should register all 50 Phase 5 strategies into ContentStrategyRegistry', () => {
    const strategies = createPhase5Strategies();
    ContentStrategyRegistry.registerAll(strategies);

    expect(ContentStrategyRegistry.getByModality('interactive-web').length).toBe(50);
  });

  test('should execute interactive strategy process() and generate valid HTML5 widget bundle', async () => {
    const strategy = ContentStrategyRegistry.getOrThrow('item_201_choose_your_own_adventure');
    expect(strategy).toBeDefined();

    const ctx = createUnifiedPipelineContext({
      input: {
        title: 'The Lost Crypt of Eldoria',
        summary: 'Explore branching underground tunnels with choices and inventory.',
      },
      assetContext: new AssetContext({
        storyId: 'test_story_phase5',
        workDir: './scratch/test_phase5',
      }),
      metadata: {
        taskId: 'task_201',
        workflowInstanceId: 'wf_interactive_201',
        taskDefName: 'acc.interactive.compile_widget',
        startTime: Date.now(),
      },
    });

    const result = await strategy.process(ctx);
    expect(result.contentTypeId).toBe('item_201_choose_your_own_adventure');
    expect(result.targetModality).toBe('interactive-web');
    expect(result.widgetType).toBe('html5_game');
    expect(result.bundlePayload.html).toContain('acc-widget-item_201_choose_your_own_adventure');
    expect(result.bundlePayload.jsBundle).toContain('The Lost Crypt of Eldoria');
  });
});
