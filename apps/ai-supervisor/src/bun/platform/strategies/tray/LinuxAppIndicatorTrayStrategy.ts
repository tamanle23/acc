import {
  type ITrayStrategy,
  type TrayCallbacks,
  type TrayHandle,
  type TrayColor,
  type TrayMenuItem,
} from "./ITrayStrategy";
import { type IProcessRunner } from "../../IProcessRunner";
import { NativeBinaryResolver } from "../../NativeBinaryResolver";

export class LinuxAppIndicatorTrayStrategy implements ITrayStrategy {
  readonly name = "LinuxAppIndicatorTrayStrategy";

  constructor(private readonly runner: IProcessRunner) {}

  async isSupported(): Promise<boolean> {
    if (process.platform !== "linux") return false;
    const script = NativeBinaryResolver.getLinuxTrayScript();
    if (!script) return false;

    const python3 = await this.runner.which("python3");
    if (!python3) return false;

    const probe = await this.runner.execute([
      python3,
      "-c",
      "import gi; gi.require_version('Gtk', '3.0'); gi.require_version('AppIndicator3', '0.1'); from gi.repository import Gtk, AppIndicator3",
    ]);

    return probe.ok;
  }

  async start(callbacks: TrayCallbacks): Promise<TrayHandle> {
    const script = NativeBinaryResolver.getLinuxTrayScript();
    if (!script) {
      throw new Error("Linux tray runner script not found");
    }

    const python3 = (await this.runner.which("python3")) ?? "python3";
    const proc = this.runner.spawnManaged([python3, script], {
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
    });

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
