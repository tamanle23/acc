import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type ServiceStatus =
  | "STOPPED"
  | "PROVISIONING"
  | "STARTING"
  | "RUNNING"
  | "BUSY"
  | "CRASH_LOOP"
  | "ADOPTED"
  | "NOT_INSTALLED";

export interface PythonBackendDomainTelemetry {
  type: "python-backend";
  vramUsedMb: number;
  freeVramBytes: number;
  totalVramBytes: number;
  cachedModelCount: number;
  activeModels: Array<{
    name: string;
    vramMb: number;
    accessCount: number;
  }>;
}

export interface WorkerDomainTelemetry {
  type: "worker";
  activeJobId?: string;
  currentFrame?: number;
  totalFrames?: number;
  renderFps?: number;
  vramUsedMb?: number;
}

export type SidecarDomainTelemetry =
  | PythonBackendDomainTelemetry
  | WorkerDomainTelemetry;

export interface SidecarTelemetry {
  name: string;
  pid: number | null;
  status: ServiceStatus;
  cpuPercent: number;
  memoryRssMb: number;
  uptimeSeconds: number;
  crashCount: number;
  domain?: SidecarDomainTelemetry;
}

export interface SystemResourceMetrics {
  cpuCount: number;
  totalMemoryMb: number;
  freeMemoryMb: number;
  hardwareTier: string;
}

export interface FleetTelemetrySnapshot {
  timestamp: number;
  system: SystemResourceMetrics;
  services: Record<string, SidecarTelemetry>;
}

export interface TelemetryAlert {
  id: string;
  level: "warning" | "error" | "critical";
  service: string;
  message: string;
  timestamp: number;
}

export interface AuditEventEntry {
  id: string;
  timestamp: number;
  service: string;
  eventType: "MODEL_LOADED" | "MODEL_EVICTED" | "OOM_INTERCEPTED" | "HEARTBEAT" | "STATE_CHANGE";
  message: string;
  details?: Record<string, any>;
}

/**
 * TelemetryEventBroker:
 * Enterprise In-Memory Event Bus & Ring Buffer managing real-time Fleet Telemetry.
 * Decoupled from transport, serving Server-Sent Events (SSE) and native subscribers.
 */
export class TelemetryEventBroker extends EventEmitter {
  private static instance: TelemetryEventBroker;
  private currentSnapshot: FleetTelemetrySnapshot;
  private historyRingBuffer: FleetTelemetrySnapshot[] = [];
  private readonly maxHistoryLength = 60; // 60 snapshots (1 minute @ 1Hz)
  private domainTelemetryMap: Map<string, SidecarDomainTelemetry> = new Map();
  private auditEventsRingBuffer: AuditEventEntry[] = [];
  private readonly maxAuditEvents = 200;
  private auditLogFilePath: string;

  constructor() {
    super();
    this.setMaxListeners(100);
    this.currentSnapshot = {
      timestamp: Date.now(),
      system: {
        cpuCount: 8,
        totalMemoryMb: 16384,
        freeMemoryMb: 8192,
        hardwareTier: "standard",
      },
      services: {},
    };

    const supervisorDir = path.join(os.homedir(), ".acc", "supervisor");
    try {
      if (!fs.existsSync(supervisorDir)) {
        fs.mkdirSync(supervisorDir, { recursive: true });
      }
    } catch {}
    this.auditLogFilePath = path.join(supervisorDir, "audit_events.jsonl");
  }

  public static getInstance(): TelemetryEventBroker {
    if (!TelemetryEventBroker.instance) {
      TelemetryEventBroker.instance = new TelemetryEventBroker();
    }
    return TelemetryEventBroker.instance;
  }

  public updateSystemMetrics(metrics: Partial<SystemResourceMetrics>): void {
    this.currentSnapshot.system = {
      ...this.currentSnapshot.system,
      ...metrics,
    };
  }

  public updateServiceMetrics(
    serviceName: string,
    telemetry: Partial<SidecarTelemetry>
  ): void {
    const existing = this.currentSnapshot.services[serviceName] || {
      name: serviceName,
      pid: null,
      status: "STOPPED",
      cpuPercent: 0,
      memoryRssMb: 0,
      uptimeSeconds: 0,
      crashCount: 0,
    };

    const domain = this.domainTelemetryMap.get(serviceName);

    this.currentSnapshot.services[serviceName] = {
      ...existing,
      ...telemetry,
      name: serviceName,
      domain: domain || telemetry.domain || existing.domain,
    };
  }

  public recordDomainTelemetry(
    serviceName: string,
    domainData: SidecarDomainTelemetry
  ): void {
    this.domainTelemetryMap.set(serviceName, domainData);
    if (this.currentSnapshot.services[serviceName]) {
      this.currentSnapshot.services[serviceName].domain = domainData;
    }
  }

