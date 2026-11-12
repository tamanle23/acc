import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { HttpServer } from "../apps/worker/src/supervisor/server/HttpServer.js";
import type { HardwareProfile } from "../apps/worker/src/supervisor/HardwareProfiler.js";

describe("HttpServer Modular Endpoints & Routing", () => {
  const testPort = 33341;
  let server: HttpServer;

  const mockProfile: HardwareProfile = {
    detectedTier: "tier4",
    activeTier: "tier4",
    gpu: {
      name: "NVIDIA GeForce RTX 4090",
      totalVramBytes: 24 * 1024 * 1024 * 1024,
      freeVramBytes: 20 * 1024 * 1024 * 1024,
      isAppleSilicon: false,
      isIntegrated: false,
    },
    totalSystemRamBytes: 64 * 1024 * 1024 * 1024,
    freeSystemRamBytes: 32 * 1024 * 1024 * 1024,
    cpuCores: 16,
    safeHeadroomBytes: 2 * 1024 * 1024 * 1024,
    recommendedPythonDevice: "cuda",
  };

  beforeAll(() => {
    server = new HttpServer({
      port: testPort,
      getProfile: () => mockProfile,
    });
    server.start();
  });

  afterAll(() => {
    server.stop();
  });

  it("handles OPTIONS preflight with permissive CORS headers", async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/status`, {
      method: "OPTIONS",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("serves /api/status with system profile and fleet state", async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/status`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile.activeTier).toBe("tier4");
    expect(data.services["ai-control-plane"]).toBeDefined();
    expect(data.services["worker"]).toBeDefined();
    expect(data.services["studio"]).toBeDefined();
    expect(data.trayColor).toBeDefined();
  });

  it("serves /api/telemetry/snapshot with aggregated metrics", async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/telemetry/snapshot`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.system).toBeDefined();
    expect(data.services).toBeDefined();
  });

  it("accepts /api/worker/heartbeat POST payloads", async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/worker/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerId: "test-render-worker-1",
        activeJobId: "job-abc-123",
        jobProgressPercent: 42.5,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("serves HTML dashboard at root /", async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('<div id="root"');
  });

  it("returns 404 for unknown endpoints", async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/non-existent-route`);
    expect(res.status).toBe(404);
  });
});
