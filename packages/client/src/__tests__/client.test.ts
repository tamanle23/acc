import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UnipostClient,
  UnipostClientError,
  createUnipostClient,
  generateTraceparent,
} from '../client';

describe('UnipostClient Universal HTTP Client', () => {
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  it('generates valid W3C traceparent headers', () => {
    const trace = generateTraceparent();
    expect(trace).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('attaches traceparent, authorization, tenant, and workspace headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { id: 'rec-1', name: 'Sample' } }),
    });

    const client = new UnipostClient({
      baseURL: 'https://api.unipost.io/api',
      token: 'jwt-token-123',
      tenantId: 'tenant-acme',
      workspaceId: 'ws-prod',
      fetch: mockFetch,
    });

    const result = await client.get('/v1/records/1');
    expect(result).toEqual({ id: 'rec-1', name: 'Sample' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = mockFetch.mock.calls[0];

    expect(callUrl).toBe('https://api.unipost.io/api/v1/records/1');
    expect(callInit.headers['Authorization']).toBe('Bearer jwt-token-123');
    expect(callInit.headers['X-Tenant-Id']).toBe('tenant-acme');
    expect(callInit.headers['X-Workspace-Id']).toBe('ws-prod');
    expect(callInit.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('resolves dynamic token and context functions on each request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ body: { status: 'ok' } }),
    });

    const client = createUnipostClient({
      token: async () => 'dynamic-async-token',
      tenantId: () => 'dynamic-tenant',
      workspaceId: () => 'dynamic-workspace',
      fetch: mockFetch,
    });

    const res = await client.post('/v1/test', { key: 'value' });
    expect(res).toEqual({ status: 'ok' });

    const [, callInit] = mockFetch.mock.calls[0];
    expect(callInit.headers['Authorization']).toBe('Bearer dynamic-async-token');
    expect(callInit.headers['X-Tenant-Id']).toBe('dynamic-tenant');
    expect(callInit.headers['X-Workspace-Id']).toBe('dynamic-workspace');
    expect(callInit.body).toBe(JSON.stringify({ key: 'value' }));
  });

  it('unwraps response payload from body or data wrappers', async () => {
    // Unwraps "body" wrapper
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ body: { count: 42 } }),
    });

    const client = new UnipostClient({ fetch: mockFetch });
    const res1 = await client.get('/test-body');
    expect(res1).toEqual({ count: 42 });

    // Unwraps "data" wrapper
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { count: 99 } }),
    });
    const res2 = await client.get('/test-data');
    expect(res2).toEqual({ count: 99 });
  });

  it('parses RFC 7807 problem details on error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        type: 'urn:problem-type:optimistic-concurrency-conflict',
        title: 'Optimistic Concurrency Conflict',
        status: 409,
        detail: 'Record was modified concurrently by another transaction',
      }),
    });

    const client = new UnipostClient({ fetch: mockFetch });

    await expect(client.put('/v1/records/1', { version: 2 })).rejects.toThrow(
      'Record was modified concurrently by another transaction'
    );

    try {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          title: 'Concurrency error',
          status: 409,
        }),
      });
      await client.put('/v1/records/1', {});
    } catch (err: any) {
      expect(err).toBeInstanceOf(UnipostClientError);
      expect(err.status).toBe(409);
      expect(err.problemDetail?.title).toBe('Concurrency error');
    }
  });

  it('serializes query parameters correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ items: [] }),
    });

    const client = new UnipostClient({ fetch: mockFetch });
    await client.get('/v1/search', {
      params: {
        page: 1,
        size: 20,
        filter: { status: 'ACTIVE' },
      },
    });

    const [callUrl] = mockFetch.mock.calls[0];
    expect(callUrl).toContain('page=1');
    expect(callUrl).toContain('size=20');
    expect(callUrl).toContain('filter=%7B%22status%22%3A%22ACTIVE%22%7D');
  });
});
