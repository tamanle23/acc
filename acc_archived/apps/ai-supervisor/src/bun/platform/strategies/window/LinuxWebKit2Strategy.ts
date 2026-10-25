import { type IWindowStrategy, type WindowOptions, type WindowHandle } from "./IWindowStrategy";
import { type IProcessRunner } from "../../IProcessRunner";
import { NativeBinaryResolver } from "../../NativeBinaryResolver";

export class LinuxWebKit2Strategy implements IWindowStrategy {
  readonly name = "LinuxWebKit2Strategy";

  constructor(private readonly runner: IProcessRunner) {}

  async isSupported(): Promise<boolean> {
    if (process.platform !== "linux") return false;
    const script = NativeBinaryResolver.getLinuxWebViewScript();
    if (!script) return false;

    // Check if python3 with gi / WebKit2 is present
    const python3 = await this.runner.which("python3");
    if (!python3) return false;

    const probe = await this.runner.execute([
      python3,
      "-c",
      "import gi; gi.require_version('Gtk', '3.0'); gi.require_version('WebKit2', '4.0'); from gi.repository import Gtk, WebKit2",
    ]);

    return probe.ok;
  }

  async launch(options: WindowOptions): Promise<WindowHandle> {
    const script = NativeBinaryResolver.getLinuxWebViewScript();
    if (!script) {
      throw new Error("Linux WebView script not found");
    }

    const python3 = (await this.runner.which("python3")) ?? "python3";
    const args = [
      options.url,
      options.title,
      String(options.width ?? 1200),
      String(options.height ?? 820),
    ];

    const proc = this.runner.spawnManaged([python3, script, ...args], {
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
