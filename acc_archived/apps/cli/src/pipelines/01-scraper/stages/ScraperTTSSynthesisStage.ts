import path from 'path';
import fs from 'fs';
import type { IPipelineMiddleware } from '@acc/core';
import type { ScraperPipelineContext } from '../ScraperPipeline';
import { defaultIPCFacade, IPCFacade } from '@acc/core';

export function createScraperTTSSynthesisStage(
  ipcFacade: IPCFacade = defaultIPCFacade
): IPipelineMiddleware<ScraperPipelineContext> {
  return {
    name: 'ScraperTTSSynthesisStage',
    async execute(ctx: ScraperPipelineContext, next: () => Promise<void>): Promise<void> {
      const script = ctx.summary?.voiceover_script || 'Breaking alert update.';
      const speechRes = await ipcFacade.synthesizeSpeech(script, 'af_heart', 1.0, 'kokoro');
      const audioPath = path.join(ctx.outDir, 'narration.wav');

      if (speechRes.audioBuffer && speechRes.audioBuffer.length > 0) {
        fs.writeFileSync(audioPath, speechRes.audioBuffer);
      } else {
        fs.writeFileSync(audioPath, Buffer.alloc(0));
      }

      ctx.audioPath = audioPath;
      ctx.durationMs = speechRes.durationMs || 3000;
      ctx.assets.register('alert_chunk_0', 'narration', audioPath, { duration: ctx.durationMs / 1000 });
      await next();
    },
  };
}
