#!/usr/bin/env bun
import os from "node:os";
import { Logger, TaskWorkerFactory } from "@acc/core";
import { ITaskPoller, TaskPayload, TaskExecutionResult, SandboxTaskPoller } from "./poller/index.js";
import { BackendHypervisor, AIControlPlaneAdapter } from "./hypervisor/index.js";
import { StoryScriptTaskCommand, TtsSynthesizeTaskCommand, IrComposeTaskCommand } from "./tasks/index.js";
import { WorkerTelemetryServer } from "./telemetry/WorkerTelemetryServer.js";

// Migrated Supervisor Subsystems
import { configStore } from "./supervisor/configStore.js";
import { findAvailablePort } from "./supervisor/portScanner.js";
import { HardwareProfiler, type SystemProfile } from "./supervisor/HardwareProfiler.js";
import { supervisorEngine } from "./supervisor/SupervisorEngine.js";
import { telemetryBroker } from "./supervisor/telemetry/TelemetryEventBroker.js";
import { HttpServer } from "./supervisor/server/HttpServer.js";

export interface WorkerCliOptions {
  sandbox: boolean;
  pollIntervalMs: number;
  aiControlPlanePort: number;
  ollamaPort: number;
  telemetryPort: number;
  supervisorPort: number;
  enableSupervisor: boolean;
}

export function parseWorkerArgs(args: string[]): WorkerCliOptions {
  const options: WorkerCliOptions = {
    sandbox: true,
    pollIntervalMs: 3000,
    aiControlPlanePort: parseInt(process.env.AI_CONTROL_PLANE_PORT || process.env.AI_PORT || "50051", 10),
    ollamaPort: parseInt(process.env.OLLAMA_PORT || "11434", 10),
    telemetryPort: parseInt(process.env.WORKER_TELEMETRY_PORT || "4000", 10),
    supervisorPort: parseInt(process.env.SUPERVISOR_PORT || "3333", 10),
    enableSupervisor: !args.includes("--no-supervisor"),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--sandbox" || arg === "-s") {
      options.sandbox = true;
    } else if (arg === "--interval" || arg === "-i") {
      options.pollIntervalMs = parseInt(args[++i] || "3000", 10);
    } else if (arg === "--ai-port" || arg === "--ai-control-plane-port" || arg === "--python-port") {
      options.aiControlPlanePort = parseInt(args[++i] || "50051", 10);
    } else if (arg === "--ollama-port") {
      options.ollamaPort = parseInt(args[++i] || "11434", 10);
    } else if (arg === "--telemetry-port") {
      options.telemetryPort = parseInt(args[++i] || "4000", 10);
    } else if (arg === "--supervisor-port") {
      options.supervisorPort = parseInt(args[++i] || "3333", 10);
    }
  }

  return options;
}

export interface WorkerBootstrapResult {
  poller: ITaskPoller;
  hypervisor: BackendHypervisor;
  telemetryServer: WorkerTelemetryServer;
  httpServer?: HttpServer;
}

