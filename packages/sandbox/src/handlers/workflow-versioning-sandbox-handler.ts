import type { SandboxRouteHandler, SandboxResponse, SandboxRequest } from '../types';
import { defaultSandboxStore } from '../store';
import { sandboxResetRegistry } from '../reset-registry';

export interface WorkflowDefinitionVersionItem {
  definitionId: string;
  tenantId: string;
  workflowKey: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';
  name: string;
  description: string;
  definition: Record<string, unknown>;
  publishedAtMs?: number | null;
  publishedBy?: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface WorkflowAuditLogItem {
  sequenceNum: number;
  eventId: string;
  workflowId: string;
  tenantId: string;
  actorId: string;
  action: string;
  payloadSnapshot: Record<string, unknown>;
  prevHash: string;
  currentHash: string;
  createdAtMs: number;
}

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function pseudoSha256(input: string): string {
  // Deterministic 64-char hex hash implementation for sandbox runtime
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h0 = (h0 ^ (code << 3)) >>> 0;
    h1 = (h1 + code * 31) >>> 0;
    h2 = ((h2 << 5) - h2 + code) >>> 0;
    h3 = (h3 ^ (code * 17)) >>> 0;
    h4 = (h4 + (code << 4)) >>> 0;
    h5 = ((h5 << 3) ^ code) >>> 0;
    h6 = (h6 + code * 13) >>> 0;
    h7 = (h7 ^ (code * 7)) >>> 0;
  }

  const toHex8 = (n: number) => n.toString(16).padStart(8, '0');
  return `${toHex8(h0)}${toHex8(h1)}${toHex8(h2)}${toHex8(h3)}${toHex8(h4)}${toHex8(h5)}${toHex8(h6)}${toHex8(h7)}`;
}

export class WorkflowVersioningSandboxRepository {
  private versions: Map<string, WorkflowDefinitionVersionItem[]> = new Map();
  private auditLogs: Map<string, WorkflowAuditLogItem[]> = new Map();

  constructor() {
    this.reset();
    sandboxResetRegistry.register(() => this.reset());
  }

  public reset(): void {
    this.versions.clear();
    this.auditLogs.clear();

    // Seed versions for order-fulfillment-v1
    const orderV1: WorkflowDefinitionVersionItem = {
      definitionId: 'order-fulfillment-v1_v1',
      tenantId: 'tenant-acme',
      workflowKey: 'order-fulfillment-v1',
      version: 1,
      status: 'ACTIVE',
      name: 'Order Fulfillment Pipeline',
      description: 'End-to-end e-commerce order processing with automated inventory checks and logistics.',
      definition: {
        workflowKey: 'order-fulfillment-v1',
        version: 1,
        tasks: [
          { taskReferenceName: 'checkInventory', taskType: 'SIMPLE', domain: 'inventory' },
          { taskReferenceName: 'verifyFraud', taskType: 'SIMPLE', domain: 'fraud' },
          { taskReferenceName: 'routeShipping', taskType: 'SWITCH', domain: 'shipping' },
        ],
      },
      createdAtMs: Date.now() - 86400000,
      updatedAtMs: Date.now() - 86400000,
      publishedAtMs: Date.now() - 86400000,
      publishedBy: 'lead-architect',
    };

    const orderV2Draft: WorkflowDefinitionVersionItem = {
      definitionId: 'order-fulfillment-v1_v2',
      tenantId: 'tenant-acme',
      workflowKey: 'order-fulfillment-v1',
      version: 2,
      status: 'DRAFT',
      name: 'Order Fulfillment Pipeline (v2 NextGen)',
      description: 'Upgraded pipeline with automated tax calculation and regional customs pre-clearance.',
      definition: {
        workflowKey: 'order-fulfillment-v1',
        version: 2,
        tasks: [
          { taskReferenceName: 'checkInventory', taskType: 'SIMPLE', domain: 'inventory' },
          { taskReferenceName: 'verifyFraud', taskType: 'SIMPLE', domain: 'fraud' },
          { taskReferenceName: 'calculateCustomsTax', taskType: 'SIMPLE', domain: 'tax' }, // ADDED NODE
          { taskReferenceName: 'routeShipping', taskType: 'SWITCH', domain: 'shipping' },
        ],
      },
      createdAtMs: Date.now() - 3600000,
      updatedAtMs: Date.now() - 3600000,
    };

    this.versions.set('tenant-acme:order-fulfillment-v1', [orderV1, orderV2Draft]);
    this.versions.set('SYSTEM:order-fulfillment-v1', [orderV1, orderV2Draft]);

    // Seed audit log for wf_exec_901
    this.seedAuditLog('wf_exec_901', 'tenant-acme');
  }

