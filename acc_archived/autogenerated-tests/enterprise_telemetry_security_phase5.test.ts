import { describe, it, expect } from 'bun:test';
import {
  TraceContext,
  MetricsRegistry,
  DynamicSecretsManager,
  Logger,
} from '../packages/core/src';
import { ScraperEngine } from '../apps/cli/src/pipelines/01-scraper/ScraperEngine';

describe('Zero-Trust Security, Dynamic Secrets & Observability (Phase 5)', () => {
  it('TraceContext conforms to W3C RFC traceparent specification and generates child spans', () => {
    // 1. Root span generation
    const rootContext = new TraceContext();
    expect(rootContext.traceId.length).toBe(32);
    expect(rootContext.spanId.length).toBe(16);
    expect(rootContext.traceFlags).toBe('01');

    const traceparentHeader = rootContext.toTraceparent();
    expect(traceparentHeader.startsWith('00-')).toBe(true);
    expect(traceparentHeader.split('-').length).toBe(4);

    // 2. Propagation parsing
    const parsedContext = TraceContext.fromTraceparent(traceparentHeader);
    expect(parsedContext.traceId).toBe(rootContext.traceId);
    expect(parsedContext.parentSpanId).toBe(rootContext.spanId);

    // 3. Child span derivation
    const childSpan = rootContext.createChildSpan();
    expect(childSpan.traceId).toBe(rootContext.traceId);
    expect(childSpan.parentSpanId).toBe(rootContext.spanId);
    expect(childSpan.spanId).not.toBe(rootContext.spanId);
  });

  it('MetricsRegistry records real-time gauges, counters, histograms and exports standard Prometheus text', () => {
    const registry = MetricsRegistry.getInstance();

    registry.setGauge('acc_render_frames_per_second', 'Throughput in FPS', 64.5);
    expect(registry.getGauge('acc_render_frames_per_second')).toBe(64.5);

    registry.incrementCounter('acc_render_tasks_total', 'Total render jobs', 3);
    registry.observeHistogram('acc_render_frame_latency_ms', 15.2);
    registry.observeHistogram('acc_render_frame_latency_ms', 8.4);

    const prometheusExport = registry.toPrometheusText();
    expect(prometheusExport).toContain('# HELP acc_render_frames_per_second');
    expect(prometheusExport).toContain('# TYPE acc_render_frames_per_second gauge');
    expect(prometheusExport).toContain('acc_render_frames_per_second 64.5');
    expect(prometheusExport).toContain('acc_memory_rss_bytes');
    expect(prometheusExport).toContain('acc_render_frame_latency_ms_bucket');
    expect(prometheusExport).toContain('acc_render_frame_latency_ms_count 2');
  });

  it('DynamicSecretsManager masks authorization tokens, API keys, and registered secrets from logs', () => {
    const secretsManager = DynamicSecretsManager.getInstance();

    // Register a custom sensitive token
    const testSecret = 'sk-prod-super-secret-key-998877665544332211';
    secretsManager.registerSecret(testSecret);

    const rawLog = `Calling AWS with ${testSecret} and Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tokenpayload`;
    const sanitized = secretsManager.sanitize(rawLog);

    expect(sanitized).not.toContain(testSecret);
    expect(sanitized).toContain('***REDACTED***');
    expect(sanitized).toContain('Bearer ***REDACTED***');
    expect(sanitized).not.toContain('tokenpayload');
  });

  it('ScraperEngine HTTP server serves /healthz/liveness, /healthz/readiness, and /metrics endpoints', async () => {
    const engine = new ScraperEngine();
    const testPort = 19882;
    const server = engine.startWebhookServer(testPort);

    try {
      // 1. Test /healthz/liveness
      const liveRes = await fetch(`http://127.0.0.1:${testPort}/healthz/liveness`);
      expect(liveRes.status).toBe(200);
      const liveJson: any = await liveRes.json();
      expect(liveJson.status).toBe('UP');

      // 2. Test /healthz/readiness
      const readyRes = await fetch(`http://127.0.0.1:${testPort}/healthz/readiness`);
      expect(readyRes.status).toBe(200);
      const readyJson: any = await readyRes.json();
      expect(readyJson.status).toBe('READY');
      expect(readyJson.snapshot.freeRamGB).toBeGreaterThan(0);

      // 3. Test /metrics
      const metricsRes = await fetch(`http://127.0.0.1:${testPort}/metrics`);
      expect(metricsRes.status).toBe(200);
      expect(metricsRes.headers.get('Content-Type')).toContain('text/plain');
      const metricsText = await metricsRes.text();
      expect(metricsText).toContain('acc_memory_rss_bytes');
      expect(metricsText).toContain('acc_render_frames_per_second');
    } finally {
      engine.stopWebhookServer();
    }
  });
});