  public recordWorkerHeartbeat(payload: {
    activeJobId?: string;
    currentFrame?: number;
    totalFrames?: number;
    renderFps?: number;
    vramUsedMb?: number;
    cpuPercent?: number;
    memoryRssMb?: number;
  }): void {
    const workerDomain: WorkerDomainTelemetry = {
      type: "worker",
      activeJobId: payload.activeJobId,
      currentFrame: payload.currentFrame,
      totalFrames: payload.totalFrames,
      renderFps: payload.renderFps,
      vramUsedMb: payload.vramUsedMb,
    };

    this.recordDomainTelemetry("worker", workerDomain);

    if (payload.cpuPercent !== undefined || payload.memoryRssMb !== undefined) {
      this.updateServiceMetrics("worker", {
        cpuPercent: payload.cpuPercent,
        memoryRssMb: payload.memoryRssMb,
      });
    }

    this.emit("worker-heartbeat", workerDomain);
  }

  public publishSnapshot(): FleetTelemetrySnapshot {
    this.currentSnapshot.timestamp = Date.now();
    const snapshotCopy: FleetTelemetrySnapshot = {
      timestamp: this.currentSnapshot.timestamp,
      system: { ...this.currentSnapshot.system },
      services: {},
    };

    for (const [k, v] of Object.entries(this.currentSnapshot.services)) {
      snapshotCopy.services[k] = { ...v };
    }

    this.historyRingBuffer.push(snapshotCopy);
    if (this.historyRingBuffer.length > this.maxHistoryLength) {
      this.historyRingBuffer.shift();
    }

    this.emit("telemetry", snapshotCopy);
    return snapshotCopy;
  }

  public getSnapshot(): FleetTelemetrySnapshot {
    return {
      timestamp: this.currentSnapshot.timestamp,
      system: { ...this.currentSnapshot.system },
      services: { ...this.currentSnapshot.services },
    };
  }

  public getHistory(): FleetTelemetrySnapshot[] {
    return [...this.historyRingBuffer];
  }

  public recordAuditEvent(entry: Omit<AuditEventEntry, "id">): AuditEventEntry {
    const fullEntry: AuditEventEntry = {
      ...entry,
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };

    // 1. Sliding in-memory ring buffer (last 200 items)
    this.auditEventsRingBuffer.push(fullEntry);
    if (this.auditEventsRingBuffer.length > this.maxAuditEvents) {
      this.auditEventsRingBuffer.shift();
    }

    // 2. Append-only JSONL file for forensic persistence
    try {
      fs.appendFileSync(this.auditLogFilePath, JSON.stringify(fullEntry) + "\n");
    } catch (err: any) {
      console.warn(`[TelemetryEventBroker] Failed to append to audit log: ${err.message}`);
    }

    this.emit("audit", fullEntry);
    return fullEntry;
  }

  public getAuditEvents(): AuditEventEntry[] {
    return [...this.auditEventsRingBuffer];
  }

  public emitAlert(alert: Omit<TelemetryAlert, "id" | "timestamp">): void {
    const fullAlert: TelemetryAlert = {
      ...alert,
      id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    this.emit("alert", fullAlert);
  }

  /**
   * Generates a standard WHATWG ReadableStream delivering text/event-stream chunks.
   * Handles client keep-alive pings and clean abort signal disposal.
   */
  public createEventStream(signal?: AbortSignal): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
    let telemetryHandler: ((snapshot: FleetTelemetrySnapshot) => void) | null = null;
    let alertHandler: ((alert: TelemetryAlert) => void) | null = null;

    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        // 1. Initial snapshot immediate flush
        const initial = this.getSnapshot();
        controller.enqueue(
          encoder.encode(`event: telemetry\ndata: ${JSON.stringify(initial)}\n\n`)
        );

        // Immediate audit events flush
        const initialAudits = this.getAuditEvents();
        if (initialAudits.length > 0) {
          controller.enqueue(
            encoder.encode(`event: audit_history\ndata: ${JSON.stringify(initialAudits)}\n\n`)
          );
        }

        // 2. Periodic keep-alive ping (every 15s)
        keepAliveTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            // Stream closed
          }
        }, 15000);

        // 3. Event listeners
        telemetryHandler = (snapshot) => {
          try {
            controller.enqueue(
              encoder.encode(`event: telemetry\ndata: ${JSON.stringify(snapshot)}\n\n`)
            );
          } catch {
            // Stream closed
          }
        };

        alertHandler = (alert) => {
          try {
            controller.enqueue(
              encoder.encode(`event: alert\ndata: ${JSON.stringify(alert)}\n\n`)
            );
          } catch {
            // Stream closed
          }
        };

        const auditHandler = (audit: AuditEventEntry) => {
          try {
            controller.enqueue(
              encoder.encode(`event: audit\ndata: ${JSON.stringify(audit)}\n\n`)
            );
          } catch {}
        };

        this.on("telemetry", telemetryHandler);
        this.on("alert", alertHandler);
        this.on("audit", auditHandler);

        // 4. Abort / Cancel handling
        if (signal) {
          signal.addEventListener("abort", () => {
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            if (telemetryHandler) this.off("telemetry", telemetryHandler);
            if (alertHandler) this.off("alert", alertHandler);
            this.off("audit", auditHandler);
            try {
              controller.close();
            } catch {}
          });
        }
      },
      cancel: () => {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        if (telemetryHandler) this.off("telemetry", telemetryHandler);
        if (alertHandler) this.off("alert", alertHandler);
      },
    });
  }
}

export const telemetryBroker = TelemetryEventBroker.getInstance();
