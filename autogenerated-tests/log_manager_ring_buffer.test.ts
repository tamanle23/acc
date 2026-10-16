import { describe, expect, it, afterAll } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CircularLogBuffer, LogManager } from "../apps/ai-supervisor/src/bun/LogManager.js";

describe("LogManager & CircularLogBuffer", () => {
  const testDir = path.join(os.tmpdir(), "acc-test-logs-" + Date.now());

  afterAll(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it("maintains max line capacity in CircularLogBuffer", () => {
    const buf = new CircularLogBuffer(5);
    for (let i = 1; i <= 8; i++) {
      buf.push(`line ${i}`);
    }

    expect(buf.size()).toBe(5);
    const lines = buf.getLines();
    expect(lines).toEqual(["line 4", "line 5", "line 6", "line 7", "line 8"]);
  });

  it("filters lines case-insensitively in CircularLogBuffer", () => {
    const buf = new CircularLogBuffer(10);
    buf.push("ERROR: CUDA allocation failed");
    buf.push("INFO: Model initialized");
    buf.push("warn: slow disk response");

    const errors = buf.getLines("error");
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("CUDA allocation failed");
  });

  it("appends to file and rotates when maxFileSizeBytes is reached", () => {
    // 200 bytes max file size for testing rotation
    const mgr = new LogManager({ baseDir: testDir, maxFileSizeBytes: 200, maxBackups: 2 });
    const service = "test-service";

    // Write chunk 1
    mgr.log(service, "Short line 1 to start log file");
    const filePath = mgr.getLogFilePath(service);
    expect(fs.existsSync(filePath)).toBe(true);

    // Write enough to trigger rotation
    for (let i = 0; i < 15; i++) {
      mgr.log(service, `Triggering rotation line ${i} with long text padding...`);
    }

    // Check that backup file .1 was created
    expect(fs.existsSync(`${filePath}.1`)).toBe(true);
  });
});
