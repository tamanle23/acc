import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  sha256?: string;
  sizeBytes: number;
}

export interface ReleaseManifest {
  version: string;
  releaseNotes: string;
  publishedAt: string;
  assets: ReleaseAsset[];
}

export interface UpdateStatus {
  isChecking: boolean;
  isAvailable: boolean;
  isDownloading: boolean;
  isReadyToApply: boolean;
  currentVersion: string;
  targetVersion: string | null;
  releaseNotes: string | null;
  downloadProgress: number; // 0 - 100
  stagedPath: string | null;
  error: string | null;
}

export class UpdateManager {
  private baseDir: string;
  private stagingDir: string;
  private backupDir: string;
  private currentVersion: string;
  private status: UpdateStatus;
  private crashWatchdogPath: string;

  constructor(options?: { baseDir?: string; currentVersion?: string }) {
    this.currentVersion = options?.currentVersion || "1.0.0";
    this.baseDir = options?.baseDir || path.join(os.homedir(), ".acc", "updates");
    this.stagingDir = path.join(this.baseDir, "staging");
    this.backupDir = path.join(this.baseDir, "backup");
    this.crashWatchdogPath = path.join(this.baseDir, "boot_watchdog.json");

    if (!fs.existsSync(this.stagingDir)) {
      fs.mkdirSync(this.stagingDir, { recursive: true });
    }
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    this.status = {
      isChecking: false,
      isAvailable: false,
      isDownloading: false,
      isReadyToApply: false,
      currentVersion: this.currentVersion,
      targetVersion: null,
      releaseNotes: null,
      downloadProgress: 0,
      stagedPath: null,
      error: null,
    };
  }

  public getStatus(): UpdateStatus {
    return { ...this.status };
  }

  public async checkForUpdates(repo = "automating-content-creator/acc"): Promise<boolean> {
    if (process.env.NODE_ENV === "development" && !process.env.TEST_UPDATER) {
      // Guarded in development unless explicitly testing
      return false;
    }

    this.status.isChecking = true;
    this.status.error = null;

    try {
      const url = `https://api.github.com/repos/${repo}/releases/latest`;
      const res = await fetch(url, {
        headers: { "User-Agent": "ACC-AI-Supervisor" },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        this.status.isChecking = false;
        return false;
      }

      const data = (await res.json()) as { tag_name?: string; body?: string };
      const latestTag = (data.tag_name || "").replace(/^v/, "");

      if (this.isNewerVersion(latestTag, this.currentVersion)) {
        this.status.isAvailable = true;
        this.status.targetVersion = latestTag;
        this.status.releaseNotes = data.body || "Bug fixes and performance enhancements.";
        this.status.isChecking = false;
        return true;
      }

      this.status.isAvailable = false;
      this.status.isChecking = false;
      return false;
    } catch (err: any) {
      this.status.isChecking = false;
      this.status.error = err?.message || String(err);
      return false;
    }
  }

  public simulateUpdate(version = "1.1.0"): void {
    this.status.isAvailable = true;
    this.status.targetVersion = version;
    this.status.releaseNotes = "Simulation update: New features, enhanced VRAM arbitration, and faster UI scrubbing.";
    this.status.isReadyToApply = true;
    this.status.downloadProgress = 100;
  }

  public async verifySha256(filePath: string, expectedHash: string): Promise<boolean> {
    if (!fs.existsSync(filePath)) return false;
    const fileBuffer = fs.readFileSync(filePath);
    const computedHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    return computedHash.toLowerCase() === expectedHash.toLowerCase();
  }

  public backupCurrentExecutable(customSourcePath?: string): boolean {
    try {
      const src = customSourcePath || process.execPath;
      if (!fs.existsSync(src)) return false;

      const dest = path.join(this.backupDir, path.basename(src));
      fs.copyFileSync(src, dest);
      return true;
    } catch (err) {
      console.warn("[UpdateManager] Failed to create executable backup:", err);
      return false;
    }
  }

  public rollbackFromBackup(customDestPath?: string): boolean {
    try {
      const dest = customDestPath || process.execPath;
      const backupFile = path.join(this.backupDir, path.basename(dest));
      if (!fs.existsSync(backupFile)) return false;

      fs.copyFileSync(backupFile, dest);
      console.info("[UpdateManager] Successfully rolled back to backup executable.");
      return true;
    } catch (err) {
      console.error("[UpdateManager] Failed to rollback from backup:", err);
      return false;
    }
  }

  public recordBootStart(): void {
    try {
      const data = {
        lastBootTime: Date.now(),
        crashCount: this.getCrashCount() + 1,
        version: this.currentVersion,
      };
      fs.writeFileSync(this.crashWatchdogPath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // non-fatal
    }
  }

  public markBootSuccessful(): void {
    try {
      if (fs.existsSync(this.crashWatchdogPath)) {
        fs.writeFileSync(this.crashWatchdogPath, JSON.stringify({ crashCount: 0, lastBootTime: Date.now(), version: this.currentVersion }, null, 2), "utf-8");
      }
    } catch {
      // non-fatal
    }
  }

  public getCrashCount(): number {
    try {
      if (fs.existsSync(this.crashWatchdogPath)) {
        const raw = fs.readFileSync(this.crashWatchdogPath, "utf-8");
        const parsed = JSON.parse(raw);
        return parsed.crashCount || 0;
      }
    } catch {
      // non-fatal
    }
    return 0;
  }

  public shouldRollback(): boolean {
    return this.getCrashCount() >= 2;
  }

  public isNewerVersion(remote: string, current: string): boolean {
    const rParts = remote.split(".").map(Number);
    const cParts = current.split(".").map(Number);
    for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
      const r = rParts[i] || 0;
      const c = cParts[i] || 0;
      if (r > c) return true;
      if (r < c) return false;
    }
    return false;
  }
}

export const updateManager = new UpdateManager();
