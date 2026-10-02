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

export interface RepurposingWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface RepurposingInput {
  title: string;
  rawTranscript: string;
  wordTimestamps?: RepurposingWord[];
  sourceMediaUrl?: string;
  activeSpeakerPosition?: { x: number; y: number }; // normalized 0..1 coordinates
}

export interface RepurposingPipelineContext extends UnifiedPipelineContext<RepurposingInput> {
  viralHookText?: string;
  repurposedFramePath?: string;
}

export class RepurposingPipeline implements IPipeline<RepurposingInput> {
  public readonly id = 'repurposing' as const;
  public readonly name = 'Long-Form Video Recycler & Smart-Crop Pipeline';
  public readonly description = 'Extracts high-retention viral hooks from long transcripts, tracks speaker regions, and renders vertical 9:16 clips with animated captions.';

  private dispatcher: ExporterDispatcher;

  constructor(dispatcher?: ExporterDispatcher) {
    this.dispatcher = dispatcher || defaultExporterDispatcher;
  }

  public buildRunner(): PipelineRunner<UnifiedPipelineContext<RepurposingInput>> {
    const runner = new PipelineRunner<UnifiedPipelineContext<RepurposingInput>>();

    // Stage 1: Viral Hook & Transcript Extraction
    runner.use({
      name: 'RepurposingHookExtractionStage',
      execute: async (ctx: RepurposingPipelineContext, next) => {
        const input = ctx.input;
        const sentences = input.rawTranscript
          .split(/[.!?]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 20);

        const hookSentences = sentences.slice(0, 3);
        const viralHookText = (hookSentences.length > 0 ? hookSentences.join('. ') : input.rawTranscript.slice(0, 100)) + '.';
        ctx.viralHookText = viralHookText;
        await next();
      },
    });

    // Stage 2: Speaker Framing, Karaoke Layout & PipelineIR Assembly
    runner.use({
      name: 'RepurposingCompositionStage',
      execute: async (ctx: RepurposingPipelineContext, next) => {
        const input = ctx.input;
        const viralHookText = ctx.viralHookText!;

        const cardWidth = 1080;
        const cardHeight = 1920;
        const canvas = createCanvas(cardWidth, cardHeight);
        const renderCtx = canvas.getContext('2d');

        // Background
        const bgGrad = renderCtx.createLinearGradient(0, 0, 0, cardHeight);
        bgGrad.addColorStop(0, '#13111c');
        bgGrad.addColorStop(1, '#090810');
        renderCtx.fillStyle = bgGrad;
        renderCtx.fillRect(0, 0, cardWidth, cardHeight);

        // Dynamic Speaker Highlight Frame
        const speakerX = (input.activeSpeakerPosition?.x ?? 0.5) * cardWidth;
        const speakerY = (input.activeSpeakerPosition?.y ?? 0.35) * cardHeight;

        renderCtx.save();
        renderCtx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
        renderCtx.lineWidth = 4;
        renderCtx.beginPath();
        renderCtx.arc(speakerX, speakerY, 260, 0, Math.PI * 2);
        renderCtx.stroke();

        const faceGlow = renderCtx.createRadialGradient(speakerX, speakerY, 50, speakerX, speakerY, 260);
        faceGlow.addColorStop(0, 'rgba(168, 85, 247, 0.18)');
        faceGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        renderCtx.fillStyle = faceGlow;
        renderCtx.fill();
        renderCtx.restore();

        // Header badge
        renderCtx.fillStyle = '#a855f7';
        renderCtx.fillRect(80, 140, 240, 44);
        renderCtx.fillStyle = '#ffffff';
        renderCtx.font = 'bold 22px sans-serif';
        renderCtx.fillText('REPURPOSED CLIP', 105, 170);

        // Title
        renderCtx.fillStyle = '#ffffff';
        renderCtx.font = 'bold 50px sans-serif';
        renderCtx.fillText(input.title.slice(0, 35), 80, 260);

        // Subtitle Karaoke Placement
        const subY = cardHeight * 0.72;
        renderCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        renderCtx.fillRect(60, subY - 40, cardWidth - 120, 260);

        renderCtx.font = 'bold 44px sans-serif';
        renderCtx.fillStyle = '#facc15';
        renderCtx.textAlign = 'center';

        const hookWords = viralHookText.split(' ');
        let currentLine = '';
        let lineY = subY + 30;
        for (const w of hookWords.slice(0, 25)) {
          const testLine = currentLine + w + ' ';
          if (renderCtx.measureText(testLine).width > cardWidth - 180) {
            renderCtx.fillText(currentLine, cardWidth / 2, lineY);
            currentLine = w + ' ';
            lineY += 60;
          } else {
            currentLine = testLine;
          }
        }
        renderCtx.fillText(currentLine, cardWidth / 2, lineY);
        renderCtx.textAlign = 'left';

        const framePath = path.join(ctx.outDir, 'repurposed_frame.png');
        fs.writeFileSync(framePath, canvas.toBuffer('image/png'));
        ctx.repurposedFramePath = framePath;
        ctx.assets.register('chunk_hook_0', 'original', framePath, { width: cardWidth, height: cardHeight });

        const chunks: ContentChunk[] = [
          {
            id: 'chunk_hook_0',
            order: 0,
            text: viralHookText,
            durationMs: 4500,
            visualAsset: {
              type: 'canvas',
              sourcePathOrBuffer: framePath,
              resolution: { width: cardWidth, height: cardHeight },
            },
            metadata: {
              hookType: 'high_engagement_highlight',
              originalSource: input.sourceMediaUrl,
            },
          },
        ];

        const ir: PipelineIR = {
          schemaVersion: '3.0.0',
          pipelineId: 'repurposing-recycler',
          metadata: {
            jobId: `rep_${Date.now()}`,
            title: input.title,
            createdAt: new Date().toISOString(),
            tags: ['repurposed', 'shorts', 'karaoke-clip'],
            author: 'Repurposing Pipeline',
          },
          chunks,
          audioComposition: {
            sfxMarkers: [],
            ducking: { enabled: false, attenuationDb: 0, attackMs: 0, releaseMs: 0 },
          },
          structuredData: {
            originalTranscript: input.rawTranscript,
            viralHook: viralHookText,
          },
          distributionHints: {
            supportedExporters: ['video', 'social'],
            targetAspectRatios: ['9:16'],
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
    input: RepurposingInput,
    options: PipelineExecutionOptions = {}
  ): Promise<UnifiedPipelineContext<RepurposingInput>> {
    const targetDir = options.outDir || path.resolve(process.cwd(), 'autogenerated', 'repurposing', Date.now().toString());
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const ctx = createUnifiedPipelineContext<RepurposingInput>({
      pipelineId: this.id,
      input,
      outDir: targetDir,
      dryRun: options.dryRun,
    });

    const runner = this.buildRunner();
    return await runner.run(ctx);
  }

  public async run(
    input: RepurposingInput,
    outDir?: string
  ): Promise<{ ir: PipelineIR; exportResults: MultiExportResults }> {
    const ctx = await this.execute(input, { outDir });
    return {
      ir: ctx.ir as PipelineIR,
      exportResults: ctx.exportResults!,
    };
  }
}

// Auto-register in central registry
defaultPipelineRegistry.register(new RepurposingPipeline(), ['3', 'repurpose', 'repurposing', 'recycler']);
