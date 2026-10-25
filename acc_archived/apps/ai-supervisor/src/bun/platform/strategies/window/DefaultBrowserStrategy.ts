import { type IWindowStrategy, type WindowOptions, type WindowHandle } from "./IWindowStrategy";
import { type IProcessRunner } from "../../IProcessRunner";

export class DefaultBrowserStrategy implements IWindowStrategy {
  readonly name = "DefaultBrowserStrategy";

  constructor(private readonly runner: IProcessRunner) {}

  async isSupported(): Promise<boolean> {
    return true; // Always supported as universal fallback
  }

  async launch(options: WindowOptions): Promise<WindowHandle> {
    let cmd: string[];
    if (process.platform === "darwin") {
      cmd = ["open", options.url];
    } else if (process.platform === "win32") {
      cmd = ["powershell.exe", "-NoProfile", "-Command", "Start-Process", `"${options.url}"`];
    } else {
      cmd = ["xdg-open", options.url];
    }

    const proc = this.runner.spawnManaged(cmd, {
      stdout: "ignore",
      stderr: "ignore",
    });

    return {
      pid: proc.pid,
      close: async () => {
        await proc.kill();
      },
    };
  }
}
