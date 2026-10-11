import { describe, it, expect, beforeEach } from 'vitest';
import axios from 'axios';
import { attachSandboxAxiosInterceptor } from '../adapters/axios-sandbox-adapter';
import { sandboxRegistry } from '../manager/sandbox-registry';
import { useSandboxStore } from '../store/sandbox-store';

describe('Axios Sandbox Adapter', () => {
  let testClient: ReturnType<typeof axios.create>;

  beforeEach(() => {
    sandboxRegistry.clear();
    useSandboxStore.getState().resetToDefaults();
    useSandboxStore.getState().setEnabled(true);

    testClient = axios.create({ baseURL: '/api' });
    attachSandboxAxiosInterceptor(testClient);
  });

  it('should intercept GET request and return AxiosResponse data', async () => {
    sandboxRegistry.register({
      id: 'axios-get-test',
      name: 'Axios GET Test',
      matcher: (ctx) => ctx.pathname === '/api/v1/ping' && ctx.method === 'GET',
      handler: () => ({
        status: 200,
        data: { pong: true },
      }),
    });

    const res = await testClient.get('/v1/ping');
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ pong: true });
  });

  it('should intercept POST request with payload and return 201 status', async () => {
    sandboxRegistry.register({
      id: 'axios-post-test',
      name: 'Axios POST Test',
      matcher: (ctx) => ctx.pathname === '/api/v1/items' && ctx.method === 'POST',
      handler: (req) => ({
        status: 201,
        data: { id: 101, ...req.data },
      }),
    });

    const res = await testClient.post('/v1/items', { title: 'Test Item' });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ id: 101, title: 'Test Item' });
  });

  it('should reject promise on 400/404 error response', async () => {
    sandboxRegistry.register({
      id: 'axios-error-test',
      name: 'Axios Error Test',
      matcher: (ctx) => ctx.pathname === '/api/v1/fail' && ctx.method === 'GET',
      handler: () => ({
        status: 404,
        data: { error: 'Not found in sandbox' },
      }),
    });

    try {
      await testClient.get('/v1/fail');
      expect.unreachable('Should have rejected');
    } catch (err: any) {
      expect(err.response.status).toBe(404);
      expect(err.response.data.error).toBe('Not found in sandbox');
    }
  });

  it('should fall through when sandbox is disabled', async () => {
    sandboxRegistry.register({
      id: 'axios-disabled-test',
      name: 'Axios Disabled Test',
      matcher: (ctx) => ctx.pathname === '/api/v1/ping',
      handler: () => ({ status: 200, data: { pong: true } }),
    });

    useSandboxStore.getState().setEnabled(false);

    // Should bypass mock and try live network (failing fast in jsdom)
    await expect(testClient.get('/v1/ping', { timeout: 200 })).rejects.toThrow();
  });
});
