# History 423: Eliminate Multi-Platform Tray and Window Scripts for Pure Electrobun

## Problem
`apps/ai-supervisor` previously relied on ad-hoc platform scripts (`tray_runner.ps1`, `tray_runner_mac.swift`, `tray_runner_linux.py`, `webview_host_win.ps1`, `webview_host_mac.swift`, `webview_host_linux.py`, `WindowHost.ts`, `NativeTrayBridge.ts`, and `compile-native.ts`) running through standard Bun subprocesses. This bypassed Electrobun's native desktop host, introducing script execution overhead, missing FFI libraries in standalone mode, and redundant platform-specific shell scripts.

## Plan
1. Completely remove all legacy multi-platform scripts (`tray_runner.*`, `webview_host.*`, `compile-native.ts`) and subprocess wrappers (`WindowHost`, `NativeTrayBridge`, `src/bun/platform/`).
2. Eliminate outer wrapper scripts (`build-ui.ts`, `dev-runner.ts`) and switch purely to the official Electrobun CLI (`electrobun dev`, `electrobun build`).
3. Leverage Electrobun's built-in view bundler (`views: { main: { entrypoint: "src/ui/index.tsx" } }`) to compile SolidJS and Tailwind CSS v4 directly into packaged view bundles.
4. Integrate pure Electrobun APIs (`BrowserWindow`, `Tray`, `PATHS`, `MenuItemConfig`) directly into `src/bun/index.ts`.
5. Support dynamic tray icon state updates, menu dispatching (`Open Dashboard`, `Purge All VRAM`, `Restart Services`, `Check for Updates...`, `Quit`), and singleton window management.
6. Align `package.json` and `tsconfig.json` with the Electrobun Devkit workflow.

## Changes
- **Updated** `apps/ai-supervisor/src/bun/index.ts`: Direct integration of `BrowserWindow`, `Tray`, and `PATHS.VIEWS_FOLDER` from `electrobun/bun`. Removed legacy `isDistUiMissing` auto-build subshell.
- **Configured** `apps/ai-supervisor/electrobun.config.ts`: Configured `views.main` entrypoint to `src/ui/index.tsx` and copied `src/views/main/index.html` to `views/main/index.html`.
- **Removed** `apps/ai-supervisor/scripts/build-ui.ts` & `scripts/dev-runner.ts` (the entire `scripts/` directory).
- **Removed** `apps/ai-supervisor/src/bun/NativeTrayBridge.ts` & `WindowHost.ts`.
- **Removed** `apps/ai-supervisor/src/bun/platform/` directory.
- **Removed** `apps/ai-supervisor/src/assets/tray_runner.*` & `webview_host.*`.
- **Removed** `apps/ai-supervisor/scripts/compile-native.ts`.
- **Updated** `apps/ai-supervisor/package.json`: Pure electrobun CLI scripts (`"dev": "electrobun dev"`, `"build": "electrobun build"`).
- **Updated** `apps/ai-supervisor/tsconfig.json` with devkit path mappings.

## Verification
- Validated Electrobun view compilation and packaging via `electrobun build`.
- Validated Electrobun configuration via `electrobun config`.
- Verified window lifecycle with explicit `win.show()` and `win.activate()` presentation.
- Added graceful fallback and normalized Win32 filesystem paths for tray icon activation.

