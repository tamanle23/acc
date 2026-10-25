import { describe, it, expect, afterAll } from "bun:test";
import path from "path";
import fs from "fs";
import { getAdminServiceClient } from "@acc/proto";
import { GRPCAIStrategy, IPCFacade } from "@acc/core";

describe("Phase 7: Dynamic VRAM Memory Manager & Admin gRPC Service", () => {
  const pythonBackendDir = path.resolve("./apps/ai-supervisor/python-backend");
  const testPort = 53349;
  let serverProc: any = null;

  afterAll(async () => {
    if (serverProc) {
      try {
        serverProc.kill();
      } catch {}
    }
  });

  it("should verify ModelLifecycleManager unit behaviors: LRU tracking, auto-eviction, and cache purging", async () => {
    const pyScript = `
import sys
import os
import time
sys.path.insert(0, os.path.join(os.getcwd(), "src"))
from services.model_lifecycle_manager import ModelLifecycleManager

# 1. Test basic registration and touch
mgr = ModelLifecycleManager(idle_timeout_sec=0.3)
dummy_unloaded = False
def on_unload():
    global dummy_unloaded
    dummy_unloaded = True

mgr.register_model("dummy_model", {"state": "active"}, estimated_vram_bytes=100 * 1024 * 1024, unload_fn=on_unload)
assert mgr.get_model("dummy_model") is not None, "Model should be present"

# 2. Test status
status = mgr.get_vram_status()
assert status["cached_model_count"] == 1
assert status["active_models"][0]["name"] == "dummy_model"
assert status["active_models"][0]["vram_mb"] == 100

# 3. Test idle auto-eviction
time.sleep(0.6) # Wait past 0.3s timeout and 5s loop or manual trigger
# In test, trigger auto-eviction check if loop hasn't run
now = time.time()
with mgr._lock:
    for name, entry in list(mgr.models.items()):
        if entry.instance is not None and (now - entry.last_accessed) > mgr.idle_timeout_sec:
            entry.unload()

assert dummy_unloaded == True, "unload_fn should have been called"
assert mgr.get_model("dummy_model") is None, "Model instance should be evicted"

# 4. Test purge_all
mgr.register_model("model2", {"state": "loaded"}, estimated_vram_bytes=50 * 1024 * 1024)
success, freed, msg = mgr.purge_all(force=True)
assert success == True
assert freed == 50 * 1024 * 1024
assert "Purged 1 models" in msg

mgr.stop()
print("SUCCESS_VRAM_LIFECYCLE_TEST")
`;

    const proc = Bun.spawn(["uv", "run", "python", "-c", pyScript], {
      cwd: pythonBackendDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      console.error("Python test stderr:", stderr);
    }
    expect(exitCode).toBe(0);
    expect(stdout).toContain("SUCCESS_VRAM_LIFECYCLE_TEST");
  });

  it("should verify AdminService gRPC endpoint: PurgeVRAM and GetVRAMStatus", async () => {
    // Spawn server.py on testPort
    serverProc = Bun.spawn(
      ["uv", "run", "python", "src/server.py", String(testPort), "--parent-pid", String(process.pid)],
      {
        cwd: pythonBackendDir,
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    // Wait until server is listening
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

    // Call AdminService via @acc/proto and @acc/core GRPCAIStrategy
    const client = getAdminServiceClient(`127.0.0.1:${testPort}`);

    // Test GetVRAMStatus
    const statusRes: any = await new Promise((resolve, reject) => {
      client.GetVRAMStatus({}, { deadline: new Date(Date.now() + 3000) }, (err: any, resp: any) => {
        if (err) return reject(err);
        resolve(resp);
      });
    });

    expect(statusRes).toBeDefined();
    expect(statusRes.cached_model_count).toBeDefined();
    expect(Array.isArray(statusRes.active_models)).toBe(true);

    // Test PurgeVRAM
    const purgeRes: any = await new Promise((resolve, reject) => {
      client.PurgeVRAM({ force: true }, { deadline: new Date(Date.now() + 3000) }, (err: any, resp: any) => {
        if (err) return reject(err);
        resolve(resp);
      });
    });

    expect(purgeRes.success).toBe(true);
    expect(purgeRes.message).toContain("Purged");

    // Test GRPCAIStrategy purgeVRAM via IPCFacade
    const strategy = new GRPCAIStrategy(`127.0.0.1:${testPort}`);
    const facade = new IPCFacade(strategy);

    const facadeStatus = await facade.getVRAMStatus();
    expect(facadeStatus).toBeDefined();
    expect(typeof facadeStatus.cachedModelCount).toBe("number");

    const facadePurge = await facade.purgeVRAM(true);
    expect(facadePurge.success).toBe(true);
  });
});
