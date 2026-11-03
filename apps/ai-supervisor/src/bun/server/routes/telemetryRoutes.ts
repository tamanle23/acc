import { telemetryBroker } from "../../telemetry/TelemetryEventBroker.js";
import { CORS_HEADERS, type RouteHandler } from "./types.js";

export const handleTelemetryRoutes: RouteHandler = async (req: Request, url: URL): Promise<Response | null> => {
  // 1. Unified Real-Time SSE Telemetry Stream
  if (url.pathname === "/api/telemetry/stream" && req.method === "GET") {
    return new Response(telemetryBroker.createEventStream(req.signal), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        ...CORS_HEADERS,
      },
    });
  }

  // 2. Telemetry Point-in-Time Snapshot
  if (url.pathname === "/api/telemetry/snapshot" && req.method === "GET") {
    return Response.json(telemetryBroker.getSnapshot(), { headers: CORS_HEADERS });
  }

  // 3. Worker Heartbeat Ingestion Endpoint
  if (url.pathname === "/api/worker/heartbeat" && req.method === "POST") {
    try {
      const body = await req.json();
      telemetryBroker.recordWorkerHeartbeat(body);
      return Response.json({ success: true }, { headers: CORS_HEADERS });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 400, headers: CORS_HEADERS });
    }
  }

  // 4. Real-Time Telemetry Ingest Sink (HTTP Fallback / Active Sidecars)
  if (url.pathname === "/api/telemetry/ingest" && req.method === "POST") {
    try {
      const body = await req.json();
      if (body.service && body.domain) {
        telemetryBroker.recordDomainTelemetry(body.service, body.domain);
      }
      if (body.alert) {
        telemetryBroker.emitAlert(body.alert);
      }
      telemetryBroker.publishSnapshot();
      return Response.json({ success: true, timestamp: Date.now() }, { headers: CORS_HEADERS });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 400, headers: CORS_HEADERS });
    }
  }

  // 5. Audit Events History Endpoint
  if (url.pathname === "/api/telemetry/audits" && req.method === "GET") {
    return Response.json(telemetryBroker.getAuditEvents(), { headers: CORS_HEADERS });
  }

  return null;
};
