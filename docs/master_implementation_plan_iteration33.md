# Master Implementation Plan - Iteration 33
# AI-Supervisor Desktop Control Plane: SolidJS + Ark UI + Tailwind CSS v4 with Native Bun Bundler

## 1. Executive Summary & Design Alignment
The ACC AI-Supervisor Control Plane Dashboard ([`apps/ai-supervisor/src/views/index.html`](../apps/ai-supervisor/src/views/index.html)) is currently implemented as a monolithic 315-line vanilla HTML/JavaScript file with string-based DOM manipulations (`innerHTML`), untyped HTTP polling, unmanaged error/empty states, and non-modular CSS.

This iteration refactors the AI-Supervisor dashboard to enterprise-grade production quality using:
1. **SolidJS Fine-Grained Reactivity**:
   - Zero Virtual DOM overhead, surgical DOM updates, native signals, and resource lifecycle management.
2. **Ark UI Headless Accessible Primitives**:
   - WAI-ARIA compliant, keyboard-navigable components (Tabs, Menu, Dialog/Drawer, Switch).
3. **Tailwind CSS v4 Modern Design System**:
   - Fully adhering to the 5+ state component matrix (Default, Loading skeletons, Empty, Error recovery, Disabled) from `/ui-ux-design-principles`.
4. **Native Bun Bundling Pipeline (Zero Vite)**:
   - Built natively with **`Bun.build`** and `@tailwindcss/cli` via `scripts/build-ui.ts`.
   - Uses `babel-preset-solid` in a lightweight native `Bun.plugin` to compile JSX into DOM templates in <300ms without heavy node build tools or Vite dev servers.
5. **Seamless Embedded Server Hosting**:
   - The embedded `Bun.serve` server in `src/bun/index.ts` automatically serves compiled static assets (`dist/ui/index.html`, `dist/ui/app.js`, `dist/ui/index.css`) directly from disk.

---

## 2. Architecture & Component Interaction

```mermaid
flowchart TD
    subgraph UI Source ["SolidJS Component Architecture (apps/ai-supervisor/src/ui/)"]
        App["App.tsx (Root Layout & Global State)"]
        Header["HeaderBar.tsx (Hardware Tier, Tray Status, Global Actions)"]
        Telemetry["TelemetryGrid.tsx (GPU, VRAM, RAM, CPU 5-State Cards)"]
        Fleet["FleetGrid.tsx & ServiceCard.tsx (Daemon Controls & Live Status)"]
        Console["ConsoleSection.tsx (Ark UI Tabs & Real-Time Terminal Logs)"]
        Settings["SettingsModal.tsx (Ark UI Dialog for Autostart & Ports)"]

        App --> Header
        App --> Telemetry
        App --> Fleet
        App --> Console
        App --> Settings
    end

    subgraph Native Bun Build Pipeline ["Native Bun Build Pipeline (scripts/build-ui.ts)"]
        SolidPlugin["Bun.plugin (babel-preset-solid)"]
        BunBuild["Bun.build({ entrypoints: ['src/ui/index.tsx'], outdir: 'dist/ui' })"]
        TailwindCLI["@tailwindcss/cli (Tailwind CSS v4 compile to dist/ui/index.css)"]
        HTMLGen["Generate dist/ui/index.html with bundled script & stylesheet"]

        SolidPlugin --> BunBuild
        BunBuild --> HTMLGen
        TailwindCLI --> HTMLGen
    end

    subgraph Supervisor Server ["Embedded Bun.serve Server (src/bun/index.ts)"]
        StaticServer["Serves dist/ui/ static assets (index.html, JS, CSS)"]
        API["REST APIs: /api/status, /api/logs/*, /api/service/*, /api/vram/purge, /api/config"]
    end

    UI Source --> Native Bun Build Pipeline
    HTMLGen --> StaticServer
```

---

## 3. Work Breakdown & Detailed Tasks

### Phase 1: Dependencies & Native Build Runner
- **`apps/ai-supervisor/package.json`**:
  - Add runtime dependencies: `solid-js`, `@ark-ui/solid`, `lucide-solid`.
  - Add dev dependencies: `tailwindcss`, `@tailwindcss/cli`, `@babel/core`, `babel-preset-solid`.
  - Add scripts:
    - `"build:ui"`: `"bun run scripts/build-ui.ts"`
    - `"dev:ui"`: `"bun run scripts/build-ui.ts --watch"`
    - `"build"`: `"bun run build:ui && bun build src/bun/index.ts --compile --outfile=dist/acc-supervisor.exe"`
