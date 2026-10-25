import { describe, it, expect } from "bun:test";
import path from "node:path";
import fs from "node:fs";
import { NativeTrayBridge } from "../apps/ai-supervisor/src/bun/NativeTrayBridge.js";
import { getStartupStatus, setStartupEnabled } from "../apps/ai-supervisor/src/bun/StartupManager.js";
import { WindowHost } from "../apps/ai-supervisor/src/bun/WindowHost.js";

describe("NativeTrayBridge Cross-Platform Support", () => {
  it("instantiates NativeTrayBridge with cross-platform runners", () => {
    const assetsDir = path.resolve("apps/ai-supervisor/src/assets");
    expect(fs.existsSync(assetsDir)).toBe(true);
    expect(fs.existsSync(path.join(assetsDir, "tray_runner.ps1"))).toBe(true);
    expect(fs.existsSync(path.join(assetsDir, "tray_runner_mac.swift"))).toBe(true);
    expect(fs.existsSync(path.join(assetsDir, "tray_runner_linux.py"))).toBe(true);

    const bridge = new NativeTrayBridge({
      iconDir: assetsDir,
      initialColor: "green",
    });

    expect(bridge).toBeDefined();
    expect(typeof bridge.start).toBe("function");
    expect(typeof bridge.setIcon).toBe("function");
    expect(typeof bridge.setTooltip).toBe("function");
    expect(typeof bridge.stop).toBe("function");
  });

  it("handles setIcon and setTooltip safely when subprocess is not yet active", () => {
    const assetsDir = path.resolve("apps/ai-supervisor/src/assets");
    const bridge = new NativeTrayBridge({
      iconDir: assetsDir,
    });

    expect(() => bridge.setIcon("red")).not.toThrow();
    expect(() => bridge.setTooltip("Healthy")).not.toThrow();
    expect(() => bridge.stop()).not.toThrow();
  });

  it("provides cross-platform StartupManager methods", async () => {
    expect(typeof getStartupStatus).toBe("function");
    expect(typeof setStartupEnabled).toBe("function");

    const status = await getStartupStatus();
    expect(typeof status).toBe("boolean");
  });

  it("instantiates WindowHost and provides desktop window methods", () => {
    const host = new WindowHost({ url: "http://127.0.0.1:9099" });
    expect(host).toBeDefined();
    expect(typeof host.open).toBe("function");
    expect(typeof host.openDefaultBrowser).toBe("function");
    expect(typeof host.close).toBe("function");
    expect(() => host.close()).not.toThrow();
  });
});
