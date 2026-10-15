import type { SandboxRouteHandler, SandboxRequest } from '../types';
import { workflowExecutions } from './data/workflow-executions';
import { defaultSandboxStore } from '../store';
import { sandboxResetRegistry } from '../reset-registry';
import type { WorkflowExecution } from '@unipost/client';

export class WorkflowExecutionsSandboxRepository {
  private tenantWorkflowExecutions: Map<string, WorkflowExecution[]> = new Map();

  constructor() {
    this.reset();
    sandboxResetRegistry.register(() => this.reset());
  }

  private getActiveTenantId(): string {
    return defaultSandboxStore.getState().activeTenantId || 'tenant-acme';
  }

  private getTenantList(tenantId?: string): WorkflowExecution[] {
    const tid = tenantId || this.getActiveTenantId();
    if (!this.tenantWorkflowExecutions.has(tid)) {
      this.tenantWorkflowExecutions.set(tid, JSON.parse(JSON.stringify(workflowExecutions)));
    }
    return this.tenantWorkflowExecutions.get(tid)!;
  }

  public reset(): void {
    this.tenantWorkflowExecutions.clear();
    this.tenantWorkflowExecutions.set('SYSTEM', JSON.parse(JSON.stringify(workflowExecutions)));
    this.tenantWorkflowExecutions.set('tenant-acme', JSON.parse(JSON.stringify(workflowExecutions)));
    this.tenantWorkflowExecutions.set(
      'tenant-us-east-1',
      (workflowExecutions as WorkflowExecution[]).slice(0, 5).map((t, idx) => ({
        ...t,
        id: `TASK-US-${1000 + idx}`,
        title: `[US-EAST] ${t.title}`,
      }))
    );
  }

  public getAll(tenantId?: string): WorkflowExecution[] {
    return [...this.getTenantList(tenantId)];
  }

  public getById(id: string, tenantId?: string): WorkflowExecution | undefined {
    return this.getTenantList(tenantId).find((t) => t.id === id);
  }

  public create(task: WorkflowExecution, tenantId?: string): WorkflowExecution {
    const list = this.getTenantList(tenantId);
    list.unshift(task);
    return task;
  }

  public update(id: string, patch: Partial<WorkflowExecution>, tenantId?: string): WorkflowExecution | null {
    const list = this.getTenantList(tenantId);
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch, updatedAt: new Date() };
    return list[idx];
  }

  public delete(id: string, tenantId?: string): boolean {
    const tid = tenantId || this.getActiveTenantId();
    const list = this.getTenantList(tid);
    const beforeLen = list.length;
    const filtered = list.filter((t) => t.id !== id);
    this.tenantWorkflowExecutions.set(tid, filtered);
    return filtered.length < beforeLen;
  }
}

export const workflowExecutionsSandboxRepo = new WorkflowExecutionsSandboxRepository();

export const workflowExecutionsSandboxHandler: SandboxRouteHandler = {
  id: 'workflow-executions-sandbox-handler',
  name: 'WorkflowExecutions Sandbox Repository',
  description: 'In-memory multi-tenant CRUD repository for WorkflowExecutions',
  priority: 80,
  matcher: (ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    return cleanPath.startsWith('/workflow/executions') || cleanPath.startsWith('/workflow-executions');
  },
  handler: async (req: SandboxRequest, ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    const subPath = cleanPath
      .replace(/^\/workflow\/executions/, '')
      .replace(/^\/workflow-executions/, '');
    const tenantId = (req.headers?.['x-tenant-id'] as string) || defaultSandboxStore.getState().activeTenantId || 'tenant-acme';

    // List or Create
    if (subPath === '' || subPath === '/') {
      if (req.method === 'GET') {
        return { status: 200, data: workflowExecutionsSandboxRepo.getAll(tenantId) };
      }
      if (req.method === 'POST') {
        const created = workflowExecutionsSandboxRepo.create(req.data, tenantId);
        return { status: 201, data: created };
      }
    }

    // Detail, Update, Delete
    const idMatch = subPath.match(/^\/([^/]+)$/);
    if (idMatch) {
      const id = idMatch[1];
      if (req.method === 'GET') {
        const workflowExecution = workflowExecutionsSandboxRepo.getById(id, tenantId);
        if (!workflowExecution) return { status: 404, data: { message: 'Task not found' } };
        return { status: 200, data: workflowExecution };
      }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const updated = workflowExecutionsSandboxRepo.update(id, req.data, tenantId);
        if (!updated) return { status: 404, data: { message: 'Task not found' } };
        return { status: 200, data: updated };
      }
      if (req.method === 'DELETE') {
        const deleted = workflowExecutionsSandboxRepo.delete(id, tenantId);
        return { status: 200, data: { success: deleted } };
      }
    }

    return { status: 404, data: { message: 'Not found' } };
  },
};
