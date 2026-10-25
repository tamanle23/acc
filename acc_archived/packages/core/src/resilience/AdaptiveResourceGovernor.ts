import os from 'os';
import { UniversalLogger as Logger } from '@acc/core-isomorphic';

export interface SystemResourceSnapshot {
  totalRamGB: number;
  freeRamGB: number;
  ramUsageRatio: number;
  cpuCount: number;
  isMemoryConstrained: boolean;
  throttleRecommended: boolean;
  recommendedConcurrency: number;
  allowNvencEncoding: boolean;
}

export interface ResourceGovernorOptions {
  minFreeRamGB?: number;
  highPressureThreshold?: number;
  memoryPerWorkerGB?: number;
}

/**
 * AdaptiveResourceGovernor:
 * Real-time hardware watchdog and adaptive governor for system memory and encoder sessions.
 * Continuously evaluates system pressure and yields throttling decisions to prevent
 * native heap crashes, OOM kills, and NVENC GPU session exhaustion.
 */
export class AdaptiveResourceGovernor {
  private static instance: AdaptiveResourceGovernor;
  private minFreeRamGB: number;
  private highPressureThreshold: number;
  private memoryPerWorkerGB: number;

  public constructor(options: ResourceGovernorOptions = {}) {
    this.minFreeRamGB = options.minFreeRamGB ?? 1.5; // Alert if free RAM drops below 1.5 GB
    this.highPressureThreshold = options.highPressureThreshold ?? 0.90; // Alert if RAM usage > 90%
    this.memoryPerWorkerGB = options.memoryPerWorkerGB ?? 1.2; // Approximate allocation per chunk worker
  }

  public static getInstance(): AdaptiveResourceGovernor {
    if (!AdaptiveResourceGovernor.instance) {
      AdaptiveResourceGovernor.instance = new AdaptiveResourceGovernor();
    }
    return AdaptiveResourceGovernor.instance;
  }

  /**
   * Captures current OS hardware state and evaluates memory bounds.
   */
  public probeSnapshot(): SystemResourceSnapshot {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const totalRamGB = parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(2));
    const freeRamGB = parseFloat((freeBytes / (1024 * 1024 * 1024)).toFixed(2));
    const ramUsageRatio = parseFloat(((totalBytes - freeBytes) / totalBytes).toFixed(2));
    const cpuCount = os.cpus().length || 4;

    const isMemoryConstrained = freeRamGB < this.minFreeRamGB || ramUsageRatio >= this.highPressureThreshold;
    const throttleRecommended = isMemoryConstrained || freeRamGB < 2.0;

    // Calculate maximum safe workers based on free RAM headroom
    const ramBoundWorkers = Math.max(1, Math.floor(freeRamGB / this.memoryPerWorkerGB));
    const recommendedConcurrency = isMemoryConstrained
      ? 1
      : Math.min(cpuCount, ramBoundWorkers);

    // Disable NVENC when system memory is heavily constrained to avoid CUDA driver allocation faults
    const allowNvencEncoding = !isMemoryConstrained && freeRamGB >= 1.0;

    return {
      totalRamGB,
      freeRamGB,
      ramUsageRatio,
      cpuCount,
      isMemoryConstrained,
      throttleRecommended,
      recommendedConcurrency,
      allowNvencEncoding,
    };
  }

  /**
   * Evaluates whether an incoming frame loop or worker task should pause for memory backpressure.
   */
  public async yieldForBackpressure(maxWaitMs = 5000): Promise<boolean> {
    const snapshot = this.probeSnapshot();
    if (!snapshot.throttleRecommended) {
      return false; // No delay needed
    }

    Logger.warn(
      'AdaptiveResourceGovernor',
      `[Backpressure Alert] Free RAM: ${snapshot.freeRamGB}GB (${(snapshot.ramUsageRatio * 100).toFixed(0)}% used). Throttling frame loop for gc...`
    );

    // Yield control to Node/Bun event loop and allow GC / buffer release
    const pauseMs = Math.min(maxWaitMs, 250);
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
    return true;
  }

  /**
   * Resolves safe concurrency given requested threads vs system capacity.
   */
  public resolveSafeConcurrency(requested?: number | 'auto'): number {
    const snapshot = this.probeSnapshot();
    const cpuCount = snapshot.cpuCount;

    let target = typeof requested === 'number'
      ? requested
      : (requested === 'auto' ? Math.min(4, cpuCount) : snapshot.recommendedConcurrency);

    if (target > snapshot.recommendedConcurrency) {
      Logger.warn(
        'AdaptiveResourceGovernor',
        `Adjusting concurrency from ${target} down to ${snapshot.recommendedConcurrency} to maintain RAM headroom (Free: ${snapshot.freeRamGB}GB)`
      );
      target = snapshot.recommendedConcurrency;
    }

    return Math.max(1, target);
  }
}
