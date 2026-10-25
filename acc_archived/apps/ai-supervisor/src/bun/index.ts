import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { configStore } from "./configStore.js";
import { findAvailablePort } from "./portScanner.js";
import { HardwareProfiler } from "./HardwareProfiler.js";
import { logManager } from "./LogManager.js";
import { supervisorEngine, findRepoRoot } from "./SupervisorEngine.js";
import { updateManager } from "./UpdateManager.js";
import { setStartupEnabled, getStartupStatus } from "./StartupManager.js";
import { NativeTrayBridge } from "./NativeTrayBridge.js";
import { WindowHost } from "./WindowHost.js";
import { telemetryBroker } from "./telemetry/TelemetryEventBroker.js";
import { PythonGrpcStreamConsumer } from "./telemetry/PythonGrpcStreamConsumer.js";
import { WorkerSseStreamConsumer } from "./telemetry/WorkerSseStreamConsumer.js";

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

  telemetryBroker.updateSystemMetrics({
    hardwareTier: profile.activeTier,
    cpuCount: profile.cpu?.cores || os.cpus().length || 8,
    totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
    freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
  });

  // 5. Ensure Solid UI Build is Ready
  const distUiDir = path.join(import.meta.dir, "..", "..", "dist", "ui");
  const viewsDir = path.join(import.meta.dir, "..", "views");
  const fallbackHtmlFile = path.join(viewsDir, "index.html");

  const isDistUiMissing =
    !fs.existsSync(distUiDir) ||
    !fs.existsSync(path.join(distUiDir, "app.js")) ||
    !fs.existsSync(path.join(distUiDir, "index.html"));

  if (isDistUiMissing) {
    console.log("[Supervisor] SolidJS UI bundle not found in dist/ui. Auto-building via scripts/build-ui.ts...");
    try {
      const buildScriptPath = path.join(import.meta.dir, "..", "..", "scripts", "build-ui.ts");
      if (fs.existsSync(buildScriptPath)) {
        const buildProc = Bun.spawnSync(["bun", "run", buildScriptPath], {
          cwd: path.join(import.meta.dir, "..", ".."),
        });
        if (buildProc.exitCode === 0) {
          console.log("[Supervisor] SolidJS UI successfully built into dist/ui.");
        } else {
          console.warn("[Supervisor] Failed to auto-build SolidJS UI, falling back to legacy views/index.html");
        }
      }
    } catch (buildErr) {
      console.warn("[Supervisor] Auto-build attempt encountered error:", buildErr);
    }
  }

  // 6. Launch Embedded HTTP Server (REST + Server-Sent Events SSE)
  const server = Bun.serve({
    port: config.supervisorPort,
    async fetch(req) {
      const url = new URL(req.url);

      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      // ── REST API Endpoints ───────────────────────────────────────────────

      // 1. Unified Real-Time SSE Telemetry Stream
      if (url.pathname === "/api/telemetry/stream" && req.method === "GET") {
        return new Response(telemetryBroker.createEventStream(req.signal), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            ...corsHeaders,
          },
        });
      }

      // 2. Telemetry Point-in-Time Snapshot
      if (url.pathname === "/api/telemetry/snapshot" && req.method === "GET") {
        return Response.json(telemetryBroker.getSnapshot(), { headers: corsHeaders });
      }

      // 3. Worker Heartbeat Ingestion Endpoint
      if (url.pathname === "/api/worker/heartbeat" && req.method === "POST") {
        try {
          const body = await req.json();
          telemetryBroker.recordWorkerHeartbeat(body);
          return Response.json({ success: true }, { headers: corsHeaders });
        } catch (err: any) {
          return Response.json({ success: false, error: err.message }, { status: 400, headers: corsHeaders });
        }
      }

      // 3b. Real-Time Telemetry Ingest Sink (HTTP Fallback / Active Sidecars)
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
          return Response.json({ success: true, timestamp: Date.now() }, { headers: corsHeaders });
        } catch (err: any) {
          return Response.json({ success: false, error: err.message }, { status: 400, headers: corsHeaders });
        }
      }

      // 3c. Audit Events History Endpoint
      if (url.pathname === "/api/telemetry/audits" && req.method === "GET") {
        return Response.json(telemetryBroker.getAuditEvents(), { headers: corsHeaders });
      }

      // 3d. Interactive Neural TTS Playground Proxy Endpoint
      if (url.pathname === "/api/tts/test" && req.method === "POST") {
        try {
          const body = await req.json();
          const repoRoot = findRepoRoot(import.meta.dir);
          const protoPath = path.resolve(repoRoot, "packages/proto/proto/acc/v1/tts.proto");
          const protoLoader = await import("@grpc/proto-loader");
          const grpc = await import("@grpc/grpc-js");

          const packageDefinition = protoLoader.loadSync(protoPath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
            includeDirs: [path.resolve(repoRoot, "packages/proto/proto/acc/v1")],
          });
          const proto = grpc.loadPackageDefinition(packageDefinition) as any;
          const TTSService = proto.acc?.v1?.TTSService;

          if (!TTSService) {
            return Response.json({ success: false, error: "TTSService proto not found" }, { status: 500, headers: corsHeaders });
          }

          const client = new TTSService(`127.0.0.1:${config.pythonPort}`, grpc.credentials.createInsecure());
          const startTime = performance.now();

          const result = await new Promise<any>((resolve, reject) => {
            client.Synthesize(
              {
                text: body.text || "Hello from ACC AI-Supervisor Neural Speech Playground.",
                voice_id: body.voice_id || "af_heart",
                speed: Number(body.speed || 1.0),
                model_strategy: body.model_strategy || "kokoro",
              },
              (err: any, response: any) => {
                if (err) reject(err);
                else resolve(response);
              }
            );
          });

          const latencyMs = Math.round(performance.now() - startTime);
          const audioBase64 = Buffer.from(result.audio_data).toString("base64");
          const durationMs = Number(result.duration_ms) || 1000;
          const rtf = Number((latencyMs / durationMs).toFixed(3));

          return Response.json(
            {
              success: true,
              audioBase64,
              sampleRate: result.sample_rate || 24000,
              durationMs,
              latencyMs,
              rtf,
              modelStrategy: body.model_strategy || "kokoro",
            },
            { headers: corsHeaders }
          );
        } catch (err: any) {
          return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
        }
      }

      // 4. Supervisor Status & System Profile
      if (url.pathname === "/api/status") {
        const states = supervisorEngine.getAllStates();
        const autostart = await getStartupStatus();
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
          { headers: corsHeaders }
        );
      }

      // 5. Purge VRAM
      if (url.pathname === "/api/vram/purge" && req.method === "POST") {
        await supervisorEngine.purgeAllVram();
        return Response.json({ success: true, message: "VRAM purged" }, { headers: corsHeaders });
      }

      // 6. Service Lifecycle Control
      if (url.pathname.startsWith("/api/service/") && req.method === "POST") {
        const parts = url.pathname.split("/");
        const serviceName = parts[3];
        const action = parts[4]; // start, stop, restart
        const cfg = configStore.loadConfig();

        if (action === "stop") {
          await supervisorEngine.stopService(serviceName);
        } else if (action === "start") {
          if (serviceName === "python-backend") await supervisorEngine.startPythonBackend(cfg);
          else if (serviceName === "worker") await supervisorEngine.startWorker(cfg);
          else if (serviceName === "studio") await supervisorEngine.startStudio(cfg);
        } else if (action === "restart") {
          await supervisorEngine.stopService(serviceName);
          if (serviceName === "python-backend") await supervisorEngine.startPythonBackend(cfg);
          else if (serviceName === "worker") await supervisorEngine.startWorker(cfg);
          else if (serviceName === "studio") await supervisorEngine.startStudio(cfg);
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
          await setStartupEnabled(body.autostart);
        }
        return Response.json({ config: updated }, { headers: corsHeaders });
      }

      // Serve Frontend Views (SolidJS + Ark UI + Tailwind bundle from dist/ui)
      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
      const distFilePath = path.join(distUiDir, pathname.slice(1));

      if (fs.existsSync(distFilePath) && fs.statSync(distFilePath).isFile()) {
        const ext = path.extname(distFilePath);
        const mimeTypes: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".js": "application/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".ico": "image/x-icon",
          ".png": "image/png",
          ".json": "application/json",
        };
        const contentType = mimeTypes[ext] || "application/octet-stream";
        return new Response(Bun.file(distFilePath), {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
          },
        });
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        if (fs.existsSync(fallbackHtmlFile)) {
          return new Response(Bun.file(fallbackHtmlFile), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        return new Response("ACC Control Plane Dashboard UI loading...", { status: 200 });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`[Supervisor] Control Plane Dashboard: http://127.0.0.1:${server.port}`);

  // 7. Launch Native System Tray & Window Host
  const assetsDir = path.join(import.meta.dir, "..", "assets");
  const dashboardUrl = `http://127.0.0.1:${server.port}`;
  const windowHost = new WindowHost({ url: dashboardUrl });

  const trayBridge = new NativeTrayBridge({
    iconDir: assetsDir,
    initialColor: supervisorEngine.getTrayColor(),
    onOpenDashboard: () => {
      windowHost.open();
    },
    onPurgeVram: () => supervisorEngine.purgeAllVram(),
    onRestartAll: async () => {
      await supervisorEngine.stopAll();
      await supervisorEngine.startAll();
    },
    onCheckUpdate: () => updateManager.checkForUpdates(),
    onExit: () => shutdown(),
  });
  const trayStarted = await trayBridge.start();

  const isMinimized = process.argv.includes("--minimized");
  if (!isMinimized || !trayStarted) {
    await windowHost.open();
  }

  supervisorEngine.onStatusChange((_states, color) => {
    trayBridge.setIcon(color);
    trayBridge.setTooltip(`ACC Control Plane - ${color === "green" ? "Healthy" : color === "yellow" ? "Processing" : "Alert"}`);
  });

  // 8. Start Fleet & Inverted Telemetry Stream Consumers
  await supervisorEngine.startAll();

  const pythonStreamConsumer = new PythonGrpcStreamConsumer("127.0.0.1", config.pythonPort);
  pythonStreamConsumer.start();

  const workerStreamConsumer = new WorkerSseStreamConsumer("127.0.0.1", 4000);
  workerStreamConsumer.start();

  // 9. Graceful Process Teardown
  const shutdown = async () => {
    console.log("\n[Supervisor] Shutting down all supervised services...");
    pythonStreamConsumer.stop();
    workerStreamConsumer.stop();
    trayBridge.stop();
    windowHost.close();
    await supervisorEngine.stopAll();
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[Supervisor] Fatal error:", err);
    process.exit(1);
  });
}

export { main };
