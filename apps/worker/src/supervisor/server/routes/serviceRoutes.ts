import { supervisorEngine } from "../../SupervisorEngine.js";
import { configStore } from "../../configStore.js";
import { updateManager } from "../../UpdateManager.js";
import { logManager } from "../../LogManager.js";
import { getStartupStatus, setStartupEnabled } from "../../StartupManager.js";
import type { SystemProfile } from "../../HardwareProfiler.js";
import { CORS_HEADERS, type RouteHandler } from "./types.js";

export interface ServiceRoutesOptions {
  getProfile: () => SystemProfile | null;
}

export function createServiceRoutes(options: ServiceRoutesOptions): RouteHandler {
  return async (req: Request, url: URL): Promise<Response | null> => {
    // 1. Supervisor Status & System Profile
    if (url.pathname === "/api/status" && req.method === "GET") {
      const states = supervisorEngine.getAllStates();
      const autostart = await getStartupStatus();
      const profile = options.getProfile();
      return Response.json(
        {
          profile,
          hardwareProfile: profile,
          services: states,
          trayColor: supervisorEngine.getTrayColor(),
          autostart,
          update: updateManager.getStatus(),
          config: configStore.loadConfig(),
        },
        { headers: CORS_HEADERS }
      );
    }

    // 2. Purge VRAM
    if (url.pathname === "/api/vram/purge" && req.method === "POST") {
      await supervisorEngine.purgeAllVram();
      return Response.json({ success: true, message: "VRAM purged" }, { headers: CORS_HEADERS });
    }

    // 3. Restart All Supervised Services
    if (url.pathname === "/api/service/all/restart" && req.method === "POST") {
      await supervisorEngine.stopAll();
      await supervisorEngine.startAll();
      return Response.json({ success: true }, { headers: CORS_HEADERS });
    }

    // 4. Individual Service Lifecycle Control
    if (url.pathname.startsWith("/api/service/") && req.method === "POST") {
      const parts = url.pathname.split("/");
      const serviceName = parts[3];
      const action = parts[4]; // start, stop, restart
      const cfg = configStore.loadConfig();

      if (action === "stop") {
        await supervisorEngine.stopService(serviceName);
      } else if (action === "start") {
        if (serviceName === "ai-control-plane") await supervisorEngine.startAIControlPlane(cfg);
        else if (serviceName === "worker") await supervisorEngine.startWorker(cfg);
        else if (serviceName === "studio") await supervisorEngine.startStudio(cfg);
      } else if (action === "restart") {
        await supervisorEngine.stopService(serviceName);
        if (serviceName === "ai-control-plane") await supervisorEngine.startAIControlPlane(cfg);
        else if (serviceName === "worker") await supervisorEngine.startWorker(cfg);
        else if (serviceName === "studio") await supervisorEngine.startStudio(cfg);
      }

      return Response.json({ success: true, service: serviceName, action }, { headers: CORS_HEADERS });
    }

    // 5. Service Logs
    if (url.pathname.startsWith("/api/logs/") && req.method === "GET") {
      const serviceName = url.pathname.replace("/api/logs/", "");
      const buf = logManager.getBuffer(serviceName);
      const filter = url.searchParams.get("filter") || "";
      const limit = Number(url.searchParams.get("limit") || 500);
      return Response.json({ logs: buf.getLines(filter, limit) }, { headers: CORS_HEADERS });
    }

    // 6. Update Management
    if (url.pathname === "/api/update/check" && req.method === "POST") {
      const available = await updateManager.checkForUpdates();
      return Response.json({ available, status: updateManager.getStatus() }, { headers: CORS_HEADERS });
    }

    if (url.pathname === "/api/update/simulate" && req.method === "POST") {
      updateManager.simulateUpdate("1.1.0");
      return Response.json({ status: updateManager.getStatus() }, { headers: CORS_HEADERS });
    }

    // 7. Config Management
    if (url.pathname === "/api/config" && req.method === "POST") {
      try {
        const body = await req.json();
        const updated = configStore.saveConfig(body);
        if (typeof body.autostart === "boolean") {
          await setStartupEnabled(body.autostart);
        }
        return Response.json({ config: updated }, { headers: CORS_HEADERS });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 400, headers: CORS_HEADERS });
      }
    }

    return null;
  };
}

