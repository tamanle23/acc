import type {
  ProblemDetail,
  PageResponse,
  PageRequestParams,
  LoginRequest,
  LoginResponse,
  TokenRefreshRequest,
  TokenRefreshResponse,
  EntityType,
  CreateEntityTypeDto,
  UpdateEntityTypeDto,
  AttributeDefinition,
  CreateAttributeDefinitionDto,
  EntityRecord,
  CreateEntityRecordDto,
  UpdateEntityRecordDto,
  RelationshipType,
  CompiledSchema,
  WorkflowDefinition,
  WorkflowDefinitionSummary,
  WorkflowSnapshot,
  StartWorkflowRequest,
  ExecutionSseEvent,
  UserVm,
  UserSearchCondition,
  CreateUserRequest,
  UpdateUserRequest,
  TenantBillingSummary,
  CreatePaymentLinkPayload,
  CheckoutResponse,
  ContactSalesPayload,
} from './contracts';

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
  rawResponse?: boolean;
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

  // Domain Namespaces
  public readonly auth: AuthNamespace;
  public readonly metadata: MetadataNamespace;
  public readonly workflows: WorkflowsNamespace;
  public readonly workflowExecutions: WorkflowExecutionsNamespace;
  public readonly users: UsersNamespace;
  public readonly billing: BillingNamespace;

  constructor(config: UnipostClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL?.replace(/\/$/, '') || '',
      timeoutMs: config.timeoutMs ?? 30000,
      ...config,
    };
    this.fetchFn = config.fetch || globalThis.fetch;

    this.auth = new AuthNamespace(this);
    this.metadata = new MetadataNamespace(this);
    this.workflows = new WorkflowsNamespace(this);
    this.workflowExecutions = new WorkflowExecutionsNamespace(this);
    this.users = new UsersNamespace(this);
    this.billing = new BillingNamespace(this);
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
      rawResponse = false,
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

    // 3. Setup Abort Controller for Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        ...customInit,
        headers,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json') || contentType.includes('application/problem+json');

      let data: any = null;
      if (isJson) {
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

      if (rawResponse) {
        return data as T;
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

  getConfig(): UnipostClientConfig {
    return { ...this.config };
  }
}

// ==========================================
// Domain Namespaces Implementation
// ==========================================

export class AuthNamespace {
  constructor(private client: UnipostClient) {}

  login(payload: LoginRequest, options?: RequestOptions): Promise<LoginResponse> {
    return this.client.post<LoginResponse>('/auth/token', payload, options);
  }

  refreshToken(payload: TokenRefreshRequest, options?: RequestOptions): Promise<TokenRefreshResponse> {
    return this.client.post<TokenRefreshResponse>('/auth/refresh', payload, options);
  }

  logout(options?: RequestOptions): Promise<void> {
    return this.client.patch<void>('/auth/logout', undefined, options);
  }
}

export class MetadataNamespace {
  constructor(private client: UnipostClient) {}

  getEntityTypes(params?: PageRequestParams, options?: RequestOptions): Promise<PageResponse<EntityType>> {
    return this.client.get<PageResponse<EntityType>>('/metadata/entity-types', { ...options, params });
  }

  getEntityType(id: string | number, options?: RequestOptions): Promise<EntityType> {
    return this.client.get<EntityType>(`/metadata/entity-types/${id}`, options);
  }

  createEntityType(payload: CreateEntityTypeDto, options?: RequestOptions): Promise<EntityType> {
    return this.client.post<EntityType>('/metadata/entity-types', payload, options);
  }

  updateEntityType(id: string | number, payload: UpdateEntityTypeDto, options?: RequestOptions): Promise<EntityType> {
    return this.client.put<EntityType>(`/metadata/entity-types/${id}`, payload, options);
  }

  getCompiledSchema(entityTypeId: string | number, options?: RequestOptions): Promise<CompiledSchema> {
    return this.client.get<CompiledSchema>(`/metadata/schemas/${entityTypeId}`, options);
  }

  getAttributes(entityTypeId: string | number, options?: RequestOptions): Promise<AttributeDefinition[]> {
    return this.client.get<AttributeDefinition[]>(`/metadata/entity-types/${entityTypeId}/attributes`, options);
  }

  createAttribute(entityTypeId: string | number, payload: CreateAttributeDefinitionDto, options?: RequestOptions): Promise<AttributeDefinition> {
    return this.client.post<AttributeDefinition>(`/metadata/entity-types/${entityTypeId}/attributes`, payload, options);
  }

  getRecords(entityTypeId: string | number, params?: PageRequestParams, options?: RequestOptions): Promise<PageResponse<EntityRecord>> {
    return this.client.get<PageResponse<EntityRecord>>('/metadata/records', { ...options, params: { entityTypeId, ...params } });
  }

  createRecord(payload: CreateEntityRecordDto, options?: RequestOptions): Promise<EntityRecord> {
    return this.client.post<EntityRecord>('/metadata/records', payload, options);
  }

  updateRecord(id: string | number, payload: UpdateEntityRecordDto, options?: RequestOptions): Promise<EntityRecord> {
    return this.client.put<EntityRecord>(`/metadata/records/${id}`, payload, options);
  }

  getRelationships(options?: RequestOptions): Promise<RelationshipType[]> {
    return this.client.get<RelationshipType[]>('/metadata/relationship-types', options);
  }
}

export class WorkflowsNamespace {
  constructor(private client: UnipostClient) {}

  listDefinitions(options?: RequestOptions): Promise<WorkflowDefinitionSummary[]> {
    return this.client.get<WorkflowDefinitionSummary[]>('/v1/workflow/definitions', options);
  }

  getDefinition(key: string, options?: RequestOptions): Promise<WorkflowDefinition> {
    return this.client.get<WorkflowDefinition>(`/v1/workflow/definitions/${key}`, options);
  }

  registerDefinition(definition: WorkflowDefinition, options?: RequestOptions): Promise<WorkflowDefinition> {
    return this.client.post<WorkflowDefinition>('/v1/workflow/definitions', definition, options);
  }
}

export class WorkflowExecutionsNamespace {
  constructor(private client: UnipostClient) {}

  startExecution(payload: StartWorkflowRequest, options?: RequestOptions): Promise<WorkflowSnapshot> {
    return this.client.post<WorkflowSnapshot>('/v1/workflow/executions', payload, options);
  }

  getExecution(id: string, options?: RequestOptions): Promise<WorkflowSnapshot> {
    return this.client.get<WorkflowSnapshot>(`/v1/workflow/executions/${id}`, options);
  }

  terminate(id: string, reason?: string, options?: RequestOptions): Promise<{ terminated: boolean; workflowId: string }> {
    return this.client.post<{ terminated: boolean; workflowId: string }>(
      `/v1/workflow/executions/${id}/terminate`,
      { reason },
      options
    );
  }

  compensate(id: string, reason?: string, options?: RequestOptions): Promise<{ compensated: boolean; workflowId: string }> {
    return this.client.post<{ compensated: boolean; workflowId: string }>(
      `/v1/workflow/executions/${id}/compensate`,
      { reason },
      options
    );
  }

  /**
   * Native typed SSE reader helper for streaming live execution events.
   * Returns an unsubscribe function to abort the stream.
   */
  streamEvents(
    executionId: string,
    onEvent: (event: ExecutionSseEvent) => void,
    onError?: (err: Error) => void
  ): () => void {
    const config = this.client.getConfig();
    const baseURL = config.baseURL || '';
    const url = `${baseURL}/v1/workflow/executions/${executionId}/events`;

    if (typeof EventSource !== 'undefined') {
      const es = new EventSource(url);
      es.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          onEvent({ event: 'MESSAGE', data: parsed });
        } catch {
          // Pass raw if not json
        }
      };
      es.addEventListener('WORKFLOW_STARTED', (ev: any) => {
        try {
          onEvent({ event: 'WORKFLOW_STARTED', data: JSON.parse(ev.data) });
        } catch {}
      });
      es.addEventListener('TASK_UPDATED', (ev: any) => {
        try {
          onEvent({ event: 'TASK_UPDATED', data: JSON.parse(ev.data) });
        } catch {}
      });
      es.addEventListener('WORKFLOW_COMPLETED', (ev: any) => {
        try {
          onEvent({ event: 'WORKFLOW_COMPLETED', data: JSON.parse(ev.data) });
        } catch {}
      });
      es.addEventListener('WORKFLOW_TERMINATED', (ev: any) => {
        try {
          onEvent({ event: 'WORKFLOW_TERMINATED', data: JSON.parse(ev.data) });
        } catch {}
      });
      es.onerror = () => {
        if (onError) onError(new Error('SSE Stream Error'));
      };
      return () => es.close();
    }

    // Node.js / React Native fetch fallback with AbortController
    const controller = new AbortController();
    (async () => {
      try {
        const res = await (config.fetch || globalThis.fetch)(url, {
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!res.body || !('getReader' in res.body)) return;
        const reader = (res.body as any).getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const data = JSON.parse(line.replace(/^data:\s*/, ''));
                onEvent({ event: 'DATA', data });
              } catch {}
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && onError) {
          onError(err);
        }
      }
    })();

    return () => controller.abort();
  }
}

