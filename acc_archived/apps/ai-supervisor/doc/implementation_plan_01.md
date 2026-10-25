# Implementation Plan 01: AI-Supervisor SolidJS + Ark UI + Tailwind CSS Desktop Control Plane Modernization

## Goal Description
Refactor the single-file dashboard UI ([`apps/ai-supervisor/src/views/index.html`](../src/views/index.html)) into an enterprise-grade, accessible **SolidJS + Ark UI + Tailwind CSS + TypeScript** architecture.

Per requirements: **No Vite**. We build and bundle natively using **`Bun.build`** with a zero-Vite build script (`scripts/build-ui.ts`) and Tailwind CLI (`@tailwindcss/cli`).

---

## Architecture & Native Bun Bundling Pipeline

```mermaid
flowchart TD
    subgraph UI Source ["SolidJS Component Architecture (apps/ai-supervisor/src/ui/)"]
        App["App.tsx (Root Layout & Global State)"]
        Header["HeaderBar.tsx (Hardware Tier, Tray Status, Actions)"]
        Telemetry["TelemetryGrid.tsx (GPU, VRAM, RAM, CPU Metrics)"]
        Fleet["FleetGrid.tsx & ServiceCard.tsx (Daemon Controls & Status)"]
        Console["ConsoleSection.tsx (Ark UI Tabs & Terminal Logs)"]
        Settings["SettingsModal.tsx (Autostart & Dynamic Ports)"]

        App --> Header
        App --> Telemetry
        App --> Fleet
        App --> Console
        App --> Settings
    end

    subgraph Native Bun Build Pipeline ["Native Bun Build Pipeline (scripts/build-ui.ts)"]
        SolidPlugin["Bun.plugin (babel-preset-solid)"]
        BunBuild["Bun.build({ entrypoints: ['src/ui/index.tsx'], outdir: 'dist/ui' })"]
        TailwindCLI["@tailwindcss/cli (Tailwind CSS v4 to dist/ui/index.css)"]
        HTMLGen["Generate dist/ui/index.html with bundled script & css"]

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

## Proposed Changes

### 1. Build Pipeline & Dependencies
#### [MODIFY] `apps/ai-supervisor/package.json`
- Add runtime dependencies:
  - `solid-js`
  - `@ark-ui/solid`
  - `lucide-solid`
- Add dev dependencies:
  - `tailwindcss`
  - `@tailwindcss/cli`
  - `@babel/core`
  - `babel-preset-solid`
- Add scripts:
  - `"build:ui"`: `"bun run scripts/build-ui.ts"`
  - `"dev:ui"`: `"bun run scripts/build-ui.ts --watch"`
  - Update `"build"`: `"bun run build:ui && bun build src/bun/index.ts --compile --outfile=dist/acc-supervisor.exe"`

#### [NEW] `apps/ai-supervisor/scripts/build-ui.ts`
- Native Bun build runner:
  - Registers `solid-jsx` Bun plugin.
  - Bundles `src/ui/index.tsx` into `dist/ui/app.js` with minification and sourcemaps.
  - Runs `@tailwindcss/cli` to build `dist/ui/index.css`.
  - Emits the production `dist/ui/index.html` loading `index.css` and `app.js`.
  - Supports `--watch` flag for rapid development recompilation.

---

### 2. Frontend UI Implementation (`apps/ai-supervisor/src/ui/`)

#### [NEW] `apps/ai-supervisor/src/ui/index.tsx`
- SolidJS entrypoint mounting `<App />` to `#root`.

#### [NEW] `apps/ai-supervisor/src/ui/index.css`
- Tailwind CSS v4 imports (`@import "tailwindcss";`) and custom slate/cyan dark mode theme tokens.

#### [NEW] `apps/ai-supervisor/src/ui/types.ts`
- Fully typed data contracts for:
  - `ServiceState`, `ServiceMap`, `HardwareProfile`, `UpdateStatus`, `SupervisorConfig`, `SupervisorStatusResponse`, `TrayColor`.

