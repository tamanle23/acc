import path from 'path';
import fs from 'fs';
import { createCanvas } from '@napi-rs/canvas';
import type { PipelineIR, ContentChunk } from '@acc/ir';
import { defaultExporterDispatcher, ExporterDispatcher, MultiExportResults } from '@acc/exporters';
import {
  IPipeline,
  PipelineExecutionOptions,
  PipelineRunner,
  UnifiedPipelineContext,
  createUnifiedPipelineContext,
  createExporterDispatcherMiddleware,
  defaultPipelineRegistry,
} from '@acc/core';

export interface ComparisonEntity {
  id: string;
  name: string;
  category: string;
  metrics: Record<string, number>;
  highlightMetric: string;
  badge?: string;
}

export interface DBTemplatePayload {
  title: string;
  category: string;
  entities: ComparisonEntity[];
  summaryConclusion?: string;
}

export interface DBTemplatePipelineContext extends UnifiedPipelineContext<DBTemplatePayload> {
  sortedEntities?: ComparisonEntity[];
  maxMetricValue?: number;
  chartCardPath?: string;
}

export class DBTemplatingPipeline implements IPipeline<DBTemplatePayload> {
  public readonly id = 'db' as const;
  public readonly name = 'Database / Structured Templating Pipeline';
  public readonly description = 'Transforms relational database metrics and JSONB payloads into dynamic bar chart race infographics and multi-channel reports.';

  private dispatcher: ExporterDispatcher;

  constructor(dispatcher?: ExporterDispatcher) {
    this.dispatcher = dispatcher || defaultExporterDispatcher;
  }

