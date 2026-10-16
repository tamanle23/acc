# Master Integration Plan (Iteration 3): Electrobun Unified Desktop Control Plane, Standalone App Ecosystem & Dedicated React Studio

## 1. Executive Summary & Strategic Objectives

Following the comprehensive design interview and alignment, **Iteration 3** delivers an enterprise-grade multi-runtime orchestration stack. The ecosystem is restructured into **four decoupled standalone applications** under Turborepo, orchestrated seamlessly by an **Electrobun System-Tray Desktop Control Plane**:

### Execution Order & Architecture Hierarchy:
```
                               ┌────────────────────────────────────────────────────────┐
                               │   apps/ai-supervisor (Electrobun Desktop Control Plane) │
                               │     Tray-First, OS Autostart, Hybrid Process Manager   │
                               │      Crash Backoff Recovery, Auto-Scan Port Collisions │
                               │      10K-Line Ring Buffer + Disk Log Rotation          │
                               │      Non-Blocking Health & Dual-Target Packaging Build │
                               └───────────┬───────────────────┬────────────────────┬───┘
                                           │                   │                    │
                  ┌────────────────────────┴────────┐          │                    │
                  ▼                                 ▼          ▼                    ▼
       ┌──────────────────────┐         ┌──────────────────────┐          ┌──────────────────────┐
       │ apps/python-backend  │         │     apps/worker      │          │     apps/studio      │
       │ Python AI gRPC (:50051)│       │ ACC Long-Running Task│          │ React 19 Studio NLE  │
       │ VRAM Eviction, PID   │         │ Pluggable Task Poller│          │ Pure Client-Side SPA │
       │ Parent Watchdog      │         │ Crash Loop Handling  │          │ HTML5 Canvas & WebGL │
       │ Auto-Port Shift Aware│         │ Fallback Flag Aware  │          │ WebCodecs Mediabunny │
       │ Busy / Active Aware  │         │ Non-Blocking IPC     │          │ In-Memory MP4 Blob   │
       │                      │         │                      │          │ Vite Dev (:5173)     │
       └──────────────────────┘         └──────────────────────┘          └──────────────────────┘
```

1. **Epic 1 (Phase 1): Electrobun Unified Desktop Control Plane (`apps/ai-supervisor`)**
   - **Tray-First Architecture**: Boots into the Windows System Tray with dynamic health icon (`tray-green.ico`, `tray-yellow.ico`, `tray-red.ico`), running in the background with `exitOnLastWindowClosed: false`.
   - **OS Auto-Start on Boot**: Windows Registry Run key integration (`HKCU:\Software\Microsoft\Windows\CurrentVersion\Run`) with `--minimized` boot.
   - **Auto-Scan Port Collision Resolution**: Before starting child daemons, the supervisor checks whether default ports (`:50051` gRPC, `:3300` HTTP) are in use. If a collision is detected, it automatically binds the next open port (e.g. `:50052`, `:3301`), updates its configuration state, displays an amber badge in the dashboard, and injects the resolved port into all child processes and the browser launcher.
   - **Hybrid Process Supervisor with Exponential Crash Backoff**: Spawns each standalone application via Bun `ChildProcess`, streams stdout/stderr to a consolidated tabbed terminal, tracks `.pid` files, and probes health endpoints. Automatically recovers from crashes up to 3 times (1s, 2s, 4s delay); on repeated failure, transitions service to `CRASH_LOOP`, turns the tray icon red, and fires a native Windows toast notification.
   - **Non-Blocking Health & Workload Awareness**: Probes health endpoints asynchronously every 2 seconds with an aggressive 1.5s timeout. If heavy workloads (Kokoro TTS, video export) cause temporary probe latency, marks the process as `BUSY/PROCESSING` rather than `OFFLINE`, and only flags `DEGRADED` after 3 consecutive missed beats.
   - **In-Memory Rolling Ring Buffer & Disk Log Rotation**: Maintains the latest 10,000 log lines per service in a circular ring buffer in RAM for instant, zero-lag UI console rendering, while asynchronously flushing to `~/.acc/logs/<service>.log` with automatic log rotation (max 10MB per file, retaining 3 backups).
   - **Dual-Target Monorepo & Packaging Topology**:
     - *Dev Mode (`bun run supervisor:dev`)*: Directly spawns workspace apps with hot-reloading (`bun run --filter=@acc/studio dev`, `bun run --filter=@acc/worker dev`, `uv run python apps/ai-supervisor/python-backend/src/server.py`).
     - *Production Desktop Bundle (`bun run supervisor:build`)*: Builds all standalone apps (`apps/studio/dist`, compiled worker binary, pinned python wheel) and packages them into a single, self-contained Electrobun desktop distribution installer.
   - **Centralized Configuration Persistence (`~/.acc/control-plane.json`)**: Persists port numbers, model sizes, Kokoro voice IDs, task worker endpoints, and autostart preferences in `~/.acc/control-plane.json`, seamlessly injecting them as environment variables into child processes on boot.
   - **Embedded Full Control Dashboard**: Built with native Microsoft Edge WebView2 on Windows (~12MB binary, < 30MB RAM overhead). Provides real-time CPU/RAM/VRAM telemetry, Start/Stop/Restart toggles, manual VRAM purge, and a one-click "Open Studio in Browser" shortcut.

