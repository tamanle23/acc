import { describe, it, expect, afterAll } from "bun:test";
import path from "path";
import fs from "fs";
import { GRPCAIStrategy, IPCFacade } from "@acc/core";
import { getAdminServiceClient } from "@acc/proto";
import { parseWorkerArgs, bootstrapWorker } from "../apps/worker/src/index.js";
import { HardwareProfiler } from "../apps/ai-supervisor/src/bun/HardwareProfiler.js";
import { findAvailablePort } from "../apps/ai-supervisor/src/bun/PortScanner.js";

describe("Phase 8: Master Integration & End-to-End QA of Iteration 3", () => {
  const pythonBackendDir = path.resolve("./apps/ai-supervisor/python-backend");
  let testServerProc: any = null;
  const testPort = 53351;

  afterAll(async () => {
    if (testServerProc) {
      try {
        testServerProc.kill();
      } catch {}
    }
  });

  it("should verify dynamic port resolution and hardware profiling in Supervisor control plane", async () => {
    // 1. Dynamic port resolution test
    const freePort = await findAvailablePort(testPort);
    expect(freePort).toBeGreaterThanOrEqual(testPort);

    // 2. Hardware profiler
    const profile = await HardwareProfiler.getProfile();
    expect(profile).toBeDefined();
    expect(profile.cpuCores).toBeGreaterThan(0);
    expect(profile.totalSystemRamBytes).toBeGreaterThan(0);
    expect(["tier1", "tier2", "tier3", "tier4", "tier5"]).toContain(profile.detectedTier);
    expect(["tier1", "tier2", "tier3", "tier4", "tier5"]).toContain(profile.activeTier);
  });

  it("should verify worker package argument parsing and headless bootstrap", async () => {
    const opts = parseWorkerArgs(["--sandbox", "--interval", "1500", "--python-port", "50051", "--ollama-port", "11434"]);
    expect(opts.sandbox).toBe(true);
    expect(opts.pollIntervalMs).toBe(1500);
    expect(opts.pythonPort).toBe(50051);
    expect(opts.ollamaPort).toBe(11434);

    const { poller, hypervisor } = await bootstrapWorker(opts);
    expect(poller).toBeDefined();
    expect(poller.id).toBe("sandbox-poller");
    expect(hypervisor).toBeDefined();
    expect(hypervisor.getAdapters().length).toBe(2);

    await poller.stop();
  });

  it("should verify React Studio production build artifacts exist and are client-safe", () => {
    const studioDist = path.resolve("./apps/studio/dist/client");
    const indexHtml = path.join(studioDist, "index.html");
    expect(fs.existsSync(indexHtml)).toBe(true);

    const htmlContent = fs.readFileSync(indexHtml, "utf-8");
    expect(htmlContent).toContain("<div id=\"root\"></div>");
    expect(htmlContent).toContain("assets/index-");
  });

  it("should verify full end-to-end Python AI daemon lifecycle, health status, and VRAM purge", async () => {
    // Launch server with parent pid
    testServerProc = Bun.spawn(
      ["uv", "run", "python", "src/server.py", String(testPort), "--parent-pid", String(process.pid)],
      {
        cwd: pythonBackendDir,
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    // Wait for connection
    let ready = false;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const socket = await Bun.connect({
          hostname: "127.0.0.1",
          port: testPort,
          socket: {
            data() {},
            open(s) {
              s.end();
            },
          },
        });
        ready = true;
        break;
      } catch {}
    }
    expect(ready).toBe(true);

    // Call through IPCFacade with GRPCAIStrategy
    const strategy = new GRPCAIStrategy(`127.0.0.1:${testPort}`);
    const facade = new IPCFacade(strategy);

    // 1. Ping
    const pingRes = await facade.ping("e2e_integration_test");
    expect(pingRes).toContain("pong");

    // 2. Ping all services
    const allRes = await facade.pingAllServices("e2e");
    expect(allRes.tts).toContain("TTS pong");
    expect(allRes.vision).toContain("Vision pong");
    expect(allRes.llm).toContain("LLM pong");

    // 3. VRAM status & Purge
    const vramStatus = await facade.getVRAMStatus();
    expect(vramStatus).toBeDefined();
    expect(typeof vramStatus.cachedModelCount).toBe("number");

    const purgeResult = await facade.purgeVRAM(true);
    expect(purgeResult.success).toBe(true);
    expect(purgeResult.message).toContain("Purged");

    // Terminate test server
    testServerProc.kill();
    testServerProc = null;
  });
});
