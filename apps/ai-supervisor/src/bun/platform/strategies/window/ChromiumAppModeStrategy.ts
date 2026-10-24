import fs from "node:fs";
import { type IWindowStrategy, type WindowOptions, type WindowHandle } from "./IWindowStrategy";
import { type IProcessRunner } from "../../IProcessRunner";

export class ChromiumAppModeStrategy implements IWindowStrategy {
  readonly name = "ChromiumAppModeStrategy";
  private resolvedBinary: string | null = null;

  constructor(private readonly runner: IProcessRunner) {}

  private getCandidates(): string[] {
    if (process.platform === "darwin") {
      return [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
      ];
    }
    if (process.platform === "win32") {
      const progFiles = process.env["ProgramFiles"] || "C:\\Program Files";
      const progFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
      const localApp = process.env["LOCALAPPDATA"] || "";
      return [
        `${progFiles}\\Google\\Chrome\\Application\\chrome.exe`,
        `${progFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
        `${progFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${progFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${localApp}\\Google\\Chrome\\Application\\chrome.exe`,
      ];
    }
    return [
      "google-chrome",
      "google-chrome-stable",
      "chromium-browser",
      "chromium",
      "microsoft-edge",
      "brave-browser",
    ];
  }

  async isSupported(): Promise<boolean> {
    if (this.resolvedBinary) return true;

    for (const candidate of this.getCandidates()) {
      if (candidate.startsWith("/") || candidate.includes(":\\")) {
        if (fs.existsSync(candidate)) {
          this.resolvedBinary = candidate;
          return true;
        }
      } else {
        const found = await this.runner.which(candidate);
        if (found) {
          this.resolvedBinary = found;
          return true;
        }
      }
    }
    return false;
  }

  async launch(options: WindowOptions): Promise<WindowHandle> {
    if (!this.resolvedBinary && !(await this.isSupported())) {
      throw new Error("No Chromium-based browser found for app mode");
    }

    const width = options.width ?? 1200;
    const height = options.height ?? 820;

    const args = [
      `--app=${options.url}`,
      `--window-size=${width},${height}`,
      "--disable-features=Translate",
      "--no-first-run",
      "--no-default-browser-check",
    ];

    const proc = this.runner.spawnManaged([this.resolvedBinary!, ...args], {
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