  private seedAuditLog(workflowId: string, tenantId: string): void {
    const ev1Id = 'audit_ev_001';
    const t0 = Date.now() - 120000;
    const p1 = { orderId: 'ORD-901', customer: 'Acme Corp', tier: 'PLATINUM' };
    const h1 = pseudoSha256(`${GENESIS_HASH}:${ev1Id}:${workflowId}:EXECUTION_STARTED:${JSON.stringify(p1)}:${t0}`);

    const rec1: WorkflowAuditLogItem = {
      sequenceNum: 1,
      eventId: ev1Id,
      workflowId,
      tenantId,
      actorId: 'SYSTEM',
      action: 'EXECUTION_STARTED',
      payloadSnapshot: p1,
      prevHash: GENESIS_HASH,
      currentHash: h1,
      createdAtMs: t0,
    };

    const ev2Id = 'audit_ev_002';
    const t1 = t0 + 15000;
    const p2 = { taskId: 'task_exec_901_checkInventory', referenceName: 'checkInventory', status: 'COMPLETED', output: { inStock: true } };
    const h2 = pseudoSha256(`${h1}:${ev2Id}:${workflowId}:TASK_COMPLETED:${JSON.stringify(p2)}:${t1}`);

    const rec2: WorkflowAuditLogItem = {
      sequenceNum: 2,
      eventId: ev2Id,
      workflowId,
      tenantId,
      actorId: 'worker-node-alpha',
      action: 'TASK_COMPLETED',
      payloadSnapshot: p2,
      prevHash: h1,
      currentHash: h2,
      createdAtMs: t1,
    };

    this.auditLogs.set(workflowId, [rec1, rec2]);
  }

  public getVersions(workflowKey: string, tenantId = 'tenant-acme'): WorkflowDefinitionVersionItem[] {
    const key = `${tenantId}:${workflowKey}`;
    return this.versions.get(key) || this.versions.get(`SYSTEM:${workflowKey}`) || [];
  }

  public getVersion(workflowKey: string, version: number, tenantId = 'tenant-acme'): WorkflowDefinitionVersionItem | undefined {
    return this.getVersions(workflowKey, tenantId).find((v) => v.version === version);
  }

  public saveVersion(record: WorkflowDefinitionVersionItem, tenantId = 'tenant-acme'): WorkflowDefinitionVersionItem {
    const key = `${tenantId}:${record.workflowKey}`;
    const list = this.getVersions(record.workflowKey, tenantId);
    const existingIdx = list.findIndex((v) => v.version === record.version);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...record, updatedAtMs: Date.now() };
    } else {
      list.push(record);
    }
    this.versions.set(key, list);
    return record;
  }

  public getAuditRecords(workflowId: string): WorkflowAuditLogItem[] {
    return this.auditLogs.get(workflowId) || [];
  }

  public appendAuditRecord(record: Omit<WorkflowAuditLogItem, 'sequenceNum' | 'prevHash' | 'currentHash'>): WorkflowAuditLogItem {
    const list = this.auditLogs.get(record.workflowId) || [];
    const seq = list.length + 1;
    const prevHash = list.length > 0 ? list[list.length - 1].currentHash : GENESIS_HASH;
    const currentHash = pseudoSha256(
      `${prevHash}:${record.eventId}:${record.workflowId}:${record.action}:${JSON.stringify(record.payloadSnapshot)}:${record.createdAtMs}`
    );

    const fullRecord: WorkflowAuditLogItem = {
      sequenceNum: seq,
      prevHash,
      currentHash,
      ...record,
    };

    list.push(fullRecord);
    this.auditLogs.set(record.workflowId, list);
    return fullRecord;
  }

  public tamperAuditRecord(workflowId: string, sequenceNum: number, fakePayload: Record<string, unknown>): boolean {
    const list = this.auditLogs.get(workflowId);
    if (!list) return false;
    const rec = list.find((r) => r.sequenceNum === sequenceNum);
    if (!rec) return false;
    // Mutate snapshot without recomputing hash, simulating illegal SQL injection / tamper
    rec.payloadSnapshot = fakePayload;
    return true;
  }

  public verifyAuditChain(workflowId: string): { verified: boolean; totalEvents: number; corruptedAtSequence?: number; details: string } {
    const records = this.auditLogs.get(workflowId) || [];
    if (records.length === 0) {
      return { verified: true, totalEvents: 0, details: 'No audit records for workflow execution' };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (const record of records) {
      if (record.prevHash !== expectedPrevHash) {
        return {
          verified: false,
          totalEvents: records.length,
          corruptedAtSequence: record.sequenceNum,
          details: `Broken link at sequence ${record.sequenceNum}: expected prevHash ${expectedPrevHash} but found ${record.prevHash}`,
        };
      }

      const recomputed = pseudoSha256(
        `${record.prevHash}:${record.eventId}:${record.workflowId}:${record.action}:${JSON.stringify(record.payloadSnapshot)}:${record.createdAtMs}`
      );

      if (recomputed !== record.currentHash) {
        return {
          verified: false,
          totalEvents: records.length,
          corruptedAtSequence: record.sequenceNum,
          details: `Cryptographic mismatch at sequence ${record.sequenceNum}: payload snapshot was tampered`,
        };
      }

      expectedPrevHash = record.currentHash;
    }

    return {
      verified: true,
      totalEvents: records.length,
      details: `Chain cryptographically intact (${records.length} events verified)`,
    };
  }
}

