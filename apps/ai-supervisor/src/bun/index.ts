import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { configStore } from "./configStore.js";
import { findAvailablePort } from "./portScanner.js";
import { HardwareProfiler, type SystemProfile } from "./HardwareProfiler.js";
import { supervisorEngine } from "./SupervisorEngine.js";
import { updateManager } from "./UpdateManager.js";
import { telemetryBroker } from "./telemetry/TelemetryEventBroker.js";
import { PythonGrpcStreamConsumer } from "./telemetry/PythonGrpcStreamConsumer.js";
import { WorkerSseStreamConsumer } from "./telemetry/WorkerSseStreamConsumer.js";
import { HttpServer } from "./server/HttpServer.js";
import { DesktopApplication } from "./desktop/DesktopApplication.js";

async function main(): Promise<void> {
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

  try {
    const resolvedStudioPort = await findAvailablePort(config.studioPort);
    if (resolvedStudioPort !== config.studioPort) {
      console.warn(`[Supervisor] Port ${config.studioPort} occupied. Binding Studio to ${resolvedStudioPort}`);
      config.studioPort = resolvedStudioPort;
    }
  } catch (err) {
    console.error("[Supervisor] Failed to resolve free Studio port:", err);
  }

  try {
    const resolvedSupervisorPort = await findAvailablePort(config.supervisorPort);
    if (resolvedSupervisorPort !== config.supervisorPort) {
      config.supervisorPort = resolvedSupervisorPort;
    }
  } catch (err) {
    console.error("[Supervisor] Failed to resolve free Supervisor port:", err);
  }

  configStore.saveConfig(config);

  // 4. Hardware Profiling & Telemetry Baseline
  let activeProfile: SystemProfile | null = null;
  try {
    activeProfile = await HardwareProfiler.getProfile(config.hardwareTierOverride);
    console.log(`[Supervisor] Hardware Tier: ${activeProfile.activeTier.toUpperCase()} (${activeProfile.gpu?.name || "CPU"})`);
    console.log(`[Supervisor] Recommended Python Device: ${activeProfile.recommendedPythonDevice}`);

    telemetryBroker.updateSystemMetrics({
      hardwareTier: activeProfile.activeTier,
      cpuCount: activeProfile.cpu?.cores || os.cpus().length || 8,
      totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
      freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
    });
  } catch (err) {
    console.error("[Supervisor] Hardware profiling error:", err);
  }

  // 5. Embedded HTTP & Telemetry Server
  const httpServer = new HttpServer({
    port: config.supervisorPort,
    getProfile: () => activeProfile,
  });
  const activePort = httpServer.start();
  const dashboardUrl = `http://127.0.0.1:${activePort}`;

  // 6. Graceful Process Teardown Handler
  let isShuttingDown = false;
  let pythonStreamConsumer: PythonGrpcStreamConsumer | null = null;
  let workerStreamConsumer: WorkerSseStreamConsumer | null = null;
  let desktopApp: DesktopApplication | null = null;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("\n[Supervisor] Shutting down all supervised services...");
    pythonStreamConsumer?.stop();
    workerStreamConsumer?.stop();
    desktopApp?.stop();
    await supervisorEngine.stopAll();
    httpServer.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // 7. Pure Electrobun Desktop Presentation Layer (Window + Tray)
  desktopApp = new DesktopApplication({
    supervisorEngine,
    updateManager,
    onQuit: shutdown,
  });
  desktopApp.start(dashboardUrl);

  // 8. Start Fleet & Inverted Telemetry Stream Consumers
  await supervisorEngine.startAll();

  pythonStreamConsumer = new PythonGrpcStreamConsumer("127.0.0.1", config.pythonPort);
  pythonStreamConsumer.start();

  workerStreamConsumer = new WorkerSseStreamConsumer("127.0.0.1", 4000);
  workerStreamConsumer.start();
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[Supervisor] Fatal error:", err);
    process.exit(1);
  });
}

export { main };
