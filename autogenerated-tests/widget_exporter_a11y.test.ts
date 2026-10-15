import { describe, test, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { WidgetExporter } from '../packages/exporters/src/interactive-web/WidgetExporter';
import type { ExtendedPipelineIR } from '@acc/ir';

describe('WidgetExporter Accessibility & UX Verification', () => {
  test('exportInteractiveWidget generates HTML with proper WCAG accessibility attributes and focus management', async () => {
    const tmpDir = path.join(os.tmpdir(), `widget-a11y-test-${Date.now()}`);

    const syntheticIR: ExtendedPipelineIR = {
      metadata: {
        title: 'Interactive Choice Demo',
        jobId: 'job-12345',
        sourceFile: 'input.mp4',
        pipeline: '05-rule-logic',
        author: 'Palette',
        createdAt: new Date().toISOString(),
      },
      settings: {
        resolution: { width: 1080, height: 1920, aspectRatio: '9:16' },
        fps: 30,
        audioSampleRate: 44100,
        targetDurationMs: 10000,
      },
      chunks: [],
      extendedChunks: [
        {
          id: 'chunk-1',
          startTimeMs: 0,
          endTimeMs: 5000,
          durationMs: 5000,
          text: 'Choice Point 1',
        },
      ],
      interactiveNodes: [
        {
          timestampMs: 5000,
          options: [
            { label: 'Option A', targetChunkId: 'chunk-2' },
            { label: 'Option B', targetChunkId: 'chunk-3' },
          ],
        },
      ],
      videoEditingGroup: 1,
    };

    const { htmlPath, jsonPath } = await WidgetExporter.exportInteractiveWidget(syntheticIR, {
      outputDir: tmpDir,
      autostart: true,
    });

    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(fs.existsSync(jsonPath)).toBe(true);

    const htmlContent = await fs.promises.readFile(htmlPath, 'utf-8');

    // WCAG & UX Checks
    expect(htmlContent).toContain('.choice-btn:focus-visible');
    expect(htmlContent).toContain('min-height: 44px');
    expect(htmlContent).toContain('role="region"');
    expect(htmlContent).toContain('aria-label="Interactive branching choices"');
    expect(htmlContent).toContain('aria-live="polite"');
    expect(htmlContent).toContain('aria-controls="activeVideo"');
    expect(htmlContent).toContain('<video id="activeVideo" playsinline controls');
    expect(htmlContent).toContain('aria-label="Interactive Choice Demo"');
    expect(htmlContent).toContain("btn.type = 'button'");
    expect(htmlContent).toContain("Choice ${idx + 1} of ${currentNode.choices.length}");
    expect(htmlContent).toContain('firstBtn.focus()');
    expect(htmlContent).toContain('kbd-badge');
    expect(htmlContent).toContain("document.addEventListener('keydown'");

    // Cleanup
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });
});
