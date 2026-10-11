import { UnifiedSandboxEngine, defaultSandboxEngine } from '../engine';

/**
 * Creates a fetch interceptor backed by the Unified Sandbox Engine.
 * If sandbox handles the request, synthesizes a web Response; otherwise delegates to fallbackFetch.
 */
export function createSandboxFetch(
  fallbackFetch: typeof fetch = globalThis.fetch,
  engine: UnifiedSandboxEngine = defaultSandboxEngine
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!engine.isEnabled()) {
      return fallbackFetch(input, init);
    }

    let urlStr = '';
    let method = 'GET';
    const headers: Record<string, string> = {};
    let bodyData: any = undefined;

    if (typeof input === 'string') {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else if (typeof Request !== 'undefined' && input instanceof Request) {
      urlStr = input.url;
      method = input.method || 'GET';
      input.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
      try {
        const text = await input.clone().text();
        if (text) {
          try {
            bodyData = JSON.parse(text);
          } catch {
            bodyData = text;
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (init) {
      if (init.method) {
        method = init.method.toUpperCase();
      }
      if (init.headers) {
        if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
          init.headers.forEach((v, k) => {
            headers[k.toLowerCase()] = v;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([k, v]) => {
            headers[k.toLowerCase()] = v;
          });
        } else {
          Object.entries(init.headers).forEach(([k, v]) => {
            if (v !== undefined) {
              headers[k.toLowerCase()] = String(v);
            }
          });
        }
      }
      if (init.body) {
        if (typeof init.body === 'string') {
          try {
            bodyData = JSON.parse(init.body);
          } catch {
            bodyData = init.body;
          }
        } else {
          bodyData = init.body;
        }
      }
    }

    const mockRes = await engine.handleRequest({
      url: urlStr,
      method,
      headers,
      data: bodyData,
    });

    if (mockRes) {
      const responseHeaders = new Headers(mockRes.headers || {});
      if (!responseHeaders.has('content-type')) {
        responseHeaders.set('content-type', 'application/json');
      }
      responseHeaders.set('x-sandbox-mocked', 'true');

      const bodyStr =
        typeof mockRes.data === 'string'
          ? mockRes.data
          : JSON.stringify(mockRes.data);

      return new Response(bodyStr, {
        status: mockRes.status,
        statusText: mockRes.statusText || 'OK',
        headers: responseHeaders,
      });
    }

    return fallbackFetch(input, init);
  };
}

let originalGlobalFetch: typeof fetch | null = null;

/**
 * Attaches the Sandbox interceptor directly onto globalThis.fetch
 */
export function attachGlobalSandboxFetch(
  engine: UnifiedSandboxEngine = defaultSandboxEngine
): () => void {
  if (typeof globalThis.fetch === 'undefined') {
    return () => {};
  }
  if (!originalGlobalFetch) {
    originalGlobalFetch = globalThis.fetch;
  }
  globalThis.fetch = createSandboxFetch(originalGlobalFetch, engine);

  return () => {
    if (originalGlobalFetch) {
      globalThis.fetch = originalGlobalFetch;
      originalGlobalFetch = null;
    }
  };
}
