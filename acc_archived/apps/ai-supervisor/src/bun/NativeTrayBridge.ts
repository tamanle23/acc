import { type IProcessRunner, defaultProcessRunner } from "./platform/IProcessRunner";
import {
  type ITrayStrategy,
  type TrayCallbacks,
  type TrayHandle,
  type TrayColor,
  type TrayMenuItem,
} from "./platform/strategies/tray/ITrayStrategy";
import { MacNativeTrayStrategy } from "./platform/strategies/tray/MacNativeTrayStrategy";
import { LinuxAppIndicatorTrayStrategy } from "./platform/strategies/tray/LinuxAppIndicatorTrayStrategy";
import { WindowsPoshTrayStrategy } from "./platform/strategies/tray/WindowsPoshTrayStrategy";

export type { TrayColor, TrayMenuItem, TrayCallbacks, TrayHandle, ITrayStrategy };

export interface NativeTrayBridgeOptions {
  readonly iconDir?: string;
  readonly initialColor?: TrayColor;
}

/**
 * Composite NativeTrayBridge: facade for starting, updating, and stopping system trays.
 * Fully decoupled from specific platform subprocess mechanics.
 */
export class NativeTrayBridge {
  private activeHandle: TrayHandle | null = null;
  private readonly strategies: ITrayStrategy[];
  private currentColor: TrayColor = "green";
  private currentTooltip = "ACC AI Supervisor";

  constructor(
    optionsOrStrategies?: NativeTrayBridgeOptions | ITrayStrategy[],
    private readonly runner: IProcessRunner = defaultProcessRunner
  ) {
    if (Array.isArray(optionsOrStrategies)) {
      this.strategies = optionsOrStrategies;
    } else {
      if (optionsOrStrategies?.initialColor) {
        this.currentColor = optionsOrStrategies.initialColor;
      }
      this.strategies = [
        new MacNativeTrayStrategy(this.runner),
        new LinuxAppIndicatorTrayStrategy(this.runner),
        new WindowsPoshTrayStrategy(this.runner),
      ];
    }
  }

  async isSupported(): Promise<boolean> {
    for (const strategy of this.strategies) {
      if (await strategy.isSupported()) {
        return true;
      }
    }
    return false;
  }

  async start(callbacks: TrayCallbacks): Promise<boolean> {
    if (this.activeHandle) {
      return true;
    }

    for (const strategy of this.strategies) {
      try {
        if (await strategy.isSupported()) {
          this.activeHandle = await strategy.start(callbacks);
          await this.activeHandle.updateStatus(this.currentColor, this.currentTooltip);
          return true;
        }
      } catch {
        // Fallback to next strategy
      }
    }

    return false;
  }

  async setIcon(color: TrayColor): Promise<void> {
    this.currentColor = color;
    if (this.activeHandle) {
      await this.activeHandle.updateStatus(this.currentColor, this.currentTooltip);
    }
  }

  async setTooltip(tooltip: string): Promise<void> {
    this.currentTooltip = tooltip;
    if (this.activeHandle) {
      await this.activeHandle.updateStatus(this.currentColor, this.currentTooltip);
    }
  }

  async updateStatus(color: TrayColor, tooltip: string): Promise<void> {
    this.currentColor = color;
    this.currentTooltip = tooltip;
    if (!this.activeHandle) return;
    try {
      await this.activeHandle.updateStatus(color, tooltip);
    } catch {
      // ignore
    }
  }

  async updateMenu(items: readonly TrayMenuItem[]): Promise<void> {
    if (!this.activeHandle) return;
    try {
      await this.activeHandle.updateMenu(items);
    } catch {
      // ignore
    }
  }

  async stop(): Promise<void> {
    if (this.activeHandle) {
      try {
        await this.activeHandle.stop();
      } catch {
        // ignore
      }
      this.activeHandle = null;
    }
  }
}
