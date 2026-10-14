/**
 * Type-safe Electrobun RPC contract for UniPost Desktop Console.
 * Bridges native operating system capabilities (file dialogs, system notifications,
 * system tray status, and theme synchronization) to the webview UI.
 */

export interface DesktopFileFilter {
  name: string;
  extensions: string[];
}

export interface DesktopOpenFileDialogOptions {
  startingFolder?: string;
  allowedFileTypes?: string;
  canChooseFiles?: boolean;
  canChooseDirectory?: boolean;
  allowsMultipleSelection?: boolean;
}

export interface DesktopNotificationPayload {
  title: string;
  body?: string;
  subtitle?: string;
  silent?: boolean;
}

export interface DesktopTrayStatusPayload {
  tenantId: string;
  tenantName: string;
  syncStatus: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR';
  pendingMutationsCount: number;
}

export interface DesktopThemePayload {
  theme: 'light' | 'dark' | 'system';
  vibrancy: 'mica' | 'acrylic' | 'vibrant' | 'none';
}

export interface DesktopSchemaFileContent {
  path: string;
  fileName: string;
  content: string;
}

/**
 * Electrobun RPC Request/Response Specification
 */
export interface DesktopRPCRequests {
  // Native File Picker Dialog for Schema JSON import / export
  openSchemaFileDialog: {
    params: DesktopOpenFileDialogOptions;
    response: {
      canceled: boolean;
      filePaths: string[];
      files?: DesktopSchemaFileContent[];
    };
  };

  // Read local schema file directly into JSON
  readSchemaFile: {
    params: { filePath: string };
    response: {
      success: boolean;
      data?: Record<string, unknown>;
      error?: string;
    };
  };

  // Write exported schema/record JSON to disk
  writeSchemaFile: {
    params: { filePath: string; content: string };
    response: {
      success: boolean;
      filePath?: string;
      error?: string;
    };
  };

  // Native Desktop Notification for Background Outbox Sync
  sendSyncNotification: {
    params: DesktopNotificationPayload;
    response: { success: boolean };
  };

  // System Tray & App Status
  updateTrayStatus: {
    params: DesktopTrayStatusPayload;
    response: { success: boolean };
  };

  // Window Vibrancy & Visual Glass Styling
  setWindowVibrancy: {
    params: DesktopThemePayload;
    response: { success: boolean };
  };

  // Host Machine Diagnostics
  getDesktopSystemInfo: {
    params: Record<string, never>;
    response: {
      platform: 'win32' | 'darwin' | 'linux';
      arch: string;
      appVersion: string;
      isPackaged: boolean;
    };
  };
}

export interface DesktopRPCMessages {
  'tray-menu-action': {
    action: 'open-console' | 'force-sync' | 'switch-tenant' | 'quit';
    tenantId?: string;
  };
  'theme-changed': DesktopThemePayload;
}
