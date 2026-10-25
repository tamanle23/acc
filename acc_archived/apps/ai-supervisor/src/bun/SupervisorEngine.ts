import { logManager } from "./LogManager.js";
import { configStore, type ControlPlaneConfig } from "./configStore.js";
import { HardwareProfiler, type HardwareProfile } from "./HardwareProfiler.js";
import { runtimeManager, RuntimeManager } from "./RuntimeManager.js";
import { isPortListening, findPidByPort } from "./PortScanner.js";
import { type ManagedProcess, type IProcessRunner, defaultProcessRunner } from "./platform/IProcessRunner.js";
import { telemetryBroker } from "./telemetry/TelemetryEventBroker.js";
import { osProcessSampler } from "./telemetry/OSProcessSampler.js";
import { domainTelemetryPoller } from "./telemetry/DomainTelemetryPoller.js";
import path from "node:path";
import fs from "node:fs";

export function findRepoRoot(startDir = import.meta.dir): string {
  let curr = startDir;
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, "bun.lock")) || fs.existsSync(path.join(curr, ".git"))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return path.resolve(startDir, "..", "..", "..", "..");
}

export function findUvBinary(): string {
  return runtimeManager.getUvPath();
}

export type ServiceStatus =
  | "STOPPED"
  | "PROVISIONING"
  | "STARTING"
  | "RUNNING"
  | "BUSY"
  | "CRASH_LOOP"
  | "ADOPTED"
  | "NOT_INSTALLED";

export type TrayIconColor = "green" | "yellow" | "red";

export interface ServiceState {
  name: string;
  status: ServiceStatus;
  pid: number | null;
  port: number | null;
  crashCount: number;
  lastHealthCheck: number | null;
  uptimeSeconds: number;
  isExternal: boolean;
}

/**
 * SupervisorEngine:
 * Central process lifecycle orchestrator managing the consolidated 3-service fleet:
 * 1. python-backend (gRPC port 50051 - TTS & LLM)
 * 2. worker (CLI Video IR render workers)
 * 3. studio (Studio Vite UI port 3300)
 * Note: Ollama sidecar has been purged; LLM is unified into python-backend.
 */
export class SupervisorEngine {
  private services: Map<string, ServiceState> = new Map();
  private processes: Map<string, ManagedProcess> = new Map();
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private uptimeInterval: ReturnType<typeof setInterval> | null = null;
  private onStatusChangeCallbacks: Array<(states: Record<string, ServiceState>, trayColor: TrayIconColor) => void> = [];
  private currentTrayColor: TrayIconColor = "yellow";
  private intentionalStops: Set<string> = new Set();
  private hardwareProfile: HardwareProfile | null = null;
  private repoRoot: string;
  private runtimeManager: RuntimeManager;

  constructor(
    customRepoRoot?: string,
    customRuntimeManager?: RuntimeManager,
    private readonly runner: IProcessRunner = defaultProcessRunner
  ) {
    this.repoRoot = customRepoRoot || findRepoRoot();
    this.runtimeManager = customRuntimeManager || runtimeManager;
    // Consolidated 3-Service Fleet:
    this.initService("python-backend", 50051);
    this.initService("worker", null);
    this.initService("studio", 3300);
  }

  private initService(name: string, defaultPort: number | null): void {
    this.services.set(name, {
      name,
      status: "STOPPED",
      pid: null,
      port: defaultPort,
      crashCount: 0,
      lastHealthCheck: null,
      uptimeSeconds: 0,
      isExternal: false,
    });
  }

  public getServiceState(name: string): ServiceState | undefined {
    return this.services.get(name);
  }

  public getAllStates(): Record<string, ServiceState> {
    const res: Record<string, ServiceState> = {};
    for (const [k, v] of this.services.entries()) {
      res[k] = { ...v };
    }
    return res;
  }

  public getTrayColor(): TrayIconColor {
    return this.currentTrayColor;
  }

