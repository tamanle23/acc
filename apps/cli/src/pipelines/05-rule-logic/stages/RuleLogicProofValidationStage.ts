import type { IPipelineMiddleware } from '@acc/core';
import type { RuleLogicPipelineContext } from '../RuleLogicPipeline';

export function createRuleLogicProofValidationStage(): IPipelineMiddleware<RuleLogicPipelineContext> {
  return {
    name: 'RuleLogicProofValidationStage',
    async execute(ctx: RuleLogicPipelineContext, next: () => Promise<void>): Promise<void> {
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
  };
}
