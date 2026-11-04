import { setStartupEnabled, getStartupStatus } from "./StartupManager.js";

/**
 * Backwards-compatibility wrapper for setStartupEnabled.
 */
export async function setWindowsStartup(enable: boolean, customAppPath?: string): Promise<boolean> {
  return setStartupEnabled(enable, customAppPath);
}

/**
 * Backwards-compatibility wrapper for getStartupStatus.
 */
export async function getWindowsStartupStatus(): Promise<boolean> {
  return getStartupStatus();
}
