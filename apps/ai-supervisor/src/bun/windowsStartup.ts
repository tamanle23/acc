import { spawn } from "bun";

const APP_NAME = "ACCControlPlane";
const REG_KEY = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\Run";

/**
 * Enables or disables automatic startup with Windows via the CurrentVersion\Run registry key.
 * On non-Windows platforms, safely returns false.
 */
export async function setWindowsStartup(enable: boolean, customAppPath?: string): Promise<boolean> {
  if (process.platform !== "win32") {
    return false;
  }

  const appPath = customAppPath || process.execPath;
  const command = enable
    ? `New-ItemProperty -Path "${REG_KEY}" -Name "${APP_NAME}" -Value '"${appPath}" --minimized' -PropertyType String -Force`
    : `Remove-ItemProperty -Path "${REG_KEY}" -Name "${APP_NAME}" -ErrorAction SilentlyContinue`;

  try {
    const proc = spawn(["powershell", "-NoProfile", "-NonInteractive", "-Command", command], {
      stdout: "ignore",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch (err) {
    console.warn("[WindowsStartup] Error updating registry startup:", err);
    return false;
  }
}

/**
 * Checks whether the application is currently registered to start up with Windows.
 */
export async function getWindowsStartupStatus(): Promise<boolean> {
  if (process.platform !== "win32") {
    return false;
  }

  const command = `(Get-ItemProperty -Path "${REG_KEY}" -Name "${APP_NAME}" -ErrorAction SilentlyContinue) -ne $null`;
  try {
    const proc = spawn(["powershell", "-NoProfile", "-NonInteractive", "-Command", command], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    return output.trim().toLowerCase() === "true";
  } catch {
    return false;
  }
}
