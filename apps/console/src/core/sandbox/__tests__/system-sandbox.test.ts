import { describe, it, expect, beforeEach } from 'vitest';
import { systemSandboxHandler, mockFleetStore } from '../handlers/system-sandbox-handler';
import { decodeJwt } from '@/features/spring-auth/utils/jwt';
import type { SandboxRouteMatcherContext } from '../types';

describe('SystemFleet Sandbox Handler', () => {
  beforeEach(() => {
    mockFleetStore.reset();
  });

  const createContext = (pathname: string, method = 'GET'): SandboxRouteMatcherContext => ({
    url: `http://localhost${pathname}`,
    method,
    headers: {},
    pathname,
    searchParams: new URL(pathname, 'http://localhost').searchParams,
  });

  it('matches /api/v1/system routes with priority 98', () => {
    expect(systemSandboxHandler.priority).toBe(98);
    expect(systemSandboxHandler.matcher(createContext('/api/v1/system/tenants'))).toBe(true);
    expect(systemSandboxHandler.matcher(createContext('/api/v1/system/roles'))).toBe(true);
    expect(systemSandboxHandler.matcher(createContext('/api/v1/metadata'))).toBe(false);
  });

  it('retrieves default fleet tenants including SYSTEM tenant', async () => {
    const res = await systemSandboxHandler.handler(
      { url: '/api/v1/system/tenants', method: 'GET' },
      createContext('/api/v1/system/tenants')
    );

    expect(res?.status).toBe(200);
    expect(res?.data.body.content.length).toBeGreaterThanOrEqual(3);
    const systemTenant = res?.data.body.content.find((t: any) => t.tenantId === 'SYSTEM');
    expect(systemTenant).toBeDefined();
    expect(systemTenant.tier).toBe('ENTERPRISE');
    expect(systemTenant.maxWorkspaces).toBe(-1);
    expect(systemTenant.maxSchemas).toBe(-1);
    expect(systemTenant.maxRecords).toBe(-1);
  });

  it('provisions a new tenant under sovereign custody', async () => {
    const res = await systemSandboxHandler.handler(
      {
        url: '/api/v1/system/tenants',
        method: 'POST',
        data: {
          tenantId: 'tenant-nebula',
          tenantName: 'Nebula AI',
          tier: 'PRO',
          blueprintId: 'ecommerce-standard',
        },
      },
      createContext('/api/v1/system/tenants', 'POST')
    );

    expect(res?.status).toBe(200);
    expect(res?.data.body.tenantId).toBe('tenant-nebula');
    expect(res?.data.body.tier).toBe('PRO');
    expect(res?.data.body.maxWorkspaces).toBe(5);
    expect(res?.data.body.maxSchemas).toBe(50);
  });

  it('toggles tenant status and blocks SYSTEM suspension', async () => {
    // 1. Suspend regular tenant
    const res = await systemSandboxHandler.handler(
      {
        url: '/api/v1/system/tenants/tenant-acme/status',
        method: 'PUT',
        data: { status: 'SUSPENDED', reason: 'Audit pending' },
      },
      createContext('/api/v1/system/tenants/tenant-acme/status', 'PUT')
    );

    expect(res?.status).toBe(200);
    expect(res?.data.body.status).toBe('SUSPENDED');

    // 2. Reject SYSTEM suspension
    expect(() => {
      mockFleetStore.updateTenantStatus('SYSTEM', 'SUSPENDED');
    }).toThrow('SYSTEM tenant cannot be suspended');
  });

  it('overrides subscription tier and custom sovereign quotas', async () => {
    // 1. Override subscription
    const subRes = await systemSandboxHandler.handler(
      {
        url: '/api/v1/system/tenants/tenant-acme/subscription',
        method: 'PUT',
        data: { planTier: 'ENTERPRISE', reason: 'VIP Strategic Upgrade' },
      },
      createContext('/api/v1/system/tenants/tenant-acme/subscription', 'PUT')
    );

    expect(subRes?.status).toBe(200);
    expect(subRes?.data.body.tier).toBe('ENTERPRISE');

    // 2. Inject custom quota grants
    const quotaRes = await systemSandboxHandler.handler(
      {
        url: '/api/v1/system/tenants/tenant-acme/quotas',
        method: 'PUT',
        data: { maxWorkspaces: 50, maxSchemas: 1000, maxRecords: 10000000 },
      },
      createContext('/api/v1/system/tenants/tenant-acme/quotas', 'PUT')
    );

    expect(quotaRes?.status).toBe(200);
    expect(quotaRes?.data.body.maxWorkspaces).toBe(50);
    expect(quotaRes?.data.body.maxSchemas).toBe(1000);
    expect(quotaRes?.data.body.maxRecords).toBe(10000000);
  });

  it('issues ephemeral assume-tenant token with dual-context claims', async () => {
    const res = await systemSandboxHandler.handler(
      {
        url: '/api/v1/system/tenants/tenant-us-east-1/assume',
        method: 'POST',
        data: { durationMinutes: 45, reason: 'Debugging customer latency issue' },
      },
      createContext('/api/v1/system/tenants/tenant-us-east-1/assume', 'POST')
    );

    expect(res?.status).toBe(200);
    expect(res?.data.body.actorTenantId).toBe('SYSTEM');
    expect(res?.data.body.effectiveTenantId).toBe('tenant-us-east-1');
    expect(res?.data.body.ephemeralToken).toBeTruthy();

    const decoded = decodeJwt(res?.data.body.ephemeralToken || '');
    expect(decoded?.tenantId).toBe('tenant-us-east-1');
    expect(decoded?.actor_tid).toBe('SYSTEM');
    expect(decoded?.roles).toContain('ROLE_SYSTEM_CUSTODIAN');
    expect(res?.data.body.authorities).toContain('ROLE_SYSTEM_CUSTODIAN');
  });

  it('manages RBAC matrix and universal users lockdown', async () => {
    // 1. List roles
    const rolesRes = await systemSandboxHandler.handler(
      { url: '/api/v1/system/roles', method: 'GET' },
      createContext('/api/v1/system/roles')
    );
    expect(rolesRes?.status).toBe(200);
    expect(rolesRes?.data.body.length).toBeGreaterThanOrEqual(4);

    // 2. Lock user
    const lockRes = await systemSandboxHandler.handler(
      {
        url: '/api/v1/system/users/usr-acme-admin/lock',
        method: 'PUT',
        data: { locked: true, reason: 'Suspicious credential activity' },
      },
      createContext('/api/v1/system/users/usr-acme-admin/lock', 'PUT')
    );

    expect(lockRes?.status).toBe(200);
    expect(lockRes?.data.body.locked).toBe(true);
  });
});