export async function bootstrapWorker(options: WorkerCliOptions): Promise<WorkerBootstrapResult> {
  Logger.info("ACC-Worker", "==================================================");
  Logger.info("ACC-Worker", "ACC Unified Supervisor & Task Worker Daemon v1.0.0");
  Logger.info("ACC-Worker", `Environment: AI_OFFLINE=${process.env.ACC_AI_OFFLINE || "0"}`);
  Logger.info("ACC-Worker", `Ports: Supervisor=${options.supervisorPort}, AIControlPlane=${options.aiControlPlanePort}, Telemetry=${options.telemetryPort}`);
  Logger.info("ACC-Worker", "==================================================");

  let activeProfile: SystemProfile | null = null;
  let httpServer: HttpServer | undefined;

  // 1. Initialize Supervisor Subsystems (Control Plane & Telemetry on Port 3333)
  if (options.enableSupervisor) {
    const config = configStore.loadConfig();
    config.aiControlPlanePort = options.aiControlPlanePort;

    try {
      const resolvedSupervisorPort = await findAvailablePort(options.supervisorPort);
      config.supervisorPort = resolvedSupervisorPort;
    } catch (err) {
      Logger.warn("ACC-Worker", `Failed to resolve free Supervisor port: ${err}`);
    }

    configStore.saveConfig(config);

    // Profile hardware
    try {
      activeProfile = await HardwareProfiler.getProfile(config.hardwareTierOverride);
      Logger.info("ACC-Worker", `Hardware Tier: ${activeProfile.activeTier.toUpperCase()} (${activeProfile.gpu?.name || "CPU"})`);

      telemetryBroker.updateSystemMetrics({
        hardwareTier: activeProfile.activeTier,
        cpuCount: activeProfile.cpu?.cores || os.cpus().length || 8,
        totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
        freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
      });
    } catch (err) {
      Logger.warn("ACC-Worker", `Hardware profiling error: ${err}`);
    }

    // Start Unified HTTP & SSE Control Plane Server on port 3333
    httpServer = new HttpServer({
      port: config.supervisorPort,
      getProfile: () => activeProfile,
    });
    httpServer.start();

    // Start Supervised Fleet (AI Control Plane + Studio)
    await supervisorEngine.startAll();
  }

  // 2. Legacy Worker Telemetry Server (Port 4000) for backward compatibility
  const telemetryServer = new WorkerTelemetryServer(options.telemetryPort);
  try {
    telemetryServer.start();
  } catch (err: any) {
    Logger.warn("ACC-Worker", `Failed to start Worker SSE telemetry server on ${options.telemetryPort}: ${err.message}`);
  }

  // 3. Initialize Backend Hypervisor & register adapters
  const hypervisor = new BackendHypervisor();
  hypervisor.registerAdapter(new AIControlPlaneAdapter(options.aiControlPlanePort));

  // 4. Register production Task Commands
  TaskWorkerFactory.register(new StoryScriptTaskCommand(hypervisor));
  TaskWorkerFactory.register(new TtsSynthesizeTaskCommand(hypervisor));
  TaskWorkerFactory.register(new IrComposeTaskCommand());

  Logger.info("ACC-Worker", `Registered TaskWorkerFactory tasks: [${TaskWorkerFactory.getAllRegisteredTaskNames().join(", ")}]`);

  // 5. Initialize Pluggable Poller (defaulting to SandboxTaskPoller)
  const poller: ITaskPoller = new SandboxTaskPoller({
    intervalMs: options.pollIntervalMs,
    autoGenerate: true,
  });

  // 6. Start polling dispatcher with in-process telemetry integration
  await poller.start(async (task: TaskPayload): Promise<TaskExecutionResult> => {
    Logger.info("ACC-Worker", `Processing task: ${task.taskId} (${task.taskDefName})`);
    try {
      const command = TaskWorkerFactory.getCommand(task.taskDefName);
      command.validate({
        taskId: task.taskId,
        workflowInstanceId: task.workflowInstanceId || "",
        taskDefName: task.taskDefName,
        inputData: task.inputData,
      });

      // Update both legacy telemetry server and unified TelemetryBroker
      telemetryServer.updateJobProgress({
        status: "rendering",
        activeJobId: task.taskId,
        renderFps: 24,
      });
      telemetryBroker.recordWorkerHeartbeat({
        activeJobId: task.taskId,
        renderFps: 24,
      });
      telemetryBroker.updateServiceMetrics("worker", { status: "BUSY" });

      const output = await command.execute({
        taskId: task.taskId,
        workflowInstanceId: task.workflowInstanceId || "",
        taskDefName: task.taskDefName,
        inputData: task.inputData,
      });

      Logger.info("ACC-Worker", `Task ${task.taskId} finished with status: ${output.status}`);
      telemetryServer.updateJobProgress({
        status: "idle",
        activeJobId: undefined,
        renderFps: 0,
      });
      telemetryBroker.recordWorkerHeartbeat({
        activeJobId: undefined,
        renderFps: 0,
      });
      telemetryBroker.updateServiceMetrics("worker", { status: "RUNNING" });

      return {
        status: output.status === "FAILED" ? "FAILED" : "COMPLETED",
        outputData: output.outputData,
        logs: output.logs,
        error: output.reasonForIncompletion,
      };
    } catch (err: any) {
      Logger.error("ACC-Worker", `Task ${task.taskId} failed execution: ${err.message}`);
      telemetryBroker.updateServiceMetrics("worker", { status: "RUNNING" });
      return {
        status: "FAILED",
        outputData: {},
        error: err.message,
        logs: [err.stack || err.message],
      };
    }
  });

  return { poller, hypervisor, telemetryServer, httpServer };
}

if (import.meta.main) {
  const options = parseWorkerArgs(process.argv.slice(2));
  bootstrapWorker(options)
    .then(({ poller, telemetryServer, httpServer }) => {
      let isShuttingDown = false;
      const shutdown = async () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        Logger.info("ACC-Worker", "Shutting down unified supervisor & worker daemon...");
        telemetryServer.stop();
        await supervisorEngine.stopAll();
        httpServer?.stop();
        await poller.stop();
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    })
    .catch((err) => {
      Logger.error("ACC-Worker", `Fatal worker startup error: ${err.message}`);
      process.exit(1);
    });
}
