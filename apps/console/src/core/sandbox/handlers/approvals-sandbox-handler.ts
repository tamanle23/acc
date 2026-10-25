import type { SandboxRouteHandler, SandboxRequest } from '../types';
import { sandboxResetRegistry } from '@acc/sandbox';
import { useSandboxStore } from '../store/sandbox-store';

export interface ApprovalTask {
  id: string;
  workflowId: string;
  workflowName: string;
  entityTypeId: number;
  entityTypeName: string;
  recordId: number;
  stepName: string;
  requestedBy: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
  rationale?: string;
  currentAttributes: Record<string, unknown>;
  proposedAttributes: Record<string, unknown>;
  tenantId?: string;
}

const INITIAL_APPROVAL_TASKS: ApprovalTask[] = [
  {
    id: 'appr-101',
    workflowId: 'wf-vendor-onboarding',
    workflowName: 'Vendor Compliance & Security Review',
    entityTypeId: 1,
    entityTypeName: 'Vendor Profile',
    recordId: 4021,
    stepName: 'Security Tier Authorization',
    requestedBy: 'operator-alice@acc.io',
    requestedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    status: 'PENDING',
    currentAttributes: {
      companyName: 'Acme Logistics Ltd',
      tier: 'STANDARD',
      creditLimit: 50000,
      complianceStatus: 'PENDING_REVIEW',
    },
    proposedAttributes: {
      companyName: 'Acme Logistics Ltd',
      tier: 'ENTERPRISE',
      creditLimit: 250000,
      complianceStatus: 'APPROVED_TIER_1',
    },
    tenantId: 'tenant-us-east-1',
  },
  {
    id: 'appr-102',
    workflowId: 'wf-rate-card-publish',
    workflowName: 'Carrier Zone Rate Schedule Mutation',
    entityTypeId: 3,
    entityTypeName: 'Zone Tariff',
    recordId: 8812,
    stepName: 'Finance Controller Sign-Off',
    requestedBy: 'tariffs-bot@acc.io',
    requestedAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    status: 'PENDING',
    currentAttributes: {
      zone: 'APAC-EAST',
      baseRatePerKg: 4.5,
      fuelSurchargePercent: 12.0,
      currency: 'USD',
    },
    proposedAttributes: {
      zone: 'APAC-EAST',
      baseRatePerKg: 4.85,
      fuelSurchargePercent: 13.5,
      currency: 'USD',
    },
    tenantId: 'tenant-us-east-1',
  },
];

export class ApprovalTaskMockStore {
  private tasks: ApprovalTask[] = JSON.parse(JSON.stringify(INITIAL_APPROVAL_TASKS));

  constructor() {
    sandboxResetRegistry.register(() => this.reset());
  }

  public reset(): void {
    this.tasks = JSON.parse(JSON.stringify(INITIAL_APPROVAL_TASKS));
  }

  public getTasks(tenantId?: string, status?: string): ApprovalTask[] {
    return this.tasks.filter((t) => {
      const matchTenant = !tenantId || tenantId === 'SYSTEM' || !t.tenantId || t.tenantId === tenantId;
      const matchStatus = !status || t.status === status;
      return matchTenant && matchStatus;
    });
  }

  public addTask(task: ApprovalTask): void {
    this.tasks.unshift(task);
  }

  public resolveTask(
    id: string,
    action: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED',
    rationale?: string
  ): ApprovalTask | null {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;
    task.status = action;
    if (rationale !== undefined) {
      task.rationale = rationale;
    }
    return task;
  }
}

export const approvalTaskMockStore = new ApprovalTaskMockStore();

export const approvalsSandboxHandler: SandboxRouteHandler = {
  id: 'approvals-sandbox-handler',
  name: 'Human-in-the-Loop Approvals Sandbox Handler',
  priority: 110,
  matcher: (context: { url?: string; pathname?: string }) => {
    const url = context.url || context.pathname || '';
    return url.includes('/v1/workflows/approvals');
  },
  handler: async (req: SandboxRequest) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname.replace(/^\/api/, '');
    const method = req.method.toUpperCase();
    const activeTenantId = useSandboxStore.getState().activeTenantId || 'tenant-us-east-1';

    // 1. GET /v1/workflows/approvals
    if (method === 'GET' && path === '/v1/workflows/approvals') {
      const statusParam = url.searchParams.get('status') || undefined;
      const tasks = approvalTaskMockStore.getTasks(activeTenantId, statusParam);
      return {
        status: 200,
        data: tasks,
      };
    }

    // 2. POST /v1/workflows/approvals/:id/resolve
    const resolveMatch = path.match(/^\/v1\/workflows\/approvals\/([^/]+)\/resolve$/);
    if (method === 'POST' && resolveMatch) {
      const taskId = decodeURIComponent(resolveMatch[1]);
      const body = (req.data || {}) as {
        action: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
        rationale?: string;
      };

      const updated = approvalTaskMockStore.resolveTask(taskId, body.action, body.rationale);
      if (!updated) {
        return {
          status: 404,
          data: { error: 'Approval task not found', taskId },
        };
      }

      return {
        status: 200,
        data: updated,
      };
    }

    return null;
  },
};
