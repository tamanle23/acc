import path from "node:path";
import fs from "node:fs";

export class NativeBinaryResolver {
  private static getAssetsDir(): string {
    return path.resolve(import.meta.dir, "../../assets");
  }

  /**
   * Resolves the native macOS WKWebView Mach-O binary.
   */
  static getMacWebViewBinary(): string | null {
    const binPath = path.join(this.getAssetsDir(), "bin", "webview_host_mac");
    return fs.existsSync(binPath) ? binPath : null;
  }

  /**
   * Resolves the native macOS Tray Mach-O binary.
   */
  static getMacTrayBinary(): string | null {
    const binPath = path.join(this.getAssetsDir(), "bin", "tray_runner_mac");
    return fs.existsSync(binPath) ? binPath : null;
  }

  /**
   * Resolves the Linux WebKit2GTK python script.
   */
  static getLinuxWebViewScript(): string | null {
    const scriptPath = path.join(this.getAssetsDir(), "webview_host_linux.py");
    return fs.existsSync(scriptPath) ? scriptPath : null;
  }

  /**
   * Resolves the Linux AppIndicator tray python script.
   */
  static getLinuxTrayScript(): string | null {
    const scriptPath = path.join(this.getAssetsDir(), "tray_runner_linux.py");
    return fs.existsSync(scriptPath) ? scriptPath : null;
  }

  /**
   * Resolves the Windows PowerShell tray script.
   */
  static getWindowsTrayScript(): string | null {
    const scriptPath = path.join(this.getAssetsDir(), "tray_runner_win.ps1");
    return fs.existsSync(scriptPath) ? scriptPath : null;
  }
}
