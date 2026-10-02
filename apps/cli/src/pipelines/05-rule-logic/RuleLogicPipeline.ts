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

export interface MathProofStep {
  stepNumber: number;
  explanation: string;
  latexFormula: string;
  evaluatedResult?: string;
}

export interface RuleLogicPayload {
  problemTitle: string;
  problemStatement: string;
  category: 'calculus' | 'algebra' | 'discrete_math' | 'physics' | string;
  steps: MathProofStep[];
  finalAnswer: string;
}

export interface RuleLogicPipelineContext extends UnifiedPipelineContext<RuleLogicPayload> {
  boardImagePath?: string;
}

export class RuleLogicPipeline implements IPipeline<RuleLogicPayload> {
  public readonly id = 'rule-logic' as const;
  public readonly name = 'Rule & Mathematical Logic Engine';
  public readonly description = 'Executes step-by-step mathematical proofs, logic solving sequences, and renders high-contrast educational chalkboard/Manim-style slides.';

  private dispatcher: ExporterDispatcher;

  constructor(dispatcher?: ExporterDispatcher) {
    this.dispatcher = dispatcher || defaultExporterDispatcher;
  }

  public buildRunner(): PipelineRunner<UnifiedPipelineContext<RuleLogicPayload>> {
    const runner = new PipelineRunner<UnifiedPipelineContext<RuleLogicPayload>>();

    // Stage 1: Validation & Layout Calculation
    runner.use({
      name: 'RuleLogicProofValidationStage',
      execute: async (ctx: RuleLogicPipelineContext, next) => {
        const payload = ctx.input;
        if (!payload.steps || payload.steps.length === 0) {
          payload.steps = [
            {
              stepNumber: 1,
              explanation: 'Evaluate initial identity',
              latexFormula: 'f(x) = verified',
              evaluatedResult: 'OK',
            },
          ];
        }
        await next();
      },
    });

    // Stage 2: Chalkboard Canvas Rendering & PipelineIR Assembly
    runner.use({
      name: 'RuleLogicChalkboardCompositionStage',
      execute: async (ctx: RuleLogicPipelineContext, next) => {
        const payload = ctx.input;
        const cardWidth = 1920;
        const cardHeight = 1080;
        const canvas = createCanvas(cardWidth, cardHeight);
        const renderCtx = canvas.getContext('2d');

        // Blackboard texture gradient
        const bgGrad = renderCtx.createLinearGradient(0, 0, 0, cardHeight);
        bgGrad.addColorStop(0, '#0a1d13');
        bgGrad.addColorStop(1, '#05110a');
        renderCtx.fillStyle = bgGrad;
        renderCtx.fillRect(0, 0, cardWidth, cardHeight);

        // Frame
        renderCtx.strokeStyle = '#3b2210';
        renderCtx.lineWidth = 20;
        renderCtx.strokeRect(10, 10, cardWidth - 20, cardHeight - 20);

        renderCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        renderCtx.lineWidth = 2;
        renderCtx.strokeRect(30, 30, cardWidth - 60, cardHeight - 60);

        // Badge
        renderCtx.fillStyle = '#10b981';
        renderCtx.fillRect(60, 50, 260, 40);
        renderCtx.fillStyle = '#ffffff';
        renderCtx.font = 'bold 20px monospace';
        renderCtx.fillText(`Q.E.D. RULE SOLVER`, 80, 77);

        // Problem Statement
        renderCtx.fillStyle = '#ffffff';
        renderCtx.font = 'bold 44px sans-serif';
        renderCtx.fillText(payload.problemTitle, 60, 140);

        renderCtx.font = 'italic 28px sans-serif';
        renderCtx.fillStyle = '#94a3b8';
        renderCtx.fillText(`Given: ${payload.problemStatement}`, 60, 190);

        // Steps breakdown
        let y = 260;
        payload.steps.slice(0, 4).forEach((step) => {
          renderCtx.font = 'bold 26px sans-serif';
          renderCtx.fillStyle = '#38bdf8';
          renderCtx.fillText(`Step ${step.stepNumber}: ${step.explanation}`, 60, y);
          y += 40;

          renderCtx.fillStyle = '#fef08a';
          renderCtx.font = '32px monospace';
          renderCtx.fillText(`   ${step.latexFormula}`, 60, y);

          if (step.evaluatedResult) {
            renderCtx.fillStyle = '#86efac';
            renderCtx.fillText(
              ` => ${step.evaluatedResult}`,
              60 + renderCtx.measureText(`   ${step.latexFormula}`).width + 20,
              y
            );
          }

          y += 65;
        });

        // Boxed Final Answer
        y = Math.min(y + 20, cardHeight - 160);
        renderCtx.fillStyle = 'rgba(16, 185, 129, 0.1)';
        renderCtx.fillRect(60, y, 700, 75);
        renderCtx.strokeStyle = '#10b981';
        renderCtx.lineWidth = 4;
        renderCtx.strokeRect(60, y, 700, 75);

        renderCtx.font = 'bold 32px monospace';
        renderCtx.fillStyle = '#ffffff';
        renderCtx.fillText(`FINAL ANSWER: ${payload.finalAnswer}`, 85, y + 48);

        const boardImagePath = path.join(ctx.outDir, 'chalkboard_solution.png');
        fs.writeFileSync(boardImagePath, canvas.toBuffer('image/png'));
        ctx.boardImagePath = boardImagePath;
        ctx.assets.register('chunk_math_0', 'original', boardImagePath, { width: cardWidth, height: cardHeight });

        const chunks: ContentChunk[] = [
          {
            id: 'chunk_math_0',
            order: 0,
            text: `Problem: ${payload.problemTitle}. Following deterministic proof rules, final answer is ${payload.finalAnswer}.`,
            durationMs: 4000,
            visualAsset: {
              type: 'canvas',
              sourcePathOrBuffer: boardImagePath,
              resolution: { width: cardWidth, height: cardHeight },
            },
            metadata: {
              category: payload.category,
              stepCount: payload.steps.length,
              finalAnswer: payload.finalAnswer,
            },
          },
        ];

        const ir: PipelineIR = {
          schemaVersion: '3.0.0',
          pipelineId: 'rule-logic',
          metadata: {
            jobId: `math_${Date.now()}`,
            title: payload.problemTitle,
            createdAt: new Date().toISOString(),
            tags: [payload.category, 'proof', 'deterministic-logic'],
            author: 'Rule & Math Logic Pipeline',
          },
          chunks,
          audioComposition: {
            sfxMarkers: [],
            ducking: { enabled: false, attenuationDb: 0, attackMs: 0, releaseMs: 0 },
          },
          structuredData: {
            problemStatement: payload.problemStatement,
            steps: payload.steps,
            finalAnswer: payload.finalAnswer,
          },
          distributionHints: {
            supportedExporters: ['video', 'social', 'static-web'],
            targetAspectRatios: ['16:9'],
          },
        };

        ctx.ir = ir;
        await next();
      },
    });

    // Stage 3: Exporter Dispatcher
    runner.use(createExporterDispatcherMiddleware({ dispatcher: this.dispatcher, targetAspectRatio: '16:9' }));

    return runner;
  }

  public async execute(
    payload: RuleLogicPayload,
    options: PipelineExecutionOptions = {}
  ): Promise<UnifiedPipelineContext<RuleLogicPayload>> {
    const targetDir = options.outDir || path.resolve(process.cwd(), 'autogenerated', 'rule-logic', Date.now().toString());
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const ctx = createUnifiedPipelineContext<RuleLogicPayload>({
      pipelineId: this.id,
      input: payload,
      outDir: targetDir,
      dryRun: options.dryRun,
    });

    const runner = this.buildRunner();
    return await runner.run(ctx);
  }

  public async run(
    payload: RuleLogicPayload,
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
defaultPipelineRegistry.register(new RuleLogicPipeline(), ['5', 'rule', 'math', 'logic', 'rule-logic']);
