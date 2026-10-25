import { describe, it, expect } from "bun:test";
import {
  type IProcessRunner,
  type ProcessOutput,
  type Result,
  type ProcessError,
  type ManagedProcess,
  BunProcessRunner,
} from "../apps/ai-supervisor/src/bun/platform/IProcessRunner.js";
import { WindowHost, type IWindowStrategy, type WindowHandle } from "../apps/ai-supervisor/src/bun/WindowHost.js";
import { NativeTrayBridge, type ITrayStrategy } from "../apps/ai-supervisor/src/bun/NativeTrayBridge.js";
import { HardwareProfiler } from "../apps/ai-supervisor/src/bun/HardwareProfiler.js";

class MockProcessRunner implements IProcessRunner {
  public executedCommands: string[][] = [];
  public spawnedCommands: string[][] = [];

  async execute(cmd: readonly string[]): Promise<Result<ProcessOutput, ProcessError>> {
    this.executedCommands.push([...cmd]);
    if (cmd[0] === "sysctl") {
      return { ok: true, value: { exitCode: 0, stdout: "34359738368\n", stderr: "" } };
    }
    if (cmd[0] === "nvidia-smi") {
      return { ok: true, value: { exitCode: 0, stdout: "16384, 12000, NVIDIA RTX 4090\n", stderr: "" } };
    }
    return { ok: true, value: { exitCode: 0, stdout: "/usr/bin/mock", stderr: "" } };
  }

  spawnManaged(cmd: readonly string[]): ManagedProcess {
    this.spawnedCommands.push([...cmd]);
    return {
      pid: 99999,
      killed: false,
      kill: async () => true,
      writeStdin: async () => {},
      wait: async () => 0,
    };
  }

  async which(tool: string): Promise<string | null> {
    return `/usr/bin/${tool}`;
  }

  async cleanup(): Promise<void> {}
}

describe("Process Runner & Strategy Clean Architecture", () => {
  it("executes commands and queries hardware through IProcessRunner abstraction", async () => {
    const mockRunner = new MockProcessRunner();
    const appleSilicon = await HardwareProfiler.queryAppleSilicon(mockRunner);
    if (process.platform === "darwin" && process.arch === "arm64") {
      expect(appleSilicon).not.toBeNull();
      expect(appleSilicon?.totalBytes).toBe(34359738368);
      expect(mockRunner.executedCommands.some((c) => c[0] === "sysctl")).toBe(true);
    }

    const nvidia = await HardwareProfiler.queryNvidiaSmi(mockRunner);
    expect(nvidia).not.toBeNull();
    expect(nvidia?.totalBytes).toBe(16384 * 1024 * 1024);
    expect(mockRunner.executedCommands.some((c) => c[0] === "nvidia-smi")).toBe(true);
  });

  it("cascades through WindowHost strategies with polymorphic inversion", async () => {
    let strat1Called = false;
    let strat2Launched = false;

    const unsupportedStrategy: IWindowStrategy = {
      name: "UnsupportedStrategy",
      isSupported: async () => false,
      launch: async () => {
        strat1Called = true;
        throw new Error("Should not be called");
      },
    };

    const supportedStrategy: IWindowStrategy = {
      name: "MockSupportedStrategy",
      isSupported: async () => true,
      launch: async (opts) => {
        strat2Launched = true;
        return {
          pid: 12345,
          close: async () => {},
        };
      },
    };

    const host = new WindowHost([unsupportedStrategy, supportedStrategy]);
    const handle = await host.open({ title: "Test Window", url: "http://localhost:3333" });

    expect(strat1Called).toBe(false);
    expect(strat2Launched).toBe(true);
    expect(handle.pid).toBe(12345);
    expect(host.isOpen()).toBe(true);

    await host.close();
    expect(host.isOpen()).toBe(false);
  });

  it("cascades through NativeTrayBridge strategies and handles events", async () => {
    let trayStarted = false;
    let statusUpdated = false;

    const mockTrayStrategy: ITrayStrategy = {
      name: "MockTrayStrategy",
      isSupported: async () => true,
      start: async (callbacks) => {
        trayStarted = true;
        return {
          pid: 54321,
          updateStatus: async () => {
            statusUpdated = true;
          },
          updateMenu: async () => {},
          stop: async () => {},
        };
      },
    };

    const bridge = new NativeTrayBridge([mockTrayStrategy]);
    expect(await bridge.isSupported()).toBe(true);

    const started = await bridge.start({
      onOpenDashboard: () => {},
      onMenuItemClick: () => {},
      onQuit: () => {},
    });

    expect(started).toBe(true);
    expect(trayStarted).toBe(true);

    await bridge.updateStatus("green", "All healthy");
    expect(statusUpdated).toBe(true);

    await bridge.stop();
  });

  it("BunProcessRunner executes real echo commands with Result pattern", async () => {
    const runner = new BunProcessRunner();
    const res = await runner.execute(["echo", "hello-clean-architecture"]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.stdout.trim()).toBe("hello-clean-architecture");
      expect(res.value.exitCode).toBe(0);
    }
  });
});
