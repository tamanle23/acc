import { describe, test, expect, beforeEach } from 'bun:test';
import {
  extractTenantFromAuth,
  usersSandboxRepo,
  usersSandboxHandler,
  billingSandboxRepo,
  billingSandboxHandler,
  workspaceSandboxHandler,
  sandboxWorkspaceRepository,
  createMockJwt,
  sandboxResetRegistry,
  defaultSandboxStore,
} from '../packages/sandbox/src';

/**
 * Formal Verification Suite: Unified Sandbox Domain Handler Consolidation & Zero-Trust Token Derivation
 * Target: packages/sandbox/src/handlers/, packages/sandbox/src/tenant-auth.ts
 * Standards: UNIFIED-SANDBOX-PLATFORM-MANDATE, Zero-Client-Trust, Zero-Stub Prohibition
 */
describe('Phase 1: Unified Sandbox Domain Handler Consolidation', () => {
  const validTenant = 'tenant-corp-42';
  const validToken = createMockJwt({
    sub: 'user-77',
    tenantId: validTenant,
    roles: ['ROLE_USER', 'ROLE_ADMIN'],
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  beforeEach(() => {
    sandboxResetRegistry.resetAll();
    defaultSandboxStore.getState().setActiveTenant('tenant-acme');
  });

  test('extractTenantFromAuth derives tenantId strictly from JWT Bearer token claims', () => {
    const req: any = {
      headers: {
        authorization: `Bearer ${validToken}`,
        'x-tenant-id': 'spoofed-tenant-attacker',
      },
    };

    const res = extractTenantFromAuth(req);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.tenantId).toBe(validTenant);
      expect(res.userId).toBe('user-77');
      expect(res.roles).toContain('ROLE_ADMIN');
    }
  });

  test('extractTenantFromAuth strictly returns 401 Unauthorized when Bearer token is missing or invalid', () => {
    const missingAuthReq: any = {
      headers: {
        'x-tenant-id': 'spoofed-tenant',
      },
    };
    const missingRes = extractTenantFromAuth(missingAuthReq);
    expect(missingRes.success).toBe(false);
    if (!missingRes.success) {
      expect(missingRes.response.status).toBe(401);
      expect(missingRes.response.data.error).toBe('Unauthorized');
    }

    const invalidAuthReq: any = {
      headers: {
        authorization: 'Bearer not-a-valid-jwt',
      },
    };
    const invalidRes = extractTenantFromAuth(invalidAuthReq);
    expect(invalidRes.success).toBe(false);
    if (!invalidRes.success) {
      expect(invalidRes.response.status).toBe(401);
    }
  });

  test('Users sandbox handler requires Bearer token and isolates users by derived tenant', async () => {
    // 1. Missing auth returns 401
    const unauthReq: any = {
      method: 'GET',
      headers: { 'x-tenant-id': 'tenant-acme' },
    };
    const unauthRes = await usersSandboxHandler.handler(unauthReq, {
      pathname: '/api/v1/users',
      url: '/api/v1/users',
      params: {},
      query: {},
      headers: {},
      method: 'GET',
    });
    expect(unauthRes?.status).toBe(401);

    // 2. Authenticated user request succeeds and scopes to token's tenant
    const authReq: any = {
      method: 'GET',
      headers: { authorization: `Bearer ${validToken}` },
    };
    const authRes = await usersSandboxHandler.handler(authReq, {
      pathname: '/api/v1/users',
      url: '/api/v1/users',
      params: {},
      query: {},
      headers: {},
      method: 'GET',
    });
    expect(authRes?.status).toBe(200);
    expect(Array.isArray(authRes?.data)).toBe(true);
  });

  test('Billing sandbox handler requires Bearer token for /summary and scopes to derived tenant', async () => {
    // 1. Missing auth returns 401
    const unauthReq: any = {
      method: 'GET',
      headers: {},
    };
    const unauthRes = await billingSandboxHandler.handler(unauthReq, {
      pathname: '/api/v1/billing/summary',
      url: '/api/v1/billing/summary',
      params: {},
      query: {},
      headers: {},
      method: 'GET',
    });
    expect(unauthRes?.status).toBe(401);

    // 2. Authenticated request succeeds
    const authReq: any = {
      method: 'GET',
      headers: { authorization: `Bearer ${validToken}` },
    };
    const authRes = await billingSandboxHandler.handler(authReq, {
      pathname: '/api/v1/billing/summary',
      url: '/api/v1/billing/summary',
      params: {},
      query: {},
      headers: {},
      method: 'GET',
    });
    expect(authRes?.status).toBe(200);
    expect(authRes?.data.tenantId).toBe(validTenant);
  });

  test('Workspace sandbox handler requires Bearer token and scopes CRUD strictly to token tenant', async () => {
    // 1. Missing auth returns 401
    const unauthReq: any = {
      method: 'GET',
      url: '/api/v1/workspaces',
      headers: {},
    };
    const unauthRes = await workspaceSandboxHandler.handler(unauthReq);
    expect(unauthRes?.status).toBe(401);

    // 2. Authenticated request creates and lists workspace for token tenant
    const createReq: any = {
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${validToken}` },
      data: {
        code: 'ENG',
        name: 'Engineering Hub',
        description: 'Engineering cluster',
      },
    };
    const createRes = await workspaceSandboxHandler.handler(createReq);
    expect(createRes?.status).toBe(201);
    expect(createRes?.data.data.tenantId).toBe(validTenant);

    const listReq: any = {
      method: 'GET',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${validToken}` },
    };
    const listRes = await workspaceSandboxHandler.handler(listReq);
    expect(listRes?.status).toBe(200);
    const workspaces = listRes?.data.data;
    expect(workspaces.some((w: any) => w.code === 'ENG' && w.tenantId === validTenant)).toBe(true);
  });

  test('sandboxResetRegistry resets stateful repositories across all consolidated handlers', () => {
    // Populate repository with tenant data
    billingSandboxRepo.set(validTenant, {
      tenantId: validTenant,
      planTier: 'PRO_MAX',
      billingCadence: 'YEARLY',
      status: 'ACTIVE',
      amountPaid: 3990000,
      expiresAt: null,
      entitledFeatures: [],
      quotas: {
        workspacesUsed: 5,
        maxWorkspaces: 15,
        schemasUsed: 2,
        maxSchemas: -1,
        recordsUsed: 100,
        maxRecords: -1,
      },
      vatInvoice: {
        companyName: 'Test Corp',
        taxCode: '010101',
        address: 'Hanoi',
        email: 'test@corp.vn',
        isAutoInvoice: true,
      },
      history: [],
    });

    expect(billingSandboxRepo.get(validTenant)?.planTier).toBe('PRO_MAX');

    // Perform global reset
    sandboxResetRegistry.resetAll();

    expect(billingSandboxRepo.get(validTenant)).toBeUndefined();
  });
});
