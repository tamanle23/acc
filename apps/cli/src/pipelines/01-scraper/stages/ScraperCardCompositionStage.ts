import path from 'path';
import fs from 'fs';
import { createCanvas } from '@napi-rs/canvas';
import type { PipelineIR, ContentChunk } from '@acc/ir';
import type { IPipelineMiddleware } from '@acc/core';
import type { ScraperPipelineContext } from '../ScraperPipeline';

export function createScraperCardCompositionStage(): IPipelineMiddleware<ScraperPipelineContext> {
  return {
    name: 'ScraperCardCompositionStage',
    async execute(ctx: ScraperPipelineContext, next: () => Promise<void>): Promise<void> {
      const summary = ctx.summary || {
        title: 'Breaking Event Update',
        key_points: ['Critical data update received'],
        urgency_level: 'high',
        voiceover_script: 'Breaking alert: critical updates detected.',
        category: 'tech',
      };

      const cardWidth = 1080;
      const cardHeight = 1920;
      const canvas = createCanvas(cardWidth, cardHeight);
      const renderCtx = canvas.getContext('2d');

      // Background gradient
      const grad = renderCtx.createLinearGradient(0, 0, 0, cardHeight);
      grad.addColorStop(0, '#0a0d1a');
      grad.addColorStop(1, '#05070e');
      renderCtx.fillStyle = grad;
      renderCtx.fillRect(0, 0, cardWidth, cardHeight);

      // Header badge
      const badgeColor =
        summary.urgency_level === 'critical' ? '#ff3344' : summary.urgency_level === 'high' ? '#ff8800' : '#00d2ff';
      renderCtx.fillStyle = badgeColor;
      renderCtx.fillRect(80, 140, 260, 48);

      renderCtx.fillStyle = '#ffffff';
      renderCtx.font = 'bold 24px sans-serif';
      renderCtx.fillText(`${summary.urgency_level.toUpperCase()} ALERT`, 105, 172);

      // Category tag
      renderCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      renderCtx.font = '22px sans-serif';
      renderCtx.fillText(`CATEGORY: ${summary.category.toUpperCase()} • ${new Date().toLocaleTimeString()}`, 360, 172);

      // Title
      renderCtx.fillStyle = '#ffffff';
      renderCtx.font = 'bold 64px sans-serif';

      const words = summary.title.split(' ');
      let line = '';
      let y = 290;
      for (const w of words) {
        const testLine = line + w + ' ';
        if (renderCtx.measureText(testLine).width > 900) {
          renderCtx.fillText(line, 80, y);
          line = w + ' ';
          y += 80;
        } else {
          line = testLine;
        }
      }
      renderCtx.fillText(line, 80, y);

      // Key points bullets
      y += 100;
      renderCtx.font = 'bold 36px sans-serif';
      renderCtx.fillStyle = badgeColor;
      renderCtx.fillText('KEY DEVELOPMENTS', 80, y);
      y += 60;

      renderCtx.font = '32px sans-serif';
      renderCtx.fillStyle = '#e2e8f0';
      for (const pt of summary.key_points) {
        renderCtx.fillStyle = badgeColor;
        renderCtx.beginPath();
        renderCtx.arc(95, y - 10, 8, 0, Math.PI * 2);
        renderCtx.fill();

        renderCtx.fillStyle = '#e2e8f0';
        renderCtx.fillText(pt.slice(0, 50), 125, y);
        y += 75;
      }

      // Footer banner
      renderCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      renderCtx.fillRect(80, cardHeight - 160, cardWidth - 160, 2);
      renderCtx.font = '24px sans-serif';
      renderCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      renderCtx.fillText('⚡ Automated Event-Driven Stream • Visual Storytelling Engine', 80, cardHeight - 100);

      const alertCardPath = path.join(ctx.outDir, 'alert_card.png');
      fs.writeFileSync(alertCardPath, canvas.toBuffer('image/png'));
      ctx.alertCardPath = alertCardPath;
      ctx.assets.register('alert_chunk_0', 'original', alertCardPath, { width: cardWidth, height: cardHeight });

      const chunks: ContentChunk[] = [
        {
          id: 'alert_chunk_0',
          order: 0,
          text: summary.voiceover_script,
          spokenAudioPath: ctx.audioPath,
          durationMs: ctx.durationMs || 3000,
          visualAsset: {
            type: 'canvas',
            sourcePathOrBuffer: alertCardPath,
            resolution: { width: cardWidth, height: cardHeight },
          },
          metadata: {
            key_points: summary.key_points,
            urgency: summary.urgency_level,
          },
        },
      ];

      const ir: PipelineIR = {
        schemaVersion: '3.0.0',
        pipelineId: 'scraper-summarizer',
        metadata: {
          jobId: `job_${Date.now()}`,
          title: summary.title,
          createdAt: ctx.input.receivedAt || new Date().toISOString(),
          tags: [summary.category, summary.urgency_level, 'breaking'],
          author: 'ACC Scraper Engine',
        },
        chunks,
        audioComposition: {
          narrationTrack: {
            sampleRate: 24000,
            channels: 1,
            loudnessLufs: -14,
          },
          sfxMarkers: [],
          ducking: {
            enabled: true,
            attenuationDb: -16,
            attackMs: 20,
            releaseMs: 150,
          },
        },
        structuredData: {
          title: summary.title,
          key_points: summary.key_points,
          urgency: summary.urgency_level,
          category: summary.category,
          source: ctx.input.sourceUrl || ctx.input.sourceType || 'stream',
        },
        distributionHints: {
          supportedExporters: ['video', 'audio', 'social', 'static-web'],
          targetAspectRatios: ['9:16', '16:9', '1:1'],
        },
      };

      ctx.ir = ir;
      await next();
    },
  };
}
