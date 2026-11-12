import { describe, it, expect, beforeEach } from "bun:test";
import { TelemetryEventBroker } from "../apps/worker/src/supervisor/telemetry/TelemetryEventBroker.js";
import { WorkerTelemetryServer } from "../apps/worker/src/telemetry/WorkerTelemetryServer.js";

describe("Iteration 37 - Inverted Telemetry Ingestion & Forensics", () => {
  let broker: TelemetryEventBroker;

  beforeEach(() => {
    broker = new TelemetryEventBroker();
  });

  it("ingests sidecar domain telemetry directly into broker state", () => {
    broker.recordDomainTelemetry("ai-control-plane", {
      type: "ai-control-plane" as any,
      vramUsedMb: 512,
      freeVramBytes: 10 * 1024 * 1024 * 1024,
      totalVramBytes: 16 * 1024 * 1024 * 1024,
      cachedModelCount: 2,
      activeModels: [
        { name: "kokoro_tts", vramMb: 256, accessCount: 5 },
        { name: "vieneu_turbo", vramMb: 256, accessCount: 12 },
      ],
    } as any);

    broker.updateServiceMetrics("ai-control-plane", {
      status: "RUNNING",
      cpuPercent: 12,
      memoryRssMb: 850,
    });

    const snapshot = broker.getSnapshot();
    const py = snapshot.services["ai-control-plane"];

    expect(py).toBeDefined();
    expect(py.status).toBe("RUNNING");
    expect(py.domain).toBeDefined();
    expect(py.domain?.type).toBe("ai-control-plane");
    if (py.domain?.type === "ai-control-plane") {
      expect((py.domain as any).vramUsedMb).toBe(512);
      expect((py.domain as any).cachedModelCount).toBe(2);
    }
  });

  it("records audit events to sliding ring-buffer and notifies subscribers", (done) => {
    broker.once("audit", (entry) => {
      expect(entry.eventType).toBe("OOM_INTERCEPTED");
      expect(entry.service).toBe("ai-control-plane");
      expect(entry.message).toContain("OOM Circuit Breaker");
      expect(broker.getAuditEvents().length).toBeGreaterThan(0);
      done();
    });

    broker.recordAuditEvent({
      timestamp: Date.now(),
      service: "ai-control-plane",
      eventType: "OOM_INTERCEPTED",
      message: "OOM Circuit Breaker triggered for model 'kokoro_tts' on MPS",
      details: { vramAllocatedMb: 512 },
    });
  });

  it("worker telemetry server streams standard SSE chunks over HTTP", async () => {
    const port = 4998;
    const server = new WorkerTelemetryServer(port);
    server.start();

    try {
      server.updateJobProgress({
        status: "rendering",
        renderFps: 60,
        currentFrame: 150,
        totalFrames: 300,
        activeJobId: "job_test_001",
      });

      const res = await fetch(`http://127.0.0.1:${port}/api/worker/telemetry/stream`);
      expect(res.ok).toBe(true);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const reader = res.body?.getReader();
      expect(reader).toBeDefined();

      if (reader) {
        const { value } = await reader.read();
        const text = new TextDecoder().decode(value);
        expect(text).toContain("event: telemetry");
        expect(text).toContain('"service":"worker"');
        expect(text).toContain('"status":"rendering"');
        reader.cancel();
      }
    } finally {
      server.stop();
    }
  });
});
