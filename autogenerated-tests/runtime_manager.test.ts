import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { RuntimeManager } from "../apps/ai-supervisor/src/bun/RuntimeManager.js";
import { SupervisorEngine } from "../apps/ai-supervisor/src/bun/SupervisorEngine.js";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

describe("RuntimeManager", () => {
  const testStorageDir = path.join(os.tmpdir(), `acc-runtime-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(testStorageDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    } catch {}
  });

  it("should configure correct paths conforming to GLOBAL-STORAGE", () => {
    const rm = new RuntimeManager({ storageDir: testStorageDir });
    expect(rm.getStorageDir()).toBe(testStorageDir);
    expect(rm.getBinDir()).toBe(path.join(testStorageDir, "bin"));
    expect(rm.getPythonInstallDir()).toBe(path.join(testStorageDir, "python-env"));
    const exeName = process.platform === "win32" ? "uv.exe" : "uv";
    expect(rm.getUvBinaryPath()).toBe(path.join(testStorageDir, "bin", exeName));
  });

  it("should provide execution environment with isolated Python 3.12 variables", () => {
    const rm = new RuntimeManager({ storageDir: testStorageDir });
    const env = rm.getExecutionEnv();

    expect(env.UV_PYTHON_INSTALL_DIR).toBe(path.join(testStorageDir, "python-env"));
    expect(env.UV_PYTHON).toBe("3.12");
    expect(env.PYTHONUNBUFFERED).toBe("1");
    expect(env.PATH?.startsWith(path.join(testStorageDir, "bin"))).toBe(true);
  });

  it("should correctly detect isolated uv binary", () => {
    const rm = new RuntimeManager({ storageDir: testStorageDir });
    expect(rm.isUvIsolated()).toBe(false);

    fs.mkdirSync(rm.getBinDir(), { recursive: true });
    fs.writeFileSync(rm.getUvBinaryPath(), "fake binary content");

    expect(rm.isUvIsolated()).toBe(true);
    expect(rm.getUvPath()).toBe(rm.getUvBinaryPath());
  });

  it("should accurately detect installed Python versions", () => {
    const rm = new RuntimeManager({ storageDir: testStorageDir });
    expect(rm.isPythonInstalled("3.12")).toBe(false);

    const pythonEnvDir = rm.getPythonInstallDir();
    fs.mkdirSync(path.join(pythonEnvDir, "cpython-3.12.13-mock"), { recursive: true });

    expect(rm.isPythonInstalled("3.12")).toBe(true);
    expect(rm.isPythonInstalled("3.11")).toBe(false);
  });

  it("should transition state through PROVISIONING when runtime is not ready", async () => {
    const customRm = new RuntimeManager({ storageDir: testStorageDir });
    // customRm starts with empty storageDir, so isReady() is false
    let ensureRuntimeCalled = false;
    customRm.ensureRuntime = async (onProgress) => {
      ensureRuntimeCalled = true;
      onProgress?.("Provisioning mock environment...");
      return true;
    };

    const engine = new SupervisorEngine(undefined, customRm);
    const recordedStatuses: string[] = [];

    engine.onStatusChange((states, trayColor) => {
      const pyState = states["python-backend"];
      if (pyState) {
        recordedStatuses.push(pyState.status);
      }
    });

    await engine.startPythonBackend({
      conductorUrl: "http://127.0.0.1:3300",
      pythonPort: 50051,
      studioPort: 3300,
      ollamaPort: 11434,
      hardwareTierOverride: "auto",
      trayEnabled: false,
    });

    expect(ensureRuntimeCalled).toBe(true);
    expect(recordedStatuses).toContain("PROVISIONING");
  });

  it("should reflect PROVISIONING status as yellow tray icon", () => {
    const customRm = new RuntimeManager({ storageDir: testStorageDir });
    const engine = new SupervisorEngine(undefined, customRm);

    // Initial state is yellow
    expect(engine.getTrayColor()).toBe("yellow");
  });
});
