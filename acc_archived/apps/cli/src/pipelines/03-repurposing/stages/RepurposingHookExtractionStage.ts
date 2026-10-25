import type { IPipelineMiddleware } from '@acc/core';
import type { RepurposingPipelineContext } from '../RepurposingPipeline';

export function createRepurposingHookExtractionStage(): IPipelineMiddleware<RepurposingPipelineContext> {
  return {
    name: 'RepurposingHookExtractionStage',
    async execute(ctx: RepurposingPipelineContext, next: () => Promise<void>): Promise<void> {
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
  };
}
