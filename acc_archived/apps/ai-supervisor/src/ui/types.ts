export type ServiceStatus =
  | "STOPPED"
  | "PROVISIONING"
  | "STARTING"
  | "RUNNING"
  | "BUSY"
  | "UNHEALTHY"
  | "CRASH_LOOP"
  | "ADOPTED";

export interface ServiceState {
  readonly name: string;
  readonly status: ServiceStatus;
  readonly pid?: number;
  readonly port?: number;
  readonly uptimeSeconds: number;
  readonly restartCount: number;
  readonly lastError?: string;
}

export type ServiceMap = Record<string, ServiceState>;

export interface HardwareGpuInfo {
  readonly name: string;
  readonly totalVramBytes?: number;
  readonly freeVramBytes?: number;
  readonly isAppleSilicon?: boolean;
  readonly isIntegrated?: boolean;
  readonly vendor?: string;
  readonly metalSupport?: string;
  readonly driverVersion?: string;
}

export interface HardwareCpuInfo {
  readonly model: string;
  readonly cores: number;
  readonly speedMhz: number;
}

export interface HardwareProfile {
  readonly detectedTier: string;
  readonly activeTier: string;
  readonly recommendedPythonDevice: "cuda" | "mps" | "cpu";
  readonly totalSystemRamBytes: number;
  readonly freeSystemRamBytes: number;
  readonly cpuCores: number;
  readonly safeHeadroomBytes?: number;
  readonly gpu?: HardwareGpuInfo | null;
  readonly cpu?: HardwareCpuInfo;
}

export interface UpdateStatus {
  readonly currentVersion: string;
  readonly targetVersion?: string;
  readonly state: "IDLE" | "CHECKING" | "DOWNLOADING" | "APPLYING" | "READY" | "ERROR";
  readonly error?: string;
}

export interface SupervisorConfig {
  studioPort: number;
  supervisorPort: number;
  pythonPort: number;
  hardwareTierOverride?: string;
  autostart?: boolean;
}

export type TrayColor = "green" | "yellow" | "red";

export interface PythonBackendDomainTelemetry {
  readonly type: "python-backend";
  readonly vramUsedMb: number;
  readonly freeVramBytes: number;
  readonly totalVramBytes: number;
  readonly cachedModelCount: number;
  readonly activeModels: ReadonlyArray<{
    readonly name: string;
    readonly vramMb: number;
    readonly accessCount: number;
  }>;
}

export interface WorkerDomainTelemetry {
  readonly type: "worker";
  readonly activeJobId?: string;
  readonly currentFrame?: number;
  readonly totalFrames?: number;
  readonly renderFps?: number;
  readonly vramUsedMb?: number;
}

export type SidecarDomainTelemetry =
  | PythonBackendDomainTelemetry
  | WorkerDomainTelemetry;

export interface SidecarTelemetry {
  readonly name: string;
  readonly pid: number | null;
  readonly status: ServiceStatus;
  readonly cpuPercent: number;
  readonly memoryRssMb: number;
  readonly uptimeSeconds: number;
  readonly crashCount: number;
  readonly domain?: SidecarDomainTelemetry;
}

export interface SystemResourceMetrics {
  readonly cpuCount: number;
  readonly totalMemoryMb: number;
  readonly freeMemoryMb: number;
  readonly hardwareTier: string;
}

export interface FleetTelemetrySnapshot {
  readonly timestamp: number;
  readonly system: SystemResourceMetrics;
  readonly services: Record<string, SidecarTelemetry>;
}

export interface SupervisorStatusResponse {
  readonly services: ServiceMap;
  readonly hardwareProfile: HardwareProfile;
  readonly update: UpdateStatus;
  readonly config: SupervisorConfig;
  readonly autostart: boolean;
  readonly trayColor: TrayColor;
}

export interface AuditEventEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly service: string;
  readonly eventType: "MODEL_LOADED" | "MODEL_EVICTED" | "OOM_INTERCEPTED" | "HEARTBEAT" | "STATE_CHANGE";
  readonly message: string;
  readonly details?: Record<string, any>;
}

export interface TelemetryAlert {
  readonly id: string;
  readonly level: "warning" | "error" | "critical";
  readonly service: string;
  readonly message: string;
  readonly timestamp: number;
}

export type StreamConnectionStatus = "CONNECTING" | "CONNECTED" | "RECONNECTING" | "DISCONNECTED";
