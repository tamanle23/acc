import { describe, expect, it, afterAll } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConfigStore, DEFAULT_CONFIG } from "../apps/ai-supervisor/src/bun/configStore.js";

describe("Global Storage ConfigStore", () => {
  const testDir = path.join(os.tmpdir(), "acc-test-config-" + Date.now());
  const testConfigPath = path.join(testDir, "test-control-plane.json");

  afterAll(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch { }
  });

  it("initializes with default configuration if file does not exist", () => {
    const store = new ConfigStore(testConfigPath);
    const cfg = store.loadConfig();

    expect(cfg.pythonPort).toBe(DEFAULT_CONFIG.pythonPort);
    expect(cfg.studioPort).toBe(DEFAULT_CONFIG.studioPort);
    expect(cfg.ollamaPort).toBe(DEFAULT_CONFIG.ollamaPort);
    expect(cfg.hardwareTierOverride).toBe("auto");
    expect(fs.existsSync(testConfigPath)).toBe(true);
  });

  it("updates and persists partial configuration changes", () => {
    const store = new ConfigStore(testConfigPath);
    store.saveConfig({
      pythonPort: 50099,
      hardwareTierOverride: "tier1",
      autostart: true,
    });

    // Re-instantiate store to ensure persistence
    const reloadedStore = new ConfigStore(testConfigPath);
    const reloaded = reloadedStore.loadConfig();

    expect(reloaded.pythonPort).toBe(50099);
    expect(reloaded.hardwareTierOverride).toBe("tier1");
    expect(reloaded.autostart).toBe(true);
    expect(reloaded.studioPort).toBe(DEFAULT_CONFIG.studioPort);
  });
});
