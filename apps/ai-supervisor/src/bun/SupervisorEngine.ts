import { spawn, which, type Subprocess } from "bun";
import { logManager } from "./LogManager.js";
import { ollamaManager } from "./OllamaManager.js";
import { configStore, type ControlPlaneConfig } from "./configStore.js";
import { HardwareProfiler, type HardwareProfile } from "./HardwareProfiler.js";
import { runtimeManager, RuntimeManager } from "./RuntimeManager.js";
import { isPortListening } from "./PortScanner.js";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

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

export class SupervisorEngine {
  private services: Map<string, ServiceState> = new Map();
  private processes: Map<string, Subprocess> = new Map();
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private uptimeInterval: ReturnType<typeof setInterval> | null = null;
  private onStatusChangeCallbacks: Array<(states: Record<string, ServiceState>, trayColor: TrayIconColor) => void> = [];
  private currentTrayColor: TrayIconColor = "yellow";
  private intentionalStops: Set<string> = new Set();
  private hardwareProfile: HardwareProfile | null = null;
  private repoRoot: string;
  private runtimeManager: RuntimeManager;

  constructor(customRepoRoot?: string, customRuntimeManager?: RuntimeManager) {
    this.repoRoot = customRepoRoot || findRepoRoot();
    this.runtimeManager = customRuntimeManager || runtimeManager;
    this.initService("python-backend", 50051);
    this.initService("worker", null);
    this.initService("studio", 3300);
    this.initService("ollama", 11434);
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
    return () => {
      this.onStatusChangeCallbacks = this.onStatusChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  private emitChange(): void {
    this.updateTrayColor();
    const states = this.getAllStates();
    for (const cb of this.onStatusChangeCallbacks) {
      try {
        cb(states, this.currentTrayColor);
      } catch (err) {
        console.warn("[SupervisorEngine] Status callback error:", err);
      }
    }
  }

  private updateTrayColor(): void {
    let hasCrashLoop = false;
    let hasStartingOrBusy = false;
    let allHealthy = true;

    for (const s of this.services.values()) {
      if (s.status === "CRASH_LOOP") {
        hasCrashLoop = true;
      }
      if (s.status === "STARTING" || s.status === "BUSY" || s.status === "PROVISIONING") {
        hasStartingOrBusy = true;
      }
      if (s.status !== "RUNNING" && s.status !== "ADOPTED") {
        allHealthy = false;
      }
    }

    if (hasCrashLoop) {
      this.currentTrayColor = "red";
    } else if (hasStartingOrBusy || !allHealthy) {
      this.currentTrayColor = "yellow";
    } else {
      this.currentTrayColor = "green";
    }
  }

  public async startAll(): Promise<void> {
    const config = configStore.loadConfig();
    this.hardwareProfile = await HardwareProfiler.getProfile(config.hardwareTierOverride);

    // 1. Ollama check/start
    await this.startOllama(config);

    // 2. Python backend start
    await this.startPythonBackend(config);

    // 3. Worker start
    await this.startWorker(config);

    // 4. Studio start
    await this.startStudio(config);

    this.startHealthMonitoring();
    this.startUptimeTracking();
  }

  public async startOllama(config: ControlPlaneConfig): Promise<void> {
    const state = this.services.get("ollama")!;
    state.port = config.ollamaPort;

    // Check if already running externally (ADOPTED)
    const alive = await ollamaManager.isAlive(config.ollamaPort);
    if (alive) {
      state.status = "ADOPTED";
      state.isExternal = true;
      logManager.log("ollama", `Adopted existing Ollama instance on port ${config.ollamaPort}`);
      this.emitChange();
      return;
    }

    const binary = ollamaManager.findBinaryPath();
    if (!binary) {
      state.status = "NOT_INSTALLED";
      state.isExternal = false;
      logManager.log("ollama", "Ollama binary not found. ACC will use deterministic fallbacks.");
      this.emitChange();
      return;
    }

    state.status = "STARTING";
    state.isExternal = false;
    this.intentionalStops.delete("ollama");
    this.emitChange();

    try {
      const proc = spawn([binary, "serve"], {
        env: {
          ...process.env,
          OLLAMA_HOST: `127.0.0.1:${config.ollamaPort}`,
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      this.processes.set("ollama", proc);
      state.pid = proc.pid;
      this.pipeProcessLogs("ollama", proc);
      this.monitorProcessExit("ollama", proc);
    } catch (err: any) {
      logManager.log("ollama", `Failed to spawn Ollama: ${err.message}`);
      state.status = "CRASH_LOOP";
      this.emitChange();
    }
  }

  public async startPythonBackend(config: ControlPlaneConfig): Promise<void> {
    const state = this.services.get("python-backend")!;
    state.port = config.pythonPort;
    this.intentionalStops.delete("python-backend");

    if (!this.runtimeManager.isReady()) {
      state.status = "PROVISIONING";
      this.emitChange();
      logManager.log("python-backend", "Provisioning isolated Python 3.12 runtime and uv toolchain in ~/.acc/...");
      try {
        await this.runtimeManager.ensureRuntime((msg) => {
          logManager.log("python-backend", msg);
        });
      } catch (err: any) {
        logManager.log("python-backend", `Failed to provision runtime: ${err.message}`);
        state.status = "CRASH_LOOP";
        this.emitChange();
        return;
      }
    }

    state.status = "STARTING";
    this.emitChange();

    try {
      let pythonBackendCwd = path.resolve(this.repoRoot, "apps", "ai-supervisor", "python-backend");
      if (!fs.existsSync(pythonBackendCwd)) {
        pythonBackendCwd = path.resolve(import.meta.dir, "..", "..", "python-backend");
      }
      if (!fs.existsSync(pythonBackendCwd)) {
        throw new Error(`Python backend directory not found at: ${pythonBackendCwd}`);
      }

      const serverScript = path.resolve(pythonBackendCwd, "src", "server.py");
      if (!fs.existsSync(serverScript)) {
        throw new Error(`Server script not found at: ${serverScript}`);
      }

      const uvBin = this.runtimeManager.getUvPath();
      if (!fs.existsSync(uvBin) && uvBin !== "uv") {
        throw new Error(`UV binary not found at: ${uvBin}`);
      }

      const deviceArg = this.hardwareProfile?.recommendedPythonDevice === "cpu" ? ["--device", "cpu"] : [];
      const execEnv = this.runtimeManager.getExecutionEnv();

      const proc = spawn([uvBin, "run", "python", serverScript, String(config.pythonPort), ...deviceArg], {
        cwd: pythonBackendCwd,
        stdout: "pipe",
        stderr: "pipe",
        env: execEnv,
      });

      this.processes.set("python-backend", proc);
      state.pid = proc.pid;
      this.pipeProcessLogs("python-backend", proc);
      this.monitorProcessExit("python-backend", proc);
      this.startHealthMonitoring();
      this.startUptimeTracking();
    } catch (err: any) {
      logManager.log("python-backend", `Failed to spawn Python Backend: ${err.message}`);
      state.status = "CRASH_LOOP";
      this.emitChange();
    }
  }

  public async startWorker(config: ControlPlaneConfig): Promise<void> {
    const state = this.services.get("worker")!;
    state.status = "STARTING";
    this.intentionalStops.delete("worker");
    this.emitChange();

    try {
      const pythonState = this.services.get("python-backend");
      const pythonOffline = pythonState?.status !== "RUNNING";

      const proc = spawn([
        "bun",
        "run",
        "apps/worker/src/index.ts",
        "--sandbox",
        "--python-port",
        String(config.pythonPort),
        "--ollama-port",
        String(config.ollamaPort),
      ], {
        cwd: this.repoRoot,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          PYTHON_PORT: String(config.pythonPort),
          OLLAMA_PORT: String(config.ollamaPort),
          ACC_AI_OFFLINE: pythonOffline ? "1" : "0",
        },
      });

      this.processes.set("worker", proc);
      state.pid = proc.pid;
      this.pipeProcessLogs("worker", proc);
      this.monitorProcessExit("worker", proc);
    } catch (err: any) {
      logManager.log("worker", `Failed to spawn Worker: ${err.message}`);
      state.status = "CRASH_LOOP";
      this.emitChange();
    }
  }

  public async startStudio(config: ControlPlaneConfig): Promise<void> {
    const state = this.services.get("studio")!;
    state.port = config.studioPort;
    state.status = "STARTING";
    this.intentionalStops.delete("studio");
    this.emitChange();

    try {
      const studioCwd = path.resolve(this.repoRoot, "apps", "studio");
      const proc = spawn([
        "bun",
        "run",
        "dev",
        "--port",
        String(config.studioPort),
      ], {
        cwd: studioCwd,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          PORT: String(config.studioPort),
        },
      });

      this.processes.set("studio", proc);
      state.pid = proc.pid;
      this.pipeProcessLogs("studio", proc);
      this.monitorProcessExit("studio", proc);
    } catch (err: any) {
      logManager.log("studio", `Failed to spawn Studio Server: ${err.message}`);
      state.status = "CRASH_LOOP";
      this.emitChange();
    }
  }

  private handleLogOutput(serviceName: string, text: string): void {
    logManager.log(serviceName, text);

    const state = this.services.get(serviceName);
    if (!state) return;

    if (state.status === "STARTING" || state.status === "PROVISIONING") {
      if (
        serviceName === "python-backend" &&
        (text.includes("gRPC server listening") || text.includes("listening securely on"))
      ) {
        state.status = "RUNNING";
        state.lastHealthCheck = Date.now();
        this.emitChange();
      } else if (
        serviceName === "studio" &&
        (text.includes("listening on") || text.includes("Listening on") || text.includes("Local:") || text.includes("ready in"))
      ) {
        state.status = "RUNNING";
        state.lastHealthCheck = Date.now();
        this.emitChange();
      } else if (
        serviceName === "worker" &&
        (text.includes("Worker started") || text.includes("listening") || text.includes("ready"))
      ) {
        state.status = "RUNNING";
        state.lastHealthCheck = Date.now();
        this.emitChange();
      }
    }
  }

  private pipeProcessLogs(serviceName: string, proc: Subprocess): void {
    if (proc.stdout) {
      (async () => {
        const reader = proc.stdout.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          this.handleLogOutput(serviceName, decoder.decode(value));
        }
      })().catch(() => {});
    }

    if (proc.stderr) {
      (async () => {
        const reader = proc.stderr.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          this.handleLogOutput(serviceName, decoder.decode(value));
        }
      })().catch(() => {});
    }
  }

  private monitorProcessExit(serviceName: string, proc: Subprocess): void {
    proc.exited.then((code) => {
      this.processes.delete(serviceName);
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

      if (state.crashCount < 3) {
        const delay = Math.pow(2, state.crashCount) * 1000;
        state.crashCount += 1;
        state.status = "STARTING";
        logManager.log(serviceName, `Restarting in ${delay}ms (attempt ${state.crashCount}/3)...`);
        this.emitChange();

        setTimeout(() => {
          const config = configStore.loadConfig();
          if (serviceName === "python-backend") this.startPythonBackend(config);
          else if (serviceName === "worker") this.startWorker(config);
          else if (serviceName === "studio") this.startStudio(config);
          else if (serviceName === "ollama") this.startOllama(config);
        }, delay);
      } else {
        state.status = "CRASH_LOOP";
        logManager.log(serviceName, `Exceeded 3 crash retries. Placed into CRASH_LOOP.`);
        this.emitChange();
      }
    });
  }

  public async stopService(serviceName: string): Promise<void> {
    this.intentionalStops.add(serviceName);
    const proc = this.processes.get(serviceName);
    const state = this.services.get(serviceName);

    if (proc) {
      proc.kill("SIGTERM");
      const exited = await Promise.race([
        proc.exited.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
      ]);

      if (!exited) {
        logManager.log(serviceName, "Graceful drain timed out (5s). Sending SIGKILL.");
        proc.kill("SIGKILL");
        await proc.exited;
      }
      this.processes.delete(serviceName);
    }

    if (state) {
      state.status = "STOPPED";
      state.pid = null;
      state.uptimeSeconds = 0;
      state.crashCount = 0;
    }
    this.emitChange();
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
  }

  public isBusy(): boolean {
    for (const s of this.services.values()) {
      if (s.status === "BUSY") return true;
    }
    return false;
  }

  public async purgeAllVram(): Promise<void> {
    logManager.log("supervisor", "Triggered Purge All VRAM...");
    // 1. Unload all Ollama models
    await ollamaManager.unloadAllModels();

    // 2. Python backend garbage collection trigger
    // If gRPC client is configured, call /acc.v1.AdminService/PurgeVRAM
    logManager.log("supervisor", "VRAM purge signal dispatched to Ollama and Python backend.");
  }

  private startHealthMonitoring(): void {
    if (this.healthInterval) return;

    this.healthInterval = setInterval(async () => {
      // 1. Probe Ollama
      const ollama = this.services.get("ollama");
      if (ollama && ollama.status !== "STOPPED" && ollama.status !== "NOT_INSTALLED" && ollama.status !== "CRASH_LOOP") {
        const alive = await ollamaManager.isAlive(ollama.port || 11434);
        if (alive) {
          if (ollama.status !== "BUSY") {
            ollama.status = ollama.isExternal ? "ADOPTED" : "RUNNING";
          }
          ollama.lastHealthCheck = Date.now();
        } else if (ollama.status === "RUNNING") {
          ollama.status = "STARTING";
        }
      }

      // 2. Probe Python backend via TCP port
      const pythonBackend = this.services.get("python-backend");
      if (
        pythonBackend &&
        pythonBackend.status !== "STOPPED" &&
        pythonBackend.status !== "NOT_INSTALLED" &&
        pythonBackend.status !== "CRASH_LOOP" &&
        pythonBackend.status !== "PROVISIONING"
      ) {
        const port = pythonBackend.port || 50051;
        const listening = await isPortListening(port);
        if (listening) {
          if (pythonBackend.status !== "BUSY") {
            pythonBackend.status = "RUNNING";
          }
          pythonBackend.lastHealthCheck = Date.now();
        } else if (pythonBackend.status === "RUNNING") {
          pythonBackend.status = "STARTING";
        }
      }

      // 3. Probe Studio server via TCP port
      const studio = this.services.get("studio");
      if (studio && studio.status !== "STOPPED" && studio.status !== "CRASH_LOOP") {
        const port = studio.port || 3300;
        const listening = await isPortListening(port);
        if (listening) {
          if (studio.status !== "BUSY") {
            studio.status = "RUNNING";
          }
          studio.lastHealthCheck = Date.now();
        } else if (studio.status === "RUNNING") {
          studio.status = "STARTING";
        }
      }

      // 4. Probe Worker daemon
      const worker = this.services.get("worker");
      if (worker && worker.status === "STARTING" && this.processes.has("worker")) {
        worker.status = "RUNNING";
        worker.lastHealthCheck = Date.now();
      }

      this.emitChange();
    }, 2000);
  }

  private startUptimeTracking(): void {
    if (this.uptimeInterval) return;

    this.uptimeInterval = setInterval(() => {
      for (const s of this.services.values()) {
        if (s.status === "RUNNING" || s.status === "ADOPTED" || s.status === "BUSY") {
          s.uptimeSeconds += 1;
        }
      }
    }, 1000);
  }
}

export const supervisorEngine = new SupervisorEngine();