2. **Epic 2 (Phase 2): Standalone App Decoupling & React Studio NLE (`apps/studio` & `apps/worker`)**
   - **Dedicated `apps/worker` Workspace Package**: Decouple the long-running task worker into a standalone workspace app (`apps/worker`) with its own `package.json`, CLI entrypoint, and pluggable `ITaskPoller` / `IWorkflowEngineAdapter` contract. Operates by default with zero-dependency simulated `SandboxTaskPoller`, ready for drop-in custom workflow engines. Supports both standalone binary compilation and monorepo execution.
   - **Dedicated `apps/studio` React 19 NLE Application (Pure Client-Side SPA - Option A)**: Migrate into a standalone pure client React 19 + Vite + TailwindCSS v4 + Shadcn UI app with **Default Light Mode**, adopting the modular `<Preview />`, `<Timeline />`, `<Sidebar />`, and `<Titlebar />` pattern. Completely eliminates `apps/studio/src/server/` in favor of client-side browser technologies.
   - **Enterprise Lightweight Event-Driven Viewport (Zero-Waste Preview Engine)**:
     - *No Arbitrary Frame Rate Lock*: The browser viewport does not enforce an arbitrary, battery-draining 60fps loop.
     - *State-Driven Render Pipeline*:
       - **Idle / Paused State**: 0 FPS (zero CPU/GPU utilization). Canvas only invalidates and repaints when the playhead position changes, a clip boundary is trimmed, or a modifier parameter slider moves.
       - **Active Playback State**: Driven by native HTML5 `<video>` / `<audio>` timeupdate events or a lightweight project-locked timer (`1000 / timeline.meta.globalFps` ms), smoothly rendering only active frames.
       - **Interactive Scrubbing**: Debounced low-latency canvas rasterization (single frame draw on `onScrub`) providing instantaneous visual feedback without background render loop thrashing.
   - **Client-Side Video Export via WebCodecs & Mediabunny**:
     - Replaces server-side FFmpeg and @napi-rs/canvas with browser-native HTML5 `<canvas>` and `MediabunnyClientSink` (powered by Mediabunny & browser WebCodecs `VideoEncoder`).
     - Renders frame-by-frame directly in the client and muxes to an in-memory MP4 Blob target with instant browser download.
     - Interactive export progress bar with instant responsive client-side cancellation.
   - **Local Asset Management**: Ingests and plays back local media files using browser native Blob/Object URLs without requiring a local asset streaming server.

3. **Epic 3 (Phase 3): Enterprise Lightweight Python AI Subsystem (`apps/python-backend`)**
   - **Zero-Crash / Zero-Zombie Guarantee**: `uv`-managed environment, PID file lock (`.acc-python.pid`), and a background parent watchdog thread (`os.getppid()` polling every 1s) that auto-terminates the daemon if the supervisor dies.
   - **Dynamic VRAM & Memory Budget Manager**: On-demand lazy model weights loading (Kokoro TTS, Depth Anything v2, BiRefNet/SAM 2, GBNF llama.cpp) with an automated 120s idle timeout that unloads weights and triggers `torch.cuda.empty_cache()` and `gc.collect()`.
   - **Standardized Health Check & Circuit Breaking**: `grpc.health.v1.Health` servicer with a 3-strike circuit breaker in `@acc/core`'s `IPCFacade`.