export const workflowVersioningSandboxRepo = new WorkflowVersioningSandboxRepository();

export const workflowVersioningSandboxHandler: SandboxRouteHandler = {
  id: 'workflow-versioning-handler',
  name: 'Workflow Definition Versioning, Hot Migration & Tamper-Evident Audit Ledger',
  priority: 96,
  matcher: (context) => {
    const rawPath = typeof context === 'string' ? context : (context.pathname || context.url || '');
    const cleanPath = rawPath.replace(/^(?:https?:\/\/[^/]+)?(?:\/api\/v1|\/api\/api|\/api|\/v1)/, '');
    return (
      cleanPath.includes('/workflow/definitions/') ||
      cleanPath.includes('/workflow/executions/') ||
      cleanPath.includes('/workflow-executions/')
    );
  },
  handler: async (req: SandboxRequest): Promise<SandboxResponse | null> => {
    const cleanPath = req.url
      .replace(/^(?:https?:\/\/[^/]+)?(?:\/api\/v1|\/api\/api|\/api|\/v1)/, '')
      .split('?')[0];
    const method = req.method.toUpperCase();
    const tenantId = defaultSandboxStore.getState().activeTenantId || 'tenant-acme';

    // 1. GET /workflow/definitions/:key/versions
    const versionsMatch = cleanPath.match(/^\/workflow\/definitions\/([^/]+)\/versions$/);
    if (versionsMatch && method === 'GET') {
      const key = versionsMatch[1];
      const list = workflowVersioningSandboxRepo.getVersions(key, tenantId);
      return { status: 200, data: list };
    }

    // 2. GET /workflow/definitions/:key/versions/:version
    const singleVersionMatch = cleanPath.match(/^\/workflow\/definitions\/([^/]+)\/versions\/(\d+)$/);
    if (singleVersionMatch && method === 'GET') {
      const key = singleVersionMatch[1];
      const ver = parseInt(singleVersionMatch[2], 10);
      const found = workflowVersioningSandboxRepo.getVersion(key, ver, tenantId);
      if (found) return { status: 200, data: found };
      return { status: 404, data: { error: `Version ${ver} not found for ${key}` } };
    }

    // 3. POST /workflow/executions/:id/migrate/dry-run
    const dryRunMatch = cleanPath.match(/^\/(?:workflow\/executions|workflow-executions)\/([^/]+)\/migrate\/dry-run$/);
    if (dryRunMatch && method === 'POST') {
      const execId = dryRunMatch[1];
      const targetDef = (req.data || {}) as { workflowKey: string; version: number; tasks: Array<{ taskReferenceName: string }> };

      // Simulate dry run
      const targetVersion = targetDef.version || 2;
      return {
        status: 200,
        data: {
          compatible: true,
          executionId: execId,
          sourceVersion: 'v1',
          targetVersion: `v${targetVersion}`,
          completedTasksPreserved: ['checkInventory'],
          activeFrontierTasks: ['verifyFraud'],
          addedDownstreamTasks: ['calculateCustomsTax'],
          removedTasks: [],
          issues: [],
        },
      };
    }

    // 4. POST /workflow/executions/:id/migrate
    const migrateMatch = cleanPath.match(/^\/(?:workflow\/executions|workflow-executions)\/([^/]+)\/migrate$/);
    if (migrateMatch && method === 'POST') {
      const execId = migrateMatch[1];
      const targetDef = (req.data || {}) as { workflowKey: string; version: number };
      const newVersion = targetDef.version || 2;

      // Append HOT_MIGRATION audit record
      workflowVersioningSandboxRepo.appendAuditRecord({
        eventId: `ev_mig_${Date.now()}`,
        workflowId: execId,
        tenantId,
        actorId: 'LEAD_OPERATOR',
        action: 'HOT_MIGRATION',
        payloadSnapshot: {
          sourceVersion: 'v1',
          targetVersion: `v${newVersion}`,
          remapStrategy: 'TOPOLOGICAL_FRONTIER',
        },
        createdAtMs: Date.now(),
      });

      return {
        status: 200,
        data: {
          workflowId: execId,
          status: 'RUNNING',
          version: newVersion,
          migrated: true,
          migratedAtMs: Date.now(),
        },
      };
    }

    // 5. GET /workflow/executions/:id/audit
    const auditMatch = cleanPath.match(/^\/(?:workflow\/executions|workflow-executions)\/([^/]+)\/audit$/);
    if (auditMatch && method === 'GET') {
      const execId = auditMatch[1];
      const logs = workflowVersioningSandboxRepo.getAuditRecords(execId);
      return { status: 200, data: logs };
    }

    // 6. GET /workflow/executions/:id/audit/verify
    const verifyMatch = cleanPath.match(/^\/(?:workflow\/executions|workflow-executions)\/([^/]+)\/audit\/verify$/);
    if (verifyMatch && method === 'GET') {
      const execId = verifyMatch[1];
      const result = workflowVersioningSandboxRepo.verifyAuditChain(execId);
      return { status: 200, data: result };
    }

    // 7. POST /workflow/executions/:id/audit/tamper (Diagnostic simulation endpoint)
    const tamperMatch = cleanPath.match(/^\/(?:workflow\/executions|workflow-executions)\/([^/]+)\/audit\/tamper$/);
    if (tamperMatch && method === 'POST') {
      const execId = tamperMatch[1];
      const body = (req.data || {}) as { sequenceNum?: number; payload?: Record<string, unknown> };
      const seq = body.sequenceNum || 1;
      const success = workflowVersioningSandboxRepo.tamperAuditRecord(execId, seq, body.payload || { tampered: true, illegalBypass: true });
      return { status: success ? 200 : 404, data: { tampered: success, sequenceNum: seq } };
    }

    // 8. POST /workflow/definitions/:key/migration-preview
    const previewMatch = cleanPath.match(/^\/workflow\/definitions\/([^/]+)\/migration-preview$/);
    if (previewMatch && method === 'POST') {
      const key = previewMatch[1];
      const body = (req.data || {}) as { targetVersion?: number };
      const targetVersion = body.targetVersion || 2;

      return {
        status: 200,
        data: {
          workflowKey: key,
          targetVersion,
          summary: {
            total: 3,
            fullyCompatible: 1,
            requiresReview: 1,
            incompatible: 1,
          },
          items: [
            {
              workflowId: 'wf_exec_001_safe',
              currentVersion: 1,
              status: 'RUNNING',
              tier: 'FULLY_COMPATIBLE',
              compatible: true,
              completedTasks: ['checkInventory'],
              activeTasks: ['verifyFraud'],
              warnings: [],
              issues: [],
            },
            {
              workflowId: 'wf_exec_002_review',
              currentVersion: 1,
              status: 'RUNNING',
              tier: 'CONDITIONAL_REQUIRES_MANUAL_REVIEW',
              compatible: true,
              completedTasks: ['checkInventory', 'verifyFraud'],
              activeTasks: ['routeShipping'],
              warnings: [
                'Newly added task "calculateCustomsTax" introduces 1 parameter bindings',
                'Active task "routeShipping" downstream edge remapped',
              ],
              issues: [],
            },
            {
              workflowId: 'wf_exec_003_blocked',
              currentVersion: 1,
              status: 'COMPLETED',
              tier: 'INCOMPATIBLE_BLOCK',
              compatible: false,
              completedTasks: ['checkInventory', 'verifyFraud', 'routeShipping'],
              activeTasks: [],
              warnings: [],
              issues: ['Cannot hot-migrate execution in terminal state: COMPLETED'],
            },
          ],
        },
      };
    }

    // 9. POST /workflow/definitions/:key/batch-migrate
    const batchMigrateMatch = cleanPath.match(/^\/workflow\/definitions\/([^/]+)\/batch-migrate$/);
    if (batchMigrateMatch && method === 'POST') {
      const key = batchMigrateMatch[1];
      const body = (req.data || {}) as { targetVersion?: number; executionIds?: string[]; autoMigrateCompatibleOnly?: boolean };
      const targetVersion = body.targetVersion || 2;
      const ids = body.executionIds || ['wf_exec_001_safe'];

      return {
        status: 200,
        data: {
          workflowKey: key,
          targetVersion,
          migrated: ids.length,
          failed: 0,
          results: ids.map((id) => ({ workflowId: id, success: true })),
        },
      };
    }

    return null;
  },
};
