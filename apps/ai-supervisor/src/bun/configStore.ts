import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type HardwareTierOption = "auto" | "tier1" | "tier2" | "tier3" | "tier4" | "tier5";

export interface ControlPlaneConfig {
  pythonPort: number;
  studioPort: number;
  ollamaPort: number;
  supervisorPort: number;
  conductorUrl: string;
  autostart: boolean;
  hardwareTierOverride: HardwareTierOption;
  ollamaModel: string;
  ollamaAutoUnload: boolean;
  updateChannel: "stable" | "beta";
}

export const DEFAULT_CONFIG: Readonly<ControlPlaneConfig> = {
  pythonPort: 50051,
  studioPort: 3300,
  ollamaPort: 11434,
  supervisorPort: 3333,
  conductorUrl: "http://localhost:8080",
  autostart: false,
  hardwareTierOverride: "auto",
  ollamaModel: "llama3.2:latest",
  ollamaAutoUnload: true,
  updateChannel: "stable",
};

export class ConfigStore {
  private configPath: string;
  private cachedConfig: ControlPlaneConfig | null = null;

  constructor(customPath?: string) {
    if (customPath) {
      this.configPath = customPath;
    } else {
      const accDir = path.join(os.homedir(), ".acc");
      if (!fs.existsSync(accDir)) {
        fs.mkdirSync(accDir, { recursive: true });
      }
      this.configPath = path.join(accDir, "control-plane.json");
    }
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public loadConfig(): ControlPlaneConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(raw);
        this.cachedConfig = { ...DEFAULT_CONFIG, ...parsed };
        return { ...this.cachedConfig };
      }
    } catch (err) {
      console.warn(`[ConfigStore] Failed to parse ${this.configPath}, falling back to defaults:`, err);
    }

    this.cachedConfig = { ...DEFAULT_CONFIG };
    this.saveConfig(this.cachedConfig);
    return { ...this.cachedConfig };
  }

  public saveConfig(partial: Partial<ControlPlaneConfig>): ControlPlaneConfig {
    const current = this.cachedConfig || this.loadConfig();
    const updated: ControlPlaneConfig = { ...current, ...partial };

    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), "utf-8");
    this.cachedConfig = updated;
    return { ...updated };
  }
}

export const configStore = new ConfigStore();
