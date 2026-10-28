/**
 * MemoryLeakDetector:
 * High-precision mathematical memory drift and leak detection engine.
 * Calculates linear regression slope (\u03b2 = \u0394M / \u0394t) across consecutive execution iterations
 * to differentiate between normal fluctuating garbage collector sawtooth patterns
 * and true monotonic heap/resource accumulation.
 */

export interface MemorySnapshot {
  iteration: number;
  timestamp: number;
  bytes: number;
  activeHandles?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryLeakReport {
  isLeaking: boolean;
  slopeBytesPerIteration: number;
  baselineBytes: number;
  peakBytes: number;
  finalBytes: number;
  totalIterations: number;
  correlationCoefficient: number;
}

export interface MemoryLeakOptions {
  /** Maximum acceptable growth slope in bytes per iteration (default: 512 bytes/iter) */
  maxAllowedSlopeBytesPerIter?: number;
  /** Minimum Pearson correlation coefficient (r) indicating strong linear drift (default: 0.7) */
  minCorrelationThreshold?: number;
}

export class MemoryLeakDetector {
  private snapshots: MemorySnapshot[] = [];
  private readonly maxAllowedSlope: number;
  private readonly minCorrelation: number;

  constructor(options: MemoryLeakOptions = {}) {
    this.maxAllowedSlope = options.maxAllowedSlopeBytesPerIter ?? 512;
    this.minCorrelation = options.minCorrelationThreshold ?? 0.7;
  }

  /**
   * Records a memory measurement milestone.
   */
  public record(iteration: number, bytes: number, activeHandles?: number, metadata?: Record<string, unknown>): void {
    this.snapshots.push({
      iteration,
      timestamp: performance.now(),
      bytes,
      activeHandles,
      metadata,
    });
  }

  /**
   * Resets recorded snapshots for a new scenario run.
   */
  public reset(): void {
    this.snapshots = [];
  }

  public getSnapshots(): readonly MemorySnapshot[] {
    return this.snapshots;
  }

  /**
   * Computes linear regression slope (\u03b2) and Pearson correlation coefficient (r).
   *
   * \u03b2 = [n \u2211(xy) - (\u2211x)(\u2211y)] / [n \u2211(x\u00b2) - (\u2211x)\u00b2]
   * r = [n \u2211(xy) - (\u2211x)(\u2211y)] / sqrt([n \u2211(x\u00b2) - (\u2211x)\u00b2] * [n \u2211(y\u00b2) - (\u2211y)\u00b2])
   */
  public evaluate(): MemoryLeakReport {
    const n = this.snapshots.length;
    if (n < 3) {
      return {
        isLeaking: false,
        slopeBytesPerIteration: 0,
        baselineBytes: this.snapshots[0]?.bytes ?? 0,
        peakBytes: this.snapshots[0]?.bytes ?? 0,
        finalBytes: this.snapshots[n - 1]?.bytes ?? 0,
        totalIterations: n,
        correlationCoefficient: 0,
      };
    }

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    let sumYY = 0;
    let peakBytes = 0;

    for (let i = 0; i < n; i++) {
      const snap = this.snapshots[i]!;
      const x = snap.iteration;
      const y = snap.bytes;

      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
      sumYY += y * y;

      if (y > peakBytes) peakBytes = y;
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominatorX = n * sumXX - sumX * sumX;
    const denominatorY = n * sumYY - sumY * sumY;

    const slope = denominatorX !== 0 ? numerator / denominatorX : 0;
    const denomSqrt = Math.sqrt(Math.max(0, denominatorX * denominatorY));
    const r = denomSqrt > 0 ? numerator / denomSqrt : 0;

    const baselineBytes = this.snapshots[0]!.bytes;
    const finalBytes = this.snapshots[n - 1]!.bytes;

    // A true leak has BOTH an unacceptable slope AND strong linear correlation (r >= threshold)
    const isLeaking = slope > this.maxAllowedSlope && r >= this.minCorrelation;

    return {
      isLeaking,
      slopeBytesPerIteration: slope,
      baselineBytes,
      peakBytes,
      finalBytes,
      totalIterations: n,
      correlationCoefficient: r,
    };
  }

  /**
   * Asserts that no monotonic leak occurred. Throws an error if leak criteria are met.
   */
  public assertNoLeak(label = 'MemoryLeakDetector'): MemoryLeakReport {
    const report = this.evaluate();
    if (report.isLeaking) {
      throw new Error(
        `[${label}] Memory leak detected: growth slope was ${Math.round(report.slopeBytesPerIteration)} bytes/iter ` +
        `(threshold: ${this.maxAllowedSlope} bytes/iter, Pearson r: ${report.correlationCoefficient.toFixed(3)}, ` +
        `baseline: ${(report.baselineBytes / 1024).toFixed(1)} KB, final: ${(report.finalBytes / 1024).toFixed(1)} KB)`
      );
    }
    return report;
  }
}
