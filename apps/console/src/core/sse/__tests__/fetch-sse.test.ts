import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchEventSource } from '../fetch-sse';

describe('FetchEventSource', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends Authorization: Bearer header and does not put token in URL', async () => {
    let capturedUrl = '';
    let capturedHeaders: HeadersInit | undefined;

    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(': ping\n\nevent: INIT\ndata: {"status":"CONNECTED"}\n\n'));
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      capturedUrl = String(url);
      capturedHeaders = init?.headers;
      return Promise.resolve(
        new Response(mockStream, {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/event-stream' },
        })
      );
    });

    const receivedEvents: any[] = [];
    const es = new FetchEventSource('/api/v1/notifications/stream?tenantId=DEFAULT', {
      token: 'jwt-super-secret-token-12345',
    });

    es.addEventListener('INIT', (e) => {
      receivedEvents.push(JSON.parse(e.data));
    });

    await vi.waitFor(() => {
      expect(receivedEvents.length).toBe(1);
    });

    // Verify token is NOT in URL
    expect(capturedUrl).toBe('/api/v1/notifications/stream?tenantId=DEFAULT');
    expect(capturedUrl).not.toContain('jwt-super-secret-token-12345');

    // Verify token IS in Authorization header
    expect((capturedHeaders as Record<string, string>)['Authorization']).toBe(
      'Bearer jwt-super-secret-token-12345'
    );
    expect((capturedHeaders as Record<string, string>)['Accept']).toBe('text/event-stream');

    expect(receivedEvents[0]).toEqual({ status: 'CONNECTED' });
    es.close();
  });

  it('short-circuits network calls in offline sandbox mode', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    let opened = false;
    const es = new FetchEventSource('/api/v1/notifications/stream', {
      token: 'mock-sandbox-token',
      isSandbox: true,
    });

    es.onopen = () => {
      opened = true;
    };

    await vi.waitFor(() => {
      expect(opened).toBe(true);
    });
    expect(es.readyState).toBe(FetchEventSource.OPEN);
    expect(fetchMock).not.toHaveBeenCalled();

    es.close();
    expect(es.readyState).toBe(FetchEventSource.CLOSED);
  });

  it('halts immediately without reconnect loops on HTTP 401 Unauthorized', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(
        new Response('Unauthorized', {
          status: 401,
          statusText: 'Unauthorized',
        })
      );
    });

    let errorReceived: Error | null = null;
    const es = new FetchEventSource('/api/v1/notifications/stream', {
      token: 'expired-or-bad-token',
    });

    es.onerror = (err) => {
      errorReceived = err;
    };

    await vi.waitFor(() => {
      expect(errorReceived).not.toBeNull();
    });

    expect(errorReceived?.message).toContain('401');
    expect(es.readyState).toBe(FetchEventSource.CLOSED);
    // Should NOT have made repeated reconnect calls
    expect(callCount).toBe(1);
  });

  it('dispatches custom event types and ignores comment keep-alive lines', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            ': heartbeat\n\nevent: APPROVAL_REQUESTED\ndata: {"taskId":"task-123","title":"Signoff"}\n\n'
          )
        );
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    let approvalData: any = null;
    const es = new FetchEventSource('/api/v1/notifications/stream', {
      token: 'valid-token',
    });

    es.addEventListener('APPROVAL_REQUESTED', (e) => {
      approvalData = JSON.parse(e.data);
    });

    await vi.waitFor(() => {
      expect(approvalData).not.toBeNull();
    });

    expect(approvalData).toEqual({ taskId: 'task-123', title: 'Signoff' });
    es.close();
  });
});