  public onStatusChange(callback: (states: Record<string, ServiceState>, trayColor: TrayIconColor) => void): () => void {
    this.onStatusChangeCallbacks.push(callback);
    callback(this.getAllStates(), this.currentTrayColor);
    return () => {
      this.onStatusChangeCallbacks = this.onStatusChangeCallbacks.filter((c) => c !== callback);
    };
  }

  private emitChange(): void {
    const states = this.getAllStates();
    this.updateTrayColor();
    for (const cb of this.onStatusChangeCallbacks) {
      try {
        cb(states, this.currentTrayColor);
      } catch (err) {
        console.error("[SupervisorEngine] Error in status callback:", err);
      }
    }

    // Sync to real-time TelemetryEventBroker
    for (const [name, state] of Object.entries(states)) {
      telemetryBroker.updateServiceMetrics(name, {
        pid: state.pid,
        status: state.status,
        uptimeSeconds: state.uptimeSeconds,
        crashCount: state.crashCount,
      });
      osProcessSampler.registerPid(name, state.pid);
    }
    telemetryBroker.publishSnapshot();
  }

  private updateTrayColor(): void {
    let hasCrashLoop = false;
    let hasDegraded = false;
    let allRunning = true;

    for (const s of this.services.values()) {
      if (s.status === "CRASH_LOOP") hasCrashLoop = true;
      if (s.status === "STARTING" || s.status === "PROVISIONING" || s.status === "BUSY") {
        hasDegraded = true;
      }
      if (s.status !== "RUNNING" && s.status !== "ADOPTED" && s.status !== "BUSY") {
        allRunning = false;
      }
    }

    if (hasCrashLoop) {
      this.currentTrayColor = "red";
    } else if (hasDegraded || !allRunning) {
      this.currentTrayColor = "yellow";
    } else {
      this.currentTrayColor = "green";
    }
  }

  public async startAll(): Promise<void> {
    const config = configStore.loadConfig();
    this.hardwareProfile = await HardwareProfiler.getProfile(config.hardwareTierOverride);

    // Update system metrics in TelemetryEventBroker
    telemetryBroker.updateSystemMetrics({
      hardwareTier: this.hardwareProfile.activeTier,
      cpuCount: this.hardwareProfile.cpu?.cores || 8,
    });

    // 1. Python backend start (TTS + LLM)
    await this.startPythonBackend(config);

    // 2. Worker start
    await this.startWorker(config);

    // 3. Studio start
    await this.startStudio(config);

    this.startHealthMonitoring();
    this.startUptimeTracking();
    osProcessSampler.start();
    domainTelemetryPoller.start();
  }

  public async startPythonBackend(config: ControlPlaneConfig): Promise<void> {
    const state = this.services.get("python-backend")!;
    state.port = config.pythonPort;
    this.intentionalStops.delete("python-backend");

    if (!this.runtimeManager.isReady()) {
      state.status = "PROVISIONING";
      this.emitChange();
      logManager.log("python-backend", "Provisioning Python virtual environment via uv...");
      const provSuccess = await this.runtimeManager.provision();
      if (!provSuccess) {
        state.status = "CRASH_LOOP";
        logManager.log("python-backend", "Failed to provision Python environment.");
        this.emitChange();
        return;
      }
    }

    const alive = await isPortListening(config.pythonPort);
    if (alive) {
      state.status = "ADOPTED";
      state.isExternal = true;
      state.pid = await findPidByPort(config.pythonPort, this.runner);
      logManager.log("python-backend", `Adopted running Python gRPC server on port ${config.pythonPort} (PID: ${state.pid ?? "unknown"})`);
      this.emitChange();
      return;
    }

    state.status = "STARTING";
    state.isExternal = false;
    this.emitChange();

    const uvBin = this.runtimeManager.getUvPath();
    const serverScript = path.join(this.repoRoot, "apps", "ai-supervisor", "python-backend", "src", "server.py");
    const device = this.hardwareProfile?.recommendedPythonDevice || "cpu";
    const deviceArg = device === "cpu" ? ["--device=cpu"] : [];

    logManager.log("python-backend", `Starting Python AI gRPC server on port ${config.pythonPort} (device: ${device})...`);

    try {
      const proc = this.runner.spawnManaged(
        [uvBin, "run", "python", serverScript, String(config.pythonPort), ...deviceArg],
        {
          cwd: path.join(this.repoRoot, "apps", "ai-supervisor", "python-backend"),
          env: {
            ...process.env,
            ACC_GRPC_PORT: String(config.pythonPort),
            ACC_PARENT_PID: String(process.pid),
            PYTHONUNBUFFERED: "1",
          },
          stdout: "pipe",
          stderr: "pipe",
          onStdout: (text) => this.handleLogOutput("python-backend", text),
          onStderr: (text) => this.handleLogOutput("python-backend", text),
          onExit: (code) => this.handleProcessExit("python-backend", code),
        }
      );

      this.processes.set("python-backend", proc);
      state.pid = proc.pid;
    } catch (err: any) {
      logManager.log("python-backend", `Failed to spawn Python backend: ${err.message}`);
      state.status = "CRASH_LOOP";
      this.emitChange();
    }
  }

