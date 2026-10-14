import {
  BrowserWindow,
  Tray,
  Utils,
  app,
  type ElectrobunRPCSchema,
  type MenuItemConfig,
} from 'electrobun/main';
import * as fs from 'fs';
import * as path from 'path';
import type {
  DesktopRPCRequests,
  DesktopRPCMessages,
  DesktopTrayStatusPayload,
  DesktopThemePayload,
} from './rpc-schema';

export type DesktopRPCSchema = ElectrobunRPCSchema<{
  requests: DesktopRPCRequests;
  messages: DesktopRPCMessages;
}>;

let mainWindow: BrowserWindow | null = null;
let systemTray: Tray | null = null;
let currentTrayStatus: DesktopTrayStatusPayload = {
  tenantId: 'tenant-us-east-1',
  tenantName: 'US Production Hub',
  syncStatus: 'ONLINE',
  pendingMutationsCount: 0,
};

/**
 * Configure System Tray with dynamic tenant & sync status
 */
export function buildTrayMenu(
  status: DesktopTrayStatusPayload,
  onAction?: (action: 'open-console' | 'force-sync' | 'quit') => void
): MenuItemConfig[] {
  const syncLabel =
    status.syncStatus === 'SYNCING'
      ? `⏳ Syncing (${status.pendingMutationsCount} pending)...`
      : status.syncStatus === 'OFFLINE'
        ? `⚠️ Offline (${status.pendingMutationsCount} queued)`
        : status.syncStatus === 'ERROR'
          ? `❌ Sync Error (${status.pendingMutationsCount} queued)`
          : `✓ All Changes Synced`;

  return [
    {
      type: 'normal',
      label: `UniPost Desktop — ${status.tenantName}`,
      enabled: false,
    },
    {
      type: 'normal',
      label: syncLabel,
      enabled: false,
    },
    {
      type: 'divider',
    },
    {
      type: 'normal',
      label: 'Open Console',
      action: () => {
        if (mainWindow) {
          mainWindow.activate();
        }
        onAction?.('open-console');
      },
    },
    {
      type: 'normal',
      label: 'Force Sync Outbox',
      action: () => {
        onAction?.('force-sync');
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'normal',
      label: 'Quit UniPost Desktop',
      action: () => {
        onAction?.('quit');
        app.quit();
      },
    },
  ];
}

/**
 * Initialize system tray icon and context menu
 */
function initSystemTray() {
  try {
    const iconPath = path.resolve(__dirname, '../../resources/win/icon.ico');
    systemTray = new Tray({
      title: 'UniPost',
      image: fs.existsSync(iconPath) ? iconPath : '',
      template: false,
      width: 16,
      height: 16,
    });

    systemTray.setMenu(buildTrayMenu(currentTrayStatus));
  } catch (err) {
    console.warn('[DesktopConsole] System tray initialization skipped or unsupported:', err);
  }
}

/**
 * RPC Request handlers executed in the Electrobun Main / Bun Process
 */
export const desktopRPCHandlers = {
  // 1. Native OS File Picker for schema import/export
  async openSchemaFileDialog(params: any) {
    try {
      const paths = await Utils.openFileDialog({
        startingFolder: params.startingFolder || '~/',
        allowedFileTypes: params.allowedFileTypes || 'json',
        canChooseFiles: params.canChooseFiles ?? true,
        canChooseDirectory: params.canChooseDirectory ?? false,
        allowsMultipleSelection: params.allowsMultipleSelection ?? false,
      });

      if (!paths || paths.length === 0) {
        return { canceled: true, filePaths: [] };
      }

      const files = paths.map((filePath) => ({
        path: filePath,
        fileName: path.basename(filePath),
        content: fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '',
      }));

      return {
        canceled: false,
        filePaths: paths,
        files,
      };
    } catch (error: any) {
      console.error('[DesktopConsole] openSchemaFileDialog error:', error);
      return { canceled: true, filePaths: [], error: error.message };
    }
  },

  // 2. Read local schema file directly into JSON
  async readSchemaFile(params: { filePath: string }) {
    try {
      if (!fs.existsSync(params.filePath)) {
        return { success: false, error: `File not found: ${params.filePath}` };
      }
      const raw = fs.readFileSync(params.filePath, 'utf-8');
      const data = JSON.parse(raw);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // 3. Write schema file to disk
  async writeSchemaFile(params: { filePath: string; content: string }) {
    try {
      const dir = path.dirname(params.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(params.filePath, params.content, 'utf-8');
      return { success: true, filePath: params.filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // 4. Native OS Desktop Notification for outbox sync
  async sendSyncNotification(params: any) {
    try {
      Utils.showNotification({
        title: params.title || 'UniPost Desktop Sync',
        body: params.body || 'Outbox synchronization completed',
        subtitle: params.subtitle,
        silent: params.silent ?? false,
      });
      return { success: true };
    } catch (error) {
      console.error('[DesktopConsole] showNotification error:', error);
      return { success: false };
    }
  },

  // 5. Dynamic Tray Menu update
  async updateTrayStatus(params: DesktopTrayStatusPayload) {
    currentTrayStatus = { ...params };
    if (systemTray) {
      systemTray.setMenu(buildTrayMenu(currentTrayStatus));
    }
    return { success: true };
  },

  // 6. Window Vibrancy & Glass styling
  async setWindowVibrancy(params: DesktopThemePayload) {
    if (mainWindow) {
      // Set title indicating active vibrancy profile
      const themeLabel = params.theme.toUpperCase();
      mainWindow.setTitle(`UniPost Enterprise Console [${themeLabel} · ${params.vibrancy.toUpperCase()}]`);
    }
    return { success: true };
  },

  // 7. System Diagnostics
  async getDesktopSystemInfo() {
    return {
      platform: (process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux') as any,
      arch: process.arch,
      appVersion: '1.0.0',
      isPackaged: app.isPackaged,
    };
  },
};

/**
 * Creates and stages the primary application window with Windows 11 Acrylic / macOS Vibrancy
 */
function createWindow() {
  const isLocal = process.env.APP_ENV === 'LOCAL' && !!process.env.RENDERER_URL;
  const url = isLocal
    ? process.env.RENDERER_URL!
    : 'views://electron-web/index.html';

  mainWindow = new BrowserWindow({
    title: 'UniPost Enterprise Desktop Console',
    url,
    frame: {
      width: 1440,
      height: 900,
      x: 0,
      y: 0,
    },
    // Vibrancy & Liquid Glass aesthetic options
    titleBarStyle: 'hiddenInset', // Translucent titlebar with inset controls
    transparent: true,           // Enables background alpha for Mica / Acrylic / NSVisualEffectView
    spellCheck: true,
  });

  initSystemTray();
}

createWindow();