---

## 2. Detailed Technical Specifications

### 2.1 Epic 1: Electrobun Unified Desktop Control Plane (`apps/ai-supervisor`)

#### Configuration & Runtime
- **Path**: `apps/ai-supervisor/`
- **Config**: `electrobun.config.ts`:
  ```typescript
  import type { ElectrobunConfig } from "electrobun";

  export default {
    app: {
      name: "ACC Control Plane",
      identifier: "com.acc.ai-supervisor",
      version: "1.0.0",
    },
    build: {
      mainProcess: "bun",
      views: {
        main: { entrypoint: "src/views/index.tsx" },
      },
      copy: {
        "src/views/index.html": "views/main/index.html",
        "src/assets/tray-green.ico": "views/main/tray-green.ico",
        "src/assets/tray-yellow.ico": "views/main/tray-yellow.ico",
        "src/assets/tray-red.ico": "views/main/tray-red.ico",
      },
    },
    runtime: {
      exitOnLastWindowClosed: false,
    },
  } satisfies ElectrobunConfig;
  ```

#### Dynamic Port Collision Resolver (`src/bun/portScanner.ts`)
```typescript
import net from "net";

export async function findAvailablePort(startingPort: number, maxTries = 20): Promise<number> {
  for (let port = startingPort; port < startingPort + maxTries; port++) {
    const isFree = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on("error", () => resolve(false));
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
    });
    if (isFree) return port;
  }
  throw new Error(`No available ports found starting from ${startingPort}`);
}
```

#### In-Memory Rolling Ring Buffer & Disk Rotation (`src/bun/LogManager.ts`)
- Circular in-memory buffer:
  ```typescript
  export class CircularLogBuffer {
    private lines: string[] = [];
    private maxLines = 10000;

    public push(line: string) {
      if (this.lines.length >= this.maxLines) {
        this.lines.shift();
      }
      this.lines.push(line);
    }

    public getLines(filter = ''): string[] {
      return filter ? this.lines.filter(l => l.toLowerCase().includes(filter.toLowerCase())) : this.lines;
    }
  }
  ```
- File-streamer appends asynchronously to `path.join(os.homedir(), '.acc', 'logs', `${serviceName}.log`)`, rotating files at 10MB limit with up to 3 backups.

#### Multi-Daemon Hybrid Supervisor with Crash Backoff & Health Probing (`src/bun/SupervisorEngine.ts`)
- Manages 4 fleet services:
  1. `PythonDaemon`: `uv run python apps/python-backend/src/server.py <resolved_port>` (Kokoro TTS, Vision gRPC micro-daemon)
  2. `WorkerDaemon`: `bun run apps/worker/src/index.ts` (ACC Conductor long-running worker)
  3. `StudioVite`: `bun run dev --port <resolved_port>` in `apps/studio` (Pure React 19 Client-Side SPA via Vite)
  4. `OllamaDaemon`: Local LLM / VLM inference engine (Hybrid: `ADOPTED` if already running on :11434, or `MANAGED` spawning `ollama serve`, or `NOT_INSTALLED` with 1-click download guide)
- VRAM Coordination & Arbitration:
  - Dynamic GPU VRAM manager between PyTorch (`python-backend`) and llama.cpp (`ollama`).
  - Probes `/api/ps` to monitor active model VRAM footprint.
  - Can trigger `POST /api/generate` with `keep_alive: 0` to unload Ollama models before intensive video rendering or TTS synthesis, preventing CUDA OOM.
- Exponential Crash Recovery:
  ```typescript
  export class SupervisorEngine {
    private crashCounts = new Map<string, number>();

    private async handleProcessExit(serviceName: string, code: number | null) {
      if (this.isIntentionalStop(serviceName)) return;

      const retries = this.crashCounts.get(serviceName) || 0;
      if (retries < 3) {
        const delay = Math.pow(2, retries) * 1000;
        this.crashCounts.set(serviceName, retries + 1);
        Logger.warn('Supervisor', `Service ${serviceName} crashed (code ${code}). Auto-restarting in ${delay}ms...`);
        setTimeout(() => this.startService(serviceName), delay);
      } else {
        this.setServiceState(serviceName, 'CRASH_LOOP');
        this.updateTrayIcon('red');
        this.notifyUser(`Service ${serviceName} failed to recover after 3 attempts.`);
      }
    }
  }
  ```
