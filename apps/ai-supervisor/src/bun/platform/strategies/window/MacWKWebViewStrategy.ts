import { type IWindowStrategy, type WindowOptions, type WindowHandle } from "./IWindowStrategy";
import { type IProcessRunner } from "../../IProcessRunner";
import { NativeBinaryResolver } from "../../NativeBinaryResolver";

export class MacWKWebViewStrategy implements IWindowStrategy {
  readonly name = "MacWKWebViewStrategy";

  constructor(private readonly runner: IProcessRunner) {}

  async isSupported(): Promise<boolean> {
    if (process.platform !== "darwin") return false;
    const binary = NativeBinaryResolver.getMacWebViewBinary();
    return binary !== null;
  }

  async launch(options: WindowOptions): Promise<WindowHandle> {
    const binary = NativeBinaryResolver.getMacWebViewBinary();
    if (!binary) {
      throw new Error("Mac WKWebView binary not found");
    }

    const args = [
      options.url,
      options.title,
      String(options.width ?? 1200),
      String(options.height ?? 820),
    ];

    const proc = this.runner.spawnManaged([binary, ...args], {
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
