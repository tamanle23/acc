import type { IPipelineMiddleware } from '@acc/core';
import type { DBTemplatePipelineContext } from '../DBTemplatingPipeline';

export function createDBDataNormalizationStage(): IPipelineMiddleware<DBTemplatePipelineContext> {
  return {
    name: 'DBDataNormalizationStage',
    async execute(ctx: DBTemplatePipelineContext, next: () => Promise<void>): Promise<void> {
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
  };
}
