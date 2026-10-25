import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export class CircularLogBuffer {
  private lines: string[] = [];
  private maxLines: number;

  constructor(maxLines = 10000) {
    this.maxLines = maxLines;
  }

  public push(line: string): void {
    if (this.lines.length >= this.maxLines) {
      this.lines.shift();
    }
    this.lines.push(line);
  }

  public getLines(filter = "", limit = 1000): string[] {
    const subset = filter
      ? this.lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
      : this.lines;

    return subset.slice(-limit);
  }

  public clear(): void {
    this.lines = [];
  }

  public size(): number {
    return this.lines.length;
  }
}

export class LogManager {
  private buffers: Map<string, CircularLogBuffer> = new Map();
  private baseLogDir: string;
  private maxFileSizeBytes: number;
  private maxBackups: number;

  constructor(options?: { baseDir?: string; maxFileSizeBytes?: number; maxBackups?: number }) {
    this.baseLogDir = options?.baseDir || path.join(os.homedir(), ".acc", "logs");
    this.maxFileSizeBytes = options?.maxFileSizeBytes || 10 * 1024 * 1024; // 10MB
    this.maxBackups = options?.maxBackups ?? 3;

    if (!fs.existsSync(this.baseLogDir)) {
      fs.mkdirSync(this.baseLogDir, { recursive: true });
    }
  }

  public getBuffer(serviceName: string): CircularLogBuffer {
    let buf = this.buffers.get(serviceName);
    if (!buf) {
      buf = new CircularLogBuffer();
      this.buffers.set(serviceName, buf);
    }
    return buf;
  }

  public log(serviceName: string, rawChunk: string): void {
    const buf = this.getBuffer(serviceName);
    const lines = rawChunk.split(/\r?\n/);

    const now = new Date().toISOString();
    for (const rawLine of lines) {
      if (!rawLine.trim()) continue;
      const formatted = `[${now}] [${serviceName}] ${rawLine}`;
      buf.push(formatted);
      this.appendToFile(serviceName, formatted + "\n");
    }
  }

  private appendToFile(serviceName: string, text: string): void {
    try {
      const filePath = path.join(this.baseLogDir, `${serviceName}.log`);

      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.size >= this.maxFileSizeBytes) {
          this.rotateFiles(serviceName);
        }
      }

      fs.appendFileSync(filePath, text, "utf-8");
    } catch (err) {
      console.warn(`[LogManager] Failed to append log for ${serviceName}:`, err);
    }
  }

  private rotateFiles(serviceName: string): void {
    const basePath = path.join(this.baseLogDir, `${serviceName}.log`);

    for (let i = this.maxBackups; i >= 1; i--) {
      const oldBackup = `${basePath}.${i}`;
      const nextBackup = `${basePath}.${i + 1}`;

      if (fs.existsSync(oldBackup)) {
        if (i === this.maxBackups) {
          fs.unlinkSync(oldBackup);
        } else {
          fs.renameSync(oldBackup, nextBackup);
        }
      }
    }

    if (fs.existsSync(basePath)) {
      fs.renameSync(basePath, `${basePath}.1`);
    }
  }

  public getLogFilePath(serviceName: string): string {
    return path.join(this.baseLogDir, `${serviceName}.log`);
  }
}

export const logManager = new LogManager();
