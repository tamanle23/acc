import { Logger } from '@acc/core';

export interface WorkerTelemetryPayload {
  timestamp: number;
  service: string;
  status: 'idle' | 'rendering' | 'error';
  renderFps: number;
  currentFrame: number;
  totalFrames: number;
  activeJobId?: string;
  uptimeSeconds: number;
}

export class WorkerTelemetryServer {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private subscribers: Set<ReadableStreamDefaultController> = new Set();
  private startTime = Date.now();
  private currentPayload: WorkerTelemetryPayload = {
    timestamp: Date.now(),
    service: 'worker',
    status: 'idle',
    renderFps: 0,
    currentFrame: 0,
    totalFrames: 0,
    uptimeSeconds: 0,
  };
  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private port: number = 4000) {}

  public start(): void {
    const port = this.port;

    this.server = Bun.serve({
      port,
      fetch: (req) => {
        const url = new URL(req.url);

        if (url.pathname === '/api/worker/telemetry/stream') {
          return this.handleStreamRequest();
        }

        if (url.pathname === '/healthz' || url.pathname === '/health') {
          return new Response(JSON.stringify({ status: 'ok', uptime: Math.floor((Date.now() - this.startTime) / 1000) }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response('Not Found', { status: 404 });
      },
    });

    Logger.info('WorkerTelemetryServer', `Worker SSE telemetry server listening on port ${port} at /api/worker/telemetry/stream`);

    // Emit heartbeats every 1000ms
    this.intervalTimer = setInterval(() => {
      this.currentPayload.timestamp = Date.now();
      this.currentPayload.uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      this.broadcast('telemetry', this.currentPayload);
    }, 1000);
  }

  public updateJobProgress(payload: Partial<WorkerTelemetryPayload>): void {
    this.currentPayload = {
      ...this.currentPayload,
      ...payload,
      timestamp: Date.now(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
    this.broadcast('telemetry', this.currentPayload);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    for (const controller of this.subscribers) {
      try {
        controller.close();
      } catch {}
    }
    this.subscribers.clear();
    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }
  }

  private handleStreamRequest(): Response {
    let clientController: ReadableStreamDefaultController | null = null;

    const stream = new ReadableStream({
      start: (controller) => {
        clientController = controller;
        this.subscribers.add(controller);

        // Immediate snapshot upon connection
        const data = `event: telemetry\ndata: ${JSON.stringify(this.currentPayload)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      },
      cancel: () => {
        if (clientController) {
          this.subscribers.delete(clientController);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  private broadcast(event: string, data: unknown): void {
    if (this.subscribers.size === 0) return;
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoded = new TextEncoder().encode(message);

    for (const controller of this.subscribers) {
      try {
        controller.enqueue(encoded);
      } catch {
        this.subscribers.delete(controller);
      }
    }
  }
}
