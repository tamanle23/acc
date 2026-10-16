import type { SandboxRouteHandler, SandboxResponse, SandboxRequest } from '../types';
import { defaultSandboxStore } from '../store';
import { sandboxResetRegistry } from '../reset-registry';
import type { TaskDlqRecordDto } from '@unipost/client';

const INITIAL_DLQ_SEED: TaskDlqRecordDto[] = [
  {
    dlqId: 'dlq-101',
    taskId: 'wf-order-982_charge-card_att3',
    workflowId: 'wf-order-982',
    tenantId: 'tenant-acme',
    workspaceId: 'default',
    taskType: 'HTTP',
    domain: 'payment',
    errorMessage: 'Connection timed out after 30000ms connecting to https://payment.acme.corp/charge',
    errorStacktrace: 'java.net.http.HttpTimeoutException: request timed out\n  at com.unipost.workflow.adapters.transport.HttpWorkerTransport.poll(HttpWorkerTransport.java:142)',
    payloadSnapshot: { amount: 249.99, currency: 'USD', cardToken: 'tok_visa_4242' },
    retryCount: 3,
    isolatedAtMs: Date.now() - 3600000,
    replayedAtMs: null,
    status: 'ISOLATED',
  },
  {
    dlqId: 'dlq-102',
    taskId: 'wf-content-441_llm-gen_att3',
    workflowId: 'wf-content-441',
    tenantId: 'tenant-acme',
    workspaceId: 'default',
    taskType: 'LLM_CHAT_COMPLETE',
    domain: 'ai-enrichment',
    errorMessage: 'OpenAI API 429: Rate limit exceeded or token quota reached',
    errorStacktrace: 'com.unipost.workflow.llm.RateLimitException: 429 Too Many Requests\n  at com.unipost.workflow.llm.OpenAiClient.complete(OpenAiClient.java:88)',
    payloadSnapshot: { model: 'gpt-4o', prompt: 'Summarize quarterly financial disclosures...', maxTokens: 4096 },
    retryCount: 3,
    isolatedAtMs: Date.now() - 7200000,
    replayedAtMs: null,
    status: 'ISOLATED',
  },
  {
    dlqId: 'dlq-103',
    taskId: 'wf-sync-112_jdbc-query_att3',
    workflowId: 'wf-sync-112',
    tenantId: 'tenant-acme',
    workspaceId: 'default',
    taskType: 'JDBC',
    domain: 'inventory',
    errorMessage: 'PSQLException: ERROR: deadlock detected on relation stock_reservations',
    errorStacktrace: 'org.postgresql.util.PSQLException: ERROR: deadlock detected\n  at org.postgresql.core.v3.QueryExecutorImpl.execute(QueryExecutorImpl.java:335)',
    payloadSnapshot: { sku: 'SKU-LOG-992', quantity: 15, warehouseId: 'WH-US-01' },
    retryCount: 3,
    isolatedAtMs: Date.now() - 86400000,
    replayedAtMs: Date.now() - 40000000,
    status: 'REPLAYED',
  },
  {
    dlqId: 'dlq-104',
    taskId: 'wf-cleanup-098_kafka-pub_att3',
    workflowId: 'wf-cleanup-098',
    tenantId: 'tenant-acme',
    workspaceId: 'default',
    taskType: 'KAFKA_PUBLISH',
    domain: 'audit',
    errorMessage: 'Org.apache.kafka.common.errors.TimeoutException: Topic orders.audit not present after 60000ms',
    errorStacktrace: 'org.apache.kafka.common.errors.TimeoutException: Failed to update metadata\n  at org.apache.kafka.clients.NetworkClient.poll(NetworkClient.java:540)',
    payloadSnapshot: { topic: 'orders.audit', eventId: 'EVT-9001', payload: { action: 'PURGE' } },
    retryCount: 3,
    isolatedAtMs: Date.now() - 172800000,
    replayedAtMs: null,
    status: 'DISCARDED',
  },
];

export class DlqSandboxRepository {
  private tenantDlq: Map<string, TaskDlqRecordDto[]> = new Map();

  constructor() {
    this.reset();
    sandboxResetRegistry.register(() => this.reset());
  }

