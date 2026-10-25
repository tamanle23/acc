import { type IProcessRunner, defaultProcessRunner } from "../platform/IProcessRunner.js";
import { telemetryBroker } from "./TelemetryEventBroker.js";

export interface ProcessResourceStats {
  pid: number;
  cpuPercent: number;
  memoryRssMb: number;
}

/**
 * OSProcessSampler:
 * High-performance non-intrusive sampling of OS process table metrics
 * for supervised sidecars using platform utilities via IProcessRunner.
 */
export class OSProcessSampler {
  private pids: Map<string, number> = new Map();
  private sampleInterval: ReturnType<typeof setInterval> | null = null;
  private isSampling = false;

  constructor(
    private readonly runner: IProcessRunner = defaultProcessRunner,
    private readonly intervalMs: number = 1000
  ) {}

  public registerPid(serviceName: string, pid: number | null): void {
    if (!pid || pid <= 0) {
      this.pids.delete(serviceName);
    } else {
      this.pids.set(serviceName, pid);
    }
  }

  public unregister(serviceName: string): void {
    this.pids.delete(serviceName);
  }

  public start(): void {
    if (this.sampleInterval) return;
    this.sampleInterval = setInterval(() => {
      this.sampleAll();
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
  }

  public async samplePid(pid: number): Promise<ProcessResourceStats | null> {
    if (!pid || pid <= 0) return null;

    try {
      const runner = this.runner as any;
      if (process.platform === "win32") {
        const cmd = [
          "powershell",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -Property Id, CPU, WorkingSet64 | ConvertTo-Json -Compress`,
        ];
        const res = typeof runner.execute === "function" ? await runner.execute(cmd) : await runner.exec(cmd);
        const isOk = res && (typeof res.isOk === "function" ? res.isOk() : res.ok === true);
        const val = res?.value;
        if (isOk && val && val.exitCode === 0 && val.stdout?.trim()) {
          const data = JSON.parse(val.stdout.trim());
          const rssMb = Math.round((data.WorkingSet64 || 0) / (1024 * 1024));
          const cpu = Math.round((data.CPU || 0) * 10) / 10;
          return { pid, cpuPercent: cpu, memoryRssMb: rssMb };
        }
      } else {
        const cmd = ["ps", "-o", "%cpu,rss", "-p", String(pid)];
        const res = typeof runner.execute === "function" ? await runner.execute(cmd) : await runner.exec(cmd);
        const isOk = res && (typeof res.isOk === "function" ? res.isOk() : res.ok === true);
        const val = res?.value;
        if (isOk && val && val.exitCode === 0) {
          const lines = val.stdout.trim().split("\n");
          if (lines.length >= 2) {
            const parts = lines[1].trim().split(/\s+/);
            const cpu = parseFloat(parts[0]) || 0;
            const rssKb = parseInt(parts[1], 10) || 0;
            return {
              pid,
              cpuPercent: Math.round(cpu * 10) / 10,
              memoryRssMb: Math.round(rssKb / 1024),
            };
          }
        }
      }
    } catch {
      // Non-fatal, process might have exited
    }

    return null;
  }

  public async sampleAll(): Promise<void> {
    if (this.isSampling || this.pids.size === 0) return;
    this.isSampling = true;

    try {
      const entries = Array.from(this.pids.entries());
      for (const [name, pid] of entries) {
        const stats = await this.samplePid(pid);
        if (stats) {
          telemetryBroker.updateServiceMetrics(name, {
            pid,
            cpuPercent: stats.cpuPercent,
            memoryRssMb: stats.memoryRssMb,
          });
        }
      }
    } finally {
      this.isSampling = false;
    }
  }
}

export const osProcessSampler = new OSProcessSampler();
