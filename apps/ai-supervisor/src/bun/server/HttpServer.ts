import type { Server } from "bun";
import type { SystemProfile } from "../HardwareProfiler.js";
import { CORS_HEADERS } from "./routes/types.js";
import { handleTelemetryRoutes } from "./routes/telemetryRoutes.js";
import { createServiceRoutes } from "./routes/serviceRoutes.js";
import { handleTtsRoutes } from "./routes/ttsRoutes.js";
import { handleStaticRoutes } from "./routes/staticRoutes.js";

export interface HttpServerOptions {
  port: number;
  getProfile: () => SystemProfile | null;
}

export class HttpServer {
  private server: Server<unknown> | null = null;
  private readonly port: number;
  private readonly handleServiceRoutes: ReturnType<typeof createServiceRoutes>;

  constructor(private readonly options: HttpServerOptions) {
    this.port = options.port;
    this.handleServiceRoutes = createServiceRoutes({
      getProfile: options.getProfile,
    });
  }

  public start(): number {
    if (this.server) {
      return this.server.port ?? this.port;
    }

    this.server = Bun.serve({
      port: this.port,
      fetch: async (req: Request) => {
        const url = new URL(req.url);

        if (req.method === "OPTIONS") {
          return new Response(null, { headers: CORS_HEADERS });
        }

        try {
          // 1. Real-time Telemetry & Ingestion Routes
          const telemetryResponse = await handleTelemetryRoutes(req, url);
          if (telemetryResponse) return telemetryResponse;

          // 2. Control Plane & Service Lifecycle Routes
          const serviceResponse = await this.handleServiceRoutes(req, url);
          if (serviceResponse) return serviceResponse;

          // 3. Neural TTS gRPC Playground Proxy
          const ttsResponse = await handleTtsRoutes(req, url);
          if (ttsResponse) return ttsResponse;

          // 4. Packaged Electrobun Views & Fallback Static Content
          const staticResponse = await handleStaticRoutes(req, url);
          if (staticResponse) return staticResponse;

          return new Response("Not Found", { status: 404 });
        } catch (err: any) {
          console.error("[HttpServer] Request handling error:", err);
          return Response.json(
            { error: "Internal Server Error", message: err?.message },
            { status: 500, headers: CORS_HEADERS }
          );
        }
      },
    });

    const activePort = this.server.port ?? this.port;
    console.log(`[HttpServer] Control Plane listening at http://127.0.0.1:${activePort}`);
    return activePort;
  }

  public stop(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }

  public getPort(): number {
    return this.server?.port ?? this.port;
  }
}
