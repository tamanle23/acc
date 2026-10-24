/**
 * Cross-platform startup / login-item management for ACC AI-Supervisor.
 *
 * Platform support:
 *   Windows — HKCU\...\CurrentVersion\Run registry key (PowerShell)
 *   macOS   — launchd LaunchAgent plist in ~/Library/LaunchAgents/
 *   Linux   — XDG autostart .desktop file in ~/.config/autostart/
 */

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { type IProcessRunner, defaultProcessRunner } from "./platform/IProcessRunner";

const APP_NAME = "ACCControlPlane";
const APP_LABEL = "com.acc.ai-supervisor";

// ── Windows ──────────────────────────────────────────────────────────────────

const WIN_REG_KEY = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";

async function setWindowsStartup(
  enable: boolean,
  appPath: string,
  runner: IProcessRunner = defaultProcessRunner
): Promise<boolean> {
  const command = enable
    ? `New-ItemProperty -Path "${WIN_REG_KEY}" -Name "${APP_NAME}" -Value '"${appPath}" --minimized' -PropertyType String -Force`
    : `Remove-ItemProperty -Path "${WIN_REG_KEY}" -Name "${APP_NAME}" -ErrorAction SilentlyContinue`;

  try {
    const res = await runner.execute([
      "powershell",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      command,
    ]);
    return res.ok;
  } catch (err) {
    console.warn("[StartupManager/Windows] Registry update failed:", err);
    return false;
  }
}

async function getWindowsStartupStatus(
  runner: IProcessRunner = defaultProcessRunner
): Promise<boolean> {
  const command = `(Get-ItemProperty -Path "${WIN_REG_KEY}" -Name "${APP_NAME}" -ErrorAction SilentlyContinue) -ne $null`;
  try {
    const res = await runner.execute([
      "powershell",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      command,
    ]);
    return res.ok && res.value.stdout.trim().toLowerCase() === "true";
  } catch {
    return false;
  }
}

// ── macOS ─────────────────────────────────────────────────────────────────────

const LAUNCH_AGENTS_DIR = path.join(os.homedir(), "Library", "LaunchAgents");
const PLIST_PATH = path.join(LAUNCH_AGENTS_DIR, `${APP_LABEL}.plist`);

function buildPlist(appPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${APP_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${appPath}</string>
    <string>--minimized</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${path.join(os.homedir(), ".acc", "logs", "supervisor.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(os.homedir(), ".acc", "logs", "supervisor-err.log")}</string>
</dict>
</plist>`;
}

async function setMacOSStartup(
  enable: boolean,
  appPath: string,
  runner: IProcessRunner = defaultProcessRunner
): Promise<boolean> {
  try {
    if (enable) {
      fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
      fs.writeFileSync(PLIST_PATH, buildPlist(appPath), "utf8");

      // Load it immediately so it takes effect without logout
      await runner.execute(["launchctl", "load", "-w", PLIST_PATH]);
    } else {
      if (fs.existsSync(PLIST_PATH)) {
        await runner.execute(["launchctl", "unload", "-w", PLIST_PATH]);
        fs.unlinkSync(PLIST_PATH);
      }
    }
    return true;
  } catch (err) {
    console.warn("[StartupManager/macOS] LaunchAgent update failed:", err);
    return false;
  }
}

async function getMacOSStartupStatus(): Promise<boolean> {
  return fs.existsSync(PLIST_PATH);
}

// ── Linux ─────────────────────────────────────────────────────────────────────

const XDG_AUTOSTART_DIR = path.join(
  process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
  "autostart"
);
const DESKTOP_PATH = path.join(XDG_AUTOSTART_DIR, `${APP_LABEL}.desktop`);

function buildDesktopEntry(appPath: string): string {
  return `[Desktop Entry]
Type=Application
Name=ACC Control Plane
Comment=AI-Supervisor for ACC
Exec=${appPath} --minimized
Icon=utilities-system-monitor
Terminal=false
Hidden=false
X-GNOME-Autostart-enabled=true
`;
}

async function setLinuxStartup(enable: boolean, appPath: string): Promise<boolean> {
  try {
    if (enable) {
      fs.mkdirSync(XDG_AUTOSTART_DIR, { recursive: true });
      fs.writeFileSync(DESKTOP_PATH, buildDesktopEntry(appPath), "utf8");
    } else {
      if (fs.existsSync(DESKTOP_PATH)) fs.unlinkSync(DESKTOP_PATH);
    }
    return true;
  } catch (err) {
    console.warn("[StartupManager/Linux] XDG autostart update failed:", err);
    return false;
  }
}

async function getLinuxStartupStatus(): Promise<boolean> {
  return fs.existsSync(DESKTOP_PATH);
}

// ── Public cross-platform API ─────────────────────────────────────────────────

/**
 * Enables or disables automatic startup at login for the current platform.
 * @param enable    Whether to register for autostart.
 * @param appPath   Path to the executable (defaults to the current process).
 */
export async function setStartupEnabled(enable: boolean, appPath?: string): Promise<boolean> {
  const exe = appPath ?? process.execPath;
  switch (process.platform) {
    case "win32":  return setWindowsStartup(enable, exe);
    case "darwin": return setMacOSStartup(enable, exe);
    case "linux":  return setLinuxStartup(enable, exe);
    default:
      console.warn(`[StartupManager] Autostart not supported on ${process.platform}`);
      return false;
  }
}

/** Returns true when the app is currently registered to start at login. */
export async function getStartupStatus(): Promise<boolean> {
  switch (process.platform) {
    case "win32":  return getWindowsStartupStatus();
    case "darwin": return getMacOSStartupStatus();
    case "linux":  return getLinuxStartupStatus();
    default:       return false;
  }
}

// ── Backwards-compat shims (previously windowsStartup.ts) ────────────────────

/** @deprecated Use setStartupEnabled() instead. */
export async function setWindowsStartupCompat(enable: boolean, customAppPath?: string): Promise<boolean> {
  return setStartupEnabled(enable, customAppPath);
}

/** @deprecated Use getStartupStatus() instead. */
export async function getWindowsStartupStatus(): Promise<boolean> {
  return getStartupStatus();
}
