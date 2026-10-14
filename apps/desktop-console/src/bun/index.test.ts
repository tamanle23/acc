import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildTrayMenu, desktopRPCHandlers } from './index';
import type { DesktopTrayStatusPayload } from './rpc-schema';
import * as fs from 'fs';
import * as path from 'path';

// Mock electrobun/main
vi.mock('electrobun/main', () => {
  return {
    BrowserWindow: vi.fn().mockImplementation((opts) => ({
      ...opts,
      id: 1,
      setTitle: vi.fn(),
      activate: vi.fn(),
    })),
    Tray: vi.fn().mockImplementation((opts) => ({
      ...opts,
      id: 1,
      setMenu: vi.fn(),
      setImage: vi.fn(),
    })),
    Utils: {
      openFileDialog: vi.fn(),
      showNotification: vi.fn(),
      showMessageBox: vi.fn(),
    },
    app: {
      quit: vi.fn(),
      isPackaged: false,
    },
  };
});

describe('Electrobun Desktop Main Process & RPC Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. System Tray Menu Builder', () => {
    it('constructs status-sensitive tray menu for ONLINE state', () => {
      const status: DesktopTrayStatusPayload = {
        tenantId: 'tenant-test',
        tenantName: 'Acme Logistics',
        syncStatus: 'ONLINE',
        pendingMutationsCount: 0,
      };

      const menu = buildTrayMenu(status);
      expect(menu.length).toBeGreaterThan(4);
      expect(menu[0].label).toBe('UniPost Desktop — Acme Logistics');
      expect(menu[1].label).toBe('✓ All Changes Synced');
    });

    it('constructs status-sensitive tray menu for SYNCING and OFFLINE states', () => {
      const syncingStatus: DesktopTrayStatusPayload = {
        tenantId: 'tenant-test',
        tenantName: 'Acme Logistics',
        syncStatus: 'SYNCING',
        pendingMutationsCount: 14,
      };

      const syncingMenu = buildTrayMenu(syncingStatus);
      expect(syncingMenu[1].label).toBe('⏳ Syncing (14 pending)...');

      const offlineStatus: DesktopTrayStatusPayload = {
        tenantId: 'tenant-test',
        tenantName: 'Acme Logistics',
        syncStatus: 'OFFLINE',
        pendingMutationsCount: 50,
      };

      const offlineMenu = buildTrayMenu(offlineStatus);
      expect(offlineMenu[1].label).toBe('⚠️ Offline (50 queued)');
    });

    it('triggers action callbacks from tray menu items', () => {
      const onAction = vi.fn();
      const status: DesktopTrayStatusPayload = {
        tenantId: 'tenant-test',
        tenantName: 'Acme Logistics',
        syncStatus: 'ONLINE',
        pendingMutationsCount: 0,
      };

      const menu = buildTrayMenu(status, onAction);
      const forceSyncItem = menu.find((item) => item.label === 'Force Sync Outbox');
      expect(forceSyncItem).toBeDefined();

      if (forceSyncItem?.action) {
        forceSyncItem.action();
        expect(onAction).toHaveBeenCalledWith('force-sync');
      }
    });
  });

  describe('2. Desktop RPC Handlers', () => {
    it('handles openSchemaFileDialog returning formatted file data', async () => {
      const { Utils } = await import('electrobun/main');
      const tempFilePath = path.join(__dirname, 'test-schema-sample.json');
      fs.writeFileSync(tempFilePath, JSON.stringify({ entity: 'Order' }), 'utf-8');

      try {
        vi.mocked(Utils.openFileDialog).mockResolvedValue([tempFilePath]);

        const result = await desktopRPCHandlers.openSchemaFileDialog({
          allowedFileTypes: 'json',
          allowsMultipleSelection: false,
        });

        expect(result.canceled).toBe(false);
        expect(result.filePaths).toEqual([tempFilePath]);
        expect(result.files?.[0].content).toContain('"entity"');
        expect(result.files?.[0].content).toContain('"Order"');
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }
    });

    it('handles openSchemaFileDialog when canceled by user', async () => {
      const { Utils } = await import('electrobun/main');
      vi.mocked(Utils.openFileDialog).mockResolvedValue([]);

      const result = await desktopRPCHandlers.openSchemaFileDialog({});
      expect(result.canceled).toBe(true);
      expect(result.filePaths).toEqual([]);
    });

    it('reads schema file from disk safely', async () => {
      const tempFilePath = path.join(__dirname, 'test-read-sample.json');
      fs.writeFileSync(tempFilePath, JSON.stringify({ version: '1.0', tenant: 'tenant-1' }), 'utf-8');

      try {
        const result = await desktopRPCHandlers.readSchemaFile({ filePath: tempFilePath });
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ version: '1.0', tenant: 'tenant-1' });

        const nonExistent = await desktopRPCHandlers.readSchemaFile({ filePath: 'missing.json' });
        expect(nonExistent.success).toBe(false);
        expect(nonExistent.error).toBeDefined();
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }
    });

    it('writes schema file to disk with directory auto-creation', async () => {
      const outDir = path.join(__dirname, 'tmp-test-out');
      const outFilePath = path.join(outDir, 'exported-schema.json');

      try {
        const payload = JSON.stringify({ name: 'Shipment' });
        const result = await desktopRPCHandlers.writeSchemaFile({
          filePath: outFilePath,
          content: payload,
        });

        expect(result.success).toBe(true);
        expect(fs.existsSync(outFilePath)).toBe(true);
        expect(fs.readFileSync(outFilePath, 'utf-8')).toBe(payload);
      } finally {
        if (fs.existsSync(outFilePath)) fs.unlinkSync(outFilePath);
        if (fs.existsSync(outDir)) fs.rmdirSync(outDir);
      }
    });

    it('dispatches native desktop notifications', async () => {
      const { Utils } = await import('electrobun/main');

      const res = await desktopRPCHandlers.sendSyncNotification({
        title: 'Outbox Flushed',
        body: '50 items synced successfully',
      });

      expect(res.success).toBe(true);
      expect(Utils.showNotification).toHaveBeenCalledWith({
        title: 'Outbox Flushed',
        body: '50 items synced successfully',
        subtitle: undefined,
        silent: false,
      });
    });

    it('reports host desktop system diagnostics', async () => {
      const info = await desktopRPCHandlers.getDesktopSystemInfo();
      expect(['win32', 'darwin', 'linux']).toContain(info.platform);
      expect(info.appVersion).toBe('1.0.0');
      expect(info.isPackaged).toBe(false);
    });
  });
});
