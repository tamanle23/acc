import { describe, it, expect, beforeEach } from "bun:test";
import { TelemetryEventBroker } from "../apps/ai-supervisor/src/bun/telemetry/TelemetryEventBroker";
import { OSProcessSampler } from "../apps/ai-supervisor/src/bun/telemetry/OSProcessSampler";
import type { IProcessRunner, ProcessOutput, Result } from "../apps/ai-supervisor/src/bun/platform/IProcessRunner";

class MockProcessRunner implements IProcessRunner {
  public async exec(cmd: string[]): Promise<Result<ProcessOutput, Error>> {
    const cmdStr = cmd.join(" ");
    if (cmdStr.includes("Get-Process")) {
      return {
        ok: true,
        value: {
          exitCode: 0,
          stdout: JSON.stringify({
            Id: 9999,
            CPU: 12.4,
            WorkingSet64: 268435456, // 256 MB
          }),
          stderr: "",
        },
      };
    }
    if (cmdStr.includes("ps -o %cpu,rss")) {
      return {
        ok: true,
        value: {
          exitCode: 0,
          stdout: "%CPU   RSS\n 12.4 262144\n",
          stderr: "",
        },
      };
    }
    return {
      ok: true,
      value: {
        exitCode: 0,
        stdout: "",
        stderr: "",
      },
    };
  }

  public spawn(): any {
    throw new Error("Not used in unit test");
  }

  public async which(tool: string): Promise<string | null> {
    return `/usr/bin/${tool}`;
  }
}

describe("AI-Supervisor REST & SSE Telemetry Control Plane", () => {
  let broker: TelemetryEventBroker;

  beforeEach(() => {
    broker = new TelemetryEventBroker();
  });

  it("registers sidecar metrics and produces aggregated snapshots", () => {
    broker.updateSystemMetrics({
      hardwareTier: "standard",
      cpuCount: 8,
      totalMemoryMb: 32768,
      freeMemoryMb: 16384,
    });

    broker.updateServiceMetrics("python-backend", {
      pid: 12345,
      status: "RUNNING",
      cpuPercent: 4.5,
      memoryRssMb: 512,
      uptimeSeconds: 120,
    });

    broker.recordDomainTelemetry("python-backend", {
      type: "python-backend",
      vramUsedMb: 240,
      freeVramBytes: 12000000000,
      totalVramBytes: 16000000000,
      cachedModelCount: 1,
      activeModels: [{ name: "tts_engine", vramMb: 240, accessCount: 5 }],
    });

    const snapshot = broker.publishSnapshot();
    expect(snapshot.system.hardwareTier).toBe("standard");
    expect(snapshot.services["python-backend"]).toBeDefined();
    expect(snapshot.services["python-backend"].status).toBe("RUNNING");
    expect(snapshot.services["python-backend"].domain).toBeDefined();
    expect((snapshot.services["python-backend"].domain as any).vramUsedMb).toBe(240);
  });

  it("creates a compliant WHATWG ReadableStream delivering text/event-stream chunks", async () => {
    broker.updateServiceMetrics("studio", {
      pid: 23456,
      status: "RUNNING",
      cpuPercent: 1.2,
      memoryRssMb: 256,
    });

    const ac = new AbortController();
    const stream = broker.createEventStream(ac.signal);
    const reader = stream.getReader();

    const decoder = new TextDecoder();
    const firstChunk = await reader.read();
    expect(firstChunk.done).toBe(false);

    const text = decoder.decode(firstChunk.value);
    expect(text).toContain("event: telemetry");
    expect(text).toContain("studio");

    ac.abort();
  });

  it("samples child processes using OSProcessSampler without throwing", async () => {
    const mockRunner = new MockProcessRunner();
    const sampler = new OSProcessSampler(mockRunner);

    const stats = await sampler.samplePid(9999);
    expect(stats).not.toBeNull();
    expect(stats?.cpuPercent).toBe(12.4);
    expect(stats?.memoryRssMb).toBe(256); // 262144 KB / 1024 = 256 MB
  });

  it("records domain worker heartbeats accurately", () => {
    broker.recordWorkerHeartbeat({
      activeJobId: "job-001",
      currentFrame: 45,
      totalFrames: 300,
      renderFps: 59.8,
      vramUsedMb: 120,
      cpuPercent: 88.5,
      memoryRssMb: 1024,
    });

    const snapshot = broker.getSnapshot();
    const worker = snapshot.services["worker"];
    expect(worker).toBeDefined();
    expect(worker.cpuPercent).toBe(88.5);
    expect(worker.memoryRssMb).toBe(1024);
    expect(worker.domain).toBeDefined();
    expect((worker.domain as any).activeJobId).toBe("job-001");
    expect((worker.domain as any).renderFps).toBe(59.8);
  });
});