- Non-Blocking Health Probing:
  - Queries every 2000ms with a 1500ms timeout.
  - If a probe times out while CPU/GPU is under active inference, the state is categorized as `BUSY/PROCESSING`, preventing false offline alerts.
  - If Python is offline, `apps/worker` is injected with `ACC_AI_OFFLINE=1` for seamless in-process TypeScript fallbacks.
- Updates system tray icon dynamically based on aggregated fleet status (`green`, `yellow`, `red`).

#### Windows OS Startup & Global Storage (`src/bun/configStore.ts` & `windowsStartup.ts`)
- Config persisted in `path.join(os.homedir(), '.acc', 'control-plane.json')`.
- Auto-starts via Windows Registry:
  ```typescript
  import { spawn } from "bun";

  export async function setWindowsStartup(enable: boolean) {
    const appPath = process.execPath;
    const appName = "ACCControlPlane";
    const cmd = enable
      ? `New-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "${appName}" -Value '"${appPath}" --minimized' -PropertyType String -Force`
      : `Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "${appName}" -ErrorAction SilentlyContinue`;

    await spawn(["powershell", "-NoProfile", "-Command", cmd]).exited;
  }
  ```

#### Seamless Auto-Update Engine with Crash Rollback (`src/bun/UpdateManager.ts`)
- **Distribution Source**: GitHub Releases API checking semantic versions (`vX.Y.Z`) and release manifest JSON (`release.json`).
- **Cadence & UX**:
  - Background periodic check on boot and every 4 hours.
  - Silent download to staging folder `path.join(os.homedir(), '.acc', 'updates', 'staging')`.
  - Non-intrusive Windows system tray toast ("Update vX.Y.Z ready — Click to Restart & Apply") with active notification badge in the Webview dashboard.
- **Active Job Gatekeeper & Graceful Drain**:
  - Checks `SupervisorEngine.isBusy()` before allowing restart.
  - If video render or AI inference is active (`BUSY`), postpones or alerts user with option to wait.
  - On restart approval, dispatches `SIGTERM` to child processes (`python-backend`, `worker`, `studio`), waits up to 5s graceful drain timeout, and falls back to `SIGKILL` if hung before initiating executable replacement.
- **SHA-256 Integrity & Auto-Rollback**:
  - Computes and verifies SHA-256 hash of downloaded artifact against GitHub release manifest.
  - Backs up current executable to `path.join(os.homedir(), '.acc', 'updates', 'backup')`.
  - Health watchdog: If the newly updated binary crashes within 10 seconds of startup (>2 consecutive crashes), automatically rolls back from the backup directory and notifies the user.
- **Dev Mode Guard**:
  - Updater is suppressed in development mode (`NODE_ENV === 'development'`).
  - Includes a "Simulate Update" toggle in Settings to test notification, staging, and UI state transitions without touching local source code files.

---

### 2.2 Epic 2: Standalone Worker & Studio NLE (`apps/worker` & `apps/studio`)

#### Dedicated Standalone Package: `apps/worker`
- Standalone long-running background task worker daemon with pluggable workflow engine polling abstraction (`ITaskPoller` / `IWorkflowEngineAdapter`).
- Defaults to internal zero-dependency `SandboxTaskPoller` generating simulated pipeline tasks for standalone local desktop usage, allowing seamless drop-in integration with custom workflow engines.
- Root scripts:
  - `dev`: `bun run src/index.ts`
  - `build`: `bun build src/index.ts --compile --outfile=dist/acc-worker`
  - `start`: `bun run src/index.ts --sandbox`
- Dependencies: `@acc/core`, `@acc/ir`, `@acc/effect-engines`.

