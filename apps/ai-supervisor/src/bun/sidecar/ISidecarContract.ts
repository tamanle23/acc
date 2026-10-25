/**
 * Unified Sidecar Lifecycle & Telemetry Contract
 *
 * Defines the cross-stack interface between the Supervisor Control Plane
 * and all polyglot sidecar services (Python AI backend, Worker, Studio NLE).
 */

export type SidecarLifecycleState =
  | "STOPPED"
  | "PROVISIONING"
  | "STARTING"
  | "RUNNING"
  | "BUSY"
  | "CRASH_LOOP"
  | "ADOPTED"
  | "NOT_INSTALLED";

export interface SidecarHealthProbe {
  readonly status: SidecarLifecycleState;
  readonly uptimeSeconds: number;
  readonly lastHealthCheckTimestamp: number;
  readonly error?: string;
}

export interface ISidecarControlContract {
  /**
   * Health and readiness query.
   */
  checkHealth(): Promise<SidecarHealthProbe>;

  /**
   * Graceful termination signal handler.
   * Flushes active buffers, cancels pending requests, and releases ports/memory.
   */
  requestGracefulStop(timeoutMs?: number): Promise<boolean>;

  /**
   * Proactive memory eviction (e.g. VRAM empty_cache or GC).
   */
  purgeMemoryCache?(): Promise<{ freedBytes: number }>;
}

export interface ISidecarTelemetryContract<TDomain = unknown> {
  readonly serviceName: string;
  readonly pid: number | null;
  readonly port?: number;
  readonly cpuPercent: number;
  readonly memoryRssMb: number;
  readonly domain?: TDomain;
}
