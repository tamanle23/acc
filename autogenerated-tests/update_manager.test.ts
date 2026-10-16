import { describe, expect, it, afterAll } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { UpdateManager } from "../apps/ai-supervisor/src/bun/UpdateManager.js";

describe("UpdateManager & Crash Watchdog", () => {
  const testDir = path.join(os.tmpdir(), "acc-test-update-" + Date.now());

  afterAll(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it("compares semantic versions accurately", () => {
    const mgr = new UpdateManager({ baseDir: testDir, currentVersion: "1.0.0" });
    expect(mgr.isNewerVersion("1.0.1", "1.0.0")).toBe(true);
    expect(mgr.isNewerVersion("1.1.0", "1.0.9")).toBe(true);
    expect(mgr.isNewerVersion("2.0.0", "1.9.9")).toBe(true);
    expect(mgr.isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    expect(mgr.isNewerVersion("0.9.5", "1.0.0")).toBe(false);
  });

  it("computes and validates SHA-256 hash of a staged file", async () => {
    const mgr = new UpdateManager({ baseDir: testDir });
    const dummyPath = path.join(testDir, "dummy-binary.bin");
    const content = Buffer.from("ACC_BINARY_DATA_PAYLOAD_V1");
    fs.writeFileSync(dummyPath, content);

    const expectedHash = crypto.createHash("sha256").update(content).digest("hex");
    const valid = await mgr.verifySha256(dummyPath, expectedHash);
    expect(valid).toBe(true);

    const invalid = await mgr.verifySha256(dummyPath, "badhash123");
    expect(invalid).toBe(false);
  });

  it("manages executable backup and rollback recovery", () => {
    const mgr = new UpdateManager({ baseDir: testDir });
    const originalExe = path.join(testDir, "app.exe");
    fs.writeFileSync(originalExe, "VERSION_1_ORIGINAL");

    // 1. Backup current
    const backedUp = mgr.backupCurrentExecutable(originalExe);
    expect(backedUp).toBe(true);

    // 2. Corrupt/update the current file
    fs.writeFileSync(originalExe, "VERSION_2_CORRUPTED");
    expect(fs.readFileSync(originalExe, "utf-8")).toBe("VERSION_2_CORRUPTED");

    // 3. Rollback
    const rolledBack = mgr.rollbackFromBackup(originalExe);
    expect(rolledBack).toBe(true);
    expect(fs.readFileSync(originalExe, "utf-8")).toBe("VERSION_1_ORIGINAL");
  });

  it("tracks boot crash watchdog count and signals auto-rollback after 2 failures", () => {
    const mgr = new UpdateManager({ baseDir: testDir });
    expect(mgr.shouldRollback()).toBe(false);

    // Crash 1
    mgr.recordBootStart();
    expect(mgr.getCrashCount()).toBe(1);
    expect(mgr.shouldRollback()).toBe(false);

    // Crash 2
    mgr.recordBootStart();
    expect(mgr.getCrashCount()).toBe(2);
    expect(mgr.shouldRollback()).toBe(true);

    // Successful boot clears watchdog
    mgr.markBootSuccessful();
    expect(mgr.getCrashCount()).toBe(0);
    expect(mgr.shouldRollback()).toBe(false);
  });

  it("simulates updates for development mode UI testing", () => {
    const mgr = new UpdateManager({ baseDir: testDir, currentVersion: "1.0.0" });
    mgr.simulateUpdate("1.2.0");

    const status = mgr.getStatus();
    expect(status.isAvailable).toBe(true);
    expect(status.targetVersion).toBe("1.2.0");
    expect(status.isReadyToApply).toBe(true);
  });
});