#### Pluggable Task Poller Abstraction (`apps/worker/src/poller/`)
```typescript
export interface TaskPayload {
  taskId: string;
  taskDefName: string;
  workflowInstanceId?: string;
  inputData: Record<string, any>;
}

export interface TaskExecutionResult {
  status: "COMPLETED" | "FAILED";
  outputData: Record<string, any>;
  logs?: string[];
  error?: string;
}

export interface ITaskPoller {
  readonly id: string;
  start(onTask: (task: TaskPayload) => Promise<TaskExecutionResult>): Promise<void>;
  stop(): Promise<void>;
}
```

#### Pluggable Backend Hypervisor & VRAM Arbitrator (`apps/worker/src/hypervisor/`)
- **Role Division**:
  - `apps/worker` acts as the **Inference Dispatcher & Backend Hypervisor**, routing tasks to target backends (`tts` -> `python-backend`, `llm` -> `ollama`, future `image-gen` -> `comfyui`), coordinating VRAM pre-flight checks, and executing eviction handshakes.
  - `apps/ai-supervisor` acts as the **Host Control Plane**, monitoring total/free VRAM telemetry, OS process lifecycles, and presenting manual overrides in the GUI.
- **Pluggable Backend Adapter Interface (`IBackendAdapter`)**:
  ```typescript
  export interface IBackendAdapter {
    readonly id: string; // 'python-backend' | 'ollama' | 'comfyui'
    readonly capabilities: string[]; // ['tts', 'vision', 'llm', 'image-gen']
    getEstimatedVRAMBytes(task: TaskPayload): number;
    isAlive(): Promise<boolean>;
    purgeVRAM(): Promise<void>;
    execute(task: TaskPayload): Promise<TaskResult>;
  }
  ```
- **5-Tier Granular Hardware Classification & Dynamic Watermark**:
  - Automatically detects total GPU VRAM and platform architecture on startup (with manual UI override in Settings):
    - **Tier 1 (Ultra / Workstation: >= 24GB VRAM / Mac UMA >= 36GB)**: Zero proactive eviction. Massive headroom allows 14B/32B LLMs, Kokoro TTS, SAM 2 vision, and high-res video rendering to reside co-currently in warm memory.
    - **Tier 2 (Pro / Mainstream: 12GB–20GB VRAM / Mac UMA 16GB–32GB)**: Selective co-residence. Standard models (8B LLM + Kokoro TTS) remain loaded simultaneously. Active eviction only triggers if an incoming job exceeds available headroom with a 2.0GB safety floor.
    - **Tier 3 (Budget: 6GB–8GB VRAM / Mac UMA 8GB)**: Active mutual eviction. Strictly enforces mutual exclusion between LLM generation and heavy video export/batch TTS. Enforces a 2.5GB free VRAM floor to prevent Windows DWM / system swap thrashing.
    - **Tier 4 (Ultra-Constrained: < 6GB VRAM, e.g. 4GB GTX 1650 / Laptop GPUs)**: CPU/GPU Role Splitting. Pins Python backend (Kokoro TTS, vision) strictly to CPU (`device: "cpu"`), dedicating the entire 4GB VRAM exclusively to quantized LLMs (Ollama 3B/7B Q4 with a capped 2048 context window).
    - **Tier 5 (CPU-Only / Integrated Graphics)**: GPU VRAM eviction disabled. All inference runs across multi-threaded CPU cores with thread pool and RAM budgeting.
- **Apple Silicon Unified Memory (UMA) Scaling**:
  - Dynamically mapped based on total system unified memory (>=36GB -> Tier 1, 16–32GB -> Tier 2, 8GB -> Tier 3).
  - Utilizes native Metal (MPS) acceleration without PCIe memory cloning overhead.
- **Multi-GPU & Hardware Override**:
  - Auto-detects and prioritizes discrete GPUs over integrated graphics.
  - Supports Dual-GPU splitting if 2 discrete cards exist (e.g. Python backend pinned to GPU 0, Ollama pinned to GPU 1).
  - Exposes `hardwareTierOverride` in `~/.acc/control-plane.json` and in the Electrobun GUI Settings dropdown (`Auto (Detected)`, `Tier 1 - Ultra`, `Tier 2 - Pro`, `Tier 3 - Budget`, `Tier 4 - Constrained`, `Tier 5 - CPU`).
