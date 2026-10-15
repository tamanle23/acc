import axios from 'axios';
import { generateTraceparent } from '@unipost/client';
import { useSpringAuthStore } from './store';
import { enableSandboxMockEngine } from './sandbox/mock-engine';
import { useMetadataUiStore } from '../metadata/store/use-metadata-ui-store';
import { useSandboxStore } from '../../core/sandbox/store/sandbox-store';

export const springApiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Attach Unified Sandbox Interceptor in development mode
if (import.meta.env.DEV) {
  enableSandboxMockEngine(springApiClient);
}

// Queue for pending requests while silent refresh is occurring
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: string) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token || undefined);
    }
  });
  failedQueue = [];
};

// 1. Request Interceptor: Attach Access Token, Tenant & Workspace Context Headers
springApiClient.interceptors.request.use(
  (config) => {
    const { accessToken } = useSpringAuthStore.getState();
    const assumedToken = typeof window !== 'undefined' ? localStorage.getItem('unipost_assumed_token') : null;
    const effectiveToken = assumedToken || accessToken;

    if (effectiveToken && config.headers) {
      config.headers['Authorization'] = `Bearer ${effectiveToken}`;
    }

    const assumedTenant = typeof window !== 'undefined' ? localStorage.getItem('unipost_assumed_tenant') : null;
    if (assumedTenant && config.headers) {
      config.headers['X-Assumed-Tenant'] = assumedTenant;
      config.headers['X-Tenant-Id'] = assumedTenant;
    } else {
      // If sandbox is active and running, respect its active tenant
      const sandboxState = import.meta.env.DEV ? useSandboxStore.getState() : null;
      if (sandboxState?.enabled && sandboxState.activeTenantId && config.headers) {
        config.headers['X-Tenant-Id'] = sandboxState.activeTenantId;
      }

      // Inject context from active metadata UI store if available and not yet set
      try {
        const metadataState = useMetadataUiStore.getState();
        if (metadataState.activeTenantId && config.headers && !config.headers['X-Tenant-Id']) {
          config.headers['X-Tenant-Id'] = metadataState.activeTenantId;
        }
        if (metadataState.activeWorkspaceId && config.headers && !config.headers['X-Workspace-Id']) {
          config.headers['X-Workspace-Id'] = metadataState.activeWorkspaceId;
        }
      } catch {
        // Fallback gracefully if store is uninitialized
      }
    }

    if (config.headers && !config.headers['traceparent']) {
      config.headers['traceparent'] = generateTraceparent();
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Response Interceptor: Catch 401 & Silent Refresh Loop
springApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !['/auth/refresh', '/auth/token'].includes(originalRequest.url)
    ) {
      if (isRefreshing) {
        return new Promise<string | undefined>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return springApiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const state = useSpringAuthStore.getState();

      try {
        const payload = { refreshToken: state.refreshToken };

        const { data } = await springApiClient.post('/auth/refresh', payload);

        const newAccess = data.accessToken;
        const newRefresh = data.refreshToken || state.refreshToken;

        state.setTokens(newAccess, newRefresh);
        processQueue(null, newAccess);

        originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;
        return springApiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        state.clearTokens();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
