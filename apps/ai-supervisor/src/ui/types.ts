export type ServiceStatus =
  | "STOPPED"
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

export interface HardwareProfile {
  readonly activeTier: string;
  readonly recommendedPythonDevice: "cuda" | "mps" | "cpu";
  readonly totalSystemRamBytes: number;
  readonly freeSystemRamBytes: number;
  readonly cpuCores: number;
  readonly gpu?: {
    readonly name: string;
    readonly vramBytes?: number;
    readonly driverVersion?: string;
  };
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
  ollamaPort: number;
  hardwareTierOverride?: string;
  autostart?: boolean;
}

export type TrayColor = "green" | "yellow" | "red";

export interface SupervisorStatusResponse {
  readonly services: ServiceMap;
  readonly hardwareProfile: HardwareProfile;
  readonly update: UpdateStatus;
  readonly config: SupervisorConfig;
  readonly autostart: boolean;
  readonly trayColor: TrayColor;
}

export interface LogLineResult {
  readonly logs: readonly string[];
}
