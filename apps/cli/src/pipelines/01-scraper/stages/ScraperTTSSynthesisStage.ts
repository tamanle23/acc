import path from 'path';
import fs from 'fs';
import type { IPipelineMiddleware } from '@acc/core';
import type { ScraperPipelineContext } from '../ScraperPipeline';
import { AIInferenceClient } from '@acc/ai-control-plane-sdk';

const defaultClient = new AIInferenceClient();

export function createScraperTTSSynthesisStage(
  client: AIInferenceClient = defaultClient
): IPipelineMiddleware<ScraperPipelineContext> {
  return {
    name: 'ScraperTTSSynthesisStage',
    async execute(ctx: ScraperPipelineContext, next: () => Promise<void>): Promise<void> {
      const script = ctx.summary?.voiceover_script || 'Breaking alert update.';
      const audioPath = path.join(ctx.outDir, 'narration.wav');

      let audioBuffer: Buffer = Buffer.alloc(0);
      let durationMs = 3000;

      try {
        const res = await client.synthesizeSpeech({
          text: script,
          voice: 'Hải Đăng',
          speed: 1.0,
        });
        audioBuffer = Buffer.from(res.wavBuffer);
        durationMs = Math.round((res.durationSeconds || 3) * 1000);
      } catch {
        try {
          const openAiRes = await client.openAiSpeech({
            model: 'tts-1',
            input: script,
            voice: 'af_heart',
          });
          audioBuffer = Buffer.from(await openAiRes.arrayBuffer());
        } catch {
          audioBuffer = Buffer.alloc(0);
        }
      }

      fs.writeFileSync(audioPath, audioBuffer);
      ctx.audioPath = audioPath;
      ctx.durationMs = durationMs;
      ctx.assets.register('alert_chunk_0', 'narration', audioPath, { duration: ctx.durationMs / 1000 });
      await next();
    },
  };
}
