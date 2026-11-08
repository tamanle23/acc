import axios from 'axios';
import { generateTraceparent } from '@acc/client';
import { toast } from 'sonner';
import { useSpringAuthStore } from './store';
import { enableSandboxMockEngine } from './sandbox/mock-engine';
import { useMetadataUiStore } from '../metadata/store/use-metadata-ui-store';
import { useSandboxStore, DEFAULT_SANDBOX_PERSONAS } from '../../core/sandbox/store/sandbox-store';
import { getRequiredClearanceText } from '@/components/auth/permission-guard';
import { isBackendEnvelopeFailure, extractEnvelopeErrorMessage } from '@/core/utils/error-extractor';

export const springApiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

/**
 * Canonical mutation route permission mappings for dual-gate pre-flight defense.
 */
interface RoutePermissionRule {
  pattern: RegExp;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';
  permission: string;
}

const MUTATION_PERMISSION_RULES: RoutePermissionRule[] = [
  // Workflow Plane
  { pattern: /^\/api\/v1\/workflow\/definitions/i, method: 'POST', permission: 'workflow:definition:manage' },
  { pattern: /^\/api\/v1\/workflow\/definitions\/[^/]+\/batch-migrate/i, method: 'POST', permission: 'workflow:definition:manage' },
  { pattern: /^\/api\/v1\/workflow\/definitions\/[^/]+\/migration-preview/i, method: 'POST', permission: 'workflow:definition:manage' },
  { pattern: /^\/api\/v1\/workflow\/definitions\/simulate/i, method: 'POST', permission: 'workflow:definition:manage' },
  { pattern: /^\/api\/v1\/workflow\/approvals\/[^/]+\/resolve/i, method: 'POST', permission: 'workflow:approval:execute' },
  { pattern: /^\/api\/v1\/workflow\/executions/i, method: 'POST', permission: 'workflow:execution:submit' },
  { pattern: /^\/api\/v1\/workflow\/workers/i, method: 'POST', permission: 'platform:workers:manage' },

  // Metadata Plane
  { pattern: /^\/api\/v1\/metadata\/entity-types\/[^/]+\/records(\/.*)?$/i, method: 'POST', permission: 'entity:record:create' },
  { pattern: /^\/api\/v1\/metadata\/entity-types\/[^/]+\/records(\/.*)?$/i, method: 'PUT', permission: 'entity:record:update' },
  { pattern: /^\/api\/v1\/metadata\/entity-types\/[^/]+\/records(\/.*)?$/i, method: 'DELETE', permission: 'entity:record:delete' },
  { pattern: /^\/api\/v1\/metadata\/entity-types(\/.*)?$/i, method: 'POST', permission: 'metadata:schema:write' },
  { pattern: /^\/api\/v1\/metadata\/entity-types(\/.*)?$/i, method: 'PUT', permission: 'metadata:schema:write' },
  { pattern: /^\/api\/v1\/metadata\/entity-types(\/.*)?$/i, method: 'DELETE', permission: 'metadata:schema:write' },

  // Workspace Plane
  { pattern: /^\/api\/v1\/users(\/.*)?$/i, method: 'POST', permission: 'workspace:members:manage' },
  { pattern: /^\/api\/v1\/users(\/.*)?$/i, method: 'PUT', permission: 'workspace:members:manage' },
  { pattern: /^\/api\/v1\/users(\/.*)?$/i, method: 'DELETE', permission: 'workspace:members:manage' },
  { pattern: /^\/api\/v1\/workspace\/settings/i, method: 'ALL', permission: 'workspace:settings:manage' },

  // Billing Plane
  { pattern: /^\/api\/v1\/billing\/(upgrade|subscription)/i, method: 'ALL', permission: 'billing:subscription:upgrade' },

  // Storage Plane
  { pattern: /^\/api\/(v1\/)?storage(\/.*)?$/i, method: 'ALL', permission: 'workspace:settings:manage' },

  // Dead-Letter Queue (DLQ) Plane
  { pattern: /^\/api\/(v1\/)?system\/dlq(\/.*)?$/i, method: 'ALL', permission: 'platform:dlq:manage' },

  // Fleet Tenants Plane
  { pattern: /^\/api\/(v1\/)?system\/tenants\/[^/]+\/status/i, method: 'ALL', permission: 'platform:fleet:mutate' },
  { pattern: /^\/api\/(v1\/)?system\/tenants\/[^/]+\/assume/i, method: 'ALL', permission: 'platform:tenant:assume' },
  { pattern: /^\/api\/(v1\/)?system\/tenants\/[^/]+\/subscription/i, method: 'ALL', permission: 'billing:tier:override' },
  { pattern: /^\/api\/(v1\/)?system\/tenants\/[^/]+\/quotas/i, method: 'ALL', permission: 'platform:quotas:manage' },
  { pattern: /^\/api\/(v1\/)?system\/tenants(\/.*)?$/i, method: 'POST', permission: 'platform:fleet:mutate' },

  // System Roles & RBAC Plane
  { pattern: /^\/api\/(v1\/)?system\/roles(\/.*)?$/i, method: 'ALL', permission: 'platform:roles:manage' },
  { pattern: /^\/api\/(v1\/)?system\/users\/[^/]+\/lock/i, method: 'ALL', permission: 'platform:users:manage' },

  // Audit Studio Plane
  { pattern: /^\/api\/(v1\/)?system\/audit\/verify/i, method: 'POST', permission: 'audit:hash:verify' },
  { pattern: /^\/api\/(v1\/)?system\/audit\/export/i, method: 'GET', permission: 'audit:compliance:export' },
];

