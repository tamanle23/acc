import { WindowManager } from "./WindowManager.js";
import { TrayManager } from "./TrayManager.js";
import type { SupervisorEngine, TrayIconColor } from "../SupervisorEngine.js";
import type { UpdateManager } from "../UpdateManager.js";

export interface DesktopApplicationOptions {
  supervisorEngine: SupervisorEngine;
  updateManager: UpdateManager;
  onQuit: () => void | Promise<void>;
  windowManager?: WindowManager;
}

export class DesktopApplication {
  private readonly windowManager: WindowManager;
  private readonly trayManager: TrayManager;
  private currentDashboardUrl = "";
  private isTrayActive = false;

  constructor(private readonly options: DesktopApplicationOptions) {
    this.windowManager = options.windowManager ?? new WindowManager();
    this.trayManager = new TrayManager({
      onOpenDashboard: () => this.openDashboard(),
      onPurgeVram: () => {
        this.options.supervisorEngine.purgeAllVram().catch((err) => {
          console.error("[DesktopApplication] Failed to purge VRAM:", err);
        });
      },
      onRestartAll: () => {
        this.options.supervisorEngine
          .stopAll()
          .then(() => this.options.supervisorEngine.startAll())
          .catch((err) => {
            console.error("[DesktopApplication] Failed to restart fleet:", err);
          });
      },
      onCheckUpdate: () => {
        this.options.updateManager.checkForUpdates().catch((err) => {
          console.error("[DesktopApplication] Failed to check updates:", err);
        });
      },
      onQuit: () => {
        this.options.onQuit();
      },
    });
  }

  public start(dashboardUrl: string, options?: { minimized?: boolean }): void {
    this.currentDashboardUrl = dashboardUrl;
    const initialColor: TrayIconColor = this.options.supervisorEngine.getTrayColor();
    this.isTrayActive = this.trayManager.initialize(initialColor);

    this.options.supervisorEngine.onStatusChange((_states, color) => {
      this.trayManager.updateStatus(color);
    });

    const isMinimized = options?.minimized ?? process.argv.includes("--minimized");
    if (!isMinimized || !this.isTrayActive) {
      this.openDashboard();
    }
  }

  public openDashboard(): void {
    if (!this.currentDashboardUrl) return;
    const handleClose = !this.isTrayActive ? () => this.options.onQuit() : undefined;
    this.windowManager.openWindow(this.currentDashboardUrl, handleClose);
  }

  public stop(): void {
    this.trayManager.remove();
    this.windowManager.close();
  }

  public getWindowManager(): WindowManager {
    return this.windowManager;
  }

  public getTrayManager(): TrayManager {
    return this.trayManager;
  }
}
