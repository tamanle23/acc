import type { IPipelineMiddleware } from '@acc/core';
import type { ScraperPipelineContext, ScraperSummary } from '../ScraperPipeline';
import { defaultIPCFacade, IPCFacade } from '@acc/core';

export function createScraperLLMSummarizeStage(
  ipcFacade: IPCFacade = defaultIPCFacade
): IPipelineMiddleware<ScraperPipelineContext> {
  return {
    name: 'ScraperLLMSummarizeStage',
    async execute(ctx: ScraperPipelineContext, next: () => Promise<void>): Promise<void> {
      const event = ctx.input;
      const prompt = `Extract news summary from the following text:\n\n${event.rawText}`;
      const llmRes = await ipcFacade.generateStructuredJson(prompt);

      let summary: ScraperSummary;
      try {
        summary = JSON.parse(llmRes.jsonOutput);
      } catch {
        summary = {
          title: 'Breaking Event Update',
          key_points: ['Critical data update received', 'Monitoring active metrics'],
          urgency_level: 'high',
          voiceover_script: 'Breaking alert: critical updates detected in event stream.',
          category: 'tech',
        };
      }
      ctx.summary = summary;
      await next();
    },
  };
}