- **Eviction Handshake & Safety Protocol**:
  - Before high-priority batch TTS or export render: calls `ollama.purgeVRAM()` (`POST /api/generate` with `keep_alive: 0`).
  - Before interactive LLM prompt expansion: calls `python.purgeVRAM()` (`/acc.v1.AdminService/PurgeVRAM` -> `torch.cuda.empty_cache()`).
  - Active polling handshake: polls `/api/ps` or GPU headroom every 100ms up to a 3.0s timeout before proceeding.

#### Dedicated Standalone Package: `apps/studio` (Pure Client-Side React 19 NLE)
- **Frontend Architecture**: Pure React 19 + Vite + TailwindCSS v4 + Shadcn UI with **Default Light Theme**.
- **Zero Server Footprint (Option A)**: No backend server process; `apps/studio/src/server/` is deleted. Preview and export run 100% in the user browser.
- **Modular Layout**:
  - `<Titlebar />`: Project switcher, zoom, resolution selector, dark mode toggle, and export MP4 button.
  - `<Sidebar />`: Dual-tab for Asset Vault (input media vs generated client renders) & dynamic Sequence Modifier Inspector.
  - `<Preview />`: Aspect-ratio-locked viewport monitor with HTML5 `<canvas>`, calibrated WebGL fragment shaders, and event-driven rendering (0 FPS idle).
  - `<Timeline />`: Multi-track virtualized timeline with zoomable timecode axis, clip boundary trimming, magnetic snapping, and standard transport shortcuts (`Space`, `J/K/L`).
- **Client-Side WebCodecs Video Export (`MediabunnyClientSink`)**:
  - Direct in-browser MP4 encoding using `MediabunnyClientSink` (@acc/core/client).
  - Extracts RGBA frames from offscreen HTML5 `<canvas>`, encodes via WebCodecs `VideoEncoder`, muxes into MP4 `BufferTarget`, and downloads the resulting Blob directly in the browser.
  - Responsive cancellation flag cancels export loop instantly with zero memory leaks.
- **Vite Development & Static Distribution**:
  - Development: Instant HMR via `vite` (`bun run dev`).
  - Production: `vite build` bundles static files into `apps/studio/dist/client`, ready for static web hosting or Electrobun packaging.

---

### 2.3 Epic 3: Enterprise Lightweight Python AI Subsystem (`apps/python-backend`)

#### Parent Process Watchdog Thread (`src/server.py`)
```python
import os, time, sys, threading

def start_parent_watchdog(parent_pid: int):
    def _poll():
        while True:
            time.sleep(1.0)
            try:
                os.kill(parent_pid, 0)
            except OSError:
                print(f"[ACC Python AI] Parent process {parent_pid} terminated. Exiting immediately.", flush=True)
                sys.exit(0)
    t = threading.Thread(target=_poll, daemon=True)
    t.start()
```

#### Dynamic VRAM Memory Manager (`src/services/model_lifecycle_manager.py`)
- Maintains an LRU cache of instantiated models (`KokoroTTS`, `DepthAnythingV2`, `BiRefNetSAM2`).
- Idle eviction timer: After 120s of zero inference requests, unloads weights, calls `torch.cuda.empty_cache()` (if CUDA is present), and runs Python `gc.collect()`.
- Exposes an explicit gRPC RPC `/acc.v1.AdminService/PurgeVRAM` triggered by the Electrobun Control Plane.

#### Ollama AI Inference Adapter (`src/services/llm_engine.py`)
- Connects `LLMEngine.generate_structured_json` directly to the supervised Ollama endpoint (default `http://127.0.0.1:11434/api/generate` or resolved port).
- Transmits structured JSON requests using Ollama's `format: "json"` mode with configured model (e.g. `llama3.2`, `qwen2.5`, `mistral`).
- Zero-Crash Resilient Fallback: If Ollama is offline or uninstalled, automatically falls back to the deterministic regex extractor without pipeline interruptions.

---

## 3. Phased Implementation Roadmap