- **`apps/ai-supervisor/scripts/build-ui.ts`**:
  - Register `solid-jsx` Bun plugin with `babel-preset-solid`.
  - Run `Bun.build({ entrypoints: ['src/ui/index.tsx'], outdir: 'dist/ui', naming: 'app.js', minify: true, sourcemap: 'external' })`.
  - Invoke `bunx @tailwindcss/cli -i src/ui/index.css -o dist/ui/index.css --minify`.
  - Write `dist/ui/index.html` referencing `/index.css` and `/app.js`.
  - Support `--watch` flag for active recompilation during development.

### Phase 2: Domain Contracts & Reactive Store
- **`apps/ai-supervisor/src/ui/types.ts`**:
  - Strictly typed contracts matching backend: `ServiceState`, `ServiceMap`, `HardwareProfile`, `UpdateStatus`, `SupervisorConfig`, `SupervisorStatusResponse`, `TrayColor`.
- **`apps/ai-supervisor/src/ui/stores/supervisorStore.ts`**:
  - Manage periodic polling (2s for `/api/status`, 3s for `/api/logs/:service`).
  - Signal-driven state with active log service selection and keyword filtering.
  - Action methods: `controlService(name, action)`, `purgeVram()`, `restartAll()`, `checkUpdates()`, `saveConfig(config)`.

### Phase 3: Accessible Component Hierarchy
- **`apps/ai-supervisor/src/ui/components/HeaderBar.tsx`**:
  - Hardware Tier badge (e.g. `TIER1 (CUDA)`, `TIER5 (CPU)`).
  - Status indicator (Healthy / Fleet Processing / Alert).
  - Global action bar with icons: *Purge All VRAM*, *Restart Fleet*, *Check Updates*, *Open Studio*.
- **`apps/ai-supervisor/src/ui/components/TelemetryGrid.tsx`**:
  - 4 telemetry cards adhering to the 5-state component matrix (Default, Loading skeletons, Error):
    1. *Hardware Profile*: Active GPU model or CPU fallback with VRAM indicator.
    2. *System RAM*: Free / Total GB with dynamic usage bar.
    3. *Python Device*: Active recommended target (`cuda`, `mps`, `cpu`).
    4. *CPU Cores*: Active core topology and thread allocation.
- **`apps/ai-supervisor/src/ui/components/FleetGrid.tsx` & `ServiceCard.tsx`**:
  - 4 managed daemons: `python-backend`, `worker`, `studio`, `ollama`.
  - Displays PID, Port, Uptime, Status badge, and controls (*Start*, *Stop*, *Restart*, *Purge VRAM*).
- **`apps/ai-supervisor/src/ui/components/ConsoleSection.tsx`**:
  - Log viewer using `@ark-ui/solid` Tabs for active service selection.
  - Real-time search filter input with instant client-side filtering.
  - Monospace terminal with color-coded log levels (info, warn, error).
- **`apps/ai-supervisor/src/ui/components/SettingsModal.tsx`**:
  - Ark UI Dialog modal: autostart on system login toggle, port configurations, and update simulation.
- **`apps/ai-supervisor/src/ui/App.tsx`**:
  - Root layout composing all sections inside a responsive dark/light styled container.

### Phase 4: Server Integration & Static Asset Router
- **`apps/ai-supervisor/src/bun/index.ts`**:
  - Update embedded server static file routing to serve `dist/ui/` (`/`, `/index.html`, `/app.js`, `/index.css`).
  - Retain fallback to legacy `src/views/index.html` if `dist/ui/` is not yet built.

---

## 4. Verification & Testing Strategy
1. **Native UI Compilation**:
   - `bun run --cwd apps/ai-supervisor build:ui` — verify clean generation of `dist/ui/app.js` and `dist/ui/index.css`.
2. **Supervisor Executable Build**:
   - `bun run --cwd apps/ai-supervisor build` — verify standalone `dist/acc-supervisor.exe` compiles cleanly.
3. **Automated Test Suites**:
   - Existing tests: `bun test autogenerated-tests/supervisor_engine.test.ts` & `native_tray_cross_platform.test.ts`.
   - New test: `autogenerated-tests/supervisor_solid_ui.test.ts` verifying static bundle asset availability and server HTTP routing.
