import { test, expect, describe } from 'bun:test';
import {
  ContentStrategyRegistry,
  registerAll250ContentStrategies,
  TaskWorkerFactory,
  registerAllConductorCommands,
  UniversalStrategyTaskCommand,
  ConductorTaskInput,
} from '@acc/core';

describe('Enterprise Content Strategies: Full 250 Content Variations End-to-End Suite', () => {
  test('should register all 250 strategies with 100% complete coverage and unique IDs', () => {
    registerAll250ContentStrategies();
    expect(ContentStrategyRegistry.count()).toBe(250);

    const all = ContentStrategyRegistry.getAll();
    expect(all.length).toBe(250);

    const uniqueIds = new Set(all.map((s) => s.contentTypeId));
    expect(uniqueIds.size).toBe(250);
  });

  test('should satisfy exact distribution across all 5 modality formats (50 per format)', () => {
    registerAll250ContentStrategies();

    const staticWeb = ContentStrategyRegistry.getByModality('static-web');
    const social = ContentStrategyRegistry.getByModality('social');
    const video = ContentStrategyRegistry.getByModality('video');
    const audio = ContentStrategyRegistry.getByModality('audio');
    const interactive = ContentStrategyRegistry.getByModality('interactive-web');

    expect(staticWeb.length).toBe(50);
    expect(social.length).toBe(50);
    expect(video.length).toBe(50);
    expect(audio.length).toBe(50);
    expect(interactive.length).toBe(50);
    expect(staticWeb.length + social.length + video.length + audio.length + interactive.length).toBe(250);
  });

  test('should span across all 6 Canonical Pipelines', () => {
    registerAll250ContentStrategies();

    const p1 = ContentStrategyRegistry.getByPipeline('1');
    const p2 = ContentStrategyRegistry.getByPipeline('2');
    const p3 = ContentStrategyRegistry.getByPipeline('3');
    const p4 = ContentStrategyRegistry.getByPipeline('4');
    const p5 = ContentStrategyRegistry.getByPipeline('5');
    const p6 = ContentStrategyRegistry.getByPipeline('6');

    expect(p1.length).toBeGreaterThan(0);
    expect(p2.length).toBeGreaterThan(0);
    expect(p3.length).toBeGreaterThan(0);
    expect(p4.length).toBeGreaterThan(0);
    expect(p5.length).toBeGreaterThan(0);
    expect(p6.length).toBeGreaterThan(0);

    const total = p1.length + p2.length + p3.length + p4.length + p5.length + p6.length;
    expect(total).toBe(250);
  });

  test('should execute UniversalStrategyTaskCommand dynamically via TaskWorkerFactory for arbitrary content types', async () => {
    registerAll250ContentStrategies();
    registerAllConductorCommands();

    const cmd = TaskWorkerFactory.getCommand('acc.content.render_strategy');
    expect(cmd).toBeDefined();

    // 1. Test Static Web strategy dispatch
    const input1: ConductorTaskInput = {
      taskId: 't_001',
      workflowInstanceId: 'w_001',
      taskDefName: 'acc.content.render_strategy',
      inputData: {
        contentTypeId: 'item_001_daily_industry_digest',
        title: 'Morning AI News',
        summary: 'Automated synthesis of daily developments.',
      },
    };
    cmd.validate(input1);
    const res1 = await cmd.execute(input1);
    expect(res1.status).toBe('COMPLETED');
    expect(res1.outputData.targetModality).toBe('static-web');

    // 2. Test Social strategy dispatch
    const input2: ConductorTaskInput = {
      taskId: 't_051',
      workflowInstanceId: 'w_051',
      taskDefName: 'acc.content.render_strategy',
      inputData: {
        contentTypeId: 'item_051_curated_tweet_threads',
        title: 'Tech Innovations 2026',
        summary: 'Key trends in edge AI and silicon architectures.',
      },
    };
    cmd.validate(input2);
    const res2 = await cmd.execute(input2);
    expect(res2.status).toBe('COMPLETED');
    expect(res2.outputData.targetModality).toBe('social');

    // 3. Test Video strategy dispatch (Universal Video IR)
    const input3: ConductorTaskInput = {
      taskId: 't_111',
      workflowInstanceId: 'w_111',
      taskDefName: 'acc.content.render_strategy',
      inputData: {
        contentTypeId: 'item_111_bar_chart_race_animation',
        title: 'Top AI Frameworks Popularity',
        summary: 'Bar chart race comparing Bun, Node, and Python adoption.',
      },
    };
    cmd.validate(input3);
    const res3 = await cmd.execute(input3);
    expect(res3.status).toBe('COMPLETED');
    expect(res3.outputData.targetModality).toBe('video');
    expect(res3.outputData.result.videoIRDoc).toBeDefined();
    expect(res3.outputData.result.videoIRDoc.version).toBe('1.0.0-stable');

    // 4. Test Audio strategy dispatch
    const input4: ConductorTaskInput = {
      taskId: 't_151',
      workflowInstanceId: 'w_151',
      taskDefName: 'acc.content.render_strategy',
      inputData: {
        contentTypeId: 'item_151_solo_deep_dive_podcast',
        title: 'Deep Audio Systems',
        summary: 'Spatial DSP and audio ducking analysis.',
      },
    };
    cmd.validate(input4);
    const res4 = await cmd.execute(input4);
    expect(res4.status).toBe('COMPLETED');
    expect(res4.outputData.targetModality).toBe('audio');

    // 5. Test Interactive Web strategy dispatch
    const input5: ConductorTaskInput = {
      taskId: 't_201',
      workflowInstanceId: 'w_201',
      taskDefName: 'acc.content.render_strategy',
      inputData: {
        contentTypeId: 'item_201_choose_your_own_adventure',
        title: 'The Cyber Labyrinth',
        summary: 'Choose your own adventure terminal story.',
      },
    };
    cmd.validate(input5);
    const res5 = await cmd.execute(input5);
    expect(res5.status).toBe('COMPLETED');
    expect(res5.outputData.targetModality).toBe('interactive-web');
  });
});