  public async startWorker(config: ControlPlaneConfig): Promise<void> {
    const state = this.services.get("worker")!;
    this.intentionalStops.delete("worker");

    // Check if python backend is running or adopted
    const pythonState = this.services.get("python-backend");
    const pythonReady = pythonState?.status === "RUNNING" || pythonState?.status === "ADOPTED";

    state.status = pythonReady ? "STARTING" : "PROVISIONING";
    this.emitChange();

    try {
      const proc = this.runner.spawnManaged(
        [
          "bun",
          "run",
          "--cwd",
          path.join(this.repoRoot, "apps", "worker"),
          "src/index.ts",
          "--sandbox",
          "--python-port",
          String(config.pythonPort),
        ],
        {
          cwd: path.join(this.repoRoot, "apps", "worker"),
          env: {
            ...process.env,
            PYTHON_PORT: String(config.pythonPort),
            NODE_ENV: "production",
          },
          stdout: "pipe",
          stderr: "pipe",
          onStdout: (text) => this.handleLogOutput("worker", text),
          onStderr: (text) => this.handleLogOutput("worker", text),
          onExit: (code) => this.handleProcessExit("worker", code),
        }
      );

      this.processes.set("worker", proc);
      state.pid = proc.pid;
      if (proc.pid && proc.pid > 0) {
        state.status = "RUNNING";
        this.emitChange();
      }
    } catch (err: any) {
      logManager.log("worker", `Failed to spawn Worker: ${err.message}`);
      state.status = "CRASH_LOOP";
      this.emitChange();
    }
  }

  public async startStudio(config: ControlPlaneConfig): Promise<void> {
    const state = this.services.get("studio")!;
    state.port = config.studioPort;
    this.intentionalStops.delete("studio");

    const alive = await isPortListening(config.studioPort);
    if (alive) {
      state.status = "ADOPTED";
      state.isExternal = true;
      state.pid = await findPidByPort(config.studioPort, this.runner);
      logManager.log("studio", `Adopted existing Studio server on port ${config.studioPort} (PID: ${state.pid ?? "unknown"})`);
      this.emitChange();
      return;
    }

    state.status = "STARTING";
    state.isExternal = false;
    this.emitChange();

    try {
      const proc = this.runner.spawnManaged(
        ["bun", "run", "--cwd", path.join(this.repoRoot, "apps", "studio"), "dev", "--port", String(config.studioPort)],
        {
          cwd: path.join(this.repoRoot, "apps", "studio"),
          env: {
            ...process.env,
            PORT: String(config.studioPort),
          },
          stdout: "pipe",
          stderr: "pipe",
          onStdout: (text) => this.handleLogOutput("studio", text),
          onStderr: (text) => this.handleLogOutput("studio", text),
          onExit: (code) => this.handleProcessExit("studio", code),
        }
      );

      this.processes.set("studio", proc);
      state.pid = proc.pid;
    } catch (err: any) {
      logManager.log("studio", `Failed to spawn Studio: ${err.message}`);
      state.status = "CRASH_LOOP";
      this.emitChange();
    }
  }

