import { describe, it, expect } from 'bun:test';
import type { PipelineIR } from '@acc/ir';
import { ExporterDispatcher, defaultExporterDispatcher, type IExporter, type ExportResult } from '@acc/exporters';

describe('Phase 2: ExporterDispatcher & Extensibility Suite', () => {
  const minimalIR: PipelineIR = {
    schemaVersion: '3.0.0',
    pipelineId: 'rule-logic',
    metadata: {
      jobId: 'dispatcher_test',
      title: 'Dispatcher Test Title',
      createdAt: new Date().toISOString(),
      tags: ['test'],
    },
    chunks: [
      { id: 'c1', order: 1, text: 'Sample logic problem', durationMs: 1000 },
    ],
    audioComposition: { sfxMarkers: [], ducking: { enabled: false, attenuationDb: -16, attackMs: 100, releaseMs: 300 } },
    distributionHints: { supportedExporters: ['social'], targetAspectRatios: ['1:1'] },
  };

  it('initializes default dispatcher with all 4 core exporters', () => {
    expect(defaultExporterDispatcher.get('video')).toBeDefined();
    expect(defaultExporterDispatcher.get('audio')).toBeDefined();
    expect(defaultExporterDispatcher.get('social')).toBeDefined();
    expect(defaultExporterDispatcher.get('static-web')).toBeDefined();
    expect(defaultExporterDispatcher.get('non_existent')).toBeUndefined();
  });

  it('allows dynamic registration of custom third-party exporters', async () => {
    const customDispatcher = new ExporterDispatcher();

    class MockWebhookExporter implements IExporter {
      public readonly id = 'webhook';
      async export(ir: PipelineIR): Promise<ExportResult> {
        return {
          exporterId: this.id,
          outputPath: 'https://api.example.com/webhook/post',
          format: 'json_payload',
          metadata: { delivered: true, titleSent: ir.metadata.title },
        };
      }
    }

    customDispatcher.register(new MockWebhookExporter());
    const webhookExporter = customDispatcher.get('webhook');
    expect(webhookExporter).toBeDefined();

    const result = await webhookExporter?.export(minimalIR);
    expect(result?.exporterId).toBe('webhook');
    expect(result?.outputPath).toBe('https://api.example.com/webhook/post');
    expect(result?.metadata?.titleSent).toBe('Dispatcher Test Title');
  });
});
