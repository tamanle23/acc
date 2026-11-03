import { BrowserWindow } from "electrobun/bun";

export interface WindowManagerOptions {
  title?: string;
  width?: number;
  height?: number;
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private readonly defaultTitle: string;
  private readonly defaultWidth: number;
  private readonly defaultHeight: number;

  constructor(options: WindowManagerOptions = {}) {
    this.defaultTitle = options.title ?? "ACC Control Plane";
    this.defaultWidth = options.width ?? 1200;
    this.defaultHeight = options.height ?? 820;
  }

  public openWindow(url: string): BrowserWindow {
    if (this.mainWindow) {
      try {
        this.mainWindow.show();
        this.mainWindow.activate();
        this.bringNativeWindowToForeground(this.mainWindow.ptr);
        return this.mainWindow;
      } catch {
        this.mainWindow = null;
      }
    }

    try {
      const win = new BrowserWindow({
        title: this.defaultTitle,
        url,
        frame: {
          width: this.defaultWidth,
          height: this.defaultHeight,
        },
        titleBarStyle: "default",
      });

      // Explicitly reveal, navigate, and activate window
      win.show();
      win.activate();

      try {
        win.webview.loadURL(url);
      } catch {
        // Fallback if webview controller initializes asynchronously
      }

      this.bringNativeWindowToForeground(win.ptr);

      win.on("close", () => {
        if (this.mainWindow === win) {
          this.mainWindow = null;
        }
      });

      this.mainWindow = win;
      return win;
    } catch (winErr) {
      console.error("[WindowManager] Failed to instantiate BrowserWindow:", winErr);
      throw winErr;
    }
  }

  public getWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  public isWindowOpen(): boolean {
    return this.mainWindow !== null;
  }

  public close(): void {
    if (this.mainWindow) {
      try {
        this.mainWindow.close();
      } catch {
        // Ignore close error during teardown
      } finally {
        this.mainWindow = null;
      }
    }
  }

  private bringNativeWindowToForeground(hwndPtr: unknown): void {
    if (!hwndPtr || process.platform !== "win32") return;
    try {
      const { dlopen, FFIType } = require("bun:ffi");
      const user32 = dlopen("user32.dll", {
        SetForegroundWindow: { args: [FFIType.ptr], returns: FFIType.bool },
        BringWindowToTop: { args: [FFIType.ptr], returns: FFIType.bool },
        ShowWindow: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.bool },
      });
      user32.symbols.ShowWindow(hwndPtr, 9); // SW_RESTORE
      user32.symbols.BringWindowToTop(hwndPtr);
      user32.symbols.SetForegroundWindow(hwndPtr);
    } catch {
      // Best-effort foreground activation; continue silently on non-interactive environments
    }
  }
}