| Phase | Epic | Scope & Deliverables |
| :--- | :--- | :--- |
| **Phase 1** | **Epic 1: Electrobun Control Plane** | Scaffold `apps/ai-supervisor`, configure Electrobun tray-first runtime, build dynamic port collision scanner, Windows startup registry helper, `~/.acc/control-plane.json` config store, 10K-line rolling ring buffer with 10MB disk log rotation, and `SupervisorEngine` with exponential backoff crash recovery and non-blocking `BUSY` health probing. |
| **Phase 2** | **Epic 1: Control Plane UI Dashboard** | Build native WebView2 Shadcn Light UI: service health cards, CPU/RAM/VRAM meters, Start/Stop/Restart buttons, live tabbed colored log streaming console, and Purge VRAM action. |
| **Phase 3** | **Epic 2: Standalone Worker App** | Scaffold `apps/worker` with standalone `package.json`, pluggable `ITaskPoller` (`SandboxTaskPoller`), default Core Suite task commands (story script, TTS synthesis, IR composition), and `BackendHypervisor` VRAM arbitrator. |
| **Phase 4** | **Epic 2: Standalone React Studio App** | Scaffold `apps/studio` with Vite, React 19, TailwindCSS v4, Shadcn UI (Light Mode default) as pure client SPA (Option A). Implement HTML5 `<canvas>` preview and `MediabunnyClientSink` WebCodecs in-memory export. |
| **Phase 5** | **Epic 2: VideoFlow NLE Timeline & Lightweight Viewport** | Implement zoomable multi-track timeline, boundary trimming, magnetic snapping, event-driven zero-waste canvas rendering, Web Audio client scrubbing + `/api/audio/preview` server mix, and calibrated WebGL shader preview. |
| **Phase 6** | **Epic 3: Python Backend Resilience & Watchdog** | Add parent PID watchdog thread, PID file locking, `grpc.health.v1` health servicer, and signal traps to `apps/python-backend`. |
| **Phase 7** | **Epic 3: VRAM Lifecycle Manager & Admin RPC** | Implement `ModelLifecycleManager` in Python with 120s idle timeout auto-eviction, CUDA cache purge, and wired gRPC `PurgeVRAM` endpoint. |
| **Phase 8** | **All: Master Integration & End-to-End QA** | Verify full workflow: launch Electrobun control plane from system tray $\rightarrow$ start all daemons $\rightarrow$ open React Studio $\rightarrow$ scrub timeline & edit modifiers $\rightarrow$ monitor worker & Python logs $\rightarrow$ verify clean exit with zero zombie processes. Update master documentation. |

---

## 4. Verification & Acceptance Criteria
- [ ] `apps/ai-supervisor` builds and launches as a native Windows tray application using Electrobun (< 30MB RAM footprint).
- [ ] Closing the dashboard window minimizes to the system tray (`exitOnLastWindowClosed: false`).
- [ ] If port `:50051` or `:3300` is occupied, the supervisor automatically selects the next available port and updates child processes without crashing.
- [ ] Simulated daemon crashes auto-restart with exponential backoff (1s, 2s, 4s) up to 3 attempts before setting `CRASH_LOOP` status and alerting via native notification.
- [ ] Active workloads mark the service status as `BUSY/PROCESSING` without triggering false `OFFLINE` alerts.
- [ ] Embedded log console displays up to 10,000 lines from RAM ring buffer with instant search, and rotates logs on disk at 10MB.
- [x] React Studio viewport runs event-driven (0 FPS at idle, smooth during playback/scrubbing), avoiding redundant CPU/GPU repaints.
- [x] Clicking "Cancel Export" in React Studio aborts the render job cleanly via `AbortSignal`, deletes temp files, and frees native encoder memory.
- [x] If Python is offline, `apps/worker` receives `ACC_AI_OFFLINE=1` and falls back cleanly without hanging.
- [x] `StudioServer` serves media files via HTTP 206 range requests; video elements seek smoothly without stutter.
- [x] Client Web Audio engine provides zero-latency timeline scrubbing and accurate real-time audio ducking without server dependencies.
- [ ] Clicking "Purge VRAM" successfully frees Python CUDA/RAM allocations via gRPC admin call.
- [x] `apps/worker` and `apps/studio` run as independent standalone packages with dedicated `dev` and `build` commands (worker & studio implemented).
- [ ] Dual-target scripts allow both source-level live development (`bun run supervisor:dev`) and production standalone packaging (`bun run supervisor:build`).
- [ ] Terminating the control plane or parent Bun process kills all child processes cleanly without leaving orphaned zombie daemons.
