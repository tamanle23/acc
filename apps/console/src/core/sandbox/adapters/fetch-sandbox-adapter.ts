import { sandboxManager } from '../manager/sandbox-manager';

let originalFetch: typeof window.fetch | null = null;

/**
 * Attaches the Unified Sandbox Interceptor to window.fetch.
 * If sandbox is enabled and a registered handler matches the request,
 * it returns a simulated Response object. Otherwise, it falls through to
 * the real network.
 */
export function attachSandboxFetchInterceptor(): void {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'production') {
    return;
  }

  if (originalFetch) {
    // Already attached
    return;
  }

  originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!sandboxManager.isEnabled()) {
      return originalFetch!(input, init);
    }

    let urlStr = '';
    let method = 'GET';
    const headers: Record<string, string> = {};
    let bodyData: any = undefined;

    if (typeof input === 'string') {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else if (input instanceof Request) {
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
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => {
            headers[k.toLowerCase()] = v;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([k, v]) => {
            headers[k.toLowerCase()] = v;
          });
        } else {
          Object.entries(init.headers).forEach(([k, v]) => {
            if (v !== undefined && v !== null) {
              headers[k.toLowerCase()] = String(v);
            }
          });
        }
      }
      if (init.body) {
        try {
          bodyData = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        } catch {
          bodyData = init.body;
        }
      }
    }

    const mockRes = await sandboxManager.handleRequest({
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

      return new Response(
        typeof mockRes.data === 'string' ? mockRes.data : JSON.stringify(mockRes.data),
        {
          status: mockRes.status,
          statusText: mockRes.statusText || 'OK',
          headers: responseHeaders,
        }
      );
    }

    if (originalFetch) {
      try {
        const fullUrl =
          typeof input === 'string' && input.startsWith('/')
            ? `${typeof window !== 'undefined' ? window.location?.origin || 'http://localhost' : 'http://localhost'}${input}`
            : input;
        return originalFetch(fullUrl, init);
      } catch {
        return originalFetch(input, init);
      }
    }

    return new Response(JSON.stringify({ message: 'Unhandled sandbox request' }), { status: 404 });
  };
}

export function detachSandboxFetchInterceptor(): void {
  if (typeof window !== 'undefined' && originalFetch) {
    window.fetch = originalFetch;
    originalFetch = null;
  }
}