#### [NEW] `apps/ai-supervisor/src/ui/stores/supervisorStore.ts`
- Reactive Solid store (`createStore`, `createSignal`):
  - 2s interval polling for `/api/status`.
  - 3s interval polling for `/api/logs/:service`.
  - Action mutations: `controlService()`, `purgeVram()`, `restartAll()`, `checkUpdates()`, `saveConfig()`.

#### [NEW] `apps/ai-supervisor/src/ui/components/HeaderBar.tsx`
- Top navigation bar featuring:
  - Application title & version.
  - Active Hardware Tier badge (e.g. `TIER1 (CUDA)`, `TIER5 (CPU)`).
  - Dynamic System Tray status indicator (Healthy / Processing / Alert).
  - Quick action buttons with icons: *Purge All VRAM*, *Restart Fleet*, *Check Updates*, *Open Studio*.

#### [NEW] `apps/ai-supervisor/src/ui/components/TelemetryGrid.tsx`
- 4 telemetry cards adhering to the 5-state component matrix (Default, Loading skeleton, Error):
  1. **Hardware Profile**: Active GPU name or CPU fallback.
  2. **System RAM**: Visual progress gauge with Free / Total GB formatted.
  3. **Python Device**: Recommended target (`cuda`, `mps`, `cpu`).
  4. **CPU Cores**: Detected active thread/core capacity.

#### [NEW] `apps/ai-supervisor/src/ui/components/FleetGrid.tsx` & `ServiceCard.tsx`
- Grid of 4 managed daemons:
  - `python-backend` (Kokoro TTS & Vision)
  - `worker` (Conductor Hypervisor)
  - `studio` (NLE Web Server)
  - `ollama` (Local LLM Inference)
- Service cards display PID, Port, Uptime, Status badge, and controls (*Start*, *Stop*, *Restart*, *Purge VRAM*).

#### [NEW] `apps/ai-supervisor/src/ui/components/ConsoleSection.tsx`
- Log viewer using `@ark-ui/solid` Tabs for active service selection.
- Search filter input with instant client-side filtering.
- Monospace terminal with color-coded log levels (info, warn, error).

#### [NEW] `apps/ai-supervisor/src/ui/components/SettingsModal.tsx`
- Modal dialog using `@ark-ui/solid` Dialog primitive:
  - Toggle autostart at login.
  - View & configure ports.
  - Test / simulate updates.

#### [NEW] `apps/ai-supervisor/src/ui/App.tsx`
- Root layout composing all sections inside a responsive container.

---

### 3. Server Static Asset Route Integration
#### [MODIFY] `apps/ai-supervisor/src/bun/index.ts`
- Update embedded `Bun.serve` router to serve files from `dist/ui/` (`/index.html`, `/app.js`, `/index.css`), with fallback to legacy `src/views/index.html` if `dist/ui/` hasn't been built yet.

---

## Verification Plan

### Automated Tests
1. **Native UI Build Verification**:
   - `bun run --cwd apps/ai-supervisor build:ui` — verify `dist/ui/index.html`, `dist/ui/app.js`, and `dist/ui/index.css` are generated cleanly.
2. **End-to-End Monorepo Compilation**:
   - `bun run --cwd apps/ai-supervisor build` — verify standalone `dist/acc-supervisor.exe` compiles without errors.
3. **Automated Test Suites**:
   - `bun test autogenerated-tests/supervisor_engine.test.ts`
   - `bun test autogenerated-tests/native_tray_cross_platform.test.ts`
   - Add new test: `autogenerated-tests/supervisor_solid_ui.test.ts` asserting generated bundles and static server endpoints.

### Manual Verification
1. Launch `bun --cwd apps/ai-supervisor dev`.
2. Inspect the native WKWebView window on macOS:
   - Check that SolidJS components render cleanly without layout shifts.
   - Verify Ark UI tabs switch logs instantaneously.
   - Click "Purge All VRAM" and verify UI updates and feedback.