  private handleLogOutput(serviceName: string, text: string): void {
    logManager.log(serviceName, text);

    const state = this.services.get(serviceName);
    if (!state) return;

    if (state.status === "STARTING") {
      if (
        serviceName === "python-backend" &&
        (text.includes("listening securely on") || text.includes("gRPC server listening"))
      ) {
        state.status = "RUNNING";
        state.crashCount = 0;
        this.emitChange();
      } else if (
        serviceName === "studio" &&
        (text.includes("Local:") || text.includes("ready in"))
      ) {
        state.status = "RUNNING";
        state.crashCount = 0;
        this.emitChange();
      } else if (
        serviceName === "worker" &&
        (text.includes("Daemon ready") || text.includes("Listening for jobs") || text.includes("Worker SSE telemetry server listening") || text.includes("Started simulated sandbox poller") || text.includes("Registered TaskWorkerFactory"))
      ) {
        state.status = "RUNNING";
        state.crashCount = 0;
        this.emitChange();
      }
    }
  }

  private handleProcessExit(serviceName: string, code: number | null): void {
    this.processes.delete(serviceName);
    osProcessSampler.unregister(serviceName);
    const state = this.services.get(serviceName);
    if (!state) return;

    state.pid = null;
    state.uptimeSeconds = 0;

    if (this.intentionalStops.has(serviceName)) {
      state.status = "STOPPED";
      this.emitChange();
      return;
    }

    logManager.log(serviceName, `Process exited with code ${code}`);

    // Exponential backoff crash recovery
    if (state.crashCount < 5) {
      const delay = Math.min(1000 * Math.pow(2, state.crashCount), 30000);
      state.crashCount += 1;
      state.status = "STARTING";
      logManager.log(serviceName, `Restarting in ${delay}ms (attempt ${state.crashCount}/5)...`);
      this.emitChange();

      setTimeout(() => {
        const config = configStore.loadConfig();
        if (serviceName === "python-backend") this.startPythonBackend(config);
        else if (serviceName === "worker") this.startWorker(config);
        else if (serviceName === "studio") this.startStudio(config);
      }, delay);
    } else {
      state.status = "CRASH_LOOP";
      logManager.log(serviceName, `Exceeded 5 crash retries. Placed into CRASH_LOOP.`);
      telemetryBroker.emitAlert({
        level: "critical",
        service: serviceName,
        message: `Service ${serviceName} exceeded maximum crash recovery attempts.`,
      });
      this.emitChange();
    }
  }

  public async stopService(serviceName: string): Promise<void> {
    this.intentionalStops.add(serviceName);
    const proc = this.processes.get(serviceName);
    const state = this.services.get(serviceName);

    if (proc) {
      logManager.log(serviceName, "Sending graceful SIGTERM to managed process...");
      await proc.kill("SIGTERM");
      this.processes.delete(serviceName);
    } else if (state?.pid && state.pid > 0) {
      // Graceful termination for ADOPTED / external processes
      logManager.log(serviceName, `Sending graceful SIGTERM to adopted process PID ${state.pid}...`);
      try {
        process.kill(state.pid, "SIGTERM");
      } catch (err: any) {
        logManager.log(serviceName, `SIGTERM to PID ${state.pid} returned: ${err.message}`);
      }
    } else if (state?.port) {
      // Attempt PID resolution by port if state.pid was not yet set
      const resolvedPid = await findPidByPort(state.port, this.runner);
      if (resolvedPid && resolvedPid > 0) {
        logManager.log(serviceName, `Sending graceful SIGTERM to resolved process PID ${resolvedPid} on port ${state.port}...`);
        try {
          process.kill(resolvedPid, "SIGTERM");
        } catch (err: any) {
          logManager.log(serviceName, `SIGTERM to PID ${resolvedPid} returned: ${err.message}`);
        }
      }
    }

    if (state) {
      state.pid = null;
      state.status = "STOPPED";
      state.uptimeSeconds = 0;
      this.emitChange();
    }
  }

