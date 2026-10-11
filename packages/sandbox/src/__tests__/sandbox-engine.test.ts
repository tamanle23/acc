import { describe, it, expect, beforeEach } from 'vitest';
import {
  SandboxRegistry,
  UnifiedSandboxEngine,
  SandboxStoreManager,
  createSandboxFetch,
  attachSandboxAxiosInterceptor,
} from '../index';
import axios from 'axios';

describe('Unified Sandbox Engine Package', () => {
  let registry: SandboxRegistry;
  let store: SandboxStoreManager;
  let engine: UnifiedSandboxEngine;

  beforeEach(() => {
    registry = new SandboxRegistry();
    store = new SandboxStoreManager();
    engine = new UnifiedSandboxEngine({ registry, store, isDev: true });
  });

  it('registers and matches handlers by pathname and method', async () => {
    registry.register({
      id: 'test-articles',
      name: 'Test Articles',
      matcher: (ctx) => ctx.pathname === '/api/v1/articles' && ctx.method === 'GET',
      handler: () => ({
        status: 200,
        data: [{ id: 1, title: 'Article 1' }],
      }),
    });

    const res = await engine.handleRequest({
      url: 'https://unipost.io/api/v1/articles?limit=10',
      method: 'GET',
    });

    expect(res).not.toBeNull();
    expect(res?.status).toBe(200);
    expect(res?.data).toEqual([{ id: 1, title: 'Article 1' }]);
  });

  it('respects handler priority ordering', async () => {
    registry.register({
      id: 'low-priority',
      name: 'Catch-all',
      priority: 0,
      matcher: () => true,
      handler: () => ({ status: 200, data: { source: 'low' } }),
    });

    registry.register({
      id: 'high-priority',
      name: 'Specific',
      priority: 100,
      matcher: () => true,
      handler: () => ({ status: 200, data: { source: 'high' } }),
    });

    const res = await engine.handleRequest({
      url: '/test',
      method: 'GET',
    });

    expect(res?.data).toEqual({ source: 'high' });
  });

  it('intercepts fetch requests seamlessly', async () => {
    registry.register({
      id: 'fetch-test',
      name: 'Fetch Test',
      matcher: (ctx) => ctx.pathname === '/api/v1/ping',
      handler: () => ({
        status: 200,
        data: { pong: true },
      }),
    });

    const sandboxFetch = createSandboxFetch(async () => new Response('real'), engine);
    const response = await sandboxFetch('/api/v1/ping');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ pong: true });
    expect(response.headers.get('x-sandbox-mocked')).toBe('true');
  });

  it('intercepts axios requests seamlessly', async () => {
    registry.register({
      id: 'axios-test',
      name: 'Axios Test',
      matcher: (ctx) => ctx.pathname === '/api/v1/echo' && ctx.method === 'POST',
      handler: (req) => ({
        status: 201,
        data: { echoed: req.data },
      }),
    });

    const client = axios.create({ baseURL: '/api' });
    attachSandboxAxiosInterceptor(client, engine);

    const res = await client.post('/v1/echo', { hello: 'world' });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ echoed: { hello: 'world' } });
  });

  it('returns null and falls through when disabled or unmatched', async () => {
    store.setEnabled(false);

    registry.register({
      id: 'disabled-test',
      name: 'Disabled Test',
      matcher: () => true,
      handler: () => ({ status: 200, data: {} }),
    });

    const res = await engine.handleRequest({ url: '/test', method: 'GET' });
    expect(res).toBeNull();
  });
});
