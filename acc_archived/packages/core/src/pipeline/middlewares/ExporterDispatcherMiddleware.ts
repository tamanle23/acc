import { defaultExporterDispatcher, ExporterDispatcher } from '@acc/exporters';
import type { IPipelineMiddleware } from '../../PipelineRunner';
import type { UnifiedPipelineContext } from '../UnifiedPipelineContext';
import { UniversalLogger as Logger } from '@acc/core-isomorphic';

export interface ExporterDispatcherOptions {
  dispatcher?: ExporterDispatcher;
  targetAspectRatio?: '16:9' | '9:16' | '1:1';
  format?: 'mp4' | 'mkv' | 'mov' | 'webm' | string;
  exporters?: string[];
}

export function createExporterDispatcherMiddleware<TInput = any>(
  options: ExporterDispatcherOptions = {}
): IPipelineMiddleware<UnifiedPipelineContext<TInput>> {
  const dispatcher = options.dispatcher || defaultExporterDispatcher;

  return {
    name: 'ExporterDispatcherMiddleware',
    async execute(ctx: UnifiedPipelineContext<TInput>, next: () => Promise<void>): Promise<void> {
      if (ctx.dryRun) {
        Logger.info('ExporterDispatcherMiddleware', 'Dry-run mode enabled; skipping physical file exports.');
        await next();
        return;
      }

      if (!ctx.ir) {
        Logger.warn('ExporterDispatcherMiddleware', 'No PipelineIR found on context; skipping exporter dispatcher.');
        await next();
        return;
      }

      Logger.info('ExporterDispatcherMiddleware', `Exporting deliverables for pipeline [${ctx.pipelineId}] to: ${ctx.outDir}`);
      
      const exportResults = await dispatcher.exportAll(ctx.ir as any, {
        outputDir: ctx.outDir,
        targetAspectRatio: options.targetAspectRatio || '9:16',
        format: options.format as any,
      });

      ctx.exportResults = exportResults;
      await next();
    },
  };
}