  public async stopAll(): Promise<void> {
    const names = Array.from(this.services.keys());
    for (const name of names) {
      await this.stopService(name);
    }
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
      this.uptimeInterval = null;
    }
    osProcessSampler.stop();
    domainTelemetryPoller.stop();
  }

  public isBusy(): boolean {
    for (const s of this.services.values()) {
      if (s.status === "BUSY") return true;
    }
    return false;
  }

  public async purgeAllVram(): Promise<void> {
    logManager.log("supervisor", "Triggered Purge All VRAM...");

    // Python backend garbage collection trigger via gRPC AdminService
    try {
      const pythonBackend = this.services.get("python-backend");
      const port = pythonBackend?.port || 50051;
      const { getAdminServiceClient } = await import("@acc/proto");
      const client = getAdminServiceClient(`127.0.0.1:${port}`);
      await new Promise<void>((resolve) => {
        const deadline = new Date(Date.now() + 5000);
        client.PurgeVRAM({ force: true }, { deadline }, (err: any, resp: any) => {
          if (err) {
            logManager.log("supervisor", `Python backend PurgeVRAM notice: ${err.message}`);
          } else {
            logManager.log("supervisor", `Python backend PurgeVRAM: ${resp.message} (freed: ${resp.freed_bytes} bytes)`);
          }
          resolve();
        });
      });
    } catch (e: any) {
      logManager.log("supervisor", `PurgeVRAM dispatch note: ${e?.message}`);
    }

    logManager.log("supervisor", "VRAM purge signal dispatched to Python backend.");
  }

  private startHealthMonitoring(): void {
    if (this.healthInterval) return;

    this.healthInterval = setInterval(async () => {
      // 1. Probe Python backend via TCP port
      const pythonBackend = this.services.get("python-backend");
      if (
        pythonBackend &&
        !this.intentionalStops.has("python-backend") &&
        pythonBackend.status !== "STOPPED" &&
        pythonBackend.status !== "PROVISIONING" &&
        pythonBackend.status !== "CRASH_LOOP"
      ) {
        const port = pythonBackend.port || 50051;
        const alive = await isPortListening(port);
        if (alive) {
          if (pythonBackend.status !== "BUSY") {
            pythonBackend.status = pythonBackend.isExternal ? "ADOPTED" : "RUNNING";
          }
          if (pythonBackend.isExternal && (!pythonBackend.pid || pythonBackend.pid <= 0)) {
            pythonBackend.pid = await findPidByPort(port, this.runner);
          }
          pythonBackend.lastHealthCheck = Date.now();
        } else if (pythonBackend.status === "RUNNING") {
          pythonBackend.status = "STARTING";
        }
      }

      // 2. Probe Studio server
      const studio = this.services.get("studio");
      if (
        studio &&
        !this.intentionalStops.has("studio") &&
        studio.status !== "STOPPED" &&
        studio.status !== "CRASH_LOOP"
      ) {
        const alive = await isPortListening(studio.port || 3300);
        if (alive) {
          studio.status = studio.isExternal ? "ADOPTED" : "RUNNING";
          if (studio.isExternal && (!studio.pid || studio.pid <= 0)) {
            studio.pid = await findPidByPort(studio.port || 3300, this.runner);
          }
          studio.lastHealthCheck = Date.now();
        } else if (studio.status === "RUNNING") {
          studio.status = "STARTING";
        }
      }

      // 3. Probe Worker process
      const worker = this.services.get("worker");
      if (worker && worker.status !== "STOPPED" && worker.status !== "CRASH_LOOP") {
        const proc = this.processes.get("worker");
        if (proc && proc.pid && !proc.exitCode) {
          worker.status = "RUNNING";
          worker.lastHealthCheck = Date.now();
        }
      }

      this.emitChange();
    }, 5000);
  }

  private startUptimeTracking(): void {
    if (this.uptimeInterval) return;

    this.uptimeInterval = setInterval(() => {
      let changed = false;
      for (const s of this.services.values()) {
        if (s.status === "RUNNING" || s.status === "BUSY" || s.status === "ADOPTED") {
          s.uptimeSeconds += 1;
          changed = true;
        }
      }
      if (changed) {
        this.emitChange();
      }
    }, 1000);
  }
}

export const supervisorEngine = new SupervisorEngine();
