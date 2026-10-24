import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type IProcessRunner, defaultProcessRunner } from "./platform/IProcessRunner";

export type OllamaState = "ADOPTED" | "MANAGED" | "STOPPED" | "NOT_INSTALLED";

export interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
  modifiedAt?: string;
}

export interface OllamaRunningModel {
  name: string;
  size: number;
  sizeVram: number;
  expiresAt?: string;
}

export class OllamaManager {
  private basePort: number;

  constructor(
    basePort = 11434,
    private readonly runner: IProcessRunner = defaultProcessRunner
  ) {
    this.basePort = basePort;
  }

  public getBasePort(): number {
    return this.basePort;
  }

  public setBasePort(port: number): void {
    this.basePort = port;
  }

  public async findBinaryPath(): Promise<string | null> {
    if (process.platform === "win32") {
      const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
      const standardWinPath = path.join(localAppData, "Programs", "Ollama", "ollama.exe");
      if (fs.existsSync(standardWinPath)) {
        return standardWinPath;
      }
    }

    return await this.runner.which("ollama");
  }

  public async isAlive(port = this.basePort): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(1500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async listModels(port = this.basePort): Promise<OllamaModelInfo[]> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string; size: number; digest: string; modified_at?: string }> };
      return (data.models || []).map((m) => ({
        name: m.name,
        size: m.size,
        digest: m.digest,
        modifiedAt: m.modified_at,
      }));
    } catch {
      return [];
    }
  }

  public async getActiveModels(port = this.basePort): Promise<OllamaRunningModel[]> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/ps`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string; size: number; size_vram: number; expires_at?: string }> };
      return (data.models || []).map((m) => ({
        name: m.name,
        size: m.size,
        sizeVram: m.size_vram,
        expiresAt: m.expires_at,
      }));
    } catch {
      return [];
    }
  }

  public async unloadModel(modelName: string, port = this.basePort): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          keep_alive: 0,
        }),
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch (err) {
      console.warn(`[OllamaManager] Failed to unload model ${modelName}:`, err);
      return false;
    }
  }

  public async unloadAllModels(port = this.basePort): Promise<boolean> {
    const active = await this.getActiveModels(port);
    let success = true;
    for (const m of active) {
      const res = await this.unloadModel(m.name, port);
      if (!res) success = false;
    }
    return success;
  }

  public async pullModel(
    modelName: string,
    port = this.basePort,
    onProgress?: (status: string, completed: number, total: number) => void
  ): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!res.ok || !res.body) return false;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (onProgress) {
              onProgress(parsed.status || "", parsed.completed || 0, parsed.total || 0);
            }
          } catch {
            // chunk boundary
          }
        }
      }

      return true;
    } catch (err) {
      console.warn(`[OllamaManager] Failed to pull model ${modelName}:`, err);
      return false;
    }
  }
}

export const ollamaManager = new OllamaManager();
