import {
  type ITrayStrategy,
  type TrayCallbacks,
  type TrayHandle,
  type TrayColor,
  type TrayMenuItem,
} from "./ITrayStrategy";
import { type IProcessRunner } from "../../IProcessRunner";
import { NativeBinaryResolver } from "../../NativeBinaryResolver";

export class WindowsPoshTrayStrategy implements ITrayStrategy {
  readonly name = "WindowsPoshTrayStrategy";

  constructor(private readonly runner: IProcessRunner) {}

  async isSupported(): Promise<boolean> {
    if (process.platform !== "win32") return false;
    const script = NativeBinaryResolver.getWindowsTrayScript();
    if (!script) return false;
    const posh = await this.runner.which("powershell.exe");
    return posh !== null;
  }

  async start(callbacks: TrayCallbacks): Promise<TrayHandle> {
    const script = NativeBinaryResolver.getWindowsTrayScript();
    if (!script) {
      throw new Error("Windows tray runner script not found");
    }

    const proc = this.runner.spawnManaged(
      [
        "powershell.exe",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
      ],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "ignore",
        onStdout: (chunk) => {
          const lines = chunk.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === "ACTION:open") {
              callbacks.onOpenDashboard();
            } else if (trimmed === "ACTION:quit") {
              callbacks.onQuit();
            } else if (trimmed.startsWith("ACTION:menu:")) {
              const id = trimmed.replace("ACTION:menu:", "");
              callbacks.onMenuItemClick(id);
            }
          }
        },
      }
    );

    return {
      pid: proc.pid,
      updateStatus: async (color: TrayColor, tooltip: string) => {
        await proc.writeStdin(`STATUS:${color}:${tooltip}\n`);
      },
      updateMenu: async (items: readonly TrayMenuItem[]) => {
        const payload = items.map((i) => `${i.id}|${i.label}|${i.enabled !== false}`).join(";");
        await proc.writeStdin(`MENU:${payload}\n`);
      },
      stop: async () => {
        try {
          await proc.writeStdin("QUIT\n");
        } catch {
          // ignore
        }
        await proc.kill();
      },
    };
  }
}
