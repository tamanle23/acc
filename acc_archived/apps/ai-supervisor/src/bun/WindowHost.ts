import { type IProcessRunner, defaultProcessRunner } from "./platform/IProcessRunner";
import { type IWindowStrategy, type WindowOptions, type WindowHandle } from "./platform/strategies/window/IWindowStrategy";
import { MacWKWebViewStrategy } from "./platform/strategies/window/MacWKWebViewStrategy";
import { LinuxWebKit2Strategy } from "./platform/strategies/window/LinuxWebKit2Strategy";
import { WindowsWebView2Strategy } from "./platform/strategies/window/WindowsWebView2Strategy";
import { ChromiumAppModeStrategy } from "./platform/strategies/window/ChromiumAppModeStrategy";
import { DefaultBrowserStrategy } from "./platform/strategies/window/DefaultBrowserStrategy";

export type { WindowOptions, WindowHandle, IWindowStrategy };

export interface WindowHostConfig {
  readonly title?: string;
  readonly url?: string;
  readonly width?: number;
  readonly height?: number;
}

/**
 * Composite WindowHost: evaluates ordered strategies and delegates window presentation.
 * Clean, decoupled, and free of direct spawn() or platform switches.
 */
export class WindowHost {
  private activeWindow: WindowHandle | null = null;
  private readonly strategies: IWindowStrategy[];
  private readonly defaultOptions?: WindowHostConfig;

  constructor(
    configOrStrategies?: WindowHostConfig | IWindowStrategy[],
    private readonly runner: IProcessRunner = defaultProcessRunner
  ) {
    if (Array.isArray(configOrStrategies)) {
      this.strategies = configOrStrategies;
    } else {
      this.defaultOptions = configOrStrategies;
      // Prioritized strategy cascade
      this.strategies = [
        new MacWKWebViewStrategy(this.runner),
        new LinuxWebKit2Strategy(this.runner),
        new WindowsWebView2Strategy(this.runner),
        new ChromiumAppModeStrategy(this.runner),
        new DefaultBrowserStrategy(this.runner),
      ];
    }
  }

  /**
   * Opens the window by selecting the first supported strategy.
   */
  async open(options?: Partial<WindowOptions>): Promise<WindowHandle> {
    const mergedOptions: WindowOptions = {
      title: options?.title ?? this.defaultOptions?.title ?? "ACC Control Plane",
      url: options?.url ?? this.defaultOptions?.url ?? "http://localhost:3333",
      width: options?.width ?? this.defaultOptions?.width ?? 1200,
      height: options?.height ?? this.defaultOptions?.height ?? 820,
    };

    if (this.activeWindow) {
      try {
        await this.activeWindow.close();
      } catch {
        // ignore
      }
      this.activeWindow = null;
    }

    for (const strategy of this.strategies) {
      try {
        if (await strategy.isSupported()) {
          const handle = await strategy.launch(mergedOptions);
          this.activeWindow = handle;
          return handle;
        }
      } catch {
        // Fall through to next strategy
      }
    }

    throw new Error("No viable window strategy found for the current environment");
  }

  /**
   * Explicitly opens the default system web browser.
   */
  async openDefaultBrowser(targetUrl?: string): Promise<WindowHandle> {
    const browserStrategy = new DefaultBrowserStrategy(this.runner);
    return browserStrategy.launch({
      title: "ACC Control Plane",
      url: targetUrl ?? this.defaultOptions?.url ?? "http://localhost:3333",
    });
  }

  async close(): Promise<void> {
    if (this.activeWindow) {
      await this.activeWindow.close();
      this.activeWindow = null;
    }
  }

  isOpen(): boolean {
    return this.activeWindow !== null;
  }
}
