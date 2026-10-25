import { telemetryBroker, type WorkerDomainTelemetry } from "./TelemetryEventBroker.js";

/**
 * WorkerSseStreamConsumer:
 * Inverted Telemetry Ingestion Consumer for Worker Daemon (:4000).
 * Connects to `GET http://127.0.0.1:${port}/api/worker/telemetry/stream`
 * and consumes continuous Server-Sent Events.
 *
 * Implements exponential backoff auto-reconnect (1s -> 2s -> 5s -> 10s)
 * and feeds render FPS, frame progress, and active job into TelemetryEventBroker.
 */
export class WorkerSseStreamConsumer {
  private isRunning = false;
  private abortController: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelayMs = 1000;
  private readonly maxRetryDelayMs = 10000;

  constructor(
    private readonly host: string = "127.0.0.1",
    private readonly port: number = 4000
  ) {}

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
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async connectAndStream(): Promise<void> {
    if (!this.isRunning) return;

    this.abortController = new AbortController();
    const url = `http://${this.host}:${this.port}/api/worker/telemetry/stream`;

    try {
      const response = await fetch(url, {
        signal: this.abortController.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (!response.ok || !response.body) {
        throw new Error(`Worker stream endpoint returned HTTP ${response.status}`);
      }

      // Reset backoff on successful connection
      this.retryDelayMs = 1000;
      telemetryBroker.updateServiceMetrics("worker", { status: "RUNNING" });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (this.isRunning) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const jsonStr = trimmed.slice(5).trim();
            try {
              const payload = JSON.parse(jsonStr);
              this.handleWorkerTelemetry(payload);
            } catch {}
          }
        }
      }

      if (this.isRunning) {
        this.scheduleReconnect();
      }
    } catch (err: any) {
      if (this.isRunning && err.name !== "AbortError") {
        telemetryBroker.updateServiceMetrics("worker", { status: "STARTING" });
        this.scheduleReconnect();
      }
    }
  }

  private handleWorkerTelemetry(payload: any): void {
    const workerDomain: WorkerDomainTelemetry = {
      type: "worker",
      activeJobId: payload.activeJobId,
      currentFrame: payload.currentFrame || 0,
      totalFrames: payload.totalFrames || 0,
      renderFps: payload.renderFps || 0,
      vramUsedMb: payload.vramUsedMb,
    };

    telemetryBroker.recordDomainTelemetry("worker", workerDomain);
    telemetryBroker.updateServiceMetrics("worker", {
      status: payload.status === "rendering" ? "BUSY" : "RUNNING",
    });
  }

  private scheduleReconnect(): void {
    if (!this.isRunning || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectAndStream();
    }, this.retryDelayMs);

    this.retryDelayMs = Math.min(this.retryDelayMs * 2, this.maxRetryDelayMs);
  }
}
