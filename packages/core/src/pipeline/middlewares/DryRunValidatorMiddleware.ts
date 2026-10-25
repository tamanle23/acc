import type { IPipelineMiddleware } from '../../PipelineRunner';
import type { UnifiedPipelineContext } from '../UnifiedPipelineContext';
import { UniversalLogger as Logger } from '@acc/core-isomorphic';

export interface DryRunValidationReport {
  valid: boolean;
  warnings: string[];
  errors: string[];
  commandCount: number;
  chunkCount: number;
}

export function createDryRunValidatorMiddleware<TInput = any>(): IPipelineMiddleware<
  UnifiedPipelineContext<TInput>
> {
  return {
    name: 'DryRunValidatorMiddleware',
    async execute(ctx: UnifiedPipelineContext<TInput>, next: () => Promise<void>): Promise<void> {
      const report: DryRunValidationReport = {
        valid: true,
        warnings: [],
        errors: [],
        commandCount: ctx.vfxQueue.length,
        chunkCount: ctx.ir ? (ctx.ir as any).chunks?.length || 0 : 0,
      };

      // 1. Validate VFX Command queue
      for (const cmd of ctx.vfxQueue) {
        if (typeof cmd.validate === 'function') {
          const res = cmd.validate(ctx.assets);
          if (!res.valid) {
            report.valid = false;
            report.errors.push(`Command [${cmd.id} (${cmd.type})] validation error: ${res.errors.join('; ')}`);
          }
        }
      }

      // 2. Validate PipelineIR integrity
      if (ctx.ir) {
        if (!ctx.ir.pipelineId) {
          report.warnings.push('PipelineIR is missing pipelineId identifier.');
        }
        const chunks = (ctx.ir as any).chunks || (ctx.ir as any).extendedChunks || [];
        if (chunks.length === 0) {
          report.warnings.push('PipelineIR contains 0 content chunks.');
        }
      } else {
        report.warnings.push('Context has no PipelineIR assembled prior to dry-run validation.');
      }

      ctx.metadata.validationReport = report;

      if (!report.valid) {
        Logger.warn('DryRunValidator', `Validation found ${report.errors.length} issue(s): ${report.errors.join(', ')}`);
      } else {
        Logger.debug('DryRunValidator', `Dry-run validation passed (${report.commandCount} commands, ${report.chunkCount} chunks).`);
      }

      await next();
    },
  };
}
