# History 423: Eliminate Multi-Platform Tray and Window Scripts for Pure Electrobun

## Problem
`apps/ai-supervisor` previously relied on ad-hoc platform scripts (`tray_runner.ps1`, `tray_runner_mac.swift`, `tray_runner_linux.py`, `webview_host_win.ps1`, `webview_host_mac.swift`, `webview_host_linux.py`, `WindowHost.ts`, `NativeTrayBridge.ts`, and `compile-native.ts`) running through standard Bun subprocesses. This bypassed Electrobun's native desktop host, introducing script execution overhead, missing FFI libraries in standalone mode, and redundant platform-specific shell scripts.

## Plan
1. Completely remove all legacy multi-platform scripts (`tray_runner.*`, `webview_host.*`, `compile-native.ts`) and subprocess wrappers (`WindowHost`, `NativeTrayBridge`, `src/bun/platform/`).
2. Integrate pure Electrobun APIs (`BrowserWindow`, `Tray`, `MenuItemConfig`) directly into `src/bun/index.ts`.
3. Support dynamic tray icon state updates, menu dispatching (`Open Dashboard`, `Purge All VRAM`, `Restart Services`, `Check for Updates...`, `Quit`), and singleton window management.
4. Align `package.json`, `scripts/dev-runner.ts`, and `tsconfig.json` with the Electrobun Devkit workflow.

## Changes
- **Updated** `apps/ai-supervisor/src/bun/index.ts`: Direct integration of `BrowserWindow` and `Tray` from `electrobun/bun`.
- **Removed** `apps/ai-supervisor/src/bun/NativeTrayBridge.ts` & `WindowHost.ts`.
- **Removed** `apps/ai-supervisor/src/bun/platform/` directory.
- **Removed** `apps/ai-supervisor/src/assets/tray_runner.*` & `webview_host.*`.
- **Removed** `apps/ai-supervisor/scripts/compile-native.ts`.
- **Updated** `apps/ai-supervisor/package.json` & `scripts/dev-runner.ts`.
- **Updated** `apps/ai-supervisor/tsconfig.json` with devkit path mappings.

## Verification
- Built UI bundle via `bun run scripts/build-ui.ts`.
- Validated Electrobun configuration via `electrobun config`.
- Verified build and launch via `electrobun dev`.
