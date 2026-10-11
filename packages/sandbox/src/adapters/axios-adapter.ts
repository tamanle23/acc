import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { UnifiedSandboxEngine, defaultSandboxEngine } from '../engine';

/**
 * Attaches the Unified Sandbox Interceptor to an Axios instance.
 */
export function attachSandboxAxiosInterceptor(
  apiClient: AxiosInstance,
  engine: UnifiedSandboxEngine = defaultSandboxEngine
): void {
  apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    if (!engine.isEnabled()) {
      return config;
    }

    const rawUrl = config.url || '';
    const baseURL = config.baseURL || '';
    const isAbsolute = /^https?:\/\//i.test(rawUrl);

    // Resolve full path considering baseURL
    const fullUrl =
      isAbsolute || !baseURL
        ? rawUrl
        : `${baseURL.replace(/\/$/, '')}/${rawUrl.replace(/^\//, '')}`;

    const method = config.method?.toUpperCase() || 'GET';

    const headers: Record<string, string> = {};
    if (config.headers) {
      Object.entries(config.headers).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          headers[k.toLowerCase()] = String(v);
        }
      });
    }

    // Check if unified sandbox handles this route
    const mockRes = await engine.handleRequest({
      url: fullUrl,
      method,
      headers,
      data: config.data,
      params: config.params,
    });

    if (mockRes) {
      // Short-circuit Axios dispatch via custom adapter
      config.adapter = async (adapterConfig): Promise<AxiosResponse> => {
        if (mockRes.status >= 200 && mockRes.status < 300) {
          return {
            data: mockRes.data,
            status: mockRes.status,
            statusText: mockRes.statusText || 'OK',
            headers: mockRes.headers || {},
            config: adapterConfig,
            request: {},
          };
        } else {
          const error: any = new Error(
            mockRes.statusText || `Request failed with status code ${mockRes.status}`
          );
          error.config = adapterConfig;
          error.response = {
            data: mockRes.data,
            status: mockRes.status,
            statusText: mockRes.statusText || 'Error',
            headers: mockRes.headers || {},
            config: adapterConfig,
            request: {},
          };
          error.isAxiosError = true;
          return Promise.reject(error);
        }
      };
    }

    return config;
  });
}
