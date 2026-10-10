import { Logger } from "@acc/core";
import { Server } from 'bun';

export interface IngestedEvent {
  sourceType: 'webhook' | 'rss' | 'url' | 'manual';
  rawText: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
  receivedAt: string;
}

export type EventHandler = (event: IngestedEvent) => Promise<void> | void;

export class ScraperEngine {
  private server: Server<any> | null = null;
  private listeners: EventHandler[] = [];

  public onEvent(handler: EventHandler) {
    this.listeners.push(handler);
  }

  public async ingestManual(text: string, metadata?: Record<string, unknown>): Promise<IngestedEvent> {
    const event: IngestedEvent = {
      sourceType: 'manual',
      rawText: text,
      metadata,
      receivedAt: new Date().toISOString(),
    };
    await this.notifyListeners(event);
    return event;
  }

  public async fetchUrl(url: string): Promise<IngestedEvent> {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'ACC-ScraperEngine/3.0' } });
      const htmlOrText = await response.text();
      
      // Simple tag stripper to extract body content
      const cleaned = htmlOrText
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const event: IngestedEvent = {
        sourceType: 'url',
        sourceUrl: url,
        rawText: cleaned.slice(0, 8000), // Bounded slice
        receivedAt: new Date().toISOString(),
      };
      await this.notifyListeners(event);
      return event;
    } catch (err: any) {
      throw new Error(`Failed to fetch URL ${url}: ${err.message}`);
    }
  }

  public startWebhookServer(port = 3001, path = '/webhook'): Server<any> {
    if (this.server) {
      return this.server;
    }

    const self = this;
    this.server = Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url);

        // K8s Liveness Probe
        if (url.pathname === '/healthz/liveness') {
          return new Response(JSON.stringify({ status: 'UP', uptimeSec: process.uptime() }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          });
        }

        // K8s Readiness Probe
        if (url.pathname === '/healthz/readiness') {
          const { AdaptiveResourceGovernor } = await import('@acc/core');
          const snapshot = AdaptiveResourceGovernor.getInstance().probeSnapshot();
          const isReady = !snapshot.isMemoryConstrained;
          return new Response(JSON.stringify({ status: isReady ? 'READY' : 'DEGRADED', snapshot }), {
            headers: { 'Content-Type': 'application/json' },
            status: isReady ? 200 : 503,
          });
        }

        // Prometheus Metrics Scrape Endpoint
        if (url.pathname === '/metrics') {
          const { MetricsRegistry } = await import('@acc/core');
          const prometheusText = MetricsRegistry.getInstance().toPrometheusText();
          return new Response(prometheusText, {
            headers: { 'Content-Type': 'text/plain; version=0.0.4' },
            status: 200,
          });
        }

        if (req.method === 'POST' && url.pathname === path) {
          try {
            const body = await req.json();
            const rawText = body.content || body.text || body.message || JSON.stringify(body);
            const event: IngestedEvent = {
              sourceType: 'webhook',
              rawText,
              metadata: body,
              receivedAt: new Date().toISOString(),
            };
            // Asynchronously process event through listeners
            self.notifyListeners(event).catch((err) => Logger.error('ScraperEngine', 'Listener notify error:', err));

            return new Response(JSON.stringify({ status: 'ACK', receivedAt: event.receivedAt }), {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            });
          } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message }), { status: 400 });
          }
        }
        return new Response('Not Found', { status: 404 });
      },
    });

    return this.server;
  }

  public stopWebhookServer() {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }

  private async notifyListeners(event: IngestedEvent) {
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (err) {
        Logger.error('ScraperEngine', 'Listener error:', err);
      }
    }
  }
}