export class UsersNamespace {
  constructor(private client: UnipostClient) {}

  searchUsers(params?: UserSearchCondition, options?: RequestOptions): Promise<PageResponse<UserVm>> {
    return this.client.get<PageResponse<UserVm>>('/user/_list', { ...options, params });
  }

  getUserByUid(uid: string, options?: RequestOptions): Promise<UserVm> {
    return this.client.get<UserVm>(`/user/${uid}`, options);
  }

  getUserNames(uids: string[], options?: RequestOptions): Promise<Record<string, string>> {
    return this.client.post<Record<string, string>>('/user/_names', uids, options);
  }

  createUser(payload: CreateUserRequest, options?: RequestOptions): Promise<UserVm> {
    return this.client.post<UserVm>('/user', payload, options);
  }

  updateUser(uid: string, payload: UpdateUserRequest, options?: RequestOptions): Promise<UserVm> {
    return this.client.put<UserVm>(`/user/${uid}`, payload, options);
  }
}

export class BillingNamespace {
  constructor(private client: UnipostClient) {}

  getSummary(tenantId?: string, options?: RequestOptions): Promise<TenantBillingSummary> {
    return this.client.get<TenantBillingSummary>('/billing/summary', { ...options, tenantId });
  }

  createPaymentLink(payload: CreatePaymentLinkPayload, options?: RequestOptions): Promise<CheckoutResponse> {
    return this.client.post<CheckoutResponse>('/billing/create-payment-link', payload, options);
  }

  contactSales(payload: ContactSalesPayload, options?: RequestOptions): Promise<{ success: boolean; message?: string }> {
    return this.client.post<{ success: boolean; message?: string }>('/billing/contact-sales', payload, options);
  }
}

/**
 * Factory to create a pre-configured UnipostClient instance
 */
export function createUnipostClient(config: UnipostClientConfig = {}): UnipostClient {
  return new UnipostClient(config);
}
