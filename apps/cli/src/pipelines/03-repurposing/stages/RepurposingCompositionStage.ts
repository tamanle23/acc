import path from 'path';
import fs from 'fs';
import type { PipelineIR, ContentChunk } from '@acc/ir';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import type { IPipelineMiddleware } from '@acc/core';
import type { RepurposingPipelineContext } from '../RepurposingPipeline';

export function createRepurposingCompositionStage(): IPipelineMiddleware<RepurposingPipelineContext> {
  return {
    name: 'RepurposingCompositionStage',
    async execute(ctx: RepurposingPipelineContext, next: () => Promise<void>): Promise<void> {
      const input = ctx.input;
      const viralHookText = ctx.viralHookText || input.rawTranscript.slice(0, 100);

      const cardWidth = 1080;
      const cardHeight = 1920;
      const canvas = UniversalCanvasProvider.createCanvas(cardWidth, cardHeight);
      const renderCtx = canvas.getContext('2d');

      // Background
      const bgGrad = renderCtx.createLinearGradient(0, 0, 0, cardHeight);
      bgGrad.addColorStop(0, '#13111c');
      bgGrad.addColorStop(1, '#090810');
      renderCtx.fillStyle = bgGrad;
      renderCtx.fillRect(0, 0, cardWidth, cardHeight);

      // Dynamic Speaker Highlight Frame
      const speakerX = (input.activeSpeakerPosition?.x ?? 0.5) * cardWidth;
      const speakerY = (input.activeSpeakerPosition?.y ?? 0.35) * cardHeight;

      renderCtx.save();
      renderCtx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      renderCtx.lineWidth = 4;
      renderCtx.beginPath();
      renderCtx.arc(speakerX, speakerY, 260, 0, Math.PI * 2);
      renderCtx.stroke();

      const faceGlow = renderCtx.createRadialGradient(speakerX, speakerY, 50, speakerX, speakerY, 260);
      faceGlow.addColorStop(0, 'rgba(168, 85, 247, 0.18)');
      faceGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      renderCtx.fillStyle = faceGlow;
      renderCtx.fill();
      renderCtx.restore();

      // Header badge
      renderCtx.fillStyle = '#a855f7';
      renderCtx.fillRect(80, 140, 240, 44);
      renderCtx.fillStyle = '#ffffff';
      renderCtx.font = 'bold 22px sans-serif';
      renderCtx.fillText('REPURPOSED CLIP', 105, 170);

      // Title
      renderCtx.fillStyle = '#ffffff';
      renderCtx.font = 'bold 50px sans-serif';
      renderCtx.fillText(input.title.slice(0, 35), 80, 260);

      // Subtitle Karaoke Placement
      const subY = cardHeight * 0.72;
      renderCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      renderCtx.fillRect(60, subY - 40, cardWidth - 120, 260);

      renderCtx.font = 'bold 44px sans-serif';
      renderCtx.fillStyle = '#facc15';
      renderCtx.textAlign = 'center';

      const hookWords = viralHookText.split(' ');
      let currentLine = '';
      let lineY = subY + 30;
      for (const w of hookWords.slice(0, 25)) {
        const testLine = currentLine + w + ' ';
        if (renderCtx.measureText(testLine).width > cardWidth - 180) {
          renderCtx.fillText(currentLine, cardWidth / 2, lineY);
          currentLine = w + ' ';
          lineY += 60;
        } else {
          currentLine = testLine;
        }
      }
      renderCtx.fillText(currentLine, cardWidth / 2, lineY);
      renderCtx.textAlign = 'left';

      const framePath = path.join(ctx.outDir, 'repurposed_frame.png');
      fs.writeFileSync(framePath, canvas.toBuffer('image/png'));
      ctx.repurposedFramePath = framePath;
      ctx.assets.register('chunk_hook_0', 'original', framePath, { width: cardWidth, height: cardHeight });

      const chunks: ContentChunk[] = [
        {
          id: 'chunk_hook_0',
          order: 0,
          text: viralHookText,
          durationMs: 4500,
          visualAsset: {
            type: 'canvas',
            sourcePathOrBuffer: framePath,
            resolution: { width: cardWidth, height: cardHeight },
          },
          metadata: {
            hookType: 'high_engagement_highlight',
            originalSource: input.sourceMediaUrl,
          },
        },
      ];

      const ir: PipelineIR = {
        schemaVersion: '3.0.0',
        pipelineId: 'repurposing-recycler',
        metadata: {
          jobId: `rep_${Date.now()}`,
          title: input.title,
          createdAt: new Date().toISOString(),
          tags: ['repurposed', 'shorts', 'karaoke-clip'],
          author: 'Repurposing Pipeline',
        },
        chunks,
        audioComposition: {
          sfxMarkers: [],
          ducking: { enabled: false, attenuationDb: 0, attackMs: 0, releaseMs: 0 },
        },
        structuredData: {
          originalTranscript: input.rawTranscript,
          viralHook: viralHookText,
        },
        distributionHints: {
          supportedExporters: ['video', 'social'],
          targetAspectRatios: ['9:16'],
        },
      };

      ctx.ir = ir;
      await next();
    },
  };
}
