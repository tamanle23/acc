import type { IPipelineMiddleware } from '@acc/core';
import type { ScraperPipelineContext, ScraperSummary } from '../ScraperPipeline';
import { AIInferenceClient } from '@acc/ai-control-plane-sdk';

const defaultClient = new AIInferenceClient();

export function createScraperLLMSummarizeStage(
  client: AIInferenceClient = defaultClient
): IPipelineMiddleware<ScraperPipelineContext> {
  return {
    name: 'ScraperLLMSummarizeStage',
    async execute(ctx: ScraperPipelineContext, next: () => Promise<void>): Promise<void> {
      const event = ctx.input;
      const prompt = `Extract news summary from the following text in JSON with fields title, key_points, urgency_level, voiceover_script, category:\n\n${event.rawText}`;

      let summary: ScraperSummary;
      try {
        const response = await client.openAiChatCompletion({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are an event extraction engine. Output valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        });
        const jsonText = response.choices?.[0]?.message?.content || '{}';
        summary = JSON.parse(jsonText);
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
