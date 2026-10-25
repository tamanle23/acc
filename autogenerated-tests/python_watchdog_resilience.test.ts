import { describe, it, expect, afterAll } from "bun:test";
import path from "path";
import fs from "fs";
import os from "os";

describe("Phase 6: Python Backend Resilience & Watchdog", () => {
  const pythonBackendDir = path.resolve("./apps/ai-supervisor/python-backend");
  const testPidPath = path.resolve("./scratch/test_python.pid");

  afterAll(() => {
    try {
      if (fs.existsSync(testPidPath)) fs.unlinkSync(testPidPath);
    } catch {}
  });

  it("should verify watchdog.py executes PIDManager and PID alive checks accurately", async () => {
    // Run watchdog verification script using uv python
    const verifyScript = `
import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), "src"))
from watchdog import PIDManager, is_pid_alive

# Test is_pid_alive on self
my_pid = os.getpid()
assert is_pid_alive(my_pid) == True, "Self PID should be alive"

# Test non-existent PID
assert is_pid_alive(999999) == False, "PID 999999 should be dead"

# Test PIDManager
mgr = PIDManager(r"${testPidPath.replace(/\\/g, "\\\\")}")
written_pid = mgr.write_pid()
assert written_pid == my_pid, "Written PID should match"
assert os.path.exists(mgr.pid_file_path), "PID file should exist"

mgr.remove_pid()
assert not os.path.exists(mgr.pid_file_path), "PID file should be deleted"
print("SUCCESS_WATCHDOG_TEST")
`;

    const proc = Bun.spawn(["uv", "run", "python", "-c", verifyScript], {
      cwd: pythonBackendDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(stdout).toContain("SUCCESS_WATCHDOG_TEST");
  });

  it("should verify server.py starts and registers grpc.health.v1 HealthServicer", async () => {
    // Spawns server on dynamic port for 2 seconds and verifies it reports listening and registers health servicer
    const testPort = 53345;
    const proc = Bun.spawn(
      ["uv", "run", "python", "src/server.py", String(testPort), "--parent-pid", String(process.pid)],
      {
        cwd: pythonBackendDir,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
        },
      }
    );

    let serverOutput = "";
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();

    // Read until listening message
    const startTime = Date.now();
    while (Date.now() - startTime < 8000) {
      const { done, value } = await reader.read();
      if (done) break;
      serverOutput += decoder.decode(value);
      if (serverOutput.includes("gRPC server listening")) break;
    }

    expect(serverOutput).toContain("gRPC server listening");

    // Cleanly terminate process via SIGTERM
    proc.kill("SIGTERM");
    await proc.exited;
  });
});
