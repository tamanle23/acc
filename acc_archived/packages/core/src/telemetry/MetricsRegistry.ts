import os from 'os';

export interface MetricGauge {
  name: string;
  help: string;
  value: number;
}

export interface MetricCounter {
  name: string;
  help: string;
  value: number;
}

export interface MetricHistogram {
  name: string;
  help: string;
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
}

/**
 * MetricsRegistry:
 * Prometheus-compatible metrics registry and collector for render performance,
 * memory RSS, and worker pool operations.
 */
export class MetricsRegistry {
  private static instance: MetricsRegistry;
  private gauges: Map<string, MetricGauge> = new Map();
  private counters: Map<string, MetricCounter> = new Map();
  private histograms: Map<string, MetricHistogram> = new Map();

  public constructor() {
    this.registerDefaults();
  }

  public static getInstance(): MetricsRegistry {
    if (!MetricsRegistry.instance) {
      MetricsRegistry.instance = new MetricsRegistry();
    }
    return MetricsRegistry.instance;
  }

  private registerDefaults(): void {
    this.setGauge('acc_render_frames_per_second', 'Current rendering throughput in frames per second', 0);
    this.setGauge('acc_memory_rss_bytes', 'Resident Set Size memory allocated by process', 0);
    this.setGauge('acc_vram_utilization_ratio', 'VRAM utilization ratio from 0.0 to 1.0', 0);
    this.setGauge('acc_worker_pool_active_count', 'Number of active worker chunk rendering tasks', 0);
    this.registerHistogram(
      'acc_render_frame_latency_ms',
      'Frame render latency in milliseconds',
      [2, 5, 10, 20, 50, 100, 250, 500]
    );
  }

  public setGauge(name: string, help: string, value: number): void {
    this.gauges.set(name, { name, help, value });
  }

  public getGauge(name: string): number {
    return this.gauges.get(name)?.value ?? 0;
  }

  public incrementCounter(name: string, help: string, delta = 1): void {
    const existing = this.counters.get(name) || { name, help, value: 0 };
    existing.value += delta;
    this.counters.set(name, existing);
  }

  public registerHistogram(name: string, help: string, buckets: number[]): void {
    this.histograms.set(name, {
      name,
      help,
      buckets: [...buckets].sort((a, b) => a - b),
      counts: new Array(buckets.length + 1).fill(0),
      sum: 0,
      count: 0,
    });
  }

  public observeHistogram(name: string, value: number): void {
    const hist = this.histograms.get(name);
    if (!hist) return;

    hist.sum += value;
    hist.count++;

    let placed = false;
    for (let i = 0; i < hist.buckets.length; i++) {
      if (value <= hist.buckets[i]) {
        hist.counts[i]++;
        placed = true;
        break;
      }
    }
    if (!placed) {
      hist.counts[hist.buckets.length]++;
    }
  }

  /**
   * Updates host and process system gauges.
   */
  public collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.setGauge('acc_memory_rss_bytes', 'Process Resident Set Size memory', memUsage.rss);
    this.setGauge(
      'acc_memory_heap_used_bytes',
      'V8 / Bun Heap Memory Used',
      memUsage.heapUsed
    );
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    this.setGauge(
      'acc_system_memory_used_ratio',
      'System memory usage ratio',
      parseFloat(((totalMem - freeMem) / totalMem).toFixed(3))
    );
  }

  /**
   * Renders the complete metrics catalog in standard Prometheus text format.
   */
  public toPrometheusText(): string {
    this.collectSystemMetrics();
    const lines: string[] = [];

    // Gauges
    for (const g of this.gauges.values()) {
      lines.push(`# HELP ${g.name} ${g.help}`);
      lines.push(`# TYPE ${g.name} gauge`);
      lines.push(`${g.name} ${g.value}`);
    }

    // Counters
    for (const c of this.counters.values()) {
      lines.push(`# HELP ${c.name} ${c.help}`);
      lines.push(`# TYPE ${c.name} counter`);
      lines.push(`${c.name} ${c.value}`);
    }

    // Histograms
    for (const h of this.histograms.values()) {
      lines.push(`# HELP ${h.name} ${h.help}`);
      lines.push(`# TYPE ${h.name} histogram`);
      let cumulative = 0;
      for (let i = 0; i < h.buckets.length; i++) {
        cumulative += h.counts[i];
        lines.push(`${h.name}_bucket{le="${h.buckets[i]}"} ${cumulative}`);
      }
      cumulative += h.counts[h.buckets.length];
      lines.push(`${h.name}_bucket{le="+Inf"} ${cumulative}`);
      lines.push(`${h.name}_sum ${h.sum.toFixed(2)}`);
      lines.push(`${h.name}_count ${h.count}`);
    }

    return lines.join('\n') + '\n';
  }
}
