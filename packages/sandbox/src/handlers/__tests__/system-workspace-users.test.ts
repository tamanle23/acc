import { describe, it, expect, beforeEach } from 'vitest';
import { systemSandboxHandler, mockFleetStore } from '../system-sandbox-handler';
import { workspaceSandboxHandler, sandboxWorkspaceRepository } from '../workspace-sandbox-handler';
import { usersSandboxHandler, usersSandboxRepo } from '../users-sandbox-handler';
import { defaultSandboxStore } from '../../store';

describe('System, Workspace, and Users Sandbox Handlers Suite', () => {
  beforeEach(() => {
    mockFleetStore.reset();
    sandboxWorkspaceRepository.reset();
    usersSandboxRepo.reset();
    defaultSandboxStore.resetToDefaults();
  });

  const createCtx = (path: string, method: string = 'GET') => ({
    pathname: path,
    method,
    headers: {},
    searchParams: new URLSearchParams(),
    url: path,
  });

  describe('System Fleet Tenants & Roles Handler', () => {
    it('matches /api/v1/system routes', () => {
      expect(systemSandboxHandler.matcher(createCtx('/api/v1/system/tenants'))).toBe(true);
      expect(systemSandboxHandler.matcher(createCtx('/api/v1/system/roles'))).toBe(true);
      expect(systemSandboxHandler.matcher(createCtx('/api/v1/billing'))).toBe(false);
    });

    it('lists fleet tenants with search and filtering', async () => {
      const req = { url: 'http://localhost/api/v1/system/tenants?tier=PRO', method: 'GET', headers: {} };
      const res = await systemSandboxHandler.handler(req, createCtx('/api/v1/system/tenants?tier=PRO'));
      expect(res?.status).toBe(200);
      expect(res?.data?.body?.content).toBeDefined();
    });

    it('creates, retrieves, and updates tenant metadata', async () => {
      const createReq = {
        url: 'http://localhost/api/v1/system/tenants',
        method: 'POST',
        headers: {},
        data: {
          tenantId: 'hyperscale',
          tenantName: 'HyperScale Corp',
          slug: 'hyperscale',
          tier: 'PRO_MAX',
          ownerEmail: 'ceo@hyperscale.io',
        },
      };

      const createRes = await systemSandboxHandler.handler(createReq, createCtx('/api/v1/system/tenants', 'POST'));
      expect(createRes?.status).toBe(200);
      const tenantId = createRes?.data?.body?.tenantId;
      expect(tenantId).toBe('hyperscale');

      // Retrieve by ID
      const getReq = { url: `http://localhost/api/v1/system/tenants/${tenantId}`, method: 'GET', headers: {} };
      const getRes = await systemSandboxHandler.handler(getReq, createCtx(`/api/v1/system/tenants/${tenantId}`, 'GET'));
      expect(getRes?.status).toBe(200);
      expect(getRes?.data?.body?.name).toBe('HyperScale Corp');

      // Update tenant status
      const putReq = {
        url: `http://localhost/api/v1/system/tenants/${tenantId}/status`,
        method: 'PUT',
        headers: {},
        data: { status: 'SUSPENDED' },
      };
      const putRes = await systemSandboxHandler.handler(putReq, createCtx(`/api/v1/system/tenants/${tenantId}/status`, 'PUT'));
      expect(putRes?.status).toBe(200);
      expect(putRes?.data?.body?.status).toBe('SUSPENDED');
    });

    it('generates sovereign assume-tenant impersonation JWT', async () => {
      const req = {
        url: 'http://localhost/api/v1/system/tenants/tenant-us-east-1/assume',
        method: 'POST',
        headers: {},
      };
      const res = await systemSandboxHandler.handler(req, createCtx('/api/v1/system/tenants/tenant-us-east-1/assume', 'POST'));
      expect(res?.status).toBe(200);
      expect(res?.data?.body?.ephemeralToken).toBeDefined();
    });

    it('lists RBAC roles and mutates role permissions', async () => {
      const getReq = { url: 'http://localhost/api/v1/system/roles', method: 'GET', headers: {} };
      const getRes = await systemSandboxHandler.handler(getReq, createCtx('/api/v1/system/roles', 'GET'));
      expect(getRes?.status).toBe(200);
      expect(getRes?.data?.body?.length).toBeGreaterThan(0);

      const putReq = {
        url: 'http://localhost/api/v1/system/roles/ROLE_ADMIN/permissions',
        method: 'PUT',
        headers: {},
        data: { permissions: ['READ_METADATA', 'WRITE_METADATA', 'CUSTOM_PERM'] },
      };
      const putRes = await systemSandboxHandler.handler(
        putReq,
        createCtx('/api/v1/system/roles/ROLE_ADMIN/permissions', 'PUT')
      );
      expect(putRes?.status).toBe(200);
      expect(putRes?.data?.body?.permissions).toContain('CUSTOM_PERM');
    });
  });

  describe('Workspace Sandbox Handler', () => {
    it('matches /api/v1/workspaces routes', () => {
      expect(workspaceSandboxHandler.matcher(createCtx('/api/v1/workspaces'))).toBe(true);
      expect(workspaceSandboxHandler.matcher(createCtx('/api/v1/workspaces/ws-acme-staging/default', 'PUT'))).toBe(true);
      expect(workspaceSandboxHandler.matcher(createCtx('/api/v1/chats'))).toBe(false);
    });

    it('lists workspaces and allows creating, setting default, and deleting', async () => {
      defaultSandboxStore.setActiveTenant('tenant-acme');
      // 1. List
      const listReq = { url: '/api/v1/workspaces', method: 'GET', headers: {} };
      const listRes = await workspaceSandboxHandler.handler(listReq, createCtx('/api/v1/workspaces', 'GET'));
      expect(listRes?.status).toBe(200);
      expect(Array.isArray(listRes?.data?.data)).toBe(true);

      // 2. Create
      const createReq = {
        url: '/api/v1/workspaces',
        method: 'POST',
        headers: {},
        data: {
          code: 'TEMP',
          name: 'Temporary Test Workspace',
          description: 'For automated tests',
          planTier: 'STANDARD',
        },
      };
      const createRes = await workspaceSandboxHandler.handler(createReq, createCtx('/api/v1/workspaces', 'POST'));
      expect(createRes?.status).toBe(201);
      const createdUid = createRes?.data?.data?.uid;
      expect(createdUid).toContain('ws-temp-');

      // 3. Set default
      const defaultReq = {
        url: `/api/v1/workspaces/${createdUid}/default`,
        method: 'PUT',
        headers: {},
      };
      const defaultRes = await workspaceSandboxHandler.handler(
        defaultReq,
        createCtx(`/api/v1/workspaces/${createdUid}/default`, 'PUT')
      );
      expect(defaultRes?.status).toBe(200);
      // 4. Delete workspace
      const deleteReq = {
        url: `/api/v1/workspaces/${createdUid}`,
        method: 'DELETE',
        headers: {},
      };
      // Before deleting, switch default so we can delete non-default
      sandboxWorkspaceRepository.setDefault('tenant-acme', 'ws-acme-prod');
      const deleteRes = await workspaceSandboxHandler.handler(
        deleteReq,
        createCtx(`/api/v1/workspaces/${createdUid}`, 'DELETE')
      );
      expect(deleteRes?.status).toBe(200);

      // Attempting to delete non-existent workspace returns 409
      const errDeleteRes = await workspaceSandboxHandler.handler(
        deleteReq,
        createCtx(`/api/v1/workspaces/${createdUid}`, 'DELETE')
      );
      expect(errDeleteRes?.status).toBe(409);
    });
  });

  describe('Users Sandbox Handler', () => {
    it('matches /api/v1/users routes', () => {
      expect(usersSandboxHandler.matcher(createCtx('/api/v1/users'))).toBe(true);
      expect(usersSandboxHandler.matcher(createCtx('/api/v1/users/user-1'))).toBe(true);
    });

    it('handles complete user CRUD lifecycle and returns 404 for missing users', async () => {
      // 1. Create user
      const postReq = {
        url: '/api/v1/users',
        method: 'POST',
        headers: {},
        data: {
          username: 'engineer_tester',
          email: 'engineer@acc.vn',
          fullName: 'Test Engineer',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      };
      const postRes = await usersSandboxHandler.handler(postReq, createCtx('/api/v1/users', 'POST'));
      expect(postRes?.status).toBe(201);
      const newId = postRes?.data?.id;
      expect(newId).toBeDefined();

      // 2. Get user
      const getReq = { url: `/api/v1/users/${newId}`, method: 'GET', headers: {} };
      const getRes = await usersSandboxHandler.handler(getReq, createCtx(`/api/v1/users/${newId}`, 'GET'));
      expect(getRes?.status).toBe(200);
      expect(getRes?.data?.username).toBe('engineer_tester');

      // 3. Update user
      const patchReq = {
        url: `/api/v1/users/${newId}`,
        method: 'PATCH',
        headers: {},
        data: { fullName: 'Lead Test Engineer' },
      };
      const patchRes = await usersSandboxHandler.handler(patchReq, createCtx(`/api/v1/users/${newId}`, 'PATCH'));
      expect(patchRes?.status).toBe(200);
      expect(patchRes?.data?.fullName).toBe('Lead Test Engineer');

      // 4. Delete user
      const delReq = { url: `/api/v1/users/${newId}`, method: 'DELETE', headers: {} };
      const delRes = await usersSandboxHandler.handler(delReq, createCtx(`/api/v1/users/${newId}`, 'DELETE'));
      expect(delRes?.status).toBe(200);
      expect(delRes?.data?.success).toBe(true);

      // 5. 404 checks
      const missingGet = await usersSandboxHandler.handler(
        { url: '/api/v1/users/usr-ghost', method: 'GET', headers: {} },
        createCtx('/api/v1/users/usr-ghost', 'GET')
      );
      expect(missingGet?.status).toBe(404);

      const missingPatch = await usersSandboxHandler.handler(
        { url: '/api/v1/users/usr-ghost', method: 'PATCH', headers: {}, data: {} },
        createCtx('/api/v1/users/usr-ghost', 'PATCH')
      );
      expect(missingPatch?.status).toBe(404);
    });
  });

  describe('System Tenant Sub-Resources & Quotas', () => {
    it('manages tenant quotas, subscriptions, users, and workspaces', async () => {
      // 1. Quotas
      const quotaReq = {
        url: 'http://localhost/api/v1/system/tenants/tenant-acme/quotas',
        method: 'PUT',
        headers: {},
        data: { maxWorkspaces: 20, maxSchemas: 100 },
      };
      const quotaRes = await systemSandboxHandler.handler(
        quotaReq,
        createCtx('/api/v1/system/tenants/tenant-acme/quotas', 'PUT')
      );
      expect(quotaRes?.status).toBe(200);
      expect(quotaRes?.data?.body?.maxWorkspaces).toBe(20);

      // 2. Subscription override
      const subReq = {
        url: 'http://localhost/api/v1/system/tenants/tenant-acme/subscription',
        method: 'PUT',
        headers: {},
        data: { planTier: 'PRO_MAX', features: ['FEATURE_NEW_FLAG'] },
      };
      const subRes = await systemSandboxHandler.handler(
        subReq,
        createCtx('/api/v1/system/tenants/tenant-acme/subscription', 'PUT')
      );
      expect(subRes?.status).toBe(200);
      expect(subRes?.data?.body?.tier).toBe('PRO_MAX');

      // 3. System users with tenant filter
      const usersReq = {
        url: 'http://localhost/api/v1/system/users?tenantId=tenant-acme',
        method: 'GET',
        headers: {},
      };
      const usersCtx = {
        ...createCtx('/api/v1/system/users', 'GET'),
        searchParams: new URLSearchParams('tenantId=tenant-acme'),
      };
      const usersRes = await systemSandboxHandler.handler(usersReq, usersCtx);
      expect(usersRes?.status).toBe(200);
      expect(usersRes?.data?.header?.success).toBe(true);
      expect(usersRes?.data?.body?.content).toBeDefined();

      // 4. Lock/unlock system user
      const lockReq = {
        url: 'http://localhost/api/v1/system/users/usr-acme-admin/lock',
        method: 'PUT',
        headers: {},
        data: { locked: true },
      };
      const lockRes = await systemSandboxHandler.handler(
        lockReq,
        createCtx('/api/v1/system/users/usr-acme-admin/lock', 'PUT')
      );
      expect(lockRes?.status).toBe(200);
      expect(lockRes?.data?.body?.locked).toBe(true);
    });
  });
});
