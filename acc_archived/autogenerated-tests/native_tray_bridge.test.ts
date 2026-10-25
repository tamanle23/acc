import { describe, expect, it } from "bun:test";
import path from "node:path";
import { NativeTrayBridge } from "../apps/ai-supervisor/src/bun/NativeTrayBridge.js";

describe("NativeTrayBridge Windows System Tray", () => {
  const assetsDir = path.join(import.meta.dir, "..", "apps", "ai-supervisor", "src", "assets");

  it("instantiates NativeTrayBridge with options", () => {
    const bridge = new NativeTrayBridge({
      iconDir: assetsDir,
      initialColor: "yellow",
    });

    expect(bridge).toBeDefined();
  });

  it("allows setting icons and tooltips safely without crashing", () => {
    const bridge = new NativeTrayBridge({
      iconDir: assetsDir,
    });

    // Should not throw even when not started
    expect(() => bridge.setIcon("green")).not.toThrow();
    expect(() => bridge.setTooltip("ACC Control Plane - Testing")).not.toThrow();
    expect(() => bridge.stop()).not.toThrow();
  });

  it("handles start and stop lifecycle cleanly on Windows", async () => {
    let dashboardOpened = false;

    const bridge = new NativeTrayBridge({
      iconDir: assetsDir,
      initialColor: "green",
      onOpenDashboard: () => {
        dashboardOpened = true;
      },
    });

    const started = await bridge.start();
    if (process.platform === "win32") {
      expect(started).toBe(true);
      // Give it 300ms, then test icon update and stop
      bridge.setIcon("yellow");
      bridge.setTooltip("ACC Testing Status");
      bridge.stop();
    } else {
      expect(started).toBe(false);
    }
  });
});
