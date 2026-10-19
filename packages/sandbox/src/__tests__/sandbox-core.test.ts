import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodeJwt, isTokenExpired } from '../jwt';
import { sleep, withSimulationDecorator } from '../simulation';
import { SandboxResetRegistry, sandboxResetRegistry } from '../reset-registry';
import { SandboxStoreManager, DEFAULT_SANDBOX_PERSONAS, initialDefaultSandboxState } from '../store';
import { SandboxRegistry } from '../registry';
import { attachSandboxAxiosInterceptor } from '../adapters/axios-adapter';
import { createSandboxFetch, attachGlobalSandboxFetch } from '../adapters/fetch-adapter';
import { registerDefaultSandboxHandlers } from '../index';
import type { SandboxRouteHandler } from '../types';

describe('Sandbox Core Infrastructure Suite', () => {
  describe('JWT Utilities', () => {
    it('decodes a valid JWT token payload', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: 'user_123', exp: Math.floor(Date.now() / 1000) + 3600, roles: ['ROLE_USER'] })
      ).toString('base64url');
      const token = `${header}.${payload}.mockSignature`;

      const decoded = decodeJwt(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe('user_123');
      expect(decoded?.roles).toEqual(['ROLE_USER']);
    });

    it('returns null for malformed or empty JWT strings', () => {
      expect(decodeJwt('')).toBeNull();
      expect(decodeJwt('invalid-token')).toBeNull();
      expect(decodeJwt('header.!!!invalid-base64!!!.sig')).toBeNull();
    });

    it('validates token expiration with configurable buffer', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const makeToken = (exp?: number) => {
        const payload = Buffer.from(JSON.stringify(exp ? { exp } : {})).toString('base64url');
        return `header.${payload}.sig`;
      };

      // Token without exp is expired/invalid
      expect(isTokenExpired(makeToken())).toBe(true);

      // Token expired in past
      expect(isTokenExpired(makeToken(nowSec - 100))).toBe(true);

      // Token expiring in 5 seconds (buffer defaults to 10s -> expired)
      expect(isTokenExpired(makeToken(nowSec + 5), 10)).toBe(true);

      // Token expiring in 100 seconds -> not expired
      expect(isTokenExpired(makeToken(nowSec + 100), 10)).toBe(false);
    });
  });

  describe('Simulation Decorator & Latency', () => {
    it('sleeps for requested duration', async () => {
      const start = Date.now();
      await sleep(10);
      expect(Date.now() - start).toBeGreaterThanOrEqual(8);
    });

    it('executes original action when no faults or latency configured', async () => {
      const mockAction = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: { message: 'hello' },
      });

      const res = await withSimulationDecorator(mockAction, {
        latencyMinMs: 0,
        latencyMaxMs: 0,
        faultRate: 0,
        faultStatusCode: 500,
      });

      expect(res?.status).toBe(200);
      expect(res?.data).toEqual({ message: 'hello' });
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('injects simulated faults when faultRate is triggered', async () => {
      const mockAction = vi.fn();
      const statusCodes = [400, 401, 403, 429, 500, 503, 502];

      for (const status of statusCodes) {
        const res = await withSimulationDecorator(mockAction, {
          latencyMinMs: 1,
          latencyMaxMs: 5,
          faultRate: 1.0,
          faultStatusCode: status,
        });

        expect(res?.status).toBe(status);
        expect(res?.headers?.['x-sandbox-fault-injected']).toBe('true');
        expect(mockAction).not.toHaveBeenCalled();
      }
    });

    it('applies simulated latency within configured bounds', async () => {
      const start = Date.now();
      const res = await withSimulationDecorator(
        () => ({ status: 200, statusText: 'OK', data: 'ok' }),
        { latencyMinMs: 15, latencyMaxMs: 25, faultRate: 0, faultStatusCode: 500 }
      );
      expect(res?.status).toBe(200);
      expect(Date.now() - start).toBeGreaterThanOrEqual(12);
    });
  });

  describe('SandboxResetRegistry', () => {
    let registry: SandboxResetRegistry;

    beforeEach(() => {
      registry = SandboxResetRegistry.getInstance();
      registry.clear();
    });

    it('registers and executes reset handlers', async () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn().mockResolvedValue(undefined);

      const unreg1 = registry.register(fn1);
      registry.register(fn2);

      await registry.resetAll();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      unreg1();
      await registry.resetAll();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(2);
    });

    it('isolates exceptions thrown by buggy reset handlers', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const buggy = vi.fn().mockImplementation(() => {
        throw new Error('Reset failed');
      });
      const healthy = vi.fn();

      registry.register(buggy);
      registry.register(healthy);

      await expect(registry.resetAll()).resolves.not.toThrow();
      expect(buggy).toHaveBeenCalled();
      expect(healthy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('supports unregister and clear', () => {
      const fn = vi.fn();
      registry.register(fn);
      expect(registry.unregister(fn)).toBe(true);
      expect(registry.unregister(fn)).toBe(false);

      registry.register(fn);
      registry.clear();
      expect(registry.unregister(fn)).toBe(false);
    });
  });

  describe('SandboxStoreManager', () => {
    let store: SandboxStoreManager;

    beforeEach(() => {
      store = new SandboxStoreManager();
    });

    it('initializes with default sandbox state', () => {
      const state = store.getState();
      expect(state.enabled).toBe(true);
      expect(state.activePersonaId).toBe('admin');
      expect(state.activeTenantId).toBe('tenant-us-east-1');
    });

    it('updates persona and synchronously binds default tenant', () => {
      store.setActivePersona('system');
      expect(store.getState().activePersonaId).toBe('system');
      expect(store.getState().activeTenantId).toBe('SYSTEM');

      store.setActivePersona('creator');
      expect(store.getState().activePersonaId).toBe('creator');
      expect(store.getState().activeTenantId).toBe('tenant-eu-central-1');

      // Unknown persona defaults to admin
      store.setActivePersona('non_existent' as any);
      expect(store.getState().activePersonaId).toBe('non_existent');
      expect(store.getState().activeTenantId).toBe('tenant-us-east-1');
    });

    it('updates active tenant independently', () => {
      store.setActiveTenant('tenant-custom-99');
      expect(store.getState().activeTenantId).toBe('tenant-custom-99');
    });

    it('updates network simulation parameters and feature toggles', () => {
      store.setNetworkLatency(100, 250);
      expect(store.getState().networkSimulation.latencyMinMs).toBe(100);
      expect(store.getState().networkSimulation.latencyMaxMs).toBe(250);

      store.setFaultInjection(0.25, 503);
      expect(store.getState().networkSimulation.faultRate).toBe(0.25);
      expect(store.getState().networkSimulation.faultStatusCode).toBe(503);

      store.setFeatureToggle('tasks', false);
      expect(store.getState().activeFeatures.tasks).toBe(false);
    });

    it('notifies subscribers on state mutations and allows unsubscription', () => {
      const listener = vi.fn();
      const unsub = store.subscribe(listener);

      store.setEnabled(false);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.getState().enabled).toBe(false);

      unsub();
      store.setEnabled(true);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('resets state to initial defaults cleanly', () => {
      store.setEnabled(false);
      store.setActiveTenant('tenant-modified');
      store.setNetworkLatency(500, 1000);

      store.resetToDefaults();
      const state = store.getState();
      expect(state.enabled).toBe(true);
      expect(state.activeTenantId).toBe('tenant-us-east-1');
      expect(state.networkSimulation.latencyMinMs).toBe(0);
    });
  });

  describe('SandboxRegistry Advanced Operations', () => {
    let reg: SandboxRegistry;

    beforeEach(() => {
      reg = new SandboxRegistry();
    });

    it('sorts handlers by priority descending', () => {
      const hLow: SandboxRouteHandler = {
        id: 'low',
        name: 'Low',
        priority: 10,
        matcher: () => true,
        handler: async () => ({ status: 200, statusText: 'OK', data: 'low' }),
      };
      const hHigh: SandboxRouteHandler = {
        id: 'high',
        name: 'High',
        priority: 100,
        matcher: () => true,
        handler: async () => ({ status: 200, statusText: 'OK', data: 'high' }),
      };

      reg.register(hLow);
      reg.register(hHigh);

      const all = reg.getHandlers();
      expect(all[0].id).toBe('high');
      expect(all[1].id).toBe('low');
    });

    it('allows finding handlers by request and unregistering', () => {
      const handler: SandboxRouteHandler = {
        id: 'test-h',
        name: 'Test Handler',
        matcher: (ctx) => ctx.pathname.includes('/test-api'),
        handler: async () => ({ status: 200, statusText: 'OK', data: 'handled' }),
      };

      reg.register(handler);

      const match = reg.findHandler('/api/v1/test-api', 'GET');
      expect(match?.handler.id).toBe('test-h');

      const noMatch = reg.findHandler('/other', 'GET');
      expect(noMatch).toBeNull();

      expect(reg.unregister('test-h')).toBe(true);
      expect(reg.unregister('test-h')).toBe(false);
      expect(reg.getHandlers()).toHaveLength(0);

      // reg.clear()
      reg.register(handler);
      expect(reg.getHandlers()).toHaveLength(1);
      reg.clear();
      expect(reg.getHandlers()).toHaveLength(0);

      // Matcher error isolation
      const faultyHandler: SandboxRouteHandler = {
        id: 'buggy',
        name: 'Buggy',
        matcher: () => {
          throw new Error('boom');
        },
        handler: async () => ({ status: 500, statusText: 'Err', data: null }),
      };
      reg.register(faultyHandler);
      expect(reg.findHandler('/any', 'GET')).toBeNull();
    });
  });

  describe('Adapters', () => {
    beforeEach(() => {
      registerDefaultSandboxHandlers();
    });

    it('creates and attaches axios interceptor with success and error simulation', async () => {
      let interceptorFn: any;
      const fakeAxios: any = {
        interceptors: {
          request: {
            use: vi.fn((fn) => {
              interceptorFn = fn;
            }),
          },
        },
      };

      attachSandboxAxiosInterceptor(fakeAxios);
      expect(fakeAxios.interceptors.request.use).toHaveBeenCalled();

      // Test matched route execution (success 200)
      const configSuccess: any = {
        url: '/api/v1/auth/token',
        method: 'post',
        headers: {},
        data: { username: 'admin_bypass', password: 'bypass' },
      };
      const modifiedConfig = await interceptorFn(configSuccess);
      expect(modifiedConfig.adapter).toBeDefined();

      const axiosResponse = await modifiedConfig.adapter(modifiedConfig);
      expect(axiosResponse.status).toBe(200);
      expect(axiosResponse.data?.accessToken).toBeDefined();

      // Test matched route execution (error 401)
      const configError: any = {
        url: '/api/v1/auth/token',
        method: 'post',
        headers: {},
        data: { username: 'invalid_user', password: 'wrong' },
      };
      const modifiedErrConfig = await interceptorFn(configError);
      await expect(modifiedErrConfig.adapter(modifiedErrConfig)).rejects.toMatchObject({
        isAxiosError: true,
        response: { status: 401 },
      });
    });

    it('creates fetch wrapper handling matched routes, Request objects, and global attachment', async () => {
      const originalFetch = globalThis.fetch;
      const mockGlobalFetch = vi.fn().mockResolvedValue(new Response('real backend', { status: 200 }));
      globalThis.fetch = mockGlobalFetch;

      const sandboxFetch = createSandboxFetch(mockGlobalFetch);

      // 1. Unhandled route -> delegates to fallbackFetch
      const resFallback = await sandboxFetch('https://api.example.com/unmocked');
      expect(resFallback.status).toBe(200);
      expect(mockGlobalFetch).toHaveBeenCalled();

      // 2. Handled route via URL string
      const resMatched = await sandboxFetch('/api/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin_bypass', password: 'bypass' }),
      });
      expect(resMatched.status).toBe(200);
      expect(resMatched.headers.get('x-sandbox-mocked')).toBe('true');
      const data = await resMatched.json();
      expect(data.accessToken).toBeDefined();

      // 3. Handled route via Request instance
      const reqObj = new Request('http://localhost/api/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'custodian_root', password: 'bypass' }),
      });
      const resFromReq = await sandboxFetch(reqObj);
      expect(resFromReq.status).toBe(200);

      // 4. Test attachGlobalSandboxFetch and teardown restore
      const detach = attachGlobalSandboxFetch();
      expect(globalThis.fetch).not.toBe(mockGlobalFetch);
      detach();
      expect(globalThis.fetch).toBe(mockGlobalFetch);
      globalThis.fetch = originalFetch;
    });
  });
});
