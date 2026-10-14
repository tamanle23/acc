# History Log 060: Electrobun Desktop Native Bridge, Packaging & Hardening (Phase 21)

**Date**: 2026-10-14  
**Scope**: `apps/desktop-console`  
**Phase**: 21 (Iteration 2 Master Plan)

---

## 1. Problem Statement
The desktop application (`apps/desktop-console`) powered by Electrobun needed:
1. **Window Vibrancy & Theming**: Upgrading the window frame to support macOS `NSVisualEffectView` and Windows 11 Acrylic / Mica translucent aesthetics (`titleBarStyle: 'hiddenInset'`, `transparent: true`).
2. **Type-Safe RPC Native Bridge**: Implementing IPC/RPC between the Electrobun main process and the webview UI for native OS capabilities:
   - File picker dialog for schema JSON import and export.
   - Reading/writing schema files on disk with directory auto-creation.
   - Native desktop notifications for outbox sync completions.
   - System tray menu with tenant metadata, sync status badges (`SYNCING`, `OFFLINE`, `ERROR`, `ONLINE`), and quick actions (`Open Console`, `Force Sync Outbox`, `Quit`).
   - Host diagnostics and vibrancy styling synchronization.
3. **Packaging & Verification Pipeline**:
   - Adding a runnable `"test"` script in `apps/desktop-console/package.json`.
   - Configuring `electrobun.config.ts` to bundle `@unipost/console` static assets (`electron-web`) seamlessly.
   - Testing build output with `electrobun build`.

---

## 2. Plan
1. **Define RPC Contract (`rpc-schema.ts`)**:
   - Create type definitions for file picker dialogs, schema read/write, notifications, tray updates, vibrancy, and system diagnostics.
2. **Implement Main Process & RPC Handlers (`src/bun/index.ts`)**:
   - Configure `BrowserWindow` with `titleBarStyle: 'hiddenInset'` and `transparent: true`.
   - Implement `buildTrayMenu()` to render dynamic tray status.
   - Export `desktopRPCHandlers` with error guards and file system utilities.
3. **Packaging Configuration (`electrobun.config.ts`, `tsconfig.json`)**:
   - Map `views` and `copy` configuration to bundle `@unipost/console` assets into `views/electron-web`.
   - Configure TypeScript paths to resolve devkit APIs.
4. **Test Suite (`src/bun/index.test.ts`)**:
   - Test tray menu construction across all sync states (`ONLINE`, `SYNCING`, `OFFLINE`).
   - Test tray menu action callbacks.
   - Test file dialog formatting and cancellation.
   - Test schema file read/write with error handling.
   - Test system notification dispatching.
   - Test host platform diagnostics.
5. **Verification**:
   - Run `pnpm --filter @unipost/desktop test`.
   - Run `pnpm --filter @unipost/desktop build`.

---

## 3. Changes Made

### `apps/desktop-console/src/bun/rpc-schema.ts`
- Defined `DesktopRPCRequests` and `DesktopRPCMessages`.
- Defined data contracts: `DesktopOpenFileDialogOptions`, `DesktopNotificationPayload`, `DesktopTrayStatusPayload`, `DesktopThemePayload`, `DesktopSchemaFileContent`.

### `apps/desktop-console/src/bun/index.ts`
- Added `buildTrayMenu(status, onAction)` constructing tray menu entries reflecting tenant name and sync state.
- Implemented `desktopRPCHandlers` covering:
  - `openSchemaFileDialog`
  - `readSchemaFile`
  - `writeSchemaFile`
  - `sendSyncNotification`
  - `updateTrayStatus`
  - `setWindowVibrancy`
  - `getDesktopSystemInfo`
- Updated `BrowserWindow` with `titleBarStyle: 'hiddenInset'`, `transparent: true`, and window dimensions.

### `apps/desktop-console/electrobun.config.ts` & `package.json`
- Mapped copy source `resources/console-web` to `views/electron-web`.
- Added `"test": "pnpm --filter mobile-ui exec vitest run --config ../desktop-console/vitest.config.ts"` to `package.json`.
- Configured `.gitignore` to ignore build artifacts and local copies.

### `apps/desktop-console/src/bun/index.test.ts`
- 9 unit tests verifying all RPC handlers and tray status builders.

---

## 4. Verification
- `pnpm --filter @unipost/desktop test`: 9 passed in 335ms.
- `pnpm --filter @unipost/desktop build`: Built successfully to `build/dev-win-x64` with `views/electron-web/index.html` bundled.
- `pnpm --filter mobile-ui test`: All 23 tests remain green.

---

## 5. Next Steps
- **Phase 22**: Visual Dynamic Schema & State Machine (FSM) Workflow Studio (`apps/console/src/features/metadata/studio/`).
- **Phase 23**: Tenant Custom Theming, White-Labeling & Dynamic Domain Blueprint Seeding.
