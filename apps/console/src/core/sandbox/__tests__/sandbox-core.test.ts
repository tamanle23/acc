import { describe, it, expect, beforeEach } from 'vitest';
import {
  sandboxRegistry,
  sandboxManager,
  useSandboxStore,
  withSimulationDecorator,
  type SandboxRouteHandler,
} from '../index';

describe('Unified Sandbox Core Platform (Phase 1)', () => {
  beforeEach(() => {
    sandboxRegistry.clear();
    useSandboxStore.getState().resetToDefaults();
    useSandboxStore.getState().setEnabled(true);
  });

  describe('SandboxRegistry (Registry Pattern)', () => {
    it('should register, retrieve, and unregister route handlers', () => {
      const mockHandler: SandboxRouteHandler = {
        id: 'test-endpoint',
        name: 'Test Endpoint',
        matcher: (ctx) => ctx.pathname === '/test/hello' && ctx.method === 'GET',
        handler: () => ({
          status: 200,
          data: { greeting: 'world' },
        }),
      };

      sandboxRegistry.register(mockHandler);
      expect(sandboxRegistry.getHandlers()).toHaveLength(1);

      const match = sandboxRegistry.findHandler('/test/hello', 'GET');
      expect(match).not.toBeNull();
      expect(match?.handler.id).toBe('test-endpoint');

      const nonMatch = sandboxRegistry.findHandler('/test/hello', 'POST');
      expect(nonMatch).toBeNull();

      sandboxRegistry.unregister('test-endpoint');
      expect(sandboxRegistry.getHandlers()).toHaveLength(0);
    });

    it('should respect handler priorities when evaluating matchers', () => {
      const lowPriorityHandler: SandboxRouteHandler = {
        id: 'catch-all',
        name: 'Catch All',
        priority: 1,
        matcher: (ctx) => ctx.pathname.startsWith('/api/'),
        handler: () => ({ status: 200, data: { source: 'low' } }),
      };

      const highPriorityHandler: SandboxRouteHandler = {
        id: 'specific-route',
        name: 'Specific Route',
        priority: 10,
        matcher: (ctx) => ctx.pathname === '/api/special',
        handler: () => ({ status: 200, data: { source: 'high' } }),
      };

      sandboxRegistry.register(lowPriorityHandler);
      sandboxRegistry.register(highPriorityHandler);

      const match = sandboxRegistry.findHandler('/api/special', 'GET');
      expect(match).not.toBeNull();
      expect(match?.handler.id).toBe('specific-route');
    });
  });

  describe('UnifiedSandboxManager (Facade Pattern)', () => {
    it('should execute matching handler and return response', async () => {
      sandboxRegistry.register({
        id: 'users-query',
        name: 'Users Mock',
        matcher: (ctx) => ctx.pathname === '/api/v1/users',
        handler: () => ({
          status: 200,
          data: [{ id: 1, name: 'Alice' }],
        }),
      });

      const response = await sandboxManager.handleRequest({
        url: '/api/v1/users',
        method: 'GET',
      });

      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);
      expect(response?.data).toEqual([{ id: 1, name: 'Alice' }]);
    });

    it('should return null (fall-through) when no handler matches or sandbox is disabled', async () => {
      const unhandled = await sandboxManager.handleRequest({
        url: '/api/unknown',
        method: 'GET',
      });
      expect(unhandled).toBeNull();

      // Register handler
      sandboxRegistry.register({
        id: 'users-query',
        name: 'Users Mock',
        matcher: (ctx) => ctx.pathname === '/api/v1/users',
        handler: () => ({ status: 200, data: [] }),
      });

      // Disable sandbox
      sandboxManager.setEnabled(false);
      const disabledRes = await sandboxManager.handleRequest({
        url: '/api/v1/users',
        method: 'GET',
      });
      expect(disabledRes).toBeNull();
    });

    it('should switch persona and synchronize active tenant', () => {
      expect(sandboxManager.getActivePersona().id).toBe('admin');
      expect(useSandboxStore.getState().activeTenantId).toBe('tenant-us-east-1');

      sandboxManager.switchPersona('creator');
      expect(sandboxManager.getActivePersona().id).toBe('creator');
      expect(sandboxManager.getActivePersona().roles).toContain('ROLE_OPERATIONS_MANAGER');
      expect(useSandboxStore.getState().activeTenantId).toBe('tenant-eu-central-1');

      sandboxManager.switchPersona('user');
      expect(sandboxManager.getActivePersona().id).toBe('user');
      expect(useSandboxStore.getState().activeTenantId).toBe('tenant-us-west-2');
    });
  });

  describe('Network Simulation Decorator (Decorator Pattern)', () => {
    it('should inject faults when faultRate is triggered', async () => {
      const response = await withSimulationDecorator(
        () => ({ status: 200, data: { success: true } }),
        {
          latencyMinMs: 0,
          latencyMaxMs: 0,
          faultRate: 1.0, // 100% fault
          faultStatusCode: 503,
        }
      );

      expect(response.status).toBe(503);
      expect(response.headers?.['x-sandbox-fault-injected']).toBe('true');
      expect((response.data as any).error).toContain('Simulated Sandbox Service Unavailable');
    });

    it('should pass through cleanly when faultRate is 0', async () => {
      const response = await withSimulationDecorator(
        () => ({ status: 200, data: { ok: true } }),
        {
          latencyMinMs: 0,
          latencyMaxMs: 0,
          faultRate: 0,
          faultStatusCode: 500,
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ ok: true });
    });
  });
});
