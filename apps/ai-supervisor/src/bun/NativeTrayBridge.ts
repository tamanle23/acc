import { spawn, type Subprocess } from "bun";
import path from "node:path";
import fs from "node:fs";

export interface TrayBridgeOptions {
  iconDir: string;
  initialColor?: "green" | "yellow" | "red";
  onOpenDashboard?: () => void;
  onPurgeVram?: () => void;
  onRestartAll?: () => void;
  onCheckUpdate?: () => void;
  onExit?: () => void;
}

export class NativeTrayBridge {
  private proc: Subprocess | null = null;
  private isReady = false;
  private options: TrayBridgeOptions;

  constructor(options: TrayBridgeOptions) {
    this.options = options;
  }

  public async start(): Promise<boolean> {
    if (process.platform !== "win32") {
      console.log("[NativeTrayBridge] System tray notification area is currently implemented for Windows. Non-Windows fallback active.");
      return false;
    }

    const scriptPath = path.join(this.options.iconDir, "tray_runner.ps1");
    if (!fs.existsSync(scriptPath)) {
      console.warn(`[NativeTrayBridge] Tray runner script not found at ${scriptPath}`);
      return false;
    }

    const initialColor = this.options.initialColor || "yellow";

    try {
      this.proc = spawn(
        [
          "powershell",
          "-NoProfile",
          "-NonInteractive",
          "-WindowStyle",
          "Hidden",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          scriptPath,
          "-IconDir",
          this.options.iconDir,
          "-InitialColor",
          initialColor,
        ],
        {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        }
      );

      this.listenStdout();
      this.listenStderr();

      return true;
    } catch (err) {
      console.warn("[NativeTrayBridge] Failed to launch native Windows system tray:", err);
      return false;
    }
  }

  private listenStdout(): void {
    if (!this.proc?.stdout) return;

    (async () => {
      const reader = this.proc!.stdout.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value);
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === "TRAY_READY") {
            this.isReady = true;
            console.log("[NativeTrayBridge] System Tray icon active in Windows Notification Area.");
          } else if (trimmed === "EVENT:OPEN") {
            this.options.onOpenDashboard?.();
          } else if (trimmed === "EVENT:PURGE_VRAM") {
            this.options.onPurgeVram?.();
          } else if (trimmed === "EVENT:RESTART_ALL") {
            this.options.onRestartAll?.();
          } else if (trimmed === "EVENT:CHECK_UPDATE") {
            this.options.onCheckUpdate?.();
          } else if (trimmed === "EVENT:EXIT") {
            this.options.onExit?.();
          }
        }
      }
    })().catch(() => {});
  }

  private listenStderr(): void {
    if (!this.proc?.stderr) return;

    (async () => {
      const reader = this.proc!.stderr.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const msg = decoder.decode(value).trim();
        if (msg) {
          console.warn(`[NativeTrayBridge:stderr] ${msg}`);
        }
      }
    })().catch(() => {});
  }

  public setIcon(color: "green" | "yellow" | "red"): void {
    if (this.proc?.stdin) {
      try {
        this.proc.stdin.write(`ICON:${color}\n`);
        this.proc.stdin.flush();
      } catch {
        // stream closed
      }
    }
  }

  public setTooltip(text: string): void {
    if (this.proc?.stdin) {
      try {
        this.proc.stdin.write(`TOOLTIP:${text}\n`);
        this.proc.stdin.flush();
      } catch {
        // stream closed
      }
    }
  }

  public stop(): void {
    if (this.proc) {
      try {
        if (this.proc.stdin) {
          this.proc.stdin.write("EXIT\n");
          this.proc.stdin.flush();
        }
      } catch {}
      setTimeout(() => {
        try {
          this.proc?.kill();
        } catch {}
      }, 500);
    }
  }
}
