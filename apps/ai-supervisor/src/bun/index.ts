import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { configStore } from "./configStore.js";
import { findAvailablePort } from "./portScanner.js";
import { HardwareProfiler } from "./HardwareProfiler.js";
import { logManager } from "./LogManager.js";
import { supervisorEngine } from "./SupervisorEngine.js";
import { ollamaManager } from "./OllamaManager.js";
import { updateManager } from "./UpdateManager.js";
import { setWindowsStartup, getWindowsStartupStatus } from "./windowsStartup.js";
import { NativeTrayBridge } from "./NativeTrayBridge.js";
import { spawn } from "bun";

async function main() {
  console.log("====================================================");
  console.log("       ACC AI-Supervisor Desktop Control Plane       ");
  console.log("====================================================");

  // 1. Initialize Global Directories
  const accDir = path.join(os.homedir(), ".acc");
  const logsDir = path.join(accDir, "logs");
  const updatesDir = path.join(accDir, "updates");
  for (const dir of [accDir, logsDir, updatesDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // 2. Boot Watchdog & Rollback Check
  updateManager.recordBootStart();
  setTimeout(() => {
    updateManager.markBootSuccessful();
  }, 10000);

  if (updateManager.shouldRollback()) {
    console.warn("[Supervisor] Detected repeated crash on boot! Rolling back from backup slot...");
    updateManager.rollbackFromBackup();
  }

  // 3. Load Config & Dynamic Port Collision Resolution
  const config = configStore.loadConfig();

  // Resolve Studio port if occupied
  try {
    const resolvedStudioPort = await findAvailablePort(config.studioPort);
    if (resolvedStudioPort !== config.studioPort) {
      console.warn(`[Supervisor] Port ${config.studioPort} occupied. Binding Studio to ${resolvedStudioPort}`);
      config.studioPort = resolvedStudioPort;
    }
  } catch (err) {
    console.error("[Supervisor] Failed to resolve free Studio port:", err);
  }

  // Resolve Supervisor Dashboard port if occupied
  try {
    const resolvedSupervisorPort = await findAvailablePort(config.supervisorPort);
    if (resolvedSupervisorPort !== config.supervisorPort) {
      config.supervisorPort = resolvedSupervisorPort;
    }
  } catch (err) {
    console.error("[Supervisor] Failed to resolve free Supervisor port:", err);
  }

  configStore.saveConfig(config);

  // 4. Hardware Profiling
  const profile = await HardwareProfiler.getProfile(config.hardwareTierOverride);
  console.log(`[Supervisor] Hardware Tier: ${profile.activeTier.toUpperCase()} (${profile.gpu?.name || "CPU"})`);
  console.log(`[Supervisor] Recommended Python Device: ${profile.recommendedPythonDevice}`);

  // 5. Start Embedded Control Plane Web Server
  const viewsDir = path.join(import.meta.dir, "..", "views");
  const htmlFile = path.join(viewsDir, "index.html");

  const server = Bun.serve({
    port: config.supervisorPort,
    async fetch(req) {
      const url = new URL(req.url);

      // CORS headers
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      // API Endpoints
      if (url.pathname === "/api/status") {
        const states = supervisorEngine.getAllStates();
        const curProfile = await HardwareProfiler.getProfile(configStore.loadConfig().hardwareTierOverride);
        const updateStatus = updateManager.getStatus();
        const autostart = await getWindowsStartupStatus();

        return Response.json(
          {
            services: states,
            hardwareProfile: curProfile,
            update: updateStatus,
            config: configStore.loadConfig(),
            autostart,
            trayColor: supervisorEngine.getTrayColor(),
          },
          { headers: corsHeaders }
        );
      }

      if (url.pathname === "/api/vram/purge" && req.method === "POST") {
        await supervisorEngine.purgeAllVram();
        return Response.json({ success: true, message: "VRAM purged" }, { headers: corsHeaders });
      }

      if (url.pathname.startsWith("/api/service/") && req.method === "POST") {
        const parts = url.pathname.split("/");
        const serviceName = parts[3];
        const action = parts[4]; // start | stop | restart

        if (action === "stop") {
          await supervisorEngine.stopService(serviceName);
        } else if (action === "start") {
          const cfg = configStore.loadConfig();
          if (serviceName === "python-backend") await supervisorEngine.startPythonBackend(cfg);
          else if (serviceName === "worker") await supervisorEngine.startWorker(cfg);
          else if (serviceName === "studio") await supervisorEngine.startStudio(cfg);
          else if (serviceName === "ollama") await supervisorEngine.startOllama(cfg);
        } else if (action === "restart") {
          await supervisorEngine.stopService(serviceName);
          const cfg = configStore.loadConfig();
          if (serviceName === "python-backend") await supervisorEngine.startPythonBackend(cfg);
          else if (serviceName === "worker") await supervisorEngine.startWorker(cfg);
          else if (serviceName === "studio") await supervisorEngine.startStudio(cfg);
          else if (serviceName === "ollama") await supervisorEngine.startOllama(cfg);
        }

        return Response.json({ success: true, service: serviceName, action }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/service/all/restart" && req.method === "POST") {
        await supervisorEngine.stopAll();
        await supervisorEngine.startAll();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (url.pathname.startsWith("/api/logs/")) {
        const serviceName = url.pathname.replace("/api/logs/", "");
        const buf = logManager.getBuffer(serviceName);
        const filter = url.searchParams.get("filter") || "";
        const limit = Number(url.searchParams.get("limit") || 500);
        return Response.json({ logs: buf.getLines(filter, limit) }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/ollama/models") {
        const models = await ollamaManager.listModels();
        const active = await ollamaManager.getActiveModels();
        return Response.json({ models, active }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/update/check" && req.method === "POST") {
        const available = await updateManager.checkForUpdates();
        return Response.json({ available, status: updateManager.getStatus() }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/update/simulate" && req.method === "POST") {
        updateManager.simulateUpdate("1.1.0");
        return Response.json({ status: updateManager.getStatus() }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/config" && req.method === "POST") {
        const body = await req.json();
        const updated = configStore.saveConfig(body);
        if (typeof body.autostart === "boolean") {
          await setWindowsStartup(body.autostart);
        }
        return Response.json({ config: updated }, { headers: corsHeaders });
      }

      // Serve Frontend Views
      if (url.pathname === "/" || url.pathname === "/index.html") {
        if (fs.existsSync(htmlFile)) {
          return new Response(fs.readFileSync(htmlFile), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        return new Response("ACC Control Plane Dashboard UI loading...", { status: 200 });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`[Supervisor] Control Plane Dashboard: http://127.0.0.1:${server.port}`);

  // 6. Launch Native Windows System Tray
  const assetsDir = path.join(import.meta.dir, "..", "assets");
  const trayBridge = new NativeTrayBridge({
    iconDir: assetsDir,
    initialColor: supervisorEngine.getTrayColor(),
    onOpenDashboard: () => {
      const url = `http://127.0.0.1:${server.port}`;
      if (process.platform === "win32") {
        spawn(["powershell", "-NoProfile", "-Command", "Start-Process", `"${url}"`]);
      } else {
        console.log(`[Supervisor] Dashboard URL: ${url}`);
      }
    },
    onPurgeVram: () => supervisorEngine.purgeAllVram(),
    onRestartAll: async () => {
      await supervisorEngine.stopAll();
      await supervisorEngine.startAll();
    },
    onCheckUpdate: () => updateManager.checkForUpdates(),
    onExit: () => shutdown(),
  });
  await trayBridge.start();

  supervisorEngine.onStatusChange((_states, color) => {
    trayBridge.setIcon(color);
    trayBridge.setTooltip(`ACC Control Plane - ${color === "green" ? "Healthy" : color === "yellow" ? "Processing" : "Alert"}`);
  });

  // 7. Start Fleet
  await supervisorEngine.startAll();

  // 8. Graceful Process Teardown
  const shutdown = async () => {
    console.log("\n[Supervisor] Shutting down all supervised services...");
    trayBridge.stop();
    await supervisorEngine.stopAll();
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Auto-run if main module
if (import.meta.main) {
  main().catch((err) => {
    console.error("[Supervisor] Fatal error:", err);
    process.exit(1);
  });
}

export { main };
