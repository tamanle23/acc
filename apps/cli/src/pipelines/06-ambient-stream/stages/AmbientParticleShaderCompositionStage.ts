import path from 'path';
import fs from 'fs';
import type { PipelineIR, ContentChunk } from '@acc/ir';
import { UniversalCanvasProvider, type IPipelineMiddleware } from '@acc/core';
import type { AmbientStreamPipelineContext } from '../AmbientStreamPipeline';

export function createAmbientParticleShaderCompositionStage(): IPipelineMiddleware<AmbientStreamPipelineContext> {
  return {
    name: 'AmbientParticleShaderCompositionStage',
    async execute(ctx: AmbientStreamPipelineContext, next: () => Promise<void>): Promise<void> {
      const config = ctx.input;
      const durationSec = config.loopDurationSeconds || 5;
      ctx.durationSec = durationSec;

      const width = 1920;
      const height = 1080;
      const canvas = UniversalCanvasProvider.createCanvas(width, height);
      const renderCtx = canvas.getContext('2d');

      const bgGrad = renderCtx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width * 0.7);
      if (config.theme === 'cyberpunk_rain') {
        bgGrad.addColorStop(0, '#1a0026');
        bgGrad.addColorStop(1, '#05000a');
      } else if (config.theme === 'lofi_study') {
        bgGrad.addColorStop(0, '#2d1b0e');
        bgGrad.addColorStop(1, '#0c0704');
      } else {
        // deep_space default
        bgGrad.addColorStop(0, '#061325');
        bgGrad.addColorStop(1, '#01040a');
      }
      renderCtx.fillStyle = bgGrad;
      renderCtx.fillRect(0, 0, width, height);

      // Generative procedural particles (Starfield / Dust)
      const particleCount = config.particleCount || 100;
      for (let i = 0; i < particleCount; i++) {
        const px = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * width;
        const py = ((Math.cos(i * 78.233) * 43758.5453) % 1) * height;
        const radius = 1 + (i % 4);
        const alpha = 0.2 + (i % 10) * 0.08;

        renderCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        renderCtx.beginPath();
        renderCtx.arc(Math.abs(px), Math.abs(py), radius, 0, Math.PI * 2);
        renderCtx.fill();
      }

      renderCtx.font = '300 28px sans-serif';
      renderCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      renderCtx.textAlign = 'center';
      renderCtx.fillText(`AMBIENT LOOP • ${config.theme.toUpperCase()} • 24/7 STREAM READY`, width / 2, height - 80);
      renderCtx.textAlign = 'left';

      const loopFramePath = path.join(ctx.outDir, 'ambient_loop_frame.png');
      fs.writeFileSync(loopFramePath, canvas.toBuffer('image/png'));
      ctx.loopFramePath = loopFramePath;
      ctx.assets.register('ambient_chunk_0', 'original', loopFramePath, { width, height });

      const chunks: ContentChunk[] = [
        {
          id: 'ambient_chunk_0',
          order: 0,
          text: `Continuous procedural ${config.theme} ambient stream loop.`,
          durationMs: durationSec * 1000,
          visualAsset: {
            type: 'canvas',
            sourcePathOrBuffer: loopFramePath,
            resolution: { width, height },
          },
          metadata: {
            theme: config.theme,
            loopDurationSeconds: durationSec,
          },
        },
      ];

      const ir: PipelineIR = {
        schemaVersion: '3.0.0',
        pipelineId: 'ambient-loops',
        metadata: {
          jobId: `amb_${Date.now()}`,
          title: config.title,
          createdAt: new Date().toISOString(),
          tags: [config.theme, 'ambient', 'procedural-loop'],
          author: 'Ambient Stream Pipeline',
        },
        chunks,
        audioComposition: {
          sfxMarkers: [],
          ducking: { enabled: false, attenuationDb: 0, attackMs: 0, releaseMs: 0 },
        },
        structuredData: {
          theme: config.theme,
          particleCount,
          loopDurationSeconds: durationSec,
        },
        distributionHints: {
          supportedExporters: ['video', 'audio', 'live-stream'],
          targetAspectRatios: ['16:9'],
        },
      };

      ctx.ir = ir;
      await next();
    },
  };
}
