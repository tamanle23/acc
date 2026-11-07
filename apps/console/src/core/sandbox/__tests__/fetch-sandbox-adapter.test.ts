import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  attachSandboxFetchInterceptor,
  detachSandboxFetchInterceptor,
} from '../adapters/fetch-sandbox-adapter';
import { sandboxRegistry } from '../manager/sandbox-registry';
import { useSandboxStore } from '../store/sandbox-store';

describe('Fetch Sandbox Adapter', () => {
  beforeEach(() => {
    sandboxRegistry.clear();
    useSandboxStore.getState().resetToDefaults();
    useSandboxStore.getState().setEnabled(true);
    attachSandboxFetchInterceptor();
  });

  afterEach(() => {
    detachSandboxFetchInterceptor();
  });

  it('should intercept string URL fetch and return mocked response', async () => {
    sandboxRegistry.register({
      id: 'fetch-test-1',
      name: 'Fetch Test Endpoint',
      matcher: (ctx) => ctx.pathname === '/test/fetch' && ctx.method === 'GET',
      handler: () => ({
        status: 200,
        data: { message: 'Hello from fetch sandbox' },
      }),
    });

    const res = await window.fetch('/test/fetch');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({ message: 'Hello from fetch sandbox' });
  });

  it('should handle Request objects and Headers instances', async () => {
    sandboxRegistry.register({
      id: 'fetch-test-request',
      name: 'Fetch Request Endpoint',
      matcher: (ctx) => ctx.pathname === '/test/request' && ctx.method === 'POST',
      handler: (req) => ({
        status: 201,
        data: { received: req.data },
      }),
    });

    const req = new Request('http://localhost/test/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: 'Widget' }),
    });

    const res = await window.fetch(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toEqual({ received: { item: 'Widget' } });
  });

  it('should handle URL object inputs', async () => {
    sandboxRegistry.register({
      id: 'fetch-test-url',
      name: 'Fetch URL Endpoint',
      matcher: (ctx) => ctx.pathname === '/test/url-obj' && ctx.method === 'GET',
      handler: () => ({
        status: 200,
        data: { ok: true },
      }),
    });

    const url = new URL('http://localhost/test/url-obj');
    const res = await window.fetch(url);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('should fall back to original fetch if endpoint is unhandled', async () => {
    // Unhandled route will attempt real fetch (which jsdom fails gracefully)
    await expect(window.fetch('http://127.0.0.1:59999/unhandled/route')).rejects.toThrow();
  });
});
