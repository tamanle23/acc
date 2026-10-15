import { describe, it, expect } from 'bun:test';
import path from 'path';
import { Tracer, TraceContext, type TraceSpan } from '@acc/core';
import { parseCliArgs } from '../apps/cli/src/index';

describe('Enterprise Telemetry: Non-Invasive Distributed Tracing for ir-render', () => {
  const sampleConfigPath = path.resolve(import.meta.dir, '../sample-story/story-config.json');

  it('correctly parses --traceparent CLI argument in parseCliArgs', () => {
    const customTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const args = [
      'ir-render',
      '--config',
      './sample-story/story-config.json',
      '--traceparent',
      customTraceparent,
      '--dry-run',
    ];

    const parsed = parseCliArgs(args);
    expect(parsed.command).toBe('ir-render');
    expect(parsed.configPath).toBe('./sample-story/story-config.json');
    expect(parsed.traceparent).toBe(customTraceparent);
    expect(parsed.dryRun).toBe(true);
  });

  it('Tracer propagates context across async call trees without polluting arguments', async () => {
    const root = new TraceContext('4bf92f3577b34da6a3ce929d0e0e4736', '00f067aa0ba902b7');
    
    await Tracer.runWithContext(root, async () => {
      const active = Tracer.currentContext();
      expect(active?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(active?.spanId).toBe('00f067aa0ba902b7');

      // Nested child span
      await Tracer.withSpan('child.operation', async (span) => {
        expect(span.name).toBe('child.operation');
        expect(span.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
        expect(span.parentSpanId).toBe('00f067aa0ba902b7');
        expect(span.spanId).toBeDefined();
        expect(span.spanId).not.toBe('00f067aa0ba902b7');
      });
    });
  });

  it('executes handleIrRenderCommand in dry-run with ambient spans and captures lifecycle telemetry', async () => {
    const { handleIrRenderCommand } = await import('../apps/cli/src/commands/ir-render');
    const customTraceparent = '00-11112222333344445555666677778888-9999888877776666-01';

    const recordedSpans: TraceSpan[] = [];
    Tracer.addListener({
      onSpanEnd: (span) => {
        recordedSpans.push(span);
      },
    });

    try {
      await handleIrRenderCommand({
        input: sampleConfigPath,
        dryRun: true,
        traceparent: customTraceparent,
      });

      // Verify coarse phases were cleanly captured without modifying the rendering engine
      const spanNames = recordedSpans.map((s) => s.name);
      expect(spanNames).toContain('ir.input_transform');
      expect(spanNames).toContain('ir.dag_compile');

      // Verify all spans share the same root traceId from the incoming traceparent
      for (const span of recordedSpans) {
        expect(span.traceId).toBe('11112222333344445555666677778888');
        expect(span.attributes['status']).toBe('OK');
      }

      const compileSpan = recordedSpans.find((s) => s.name === 'ir.dag_compile');
      expect(compileSpan?.attributes['contentId']).toBeDefined();
      expect(compileSpan?.attributes['globalFps']).toBe(30);
    } finally {
      Tracer.clearListeners();
    }
  });
});