function checkPreflightAuthorization(config: import('axios').InternalAxiosRequestConfig): void {
  const method = (config.method || 'GET').toUpperCase();
  if (['HEAD', 'OPTIONS'].includes(method)) {
    return;
  }

  const fullUrl = config.url?.startsWith('http')
    ? new URL(config.url).pathname
    : (config.baseURL || '') + (config.url || '');

  if (method === 'GET') {
    const hasSensitiveGetRule = MUTATION_PERMISSION_RULES.some(
      (rule) => rule.method === 'GET' && rule.pattern.test(fullUrl)
    );
    if (!hasSensitiveGetRule) {
      return;
    }
  }

  const matchingRule = MUTATION_PERMISSION_RULES.find((rule) => {
    if (rule.method !== 'ALL' && rule.method !== method) return false;
    return rule.pattern.test(fullUrl);
  });

  if (!matchingRule) return;

  const authUser = useSpringAuthStore.getState().user;
  const isSandboxEnabled = import.meta.env.DEV ? useSandboxStore.getState().enabled : false;
  const activePersonaId = import.meta.env.DEV ? useSandboxStore.getState().activePersonaId : null;

  // Sovereign Root Custodian unconditional bypass
  if (
    authUser?.isSovereign ||
    authUser?.roles?.includes('ROLE_SYSTEM_ROOT' as any) ||
    authUser?.roles?.includes('ROLE_SYSTEM_CUSTODIAN' as any) ||
    authUser?.tenantId === 'SYSTEM' ||
    (isSandboxEnabled && activePersonaId === 'system')
  ) {
    return;
  }

  const permSet = new Set<string>();
  if (authUser?.permissions) {
    authUser.permissions.forEach((p) => permSet.add(p));
  }
  if (isSandboxEnabled && activePersonaId) {
    const persona = DEFAULT_SANDBOX_PERSONAS[activePersonaId];
    persona?.permissions?.forEach((p) => permSet.add(p));
  }

  if (!permSet.has(matchingRule.permission)) {
    const clearance = getRequiredClearanceText(matchingRule.permission);
    toast.error(`Action blocked: Requires ${clearance} clearance`);
    const cancelError = new axios.AxiosError(
      `Pre-Flight Gate: Operation halted locally. Requires ${clearance} clearance.`,
      'ERR_CLIENT_AUTH_PREFLIGHT',
      config,
      null,
      {
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        config,
        data: { error: 'Forbidden', message: `Requires ${clearance} clearance` },
      } as any
    );
    throw cancelError;
  }
}

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

// 1. Request Interceptor: Pre-Flight Gate & Headers
springApiClient.interceptors.request.use(
  (config) => {
    // Dual-gate authorization check before network dispatch
    checkPreflightAuthorization(config);

    const { accessToken } = useSpringAuthStore.getState();
    const assumedToken = typeof window !== 'undefined' ? localStorage.getItem('acc_assumed_token') : null;
    const effectiveToken = assumedToken || accessToken;
    const isRefreshRequest = Boolean(config.url && config.url.includes('/auth/refresh'));

    if (effectiveToken && config.headers && !isRefreshRequest) {
      config.headers['Authorization'] = `Bearer ${effectiveToken}`;
    }

    const assumedTenant = typeof window !== 'undefined' ? localStorage.getItem('acc_assumed_tenant') : null;
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

// 2. Response Interceptor: Catch Non-Success Envelopes & Silent Refresh Loop
springApiClient.interceptors.response.use(
  (response) => {
    // Detect Spring Boot ResponseWrapper envelopes returning status FAIL or ERROR (even on HTTP 200)
    if (isBackendEnvelopeFailure(response.data)) {
      const errMsg = extractEnvelopeErrorMessage(response.data) || `Request failed with status: ${response.data.status}`;
      const firstCode = Array.isArray(response.data?.errors) && response.data.errors[0]?.code
        ? response.data.errors[0].code
        : (String(response.data?.status).toUpperCase() === 'FAIL' ? 'ERR_BUSINESS_FAIL' : 'ERR_SERVER_ERROR');

      return Promise.reject(
        new axios.AxiosError(
          errMsg,
          firstCode,
          response.config,
          response.request,
          response
        )
      );
    }
    return response;
  },
  async (error) => {
    // If Axios error has response.data with backend envelope error message, enrich error.message
    // Only override if error.code is not a client-side preflight gate error
    if (error?.code !== 'ERR_CLIENT_AUTH_PREFLIGHT' && axios.isAxiosError(error) && error.response?.data) {
      const backendMsg = extractEnvelopeErrorMessage(error.response.data);
      if (backendMsg) {
        error.message = backendMsg;
      }
    }

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

        const newAccess = data?.body?.accessToken || data?.accessToken;
        const newRefresh = data?.body?.refreshToken || data?.refreshToken || state.refreshToken;

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

/**
 * Fetch strongly-typed security profile for current authenticated session.
 * Hydrates useSpringAuthStore without browser-side JWT decoding.
 */
export async function fetchAuthenticationProfile(explicitToken?: string): Promise<import('@acc/client').AuthenticationProfile> {
  const config = explicitToken
    ? { headers: { Authorization: `Bearer ${explicitToken}` } }
    : undefined;
  const { data } = await springApiClient.get<any>('/auth/me', config);
  const raw = data?.body || data;
  return {
    ...raw,
    isSovereign: raw.isSovereign ?? raw.sovereign ?? false,
  } as import('@acc/client').AuthenticationProfile;
}
