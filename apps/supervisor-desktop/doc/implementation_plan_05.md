# Implementation Plan 05: Decouple AI-Supervisor into Headless Worker Daemon and Tauri 2.x Desktop GUI Host

## 1. Executive Summary

Based on the `/grill-me` alignment, this plan details the execution steps to decouple `@acc/ai-supervisor`:
1. Elevate `python-backend` to top-level `apps/python-backend`.
2. Migrate the entire supervisor engine into `@acc/worker` (running headlessly in Bun on port 3333).
3. Rebrand and re-architect `apps/ai-supervisor` into `apps/supervisor-desktop` (`@acc/supervisor-desktop`), powered by **Tauri 2.x** and Rust as a lightweight desktop GUI host with native Windows 11 system tray, Windows Job Object auto-spawn/adoption, and the existing SolidJS dashboard.

---

## 2. Target Directory Topology

```
apps/
├── python-backend/                     # Elevated top-level Python AI gRPC server
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── src/
│   │   ├── server.py                   # Port 50051
│   │   └── services/
│   └── tests/
├── worker/                             # Real Headless Supervisor & Task Daemon
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                    # Entrypoint: bootstraps supervisor & task poller
│       ├── supervisor/                 # Migrated supervisor engine
│       │   ├── SupervisorEngine.ts
│       │   ├── HardwareProfiler.ts
│       │   ├── RuntimeManager.ts
│       │   ├── configStore.ts
│       │   ├── portScanner.ts
│       │   ├── IProcessRunner.ts
│       │   ├── LogManager.ts
│       │   ├── server/
│       │   │   ├── HttpServer.ts       # Unified HTTP/SSE server on Port 3333
│       │   │   └── routes/
│       │   └── telemetry/
│       │       ├── TelemetryEventBroker.ts
│       │       └── OSProcessSampler.ts
│       ├── hypervisor/
│       ├── poller/
│       └── tasks/
└── supervisor-desktop/                 # Lightweight Tauri 2.x Desktop Host
    ├── package.json                    # @acc/supervisor-desktop
    ├── vite.config.ts                  # Vite + SolidJS + Tailwind CSS v4
    ├── tsconfig.json
    ├── src/
    │   └── ui/                         # SolidJS dashboard (App.tsx, stores, components)
    └── src-tauri/
        ├── Cargo.toml                  # Tauri 2.x, tokio, reqwest, eventsource-client
        ├── tauri.conf.json             # Window & tray configurations
        ├── build.rs
        ├── capabilities/
        │   └── default.json
        ├── icons/
        │   ├── icon.ico
        │   ├── tray-green.ico
        │   ├── tray-yellow.ico
        │   └── tray-red.ico
        └── src/
            ├── main.rs                 # Tauri app entrypoint
            ├── lib.rs                  # Window & tray initialization
            ├── tray.rs                 # TrayIconBuilder & dynamic color switching
            ├── sse.rs                  # Tokio background SSE stream listener to port 3333
            └── process.rs              # Smart port 3333 probe & Windows Job Object
```

---

## 3. Phased Roadmap

### Phase 1: Elevate `apps/python-backend` to Top-Level
- Relocate `apps/ai-supervisor/python-backend` $\to$ `apps/python-backend`.
- Update references in `packages/core/src/ipc/IPCFacade.ts` and documentation.
- Verify `cd apps/python-backend && uv run pytest` passes.

### Phase 2: Migrate Supervisor Engine into `@acc/worker` on Port 3333
- Move supervisor source files into `apps/worker/src/supervisor/`.
- Update `SupervisorEngine` paths to resolve `apps/python-backend` and `apps/studio`.
- Consolidate telemetry on port 3333: Retire standalone port 4000 server in favor of `HttpServer` on port 3333.
- Update `apps/worker/src/index.ts` to boot the unified supervisor engine alongside task poller.
- Verify `bun run apps/worker/src/index.ts` starts cleanly and serves `http://127.0.0.1:3333/api/status`.

### Phase 3: Setup `apps/supervisor-desktop` with Tauri 2.x & Vite Pipeline
- Rename `apps/ai-supervisor` to `apps/supervisor-desktop` (package: `@acc/supervisor-desktop`).
- Prune all Electrobun files (`electrobun.config.ts`, `.hutch/`, `.cottontail-tmp/`, `src/bun/`).
- Initialize `src-tauri` with `Cargo.toml`, `tauri.conf.json`, and capability manifests.
- Setup `vite.config.ts` using `vite-plugin-solid` and `@tailwindcss/vite` compiling `src/ui/` to `dist/`.
- Verify clean compilation with `pnpm --filter @acc/supervisor-desktop build`.

### Phase 4: Implement Native Win11 Tray & Dynamic SSE Color Sync
- Embed tray icons (`tray-green.ico`, `tray-yellow.ico`, `tray-red.ico`) in Rust binary.
- Build native system tray via `tauri::tray::TrayIconBuilder` with context menu ("Open Dashboard", "Purge All VRAM", "Restart Services", "Quit").
- Implement `sse.rs`: Tokio background task connecting to `http://127.0.0.1:3333/api/telemetry/stream` to update the tray icon color in real time.
- Implement window close interception (`prevent_close` $\to$ `window.hide()`) and left-click tray restore.

### Phase 5: Implement Smart Auto-Spawn & Adoption with Windows Job Object
- Implement `process.rs` in Rust:
  - On startup, probe TCP port 3333.
  - If open: Set `adopted = true`, attach SSE listener immediately.
  - If closed: Set `adopted = false`, create Windows Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, spawn `bun run apps/worker/src/index.ts`, assign PID to Job Object, await port 3333 ready.
- On desktop quit: If `adopted == false`, terminate worker cleanly; if `adopted == true`, leave worker running.

### Phase 6: Monorepo Integration, Root Scripts & Verification
- Update root `package.json` scripts:
  - `"worker:dev": "bun --cwd apps/worker dev"`
  - `"desktop:dev": "pnpm --filter @acc/supervisor-desktop dev"`
  - `"desktop:build": "pnpm --filter @acc/supervisor-desktop build"`
  - `"supervisor:dev": "pnpm desktop:dev"`
- Verify end-to-end launch:
  - Running `pnpm supervisor:dev` opens the native desktop app with WebView2.
  - System tray icon appears on Windows 11 taskbar and turns green when services are ready.
  - SolidJS dashboard displays live telemetry and fleet cards.
  - Closing desktop app terminates spawned worker with 0 orphaned processes.
