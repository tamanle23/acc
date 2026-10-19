import type { SandboxRouteHandler, SandboxRequest } from '../types';
import { useSandboxStore } from '../store/sandbox-store';

export interface SandboxWorkspaceRecord {
  id: number;
  uid: string;
  tenantId: string;
  code: string;
  name: string;
  description: string;
  planTier: string;
  isDefault: boolean;
  isImmutable: boolean;
  createdDate: string;
  lastUpdatedDate: string;
}

const DEFAULT_WORKSPACES: SandboxWorkspaceRecord[] = [
  {
    id: 1,
    uid: 'ws-sovereign-root',
    tenantId: 'SYSTEM',
    code: 'ROOT',
    name: '👑 Sovereign Platform',
    description: 'Platform Custodian Root Workspace',
    planTier: 'ENTERPRISE',
    isDefault: true,
    isImmutable: true,
    createdDate: new Date().toISOString(),
    lastUpdatedDate: new Date().toISOString(),
  },
  {
    id: 2,
    uid: 'ws-acme-prod',
    tenantId: 'tenant-acme',
    code: 'PROD',
    name: 'Acme Production',
    description: 'Production E-Commerce & Retail Cluster',
    planTier: 'PRO_MAX',
    isDefault: true,
    isImmutable: true,
    createdDate: new Date().toISOString(),
    lastUpdatedDate: new Date().toISOString(),
  },
  {
    id: 3,
    uid: 'ws-acme-staging',
    tenantId: 'tenant-acme',
    code: 'STG',
    name: 'Acme Staging',
    description: 'QA & Integration Sandbox',
    planTier: 'STANDARD',
    isDefault: false,
    isImmutable: false,
    createdDate: new Date().toISOString(),
    lastUpdatedDate: new Date().toISOString(),
  },
  {
    id: 4,
    uid: 'ws-fleet-hcm',
    tenantId: 'tenant-fleet-alpha',
    code: 'HCM',
    name: 'HCM Logistics Hub',
    description: 'Southern Region Dispatch Operations',
    planTier: 'PRO',
    isDefault: true,
    isImmutable: true,
    createdDate: new Date().toISOString(),
    lastUpdatedDate: new Date().toISOString(),
  },
];

class SandboxWorkspaceRepository {
  private workspaces: SandboxWorkspaceRecord[] = JSON.parse(JSON.stringify(DEFAULT_WORKSPACES));

  public reset() {
    this.workspaces = JSON.parse(JSON.stringify(DEFAULT_WORKSPACES));
  }

  public listByTenant(tenantId: string): SandboxWorkspaceRecord[] {
    return this.workspaces.filter((w) => w.tenantId === tenantId);
  }

  public getByUid(uid: string): SandboxWorkspaceRecord | undefined {
    return this.workspaces.find((w) => w.uid === uid);
  }

  public create(
    tenantId: string,
    payload: { code: string; name: string; description?: string; planTier?: string }
  ): SandboxWorkspaceRecord {
    const code = payload.code.trim().toUpperCase();
    if (this.workspaces.some((w) => w.tenantId === tenantId && w.code === code)) {
      throw new Error(`Workspace code '${code}' already exists in active tenant`);
    }

    const newWs: SandboxWorkspaceRecord = {
      id: Date.now(),
      uid: `ws-${payload.code.toLowerCase()}-${Date.now().toString().slice(-4)}`,
      tenantId,
      code,
      name: payload.name.trim(),
      description: payload.description || '',
      planTier: payload.planTier || 'STANDARD',
      isDefault: false,
      isImmutable: false,
      createdDate: new Date().toISOString(),
      lastUpdatedDate: new Date().toISOString(),
    };

    this.workspaces.push(newWs);
    return newWs;
  }

  public setDefault(tenantId: string, uid: string): SandboxWorkspaceRecord {
    const ws = this.workspaces.find((w) => w.uid === uid && w.tenantId === tenantId);
    if (!ws) throw new Error('Workspace not found');

    this.workspaces.forEach((w) => {
      if (w.tenantId === tenantId && !w.isImmutable) {
        w.isDefault = false;
      }
    });

    ws.isDefault = true;
    ws.lastUpdatedDate = new Date().toISOString();
    return ws;
  }

  public delete(tenantId: string, uid: string): void {
    const ws = this.workspaces.find((w) => w.uid === uid && w.tenantId === tenantId);
    if (!ws) throw new Error('Workspace not found');
    if (ws.isDefault) throw new Error('Cannot delete default workspace of tenant');
    if (ws.isImmutable) throw new Error('Cannot delete immutable workspace of tenant');

    const tenantList = this.workspaces.filter((w) => w.tenantId === tenantId);
    if (tenantList.length <= 1) throw new Error('Cannot delete the only remaining workspace of tenant');

    this.workspaces = this.workspaces.filter((w) => w.uid !== uid);
  }
}

export const sandboxWorkspaceRepository = new SandboxWorkspaceRepository();

export const workspaceSandboxHandler: SandboxRouteHandler = {
  id: 'workspace-sandbox-handler',
  name: 'Unified Workspace Engine',
  matcher: (ctx) => {
    return ctx.pathname.startsWith('/api/v1/workspaces');
  },
  handler: async (req: SandboxRequest) => {
    const activeTenantId = useSandboxStore.getState().activeTenantId || 'tenant-acme';
    const method = req.method.toUpperCase();
    const url = req.url.split('?')[0];

    // 1. GET /api/v1/workspaces
    if (method === 'GET' && url === '/api/v1/workspaces') {
      const list = sandboxWorkspaceRepository.listByTenant(activeTenantId);
      return {
        status: 200,
        data: {
          data: list,
          code: 'SUCCESS',
          message: 'Retrieved workspaces for active tenant',
        },
      };
    }

    // 2. POST /api/v1/workspaces
    if (method === 'POST' && url === '/api/v1/workspaces') {
      try {
        const payload = (req.data || {}) as any;
        const created = sandboxWorkspaceRepository.create(activeTenantId, payload);
        return {
          status: 201,
          data: {
            data: created,
            code: 'SUCCESS',
            message: 'Workspace created successfully',
          },
        };
      } catch (err: any) {
        return {
          status: 409,
          data: {
            code: 'METADATA_CONFLICT',
            message: err.message,
          },
        };
      }
    }

    // 3. PUT /api/v1/workspaces/:uid/default
    const defaultMatch = url.match(/^\/api\/v1\/workspaces\/([^/]+)\/default$/);
    if (method === 'PUT' && defaultMatch) {
      const uid = defaultMatch[1];
      try {
        const updated = sandboxWorkspaceRepository.setDefault(activeTenantId, uid);
        return {
          status: 200,
          data: {
            data: updated,
            code: 'SUCCESS',
            message: 'Workspace set as default',
          },
        };
      } catch (err: any) {
        return {
          status: 404,
          data: {
            code: 'METADATA_NOT_FOUND',
            message: err.message,
          },
        };
      }
    }

    // 4. DELETE /api/v1/workspaces/:uid
    const deleteMatch = url.match(/^\/api\/v1\/workspaces\/([^/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const uid = deleteMatch[1];
      try {
        sandboxWorkspaceRepository.delete(activeTenantId, uid);
        return {
          status: 200,
          data: {
            code: 'SUCCESS',
            message: 'Workspace deleted successfully',
          },
        };
      } catch (err: any) {
        return {
          status: 409,
          data: {
            code: 'METADATA_CONFLICT',
            message: err.message,
          },
        };
      }
    }

    return { status: 404, data: { error: 'Workspace endpoint not found' } };
  },
};
