import { describe, it, expect } from 'bun:test';
import path from 'path';
import fs from 'fs';
import {
  PipelineIRToUniversalIRAdapter,
  IRConfigAdapterRegistry,
  VideoIRSchemaValidator,
  RelationalDAGCompiler,
  AssetMetadataProber,
} from '../packages/ir/src';
import {
  ScraperPipeline,
} from '../apps/cli/src/pipelines/01-scraper/ScraperPipeline';
import {
  DBTemplatingPipeline,
} from '../apps/cli/src/pipelines/02-db-templating/DBTemplatingPipeline';
import {
  RepurposingPipeline,
} from '../apps/cli/src/pipelines/03-repurposing/RepurposingPipeline';
import { VideoExporter } from '../packages/exporters/src/video/VideoExporter';
import { AudioExporter } from '../packages/exporters/src/audio/AudioExporter';
import { StaticWebExporter } from '../packages/exporters/src/static-web/StaticWebExporter';
import { FFmpegManager } from '@acc/core';

describe('Omnichannel Pipelines 1, 2, 3 Expansion via Output Modality Routing (Phase 4)', () => {
  it('PipelineIRToUniversalIRAdapter compiles PipelineIR into valid VideoIRDocument registered in registry', () => {
    const registry = IRConfigAdapterRegistry.getInstance();
    const adapter = registry.get('pipeline-ir-omnichannel');
    expect(adapter).toBeDefined();

    const mockPipelineIR: any = {
      schemaVersion: '3.0.0',
      pipelineId: 'scraper-summarizer',
      metadata: {
        jobId: 'test_job_001',
        title: 'Fed Rate Cut Surge',
        createdAt: new Date().toISOString(),
        tags: ['finance', 'breaking'],
      },
      chunks: [
        {
          id: 'chunk_1',
          order: 0,
          text: 'Federal reserve issues 50 bps cut.',
          durationMs: 2000,
          visualAsset: {
            type: 'canvas',
            sourcePathOrBuffer: 'sample-story/assets/scene1.jpg',
          },
        },
      ],
      distributionHints: {
        supportedExporters: ['video', 'audio', 'social'],
        targetAspectRatios: ['9:16'],
      },
    };

    expect(adapter!.canAdapt(mockPipelineIR)).toBe(true);

    const irDoc = registry.transform(mockPipelineIR);
    expect(irDoc.version).toBe('1.0.0-stable');
    expect(irDoc.meta.canvasSize.w).toBe(1080);
    expect(irDoc.meta.canvasSize.h).toBe(1920);
    expect(irDoc.tracks.length).toBeGreaterThanOrEqual(1);
    expect(irDoc.tracks[0].type).toBe('video');

    const validation = VideoIRSchemaValidator.validate(irDoc);
    expect(validation.valid).toBe(true);
  });

  it('Pipeline 1 (Event Scraper): routes video path through Universal Video IR while audio/text path bypasses IR', async () => {
    await FFmpegManager.prepare();

    const pipeline = new ScraperPipeline();
    const testOutDir = path.resolve('output/test_p1_omnichannel');
    if (!fs.existsSync(testOutDir)) {
      fs.mkdirSync(testOutDir, { recursive: true });
    }

    const event = {
      sourceUrl: 'https://news.bloomberg.com/markets',
      sourceType: 'rss' as const,
      rawContent: 'Global indices rally as central banks ease monetary policy. Tech stocks lead gains across Europe and Asia.',
      receivedAt: new Date().toISOString(),
    };

    const ctx = await pipeline.execute(event, {
      outDir: testOutDir,
    });

    expect(ctx.exportResults).toBeDefined();

    // 1. Video export result (compiled via Universal Video IR)
    const videoResult = ctx.exportResults?.video;
    expect(videoResult).toBeDefined();
    expect(fs.existsSync(videoResult!.outputPath)).toBe(true);
    expect(videoResult!.metadata?.irCumulativeHash).toBeDefined();

    // 2. Audio & static export results (bypassed Video IR completely)
    const audioResult = ctx.exportResults?.audio;
    const staticResult = ctx.exportResults?.staticWeb;
    expect(audioResult).toBeDefined();
    expect(staticResult).toBeDefined();
    expect(fs.existsSync(audioResult!.outputPath as string)).toBe(true);

    const staticPath = Array.isArray(staticResult!.outputPath) ? staticResult!.outputPath[0] : staticResult!.outputPath;
    expect(fs.existsSync(staticPath)).toBe(true);

    // Audio metadata must NOT have irCumulativeHash (pure audio DSP)
    expect((audioResult as any).metadata?.irCumulativeHash).toBeUndefined();

    // Cleanup
    if (fs.existsSync(videoResult!.outputPath as string)) fs.unlinkSync(videoResult!.outputPath as string);
    if (fs.existsSync(audioResult!.outputPath as string)) fs.unlinkSync(audioResult!.outputPath as string);
    if (Array.isArray(staticResult!.outputPath)) {
      staticResult!.outputPath.forEach((p) => { if (fs.existsSync(p)) fs.unlinkSync(p); });
    } else if (fs.existsSync(staticResult!.outputPath as string)) {
      fs.unlinkSync(staticResult!.outputPath as string);
    }
  }, 60000);

  it('Pipeline 2 (DB Templating): compiles bar chart video to Universal Video IR and static assets to PNG/JSON', async () => {
    await FFmpegManager.prepare();

    const pipeline = new DBTemplatingPipeline();
    const testOutDir = path.resolve('output/test_p2_omnichannel');
    if (!fs.existsSync(testOutDir)) {
      fs.mkdirSync(testOutDir, { recursive: true });
    }

    const payload = {
      title: 'Global Cloud Infrastructure Market Share',
      category: 'cloud_computing',
      entities: [
        {
          id: 'aws',
          name: 'Amazon Web Services',
          category: 'Hyperscaler',
          metrics: { share: 31 },
          highlightMetric: '31%',
        },
        {
          id: 'azure',
          name: 'Microsoft Azure',
          category: 'Hyperscaler',
          metrics: { share: 25 },
          highlightMetric: '25%',
        },
        {
          id: 'gcp',
          name: 'Google Cloud Platform',
          category: 'Hyperscaler',
          metrics: { share: 11 },
          highlightMetric: '11%',
        },
      ],
      summaryConclusion: 'Big 3 control over 67% of cloud market.',
    };

    const ctx = await pipeline.execute(payload, {
      outDir: testOutDir,
    });

    expect(ctx.exportResults).toBeDefined();

    // Video path verified
    const videoResult = ctx.exportResults?.video;
    expect(videoResult).toBeDefined();
    expect(fs.existsSync(videoResult!.outputPath)).toBe(true);
    expect(videoResult!.metadata?.irCumulativeHash).toBeDefined();

    // Static infographic path verified (bypassed Video IR)
    const staticResult = ctx.exportResults?.staticWeb;
    expect(staticResult).toBeDefined();
    const staticP2Path = Array.isArray(staticResult!.outputPath) ? staticResult!.outputPath[0] : staticResult!.outputPath;
    expect(fs.existsSync(staticP2Path)).toBe(true);
    expect((staticResult as any).metadata?.irCumulativeHash).toBeUndefined();

    // Cleanup
    if (fs.existsSync(videoResult!.outputPath as string)) fs.unlinkSync(videoResult!.outputPath as string);
    if (Array.isArray(staticResult!.outputPath)) {
      staticResult!.outputPath.forEach((p) => { if (fs.existsSync(p)) fs.unlinkSync(p); });
    } else if (fs.existsSync(staticResult!.outputPath as string)) {
      fs.unlinkSync(staticResult!.outputPath as string);
    }
  }, 60000);

  it('Pipeline 3 (Repurposing): extracts viral hook, compiles short video via Universal Video IR and audio podcast directly', async () => {
    await FFmpegManager.prepare();

    const pipeline = new RepurposingPipeline();
    const testOutDir = path.resolve('output/test_p3_omnichannel');
    if (!fs.existsSync(testOutDir)) {
      fs.mkdirSync(testOutDir, { recursive: true });
    }

    const repurposingInput = {
      title: 'DeepSeek Architecture Breakdown',
      rawTranscript: 'The secret to extreme efficiency lies in multi-head latent attention and auxiliary-loss-free load balancing. When you prune standard KV-cache redundancy, throughput scales almost linearly.',
      activeSpeakerPosition: { x: 0.5, y: 0.4 },
    };

    const ctx = await pipeline.execute(repurposingInput, {
      outDir: testOutDir,
    });

    expect(ctx.exportResults).toBeDefined();

    // Video path verified
    const videoResult = ctx.exportResults?.video;
    expect(videoResult).toBeDefined();
    expect(fs.existsSync(videoResult!.outputPath)).toBe(true);
    expect(videoResult!.metadata?.irCumulativeHash).toBeDefined();

    // Audio path verified (bypassed Video IR)
    const audioResult = ctx.exportResults?.audio;
    expect(audioResult).toBeDefined();
    expect(fs.existsSync(audioResult!.outputPath)).toBe(true);
    expect((audioResult as any).metadata?.irCumulativeHash).toBeUndefined();

    // Cleanup
    if (fs.existsSync(videoResult!.outputPath)) fs.unlinkSync(videoResult!.outputPath);
    if (fs.existsSync(audioResult!.outputPath)) fs.unlinkSync(audioResult!.outputPath);
  }, 60000);
});
