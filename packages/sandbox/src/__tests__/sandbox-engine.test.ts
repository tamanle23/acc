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

  it('manages workflow definitions catalog via workflowSandboxHandler', async () => {
    const { workflowSandboxHandler, resetWorkflowSandbox } = await import('../handlers/workflow-handler');
    resetWorkflowSandbox();
    registry.register(workflowSandboxHandler);

    // 1. Initial list should contain default seeded definitions
    const listRes = await engine.handleRequest({
      url: '/api/v1/workflow/definitions',
      method: 'GET',
    });
    expect(listRes?.status).toBe(200);
    expect(listRes?.data.length).toBeGreaterThanOrEqual(3);

    // 2. Create definition
    const postRes = await engine.handleRequest({
      url: '/api/v1/workflow/definitions',
      method: 'POST',
      data: {
        workflowKey: 'order-fulfillment-v1',
        version: 1,
        name: 'Order Fulfillment V1',
        tasks: [{ taskReferenceName: 'validateOrder', taskType: 'SIMPLE' }],
        layoutMetadata: { validateOrder: { x: 100, y: 200 } },
      },
    });
    expect(postRes?.status).toBe(201);
    expect(postRes?.data).toMatchObject({ workflowKey: 'order-fulfillment-v1' });

    // 3. Query by key
    const getRes = await engine.handleRequest({
      url: '/api/v1/workflow/definitions/order-fulfillment-v1',
      method: 'GET',
    });
    expect(getRes?.status).toBe(200);
    expect(getRes?.data.layoutMetadata?.validateOrder).toEqual({ x: 100, y: 200 });

    // 4. Start execution
    const startRes = await engine.handleRequest({
      url: '/api/v1/workflow/executions',
      method: 'POST',
      data: { workflowKey: 'order-fulfillment-v1' },
    });
    expect(startRes?.status).toBe(201);
    const execId = startRes?.data.workflowId;
    expect(execId).toBeDefined();

    // 5. Get execution
    const getExecRes = await engine.handleRequest({
      url: `/api/v1/workflow/executions/${execId}`,
      method: 'GET',
    });
    expect(getExecRes?.status).toBe(200);
    expect(getExecRes?.data.status).toBe('RUNNING');

    // 6. Query SSE events
    const sseRes = await engine.handleRequest({
      url: `/api/v1/workflow/executions/${execId}/events`,
      method: 'GET',
    });
    expect(sseRes?.status).toBe(200);
    expect(sseRes?.headers?.['Content-Type']).toBe('text/event-stream');
    expect(sseRes?.data).toHaveLength(8);

    // 7. Toggle status via PUT /v1/workflow/definitions/{key}
    const toggleRes = await engine.handleRequest({
      url: '/v1/workflow/definitions/order-fulfillment-v1',
      method: 'PUT',
      data: { status: 'DISABLED' },
    });
    expect(toggleRes?.status).toBe(200);
    expect(toggleRes?.data.status).toBe('DISABLED');

    // 8. Delete definition via DELETE /v1/workflow/definitions/{key}
    const delRes = await engine.handleRequest({
      url: '/v1/workflow/definitions/order-fulfillment-v1',
      method: 'DELETE',
    });
    expect(delRes?.status).toBe(200);
    // 9. Query workflow executions list via GET /api/v1/workflow/executions
    const execListRes = await engine.handleRequest({
      url: '/api/v1/workflow/executions',
      method: 'GET',
    });
    expect(execListRes?.status).toBe(200);
    expect(Array.isArray(execListRes?.data)).toBe(true);
    expect(execListRes?.data.length).toBeGreaterThan(0);

    // 10. Query workflow executions list via GET /api/workflow-executions
    const altListRes = await engine.handleRequest({
      url: '/api/workflow-executions',
      method: 'GET',
    });
    expect(altListRes?.status).toBe(200);
    expect(Array.isArray(altListRes?.data)).toBe(true);
    expect(altListRes?.data.length).toBeGreaterThan(0);
  });

  it('correctly handles DLQ endpoints and priority over systemSandboxHandler', async () => {
    const { dlqSandboxHandler, dlqSandboxRepository } = await import('../handlers/dlq-sandbox-handler');
    const { systemSandboxHandler } = await import('../handlers/system-sandbox-handler');
    dlqSandboxRepository.reset();
    registry.register(systemSandboxHandler);
    registry.register(dlqSandboxHandler);

    // 1. Injected DLQ task via POST /system/dlq/inject
    const injectRes = await engine.handleRequest({
      url: '/api/system/dlq/inject',
      method: 'POST',
      headers: { 'X-Tenant-Id': 'tenant-acme' },
      data: { taskId: 'wf-sim-test-99' },
    });
    expect(injectRes?.status).toBe(201);
    expect(injectRes?.data.taskId).toBe('wf-sim-test-99');
    expect(injectRes?.data.status).toBe('ISOLATED');

    // 2. Fetch DLQ records via GET /system/dlq
    const listRes = await engine.handleRequest({
      url: '/api/system/dlq',
      method: 'GET',
      headers: { 'X-Tenant-Id': 'tenant-acme' },
    });
    expect(listRes?.status).toBe(200);
    expect(Array.isArray(listRes?.data)).toBe(true);
    expect(listRes?.data.some((r: any) => r.taskId === 'wf-sim-test-99')).toBe(true);

    // 3. Fetch DLQ records via GET /api/v1/system/dlq
    const v1ListRes = await engine.handleRequest({
      url: '/api/v1/system/dlq',
      method: 'GET',
      headers: { 'X-Tenant-Id': 'SYSTEM' },
    });
    expect(v1ListRes?.status).toBe(200);
    expect(Array.isArray(v1ListRes?.data)).toBe(true);
    expect(v1ListRes?.data.some((r: any) => r.taskId === 'wf-sim-test-99')).toBe(true);
  });
});