  public buildRunner(): PipelineRunner<UnifiedPipelineContext<DBTemplatePayload>> {
    const runner = new PipelineRunner<UnifiedPipelineContext<DBTemplatePayload>>();

    // Stage 1: Data Normalization & Metric Sorting
    runner.use({
      name: 'DBDataNormalizationStage',
      execute: async (ctx: DBTemplatePipelineContext, next) => {
        const payload = ctx.input;
        const sorted = [...payload.entities].sort((a, b) => {
          const valA = a.metrics[a.highlightMetric] ?? 0;
          const valB = b.metrics[b.highlightMetric] ?? 0;
          return valB - valA;
        });

        const maxVal = Math.max(...sorted.map((e) => e.metrics[e.highlightMetric] ?? 0), 1);
        ctx.sortedEntities = sorted;
        ctx.maxMetricValue = maxVal;
        await next();
      },
    });

    // Stage 2: Canvas Rendering & PipelineIR Assembly
    runner.use({
      name: 'DBBarChartCompositionStage',
      execute: async (ctx: DBTemplatePipelineContext, next) => {
        const payload = ctx.input;
        const sorted = ctx.sortedEntities!;
        const maxVal = ctx.maxMetricValue!;

        const cardWidth = 1080;
        const cardHeight = 1920;
        const canvas = createCanvas(cardWidth, cardHeight);
        const renderCtx = canvas.getContext('2d');

        // Background
        const bgGrad = renderCtx.createLinearGradient(0, 0, 0, cardHeight);
        bgGrad.addColorStop(0, '#0c101d');
        bgGrad.addColorStop(1, '#05070f');
        renderCtx.fillStyle = bgGrad;
        renderCtx.fillRect(0, 0, cardWidth, cardHeight);

        // Header Tag
        renderCtx.fillStyle = '#10b981';
        renderCtx.fillRect(80, 140, 280, 48);
        renderCtx.fillStyle = '#ffffff';
        renderCtx.font = 'bold 22px sans-serif';
        renderCtx.fillText(`DATABASE INSIGHTS`, 105, 172);

        // Category
        renderCtx.font = '22px sans-serif';
        renderCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        renderCtx.fillText(`${payload.category.toUpperCase()} BENCHMARK`, 380, 172);

        // Main Title
        renderCtx.fillStyle = '#ffffff';
        renderCtx.font = 'bold 56px sans-serif';
        renderCtx.fillText(payload.title.slice(0, 35), 80, 280);

        // Subtitle
        renderCtx.font = '30px sans-serif';
        renderCtx.fillStyle = '#94a3b8';
        renderCtx.fillText(`Ranking sorted by: ${payload.highlightMetric.toUpperCase()}`, 80, 340);

        // Bar Chart Rows
        let y = 440;
        const barColors = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa'];

        sorted.slice(0, 6).forEach((entity, idx) => {
          const val = entity.metrics[entity.highlightMetric] ?? 0;
          const pct = val / maxVal;
          const barWidth = Math.max(40, (cardWidth - 280) * pct);
          const color = barColors[idx % barColors.length];

          // Entity Rank & Name
          renderCtx.font = 'bold 30px sans-serif';
          renderCtx.fillStyle = '#ffffff';
          renderCtx.fillText(`#${idx + 1}  ${entity.name}`, 80, y);

          // Value label
          renderCtx.font = 'bold 28px sans-serif';
          renderCtx.fillStyle = color;
          renderCtx.textAlign = 'right';
          renderCtx.fillText(`${val.toLocaleString()}`, cardWidth - 80, y);
          renderCtx.textAlign = 'left';

          y += 24;

          // Bar Background
          renderCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          renderCtx.fillRect(80, y, cardWidth - 160, 36);

          // Bar Fill
          renderCtx.fillStyle = color;
          renderCtx.fillRect(80, y, barWidth, 36);

          y += 75;
        });

        // Conclusion banner
        if (payload.summaryConclusion) {
          y += 60;
          renderCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          renderCtx.fillRect(80, y, cardWidth - 160, 120);
          renderCtx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
          renderCtx.strokeRect(80, y, cardWidth - 160, 120);

          renderCtx.font = 'italic 26px sans-serif';
          renderCtx.fillStyle = '#e2e8f0';
          renderCtx.fillText(payload.summaryConclusion.slice(0, 70), 105, y + 68);
        }

        // Footer
        renderCtx.font = '22px sans-serif';
        renderCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        renderCtx.fillText('📊 Generated by Visual Storytelling Engine • Data-to-Video Pipeline', 80, cardHeight - 100);

        const chartCardPath = path.join(ctx.outDir, 'comparison_chart.png');
        fs.writeFileSync(chartCardPath, canvas.toBuffer('image/png'));
        ctx.chartCardPath = chartCardPath;
        ctx.assets.register('chunk_0', 'original', chartCardPath, { width: cardWidth, height: cardHeight });

        const chunks: ContentChunk[] = [
          {
            id: 'chunk_0',
            order: 0,
            text: `${payload.title}. Top rank belongs to ${sorted[0]?.name || 'Leader'} with ${
              sorted[0]?.metrics[payload.highlightMetric] || 0
            } ${payload.highlightMetric}.`,
            durationMs: 4000,
            visualAsset: {
              type: 'canvas',
              sourcePathOrBuffer: chartCardPath,
              resolution: { width: cardWidth, height: cardHeight },
            },
            metadata: {
              highlightMetric: payload.highlightMetric,
              topLeader: sorted[0]?.name,
            },
          },
        ];

        const ir: PipelineIR = {
          schemaVersion: '3.0.0',
          pipelineId: 'db-templating',
          metadata: {
            jobId: `dbt_${Date.now()}`,
            title: payload.title,
            createdAt: new Date().toISOString(),
            tags: [payload.category, 'benchmark', 'ranking'],
            author: 'DB Templating Pipeline',
          },
          chunks,
          audioComposition: {
            sfxMarkers: [],
            ducking: { enabled: false, attenuationDb: 0, attackMs: 0, releaseMs: 0 },
          },
          structuredData: {
            category: payload.category,
            highlightMetric: payload.highlightMetric,
            entities: sorted,
          },
          distributionHints: {
            supportedExporters: ['video', 'social', 'static-web'],
            targetAspectRatios: ['9:16', '16:9'],
          },
        };

        ctx.ir = ir;
        await next();
      },
    });

    // Stage 3: Exporter Dispatcher
    runner.use(createExporterDispatcherMiddleware({ dispatcher: this.dispatcher, targetAspectRatio: '9:16' }));

    return runner;
  }

  public async execute(
    payload: DBTemplatePayload,
    options: PipelineExecutionOptions = {}
  ): Promise<UnifiedPipelineContext<DBTemplatePayload>> {
    const targetDir = options.outDir || path.resolve(process.cwd(), 'autogenerated', 'db-templating', Date.now().toString());
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const ctx = createUnifiedPipelineContext<DBTemplatePayload>({
      pipelineId: this.id,
      input: payload,
      outDir: targetDir,
      dryRun: options.dryRun,
    });

    const runner = this.buildRunner();
    return await runner.run(ctx);
  }

  public async run(
    payload: DBTemplatePayload,
    outDir?: string
  ): Promise<{ ir: PipelineIR; exportResults: MultiExportResults }> {
    const ctx = await this.execute(payload, { outDir });
    return {
      ir: ctx.ir as PipelineIR,
      exportResults: ctx.exportResults!,
    };
  }
}

// Auto-register in central registry
defaultPipelineRegistry.register(new DBTemplatingPipeline(), ['2', 'db', 'db-templating', 'database']);
