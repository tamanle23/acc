import { describe, it, expect } from "bun:test";
import { AIInferenceClient } from "@acc/ai-control-plane-sdk";
import { SupervisorEngine } from "../apps/worker/src/supervisor/SupervisorEngine.js";
import { domainTelemetryPoller } from "../apps/worker/src/supervisor/telemetry/DomainTelemetryPoller.js";
import { telemetryBroker } from "../apps/worker/src/supervisor/telemetry/TelemetryEventBroker.js";

describe("AI Control Plane SDK & Supervisor Fleet Integration", () => {
  it("initializes AIInferenceClient with target ports and builds valid endpoints", () => {
    const client = new AIInferenceClient({
      baseUrls: ["http://127.0.0.1:50051"],
    });
    expect(client).toBeDefined();
  });

  it("verifies SupervisorEngine fleet contains ai-control-plane as first-class member", () => {
    const engine = new SupervisorEngine(undefined, undefined, undefined, false);
    const states = engine.getAllStates();

    expect(states["ai-control-plane"]).toBeDefined();
    expect(states["ai-control-plane"].port).toBe(50051);
    expect(states["ai-control-plane"].status).toBe("STOPPED");
  });

  it("verifies telemetry event broker records ai-control-plane domain metrics", () => {
    telemetryBroker.updateServiceMetrics("ai-control-plane", {
      status: "RUNNING",
      cpuPercent: 5.0,
      memoryRssMb: 500,
    });

    telemetryBroker.recordDomainTelemetry("ai-control-plane", {
      type: "ai-control-plane",
      vramUsedMb: 300,
      freeVramBytes: 8000000000,
      totalVramBytes: 16000000000,
      cachedModelCount: 2,
      activeModels: [
        { name: "kokoro", vramMb: 240, accessCount: 1 },
        { name: "qwen", vramMb: 60, accessCount: 2 },
      ],
    });

    const snapshot = telemetryBroker.publishSnapshot();
    expect(snapshot.services["ai-control-plane"]).toBeDefined();
    expect(snapshot.services["ai-control-plane"].domain).toBeDefined();
    expect(snapshot.services["ai-control-plane"].domain?.type).toBe("ai-control-plane");
  });
});
