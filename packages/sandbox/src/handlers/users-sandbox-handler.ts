import type { SandboxRouteHandler, SandboxRequest } from '../types';
import { defaultSandboxStore } from '../store';
import { sandboxResetRegistry } from '../reset-registry';
import type { User } from '@unipost/client';
import usersData from './data/users-mock.json';

const initialUsers: User[] = usersData.map((user: any) => ({
  ...user,
  status: user.status as User['status'],
  role: user.role as User['role'],
  createdAt: new Date(user.createdAt),
  updatedAt: new Date(user.updatedAt),
}));

export class UsersSandboxRepository {
  private tenantUsers: Map<string, User[]> = new Map();

  constructor() {
    this.reset();
    sandboxResetRegistry.register(() => this.reset());
  }

  private getActiveTenantId(): string {
    return defaultSandboxStore.getState().activeTenantId || 'tenant-acme';
  }

  private getTenantList(tenantId?: string): User[] {
    const tid = tenantId || this.getActiveTenantId();
    if (!this.tenantUsers.has(tid)) {
      this.tenantUsers.set(tid, JSON.parse(JSON.stringify(initialUsers)));
    }
    return this.tenantUsers.get(tid)!;
  }

  public reset(): void {
    this.tenantUsers.clear();
    this.tenantUsers.set('SYSTEM', JSON.parse(JSON.stringify(initialUsers)));
    this.tenantUsers.set('tenant-acme', JSON.parse(JSON.stringify(initialUsers)));
    this.tenantUsers.set(
      'tenant-us-east-1',
      initialUsers.slice(0, 4).map((u, idx) => ({
        ...u,
        id: `usr-us-${100 + idx}`,
        username: `us_${u.username}`,
        email: `us_${u.email}`,
      }))
    );
  }

  public getAll(tenantId?: string): User[] {
    return [...this.getTenantList(tenantId)];
  }

  public getById(id: string, tenantId?: string): User | undefined {
    return this.getTenantList(tenantId).find((u) => u.id === id);
  }

  public create(user: User, tenantId?: string): User {
    const list = this.getTenantList(tenantId);
    list.unshift(user);
    return user;
  }

  public update(id: string, patch: Partial<User>, tenantId?: string): User | null {
    const list = this.getTenantList(tenantId);
    const idx = list.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch, updatedAt: new Date() };
    return list[idx];
  }

  public delete(id: string, tenantId?: string): boolean {
    const tid = tenantId || this.getActiveTenantId();
    const list = this.getTenantList(tid);
    const beforeLen = list.length;
    const filtered = list.filter((u) => u.id !== id);
    this.tenantUsers.set(tid, filtered);
    return filtered.length < beforeLen;
  }
}

export const usersSandboxRepo = new UsersSandboxRepository();

export const usersSandboxHandler: SandboxRouteHandler = {
  id: 'users-sandbox-handler',
  name: 'Users Sandbox Repository',
  description: 'In-memory multi-tenant CRUD repository for users',
  priority: 85,
  matcher: (ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api|v1)/, '');
    return cleanPath.startsWith('/users');
  },
  handler: async (req: SandboxRequest, ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api|v1)/, '');
    const subPath = cleanPath.replace(/^\/users/, '');
    const tenantId = (req.headers?.['x-tenant-id'] as string) || defaultSandboxStore.getState().activeTenantId || 'tenant-acme';

    if (subPath === '' || subPath === '/') {
      if (req.method === 'GET') {
        return { status: 200, data: usersSandboxRepo.getAll(tenantId) };
      }
      if (req.method === 'POST') {
        const created = usersSandboxRepo.create(req.data, tenantId);
        return { status: 201, data: created };
      }
    }

    const idMatch = subPath.match(/^\/([^/]+)$/);
    if (idMatch) {
      const id = idMatch[1];
      if (req.method === 'GET') {
        const user = usersSandboxRepo.getById(id, tenantId);
        if (!user) return { status: 404, data: { message: 'User not found' } };
        return { status: 200, data: user };
      }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const updated = usersSandboxRepo.update(id, req.data, tenantId);
        if (!updated) return { status: 404, data: { message: 'User not found' } };
        return { status: 200, data: updated };
      }
      if (req.method === 'DELETE') {
        const deleted = usersSandboxRepo.delete(id, tenantId);
        return { status: 200, data: { success: deleted } };
      }
    }

    return { status: 404, data: { message: 'Not found' } };
  },
};
