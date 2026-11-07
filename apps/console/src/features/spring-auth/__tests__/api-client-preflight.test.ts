import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { springApiClient } from '../api-client';
import { useSpringAuthStore } from '../store';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';

describe('springApiClient Preflight Authorization Gate', () => {
  beforeEach(() => {
    localStorage.clear();
    useSandboxStore.setState({ enabled: false, activePersonaId: null });
    useSpringAuthStore.setState({
      accessToken: 'valid-token',
      refreshToken: 'valid-refresh',
      user: {
        id: 'usr-regular',
        username: 'regular_user',
        email: 'user@example.com',
        roles: ['ROLE_STANDARD_MEMBER'],
        permissions: ['metadata:schema:read', 'workflow:execution:submit'],
        isSovereign: false,
        tenantId: 'tenant-acme',
      },
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('blocks DLQ replay mutation when missing platform:dlq:manage', async () => {
    await expect(springApiClient.post('/system/dlq/task-123/replay', {})).rejects.toThrow(
      /Pre-Flight Gate: Operation halted locally/
    );
  });

  it('blocks fleet tenant status mutation when missing platform:fleet:mutate', async () => {
    await expect(
      springApiClient.put('/v1/system/tenants/tenant-beta/status', { status: 'SUSPENDED' })
    ).rejects.toThrow(/Pre-Flight Gate: Operation halted locally/);
  });

  it('blocks role creation mutation when missing platform:roles:manage', async () => {
    await expect(
      springApiClient.post('/v1/system/roles', { roleId: 'ROLE_TEST', roleName: 'Test' })
    ).rejects.toThrow(/Pre-Flight Gate: Operation halted locally/);
  });

  it('blocks compliance audit export when missing audit:compliance:export', async () => {
    await expect(
      springApiClient.get('/v1/system/audit/export?tenantId=tenant-beta')
    ).rejects.toThrow(/Pre-Flight Gate: Operation halted locally/);
  });

  it('allows mutation when user has required permission', async () => {
    useSpringAuthStore.setState({
      user: {
        id: 'usr-admin',
        username: 'admin_user',
        email: 'admin@example.com',
        roles: ['ROLE_OPERATIONS_MANAGER'],
        permissions: ['platform:dlq:manage'],
        isSovereign: false,
        tenantId: 'tenant-acme',
      },
    });

    let intercepted = false;
    const originalAdapter = springApiClient.defaults.adapter;
    springApiClient.defaults.adapter = async (config) => {
      intercepted = true;
      return {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    try {
      const res = await springApiClient.post('/system/dlq/task-123/replay', {});
      expect(res.data.success).toBe(true);
      expect(intercepted).toBe(true);
    } finally {
      springApiClient.defaults.adapter = originalAdapter;
    }
  });

  it('bypasses preflight gate for sovereign root custodian', async () => {
    useSpringAuthStore.setState({
      user: {
        id: 'usr-root',
        username: 'root_custodian',
        email: 'root@acc.io',
        roles: ['ROLE_SYSTEM_ROOT'],
        permissions: [],
        isSovereign: true,
        tenantId: 'SYSTEM',
      },
    });

    let intercepted = false;
    const originalAdapter = springApiClient.defaults.adapter;
    springApiClient.defaults.adapter = async (config) => {
      intercepted = true;
      return {
        data: { replayed: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    try {
      const res = await springApiClient.post('/system/dlq/task-123/replay', {});
      expect(res.data.replayed).toBe(true);
      expect(intercepted).toBe(true);
    } finally {
      springApiClient.defaults.adapter = originalAdapter;
    }
  });
});
