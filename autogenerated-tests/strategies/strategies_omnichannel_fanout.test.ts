import { test, expect, describe } from 'bun:test';
import {
  ContentStrategyRegistry,
  registerAll250ContentStrategies,
  createUnifiedPipelineContext,
  AssetContext,
  OmnichannelOutput,
} from '@acc/core';

describe('Omnichannel 1-to-N Dynamic Fan-Out: Multi-Modality Validation', () => {
  registerAll250ContentStrategies();

  test('should allow a single content strategy (item_002_market_crypto_recap) to fan out into Social, Video, Audio, and Static Web simultaneously', async () => {
    // Look up the Crypto Recap strategy
    const cryptoStrategy = ContentStrategyRegistry.getOrThrow('item_002_market_crypto_recap');
    expect(cryptoStrategy).toBeDefined();

    // Execute with MULTIPLE requested modalities!
    const ctx = createUnifiedPipelineContext({
      input: {
        title: 'Bitcoin Hits All-Time High Amid Institutional Inflows',
        summary: 'Total crypto market cap jumps 8% as ETF volumes surge past $10B daily.',
        durationMs: 45000,
        modalities: ['social', 'video', 'audio', 'static-web', 'interactive-web'],
        structuredData: {
          btcPrice: 98500,
          ethPrice: 3850,
          solPrice: 245,
          marketCapTrillions: 3.4,
        },
      },
      assetContext: new AssetContext({
        storyId: 'omnichannel_crypto_story',
        workDir: './scratch/crypto_test',
      }),
      metadata: {
        taskId: 'crypto_fanout_task',
        workflowInstanceId: 'wf_crypto_omnichannel',
        taskDefName: 'acc.content.render_strategy',
        startTime: Date.now(),
      },
    });

    const result = (await cryptoStrategy.process(ctx)) as unknown as OmnichannelOutput;

    // 1. Verify Omnichannel Meta
    expect(result.contentTypeId).toBe('item_002_market_crypto_recap');
    expect(result.requestedModalities.length).toBe(5);
    expect(result.ir.metadata.title).toContain('Bitcoin Hits All-Time High');

    // 2. Verify Social Deliverables Generated
    expect(result.deliverables.social).toBeDefined();
    expect(result.deliverables.social?.threadTweets.length).toBeGreaterThanOrEqual(3);
    expect(result.deliverables.social?.threadTweets[0]).toContain('Bitcoin Hits All-Time High');
    expect(result.deliverables.social?.linkedinPost).toContain('📌 **Bitcoin Hits All-Time High');

    // 3. Verify Video Deliverables Generated (Direct Universal Video IR Compilation)
    expect(result.deliverables.video).toBeDefined();
    expect(result.deliverables.video?.videoIRDoc).toBeDefined();
    expect(result.deliverables.video?.videoIRDoc.version).toBe('1.0.0-stable');
    expect(result.deliverables.video?.videoIRDoc.tracks.length).toBeGreaterThanOrEqual(1);

    // 4. Verify Audio Deliverables Generated (EBU R128 Podcast Broadcast Specs)
    expect(result.deliverables.audio).toBeDefined();
    expect(result.deliverables.audio?.audioSpecs.loudnessLufs).toBe(-14.0);
    expect(result.deliverables.audio?.audioSpecs.sampleRate).toBe(48000);
    expect(result.deliverables.audio?.audioComposition.ducking.enabled).toBe(true);

    // 5. Verify Static Web Deliverables Generated (Markdown & HTML)
    expect(result.deliverables.staticWeb).toBeDefined();
    expect(result.deliverables.staticWeb?.markdown).toContain('# Bitcoin Hits All-Time High');
    expect(result.deliverables.staticWeb?.html).toContain('data-content-id="item_002_market_crypto_recap"');

    // 6. Verify Interactive Web Deliverables Generated (HTML5 Widget)
    expect(result.deliverables.interactiveWeb).toBeDefined();
    expect(result.deliverables.interactiveWeb?.bundlePayload.html).toContain('acc-widget-item_002_market_crypto_recap');
  });

  test('should allow custom selective modality subsets (e.g. video + social only)', async () => {
    const techSpecsStrategy = ContentStrategyRegistry.getOrThrow('item_015_tech_specs_buyers_guide');

    const ctx = createUnifiedPipelineContext({
      input: {
        title: 'M4 Max MacBook Pro vs RTX 4090 Mobile',
        summary: 'Benchmarking raw compute, energy efficiency, and thermal throttling.',
        modalities: ['video', 'social'],
      },
      assetContext: new AssetContext({
        storyId: 'tech_specs_story',
        workDir: './scratch/tech_specs',
      }),
      metadata: {
        taskId: 'specs_task',
        workflowInstanceId: 'wf_specs',
        taskDefName: 'acc.content.render_strategy',
        startTime: Date.now(),
      },
    });

    const result = (await techSpecsStrategy.process(ctx)) as unknown as OmnichannelOutput;

    expect(result.requestedModalities).toEqual(['video', 'social']);
    expect(result.deliverables.video).toBeDefined();
    expect(result.deliverables.social).toBeDefined();
    expect(result.deliverables.audio).toBeUndefined();
    expect(result.deliverables.staticWeb).toBeUndefined();
  });
});
