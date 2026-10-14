import type { SandboxRouteHandler, SandboxRequest } from '../types';
import { useSandboxStore } from '../store/sandbox-store';
import { tasks as initialTasks } from '../../../features/tasks/data/tasks';
import { type Task } from '../../../features/tasks/data/schema';

class TasksSandboxRepository {
  private tenantTasks: Map<string, Task[]> = new Map();

  constructor() {
    this.reset();
  }

  private getActiveTenantId(): string {
    return useSandboxStore.getState().activeTenantId || 'tenant-acme';
  }

  private getTenantList(tenantId?: string): Task[] {
    const tid = tenantId || this.getActiveTenantId();
    if (!this.tenantTasks.has(tid)) {
      this.tenantTasks.set(tid, JSON.parse(JSON.stringify(initialTasks)));
    }
    return this.tenantTasks.get(tid)!;
  }

  public reset(): void {
    this.tenantTasks.clear();
    this.tenantTasks.set('SYSTEM', JSON.parse(JSON.stringify(initialTasks)));
    this.tenantTasks.set('tenant-acme', JSON.parse(JSON.stringify(initialTasks)));
    this.tenantTasks.set(
      'tenant-us-east-1',
      initialTasks.slice(0, 5).map((t, idx) => ({
        ...t,
        id: `TASK-US-${1000 + idx}`,
        title: `[US-EAST] ${t.title}`,
      }))
    );
  }

  public getAll(tenantId?: string): Task[] {
    return [...this.getTenantList(tenantId)];
  }

  public getById(id: string, tenantId?: string): Task | undefined {
    return this.getTenantList(tenantId).find((t) => t.id === id);
  }

  public create(task: Task, tenantId?: string): Task {
    const list = this.getTenantList(tenantId);
    list.unshift(task);
    return task;
  }

  public update(id: string, patch: Partial<Task>, tenantId?: string): Task | null {
    const list = this.getTenantList(tenantId);
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    return list[idx];
  }

  public delete(id: string, tenantId?: string): boolean {
    const tid = tenantId || this.getActiveTenantId();
    const list = this.getTenantList(tid);
    const beforeLen = list.length;
    const filtered = list.filter((t) => t.id !== id);
    this.tenantTasks.set(tid, filtered);
    return filtered.length < beforeLen;
  }
}

export const tasksSandboxRepo = new TasksSandboxRepository();

export const tasksSandboxHandler: SandboxRouteHandler = {
  id: 'tasks-sandbox-handler',
  name: 'Tasks Sandbox Repository',
  description: 'In-memory multi-tenant CRUD repository for Tasks',
  priority: 80,
  matcher: (ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    return cleanPath.startsWith('/tasks');
  },
  handler: async (req: SandboxRequest, ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    const subPath = cleanPath.replace(/^\/tasks/, '');
    const tenantId = useSandboxStore.getState().activeTenantId || (req.headers?.['x-tenant-id'] as string) || 'tenant-acme';

    // List or Create
    if (subPath === '' || subPath === '/') {
      if (req.method === 'GET') {
        return { status: 200, data: tasksSandboxRepo.getAll(tenantId) };
      }
      if (req.method === 'POST') {
        const created = tasksSandboxRepo.create(req.data, tenantId);
        return { status: 201, data: created };
      }
    }

    // Detail, Update, Delete
    const idMatch = subPath.match(/^\/([^/]+)$/);
    if (idMatch) {
      const id = idMatch[1];
      if (req.method === 'GET') {
        const task = tasksSandboxRepo.getById(id, tenantId);
        if (!task) return { status: 404, data: { message: 'Task not found' } };
        return { status: 200, data: task };
      }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const updated = tasksSandboxRepo.update(id, req.data, tenantId);
        if (!updated) return { status: 404, data: { message: 'Task not found' } };
        return { status: 200, data: updated };
      }
      if (req.method === 'DELETE') {
        const deleted = tasksSandboxRepo.delete(id, tenantId);
        return { status: 200, data: { success: deleted } };
      }
    }

    return { status: 404, data: { message: 'Not found' } };
  },
};
