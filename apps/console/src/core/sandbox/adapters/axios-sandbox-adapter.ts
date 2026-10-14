import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { sandboxManager } from '../manager/sandbox-manager';

/**
 * Attaches the Unified Sandbox Interceptor to an Axios instance.
 * If sandbox is enabled and a registered handler matches the request,
 * it returns the mocked response. Otherwise, it cleanly falls through to
 * the real network without modification.
 */
export function attachSandboxAxiosInterceptor(apiClient: AxiosInstance): void {
  if (import.meta.env.MODE === 'production') {
    return;
  }

  if ((apiClient as any).__sandbox_interceptor_attached__) {
    return;
  }
  (apiClient as any).__sandbox_interceptor_attached__ = true;

  apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    if (!sandboxManager.isEnabled()) {
      return config;
    }

    const rawUrl = config.url || '';
    const baseURL = config.baseURL || '';
    const isAbsolute = /^https?:\/\//i.test(rawUrl);

    // Resolve full path considering baseURL without duplicate prefixes
    let fullUrl = rawUrl;
    if (!isAbsolute && baseURL) {
      const cleanBase = baseURL.replace(/\/$/, '');
      const cleanRaw = rawUrl.replace(/^\//, '');
      const cleanBaseWithoutSlash = cleanBase.replace(/^\//, '');
      if (cleanRaw.startsWith(cleanBaseWithoutSlash + '/') || cleanRaw === cleanBaseWithoutSlash) {
        fullUrl = `/${cleanRaw}`;
      } else {
        fullUrl = `${cleanBase}/${cleanRaw}`;
      }
    }

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
    const mockRes = await sandboxManager.handleRequest({
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
        }

        return Promise.reject({
          response: {
            data: mockRes.data,
            status: mockRes.status,
            statusText: mockRes.statusText || 'Error',
            headers: mockRes.headers || {},
          },
          config: adapterConfig,
        });
      };
    }

    return config;
  });
}
