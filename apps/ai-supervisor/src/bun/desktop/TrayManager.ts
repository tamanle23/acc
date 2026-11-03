import fs from "node:fs";
import path from "node:path";
import { Tray, PATHS, type MenuItemConfig } from "electrobun/bun";
import type { TrayIconColor } from "../SupervisorEngine.js";

export type TrayAction =
  | "open-dashboard"
  | "purge-vram"
  | "restart-all"
  | "check-update"
  | "quit";

export interface TrayManagerCallbacks {
  onOpenDashboard: () => void;
  onPurgeVram: () => void;
  onRestartAll: () => void;
  onCheckUpdate: () => void;
  onQuit: () => void;
}

export class TrayManager {
  private tray: Tray | null = null;
  private readonly title: string;

  constructor(
    private readonly callbacks: TrayManagerCallbacks,
    title = "ACC Control Plane"
  ) {
    this.title = title;
  }

  public initialize(initialColor: TrayIconColor = "yellow"): boolean {
    try {
      const iconPath = this.resolveTrayIcon(initialColor);
      const tray = new Tray({
        title: this.title,
        image: iconPath,
      });

      if (tray.id && tray.visible) {
        tray.setMenu(this.buildMenuConfig());
        tray.on("tray-clicked", (event: any) => {
          this.handleTrayEvent(event?.data?.action);
        });
        this.tray = tray;
        console.log(`[TrayManager] Electrobun Tray initialized (id: ${tray.id})`);
        return true;
      }

      console.warn("[TrayManager] Electrobun Tray inactive on this platform. Continuing in windowed mode.");
      this.tray = null;
      return false;
    } catch (err) {
      console.warn("[TrayManager] Electrobun Tray unavailable:", err);
      this.tray = null;
      return false;
    }
  }

  public isAvailable(): boolean {
    return this.tray !== null && Boolean(this.tray.id && this.tray.visible);
  }

  public updateStatus(color: TrayIconColor): void {
    if (!this.tray || !this.tray.visible) return;
    try {
      const iconPath = this.resolveTrayIcon(color);
      this.tray.setImage(iconPath);
      this.tray.setTitle(`ACC (${color})`);
    } catch (err) {
      console.warn("[TrayManager] Failed to update tray icon status:", err);
    }
  }

  public remove(): void {
    if (this.tray) {
      try {
        this.tray.remove();
      } catch {
        // Ignore removal error on shutdown
      } finally {
        this.tray = null;
      }
    }
  }

  public resolveTrayIcon(color: TrayIconColor): string {
    const candidatePaths = [
      path.resolve(PATHS.VIEWS_FOLDER, "main", `tray-${color}.ico`),
      path.resolve(process.cwd(), "src", "assets", `tray-${color}.ico`),
      path.resolve(import.meta.dir, "..", "..", "assets", `tray-${color}.ico`),
    ];
    for (const cand of candidatePaths) {
      if (fs.existsSync(cand)) {
        return path.normalize(cand);
      }
    }
    return "";
  }

  private buildMenuConfig(): MenuItemConfig[] {
    return [
      { type: "normal", label: "Open Dashboard", action: "open-dashboard" },
      { type: "normal", label: "Purge All VRAM", action: "purge-vram" },
      { type: "normal", label: "Restart Services", action: "restart-all" },
      { type: "divider" },
      { type: "normal", label: "Check for Updates...", action: "check-update" },
      { type: "divider" },
      { type: "normal", label: "Quit", action: "quit" },
    ];
  }

  private handleTrayEvent(action?: string): void {
    const selectedAction: TrayAction = (action as TrayAction) || "open-dashboard";
    switch (selectedAction) {
      case "open-dashboard":
        this.callbacks.onOpenDashboard();
        break;
      case "purge-vram":
        this.callbacks.onPurgeVram();
        break;
      case "restart-all":
        this.callbacks.onRestartAll();
        break;
      case "check-update":
        this.callbacks.onCheckUpdate();
        break;
      case "quit":
        this.callbacks.onQuit();
        break;
    }
  }
}