  private getActiveTenantId(): string {
    return defaultSandboxStore.getState().activeTenantId || 'tenant-acme';
  }

  private getTenantList(tenantId?: string): TaskDlqRecordDto[] {
    const tid = tenantId || this.getActiveTenantId();
    if (!this.tenantDlq.has(tid)) {
      this.tenantDlq.set(tid, JSON.parse(JSON.stringify(INITIAL_DLQ_SEED)));
    }
    return this.tenantDlq.get(tid)!;
  }

  public reset(): void {
    this.tenantDlq.clear();
    this.tenantDlq.set('SYSTEM', JSON.parse(JSON.stringify(INITIAL_DLQ_SEED)));
    this.tenantDlq.set('tenant-acme', JSON.parse(JSON.stringify(INITIAL_DLQ_SEED)));
    this.tenantDlq.set(
      'tenant-us-east-1',
      INITIAL_DLQ_SEED.slice(0, 2).map((r, idx) => ({
        ...r,
        dlqId: `dlq-us-${201 + idx}`,
        tenantId: 'tenant-us-east-1',
      }))
    );
  }

  public list(status?: string, limit = 100, tenantId?: string): TaskDlqRecordDto[] {
    let list: TaskDlqRecordDto[] = [];
    if (!tenantId || tenantId === 'SYSTEM' || tenantId === 'ALL') {
      // Sovereign platform root: aggregate all DLQ records across all tenants
      for (const records of this.tenantDlq.values()) {
        for (const item of records) {
          if (!list.some((r) => r.dlqId === item.dlqId)) {
            list.push(item);
          }
        }
      }
    } else {
      list = this.getTenantList(tenantId);
    }

    let filtered = list;
    if (status && status.trim() !== '') {
      filtered = filtered.filter((r) => r.status.toLowerCase() === status.toLowerCase());
    }
    return [...filtered].sort((a, b) => b.isolatedAtMs - a.isolatedAtMs).slice(0, limit);
  }

  public getById(id: string, tenantId?: string): TaskDlqRecordDto | undefined {
    for (const [tid, list] of this.tenantDlq.entries()) {
      if (tenantId && tenantId !== 'SYSTEM' && tenantId !== 'ALL' && tenantId !== tid) continue;
      const existing = list.find((r) => r.dlqId === id);
      if (existing) return existing;
    }
    return undefined;
  }

  public replay(id: string, payloadOverrides?: Record<string, unknown>, tenantId?: string): TaskDlqRecordDto | null {
    for (const [tid, list] of this.tenantDlq.entries()) {
      if (tenantId && tenantId !== 'SYSTEM' && tenantId !== 'ALL' && tenantId !== tid) continue;
      const existing = list.find((r) => r.dlqId === id);
      if (existing) {
        existing.status = 'REPLAYED';
        existing.replayedAtMs = Date.now();
        if (payloadOverrides) {
          existing.payloadSnapshot = { ...existing.payloadSnapshot, ...payloadOverrides };
        }
        return { ...existing };
      }
    }
    return null;
  }

  public discard(id: string, tenantId?: string): boolean {
    for (const [tid, list] of this.tenantDlq.entries()) {
      if (tenantId && tenantId !== 'SYSTEM' && tenantId !== 'ALL' && tenantId !== tid) continue;
      const existing = list.find((r) => r.dlqId === id);
      if (existing) {
        existing.status = 'DISCARDED';
        return true;
      }
    }
    return false;
  }

  public injectPoisonTask(task?: Partial<TaskDlqRecordDto>, tenantId: string = 'tenant-acme'): TaskDlqRecordDto {
    const list = this.getTenantList(tenantId);
    const newRecord: TaskDlqRecordDto = {
      dlqId: `dlq-sim-${Date.now()}`,
      taskId: `wf-sim-${Math.floor(Math.random() * 9000 + 1000)}_task_${Date.now().toString().slice(-4)}`,
      workflowId: `wf-sim-${Math.floor(Math.random() * 9000 + 1000)}`,
      tenantId,
      workspaceId: 'default',
      taskType: 'HTTP',
      domain: 'payment',
      errorMessage: 'Simulated 504 Gateway Timeout: Gateway connection lost during transaction processing',
      errorStacktrace: 'java.net.http.HttpTimeoutException: Simulated fault injected from Unified Sandbox\n  at com.unipost.sandbox.FaultInjector.trigger(FaultInjector.java:42)',
      payloadSnapshot: { simulated: true, amount: 990000, currency: 'VND', triggeredAt: new Date().toISOString() },
      retryCount: 3,
      isolatedAtMs: Date.now(),
      replayedAtMs: null,
      status: 'ISOLATED',
      ...task,
    };
    list.unshift(newRecord);
    return newRecord;
  }
}

