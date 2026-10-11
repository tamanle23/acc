import type { ProblemDetail } from './types';

export interface UnipostClientConfig {
  /**
   * Base URL for the Unipost API (e.g., 'http://localhost:8080/api' or '/api')
   */
  baseURL?: string;

  /**
   * Bearer token or static token provider function
   */
  token?: string | (() => string | null | Promise<string | null>);

  /**
   * Default Tenant ID to propagate via 'X-Tenant-Id' header
   */
  tenantId?: string | (() => string | null | Promise<string | null>);

  /**
   * Default Workspace ID to propagate via 'X-Workspace-Id' header
   */
  workspaceId?: string | (() => string | null | Promise<string | null>);

  /**
   * Custom fetch implementation (defaults to globalThis.fetch)
   */
  fetch?: typeof fetch;

  /**
   * Default headers to send with every request
   */
  headers?: Record<string, string>;

  /**
   * Timeout in milliseconds (default: 30000ms)
   */
  timeoutMs?: number;
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, unknown>;
  tenantId?: string;
  workspaceId?: string;
  token?: string;
  timeoutMs?: number;
}

/**
 * Standardized Unipost Client Error incorporating RFC 7807 Problem Detail
 */
export class UnipostClientError extends Error {
  readonly status: number;
  readonly problemDetail?: ProblemDetail;
  readonly rawResponse?: unknown;

  constructor(
    message: string,
    status: number,
    problemDetail?: ProblemDetail,
    rawResponse?: unknown
  ) {
    super(message);
    this.name = 'UnipostClientError';
    this.status = status;
    this.problemDetail = problemDetail;
    this.rawResponse = rawResponse;
    Object.setPrototypeOf(this, UnipostClientError.prototype);
  }
}

/**
 * Generates a standard W3C traceparent header: 00-{traceId}-{spanId}-01
 */
export function generateTraceparent(): string {
  const randomHex = (len: number) => {
    let result = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  const version = '00';
  const traceId = randomHex(32);
  const parentId = randomHex(16);
  const flags = '01';
  return `${version}-${traceId}-${parentId}-${flags}`;
}

/**
 * Universal Unipost Client for Browser, React Native, Node.js, and Edge environments.
 */
export class UnipostClient {
  private config: UnipostClientConfig;
  private fetchFn: typeof fetch;

  constructor(config: UnipostClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL?.replace(/\/$/, '') || '',
      timeoutMs: config.timeoutMs ?? 30000,
      ...config,
    };
    this.fetchFn = config.fetch || globalThis.fetch;
  }

  private async resolveValue(
    val?: string | (() => string | null | Promise<string | null>)
  ): Promise<string | null> {
    if (!val) return null;
    if (typeof val === 'function') {
      return await val();
    }
    return val;
  }

  /**
   * Core request execution pipeline
   */
  async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      params,
      tenantId: reqTenantId,
      workspaceId: reqWorkspaceId,
      token: reqToken,
      headers: reqHeaders = {},
      timeoutMs = this.config.timeoutMs ?? 30000,
      ...customInit
    } = options;

    // 1. Resolve full URL
    let url = endpoint.startsWith('http')
      ? endpoint
      : `${this.config.baseURL || ''}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            searchParams.append(key, JSON.stringify(value));
          } else {
            searchParams.append(key, String(value));
          }
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `${url.includes('?') ? '&' : '?'}${queryString}`;
      }
    }

    // 2. Assemble Context Headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      traceparent: generateTraceparent(),
      ...this.config.headers,
    };

    if (reqHeaders) {
      Object.entries(reqHeaders).forEach(([k, v]) => {
        if (v !== undefined) headers[k] = String(v);
      });
    }

    // Auth Token Resolution
    const effectiveToken = reqToken || (await this.resolveValue(this.config.token));
    if (effectiveToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${effectiveToken}`;
    }

    // Tenant Context Resolution
    const effectiveTenantId = reqTenantId || (await this.resolveValue(this.config.tenantId));
    if (effectiveTenantId && !headers['X-Tenant-Id']) {
      headers['X-Tenant-Id'] = effectiveTenantId;
    }

    // Workspace Context Resolution
    const effectiveWorkspaceId =
      reqWorkspaceId || (await this.resolveValue(this.config.workspaceId));
    if (effectiveWorkspaceId && !headers['X-Workspace-Id']) {
      headers['X-Workspace-Id'] = effectiveWorkspaceId;
    }

    // 3. Execution with AbortController timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        ...customInit,
        headers,
        signal: customInit.signal || controller.signal,
      });

      // 4. Response handling
      const contentType = response.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!response.ok) {
        const problemDetail: ProblemDetail | undefined =
          data && typeof data === 'object' ? data : undefined;
        const errorMessage =
          problemDetail?.detail ||
          problemDetail?.title ||
          `Request failed with status ${response.status}`;
        throw new UnipostClientError(errorMessage, response.status, problemDetail, data);
      }

      // Standard ResponseWrapper unwrap: body ?? data ?? result
      if (data && typeof data === 'object') {
        if ('body' in data && data.body !== undefined) return data.body;
        if ('data' in data && data.data !== undefined) return data.data;
      }

      return data as T;
    } catch (err: any) {
      if (err instanceof UnipostClientError) {
        throw err;
      }
      if (err.name === 'AbortError') {
        throw new UnipostClientError(`Request timeout after ${timeoutMs}ms`, 408);
      }
      throw new UnipostClientError(err.message || 'Network request failed', 0, undefined, err);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Convenience methods
  get<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

/**
 * Factory to create a pre-configured UnipostClient instance
 */
export function createUnipostClient(config: UnipostClientConfig = {}): UnipostClient {
  return new UnipostClient(config);
}
