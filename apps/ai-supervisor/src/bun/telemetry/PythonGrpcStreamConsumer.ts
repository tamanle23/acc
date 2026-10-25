import fs from "node:fs";
import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { findRepoRoot } from "../SupervisorEngine.js";
import { isPortListening } from "../portScanner.js";
import { telemetryBroker, type PythonBackendDomainTelemetry, type SidecarTelemetry } from "./TelemetryEventBroker.js";

/**
 * PythonGrpcStreamConsumer:
 * Inverted Telemetry Ingestion Consumer.
 * Establishes a persistent client gRPC stream to Python AI Backend (:50051)
 * `rpc StreamTelemetry(TelemetryStreamRequest) returns (stream TelemetryEvent)`.
 *
 * Implements exponential backoff auto-reconnect (1s -> 2s -> 5s -> 10s)
 * and flags sidecar as RECONNECTING without crashing the Supervisor.
 */
export class PythonGrpcStreamConsumer {
  private client: any = null;
  private currentStream: any = null;
  private isRunning = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelayMs = 1000;
  private readonly maxRetryDelayMs = 10000;
  private readonly protoPath: string;

  constructor(
    private readonly host: string = "127.0.0.1",
    private readonly port: number = 50051
  ) {
    const root = findRepoRoot(import.meta.dir);
    this.protoPath = path.resolve(
      root,
      "packages/proto/proto/acc/v1/telemetry.proto"
    );
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.connectAndStream();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.currentStream) {
      try {
        this.currentStream.cancel();
      } catch {}
      this.currentStream = null;
    }
    if (this.client) {
      try {
        this.client.close();
      } catch {}
      this.client = null;
    }
  }

  private async connectAndStream(): Promise<void> {
    if (!this.isRunning) return;

    try {
      if (!fs.existsSync(this.protoPath)) {
        this.scheduleReconnect();
        return;
      }

      // Check if Python gRPC server is actually listening before firing stream
      const isListening = await isPortListening(this.port, this.host, 300);
      if (!isListening) {
        telemetryBroker.updateServiceMetrics("python-backend", { status: "STARTING" });
        this.scheduleReconnect();
        return;
      }

      const packageDefinition = protoLoader.loadSync(this.protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
      const TelemetryService = protoDescriptor.acc?.v1?.TelemetryService;

      if (!TelemetryService) {
        console.error("[PythonGrpcStreamConsumer] TelemetryService not found in loaded proto package.");
        this.scheduleReconnect();
        return;
      }

      const target = `${this.host}:${this.port}`;
      this.client = new TelemetryService(target, grpc.credentials.createInsecure());

      const stream = this.client.StreamTelemetry({
        client_id: "supervisor_control_plane",
        interval_ms: 1000,
      });

      this.currentStream = stream;

      stream.on("data", (event: any) => {
        // Reset backoff on receiving live data
        this.retryDelayMs = 1000;
        this.handleTelemetryEvent(event);
      });

      stream.on("error", (err: any) => {
        // 1 = CANCELLED
        if (err.code !== 1 && this.isRunning) {
          console.warn(`[PythonGrpcStreamConsumer] Stream error from ${target}: ${err.message || err}`);
          telemetryBroker.updateServiceMetrics("python-backend", {
            status: "STARTING",
          });
        }
        this.cleanupCurrentStream();
        this.scheduleReconnect();
      });

      stream.on("end", () => {
        if (this.isRunning) {
          console.warn(`[PythonGrpcStreamConsumer] Stream ended by ${target}.`);
          this.cleanupCurrentStream();
          this.scheduleReconnect();
        }
      });
    } catch (err: any) {
      console.warn(`[PythonGrpcStreamConsumer] Connection setup failed: ${err.message}`);
      this.scheduleReconnect();
    }
  }

  private handleTelemetryEvent(event: any): void {
    const timestamp = Number(event.timestamp_ms) || Date.now();
    const allocatedMb = Math.round(Number(event.vram_allocated_bytes || 0) / (1024 * 1024));
    const freeBytes = Number(event.vram_total_bytes || 0) - Number(event.vram_allocated_bytes || 0);

    const activeModels = (event.active_models || []).map((m: any) => ({
      name: String(m.name || "unknown"),
      vramMb: Math.round(Number(m.allocated_bytes || 0) / (1024 * 1024)),
      accessCount: Number(m.touch_count || 0),
      state: String(m.state || "READY"),
    }));

    const domain: PythonBackendDomainTelemetry = {
      type: "python-backend",
      vramUsedMb: allocatedMb,
      freeVramBytes: Math.max(0, freeBytes),
      totalVramBytes: Number(event.vram_total_bytes || 0),
      cachedModelCount: Number(event.active_cached_models || activeModels.length),
      activeModels,
    };

    telemetryBroker.recordDomainTelemetry("python-backend", domain);
    telemetryBroker.updateServiceMetrics("python-backend", {
      status: "RUNNING",
    });

    // Check for OOM Alert or lifecycle anomalies
    const eventTypeStr = String(event.event_type);
    if (eventTypeStr.includes("OOM") || eventTypeStr === "4" || eventTypeStr === "TELEMETRY_EVENT_TYPE_OOM_INTERCEPTED") {
      telemetryBroker.emitAlert({
        level: "critical",
        service: "python-backend",
        message: event.message || "OOM Circuit Breaker triggered on accelerator!",
      });

      telemetryBroker.recordAuditEvent({
        timestamp,
        service: "python-backend",
        eventType: "OOM_INTERCEPTED",
        message: event.message,
        details: { hardwareTier: event.hardware_tier, vramAllocatedMb: allocatedMb },
      });
    } else if (eventTypeStr.includes("MODEL") || eventTypeStr === "2" || eventTypeStr === "3") {
      telemetryBroker.recordAuditEvent({
        timestamp,
        service: "python-backend",
        eventType: eventTypeStr.includes("LOAD") ? "MODEL_LOADED" : "MODEL_EVICTED",
        message: event.message,
        details: { activeModelsCount: activeModels.length },
      });
    }
  }

  private scheduleReconnect(): void {
    if (!this.isRunning || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectAndStream();
    }, this.retryDelayMs);

    // Exponential backoff with clamp
    this.retryDelayMs = Math.min(this.retryDelayMs * 2, this.maxRetryDelayMs);
  }

  private cleanupCurrentStream(): void {
    if (this.currentStream) {
      try {
        this.currentStream.removeAllListeners();
      } catch {}
      this.currentStream = null;
    }
    if (this.client) {
      try {
        this.client.close();
      } catch {}
      this.client = null;
    }
  }
}