export const dlqSandboxRepository = new DlqSandboxRepository();

export const dlqSandboxHandler: SandboxRouteHandler = {
  id: 'dlq-handler',
  name: 'Dead-Letter Queue (DLQ) Mock Handler',
  priority: 99,
  matcher: (context) => {
    const cleanPath = context.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    return cleanPath.startsWith('/system/dlq') || cleanPath.startsWith('/workflow/dlq');
  },
  handler: async (req: SandboxRequest, context): Promise<SandboxResponse> => {
    const rawPath = context.pathname || new URL(req.url, 'http://localhost').pathname;
    const cleanPath = rawPath.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    const url = new URL(req.url, 'http://localhost');
    const tenantId = (req.headers && (req.headers['X-Tenant-Id'] || req.headers['x-tenant-id'])) as string | undefined;

    // POST /system/dlq/inject or /workflow/dlq/inject
    if (req.method === 'POST' && cleanPath.endsWith('/inject')) {
      let customPayload: Partial<TaskDlqRecordDto> | undefined;
      try {
        if (req.data) {
          customPayload = typeof req.data === 'string' ? JSON.parse(req.data) : req.data;
        }
      } catch {
        // ignore parse error
      }
      const injected = dlqSandboxRepository.injectPoisonTask(customPayload, tenantId || 'tenant-acme');
      return { status: 201, data: injected };
    }

    // POST /(system|workflow)/dlq/:id/replay
    if (req.method === 'POST' && cleanPath.includes('/replay')) {
      const match = cleanPath.match(/^\/(?:system|workflow)\/dlq\/([^/]+)\/replay/);
      const id = match ? match[1] : '';
      let payloadOverrides: Record<string, unknown> | undefined;
      try {
        if (req.data) {
          const parsed = typeof req.data === 'string' ? JSON.parse(req.data) : req.data;
          payloadOverrides = parsed.payloadOverrides || parsed;
        }
      } catch {
        // ignore JSON parse error
      }
      const replayed = dlqSandboxRepository.replay(id, payloadOverrides, tenantId);
      if (!replayed) {
        return { status: 404, data: { message: `DLQ record ${id} not found` } };
      }
      return { status: 200, data: replayed };
    }

    // DELETE /(system|workflow)/dlq/:id
    if (req.method === 'DELETE') {
      const match = cleanPath.match(/^\/(?:system|workflow)\/dlq\/([^/]+)$/);
      const id = match ? match[1] : '';
      const discarded = dlqSandboxRepository.discard(id, tenantId);
      if (!discarded) {
        return { status: 404, data: { message: `DLQ record ${id} not found` } };
      }
      return { status: 204, data: null };
    }

    // GET /(system|workflow)/dlq/:id
    const singleMatch = cleanPath.match(/^\/(?:system|workflow)\/dlq\/([^/]+)$/);
    if (req.method === 'GET' && singleMatch && singleMatch[1] !== 'dlq') {
      const id = singleMatch[1];
      const record = dlqSandboxRepository.getById(id, tenantId);
      if (!record) {
        return { status: 404, data: { message: `DLQ record ${id} not found` } };
      }
      return { status: 200, data: record };
    }

    // GET /(system|workflow)/dlq (List)
    if (req.method === 'GET') {
      const statusParam = url.searchParams.get('status') || undefined;
      const limitParam = parseInt(url.searchParams.get('limit') || '100', 10);
      const queryTenant = url.searchParams.get('tenantId') || tenantId;
      const list = dlqSandboxRepository.list(statusParam, limitParam, queryTenant);
      return { status: 200, data: list };
    }

    return { status: 404, data: { message: 'DLQ endpoint not found' } };
  },
};

