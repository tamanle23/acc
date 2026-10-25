import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface ControlPlaneConfig {
  studioPort: number;
  supervisorPort: number;
  pythonPort: number;
  autostart: boolean;
  hardwareTierOverride?: string;
}

const DEFAULT_CONFIG: ControlPlaneConfig = {
  studioPort: 3300,
  supervisorPort: 3333,
  pythonPort: 50051,
  autostart: false,
};

export class ConfigStore {
  private configPath: string;

  constructor() {
    const accDir = path.join(os.homedir(), ".acc");
    this.configPath = path.join(accDir, "supervisor-config.json");
  }

  public loadConfig(): ControlPlaneConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (err) {
      console.warn("[ConfigStore] Failed to parse config, falling back to defaults:", err);
    }
    return { ...DEFAULT_CONFIG };
  }

  public saveConfig(config: Partial<ControlPlaneConfig>): ControlPlaneConfig {
    const current = this.loadConfig();
    const updated: ControlPlaneConfig = { ...current, ...config };

    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), "utf-8");
    } catch (err) {
      console.error("[ConfigStore] Failed to write config:", err);
    }

    return updated;
  }
}

export const configStore = new ConfigStore();
