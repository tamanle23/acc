import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from '../use-permissions';
import { useSpringAuthStore } from '../../store';

describe('usePermissions Hook - Sovereign & Tenant Roles', () => {
  it('correctly derives sovereign roles and permissions', () => {
    useSpringAuthStore.setState({
      currentTenantId: 'SYSTEM',
      user: {
        sub: 'custodian_root',
        roles: ['ROLE_SYSTEM_ROOT'],
        tenantId: 'SYSTEM',
      } as any,
    });

    const { result } = renderHook(() => usePermissions());
    expect(result.current.isSovereignRoot).toBe(true);
    expect(result.current.isSovereignCustodian).toBe(true);
    expect(result.current.isSovereignActor).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.canVerifyTasks).toBe(true);
    expect(result.current.canApproveQuorum).toBe(true);
    expect(result.current.canManageSchema).toBe(true);
  });

  it('correctly derives sovereign support role', () => {
    useSpringAuthStore.setState({
      currentTenantId: 'SYSTEM',
      user: {
        sub: 'support_ops',
        roles: ['ROLE_SYSTEM_SUPPORT'],
        tenantId: 'SYSTEM',
      } as any,
    });

    const { result } = renderHook(() => usePermissions());
    expect(result.current.isSovereignSupport).toBe(true);
    expect(result.current.isSovereignCustodian).toBe(true);
    expect(result.current.isSovereignRoot).toBe(false);
  });

  it('correctly derives inside-tenant roles (WorkspaceOwner)', () => {
    useSpringAuthStore.setState({
      currentTenantId: 'tenant-acme',
      user: {
        sub: 'alice',
        roles: ['ROLE_WORKSPACE_OWNER'],
        tenantId: 'tenant-acme',
      } as any,
    });

    const { result } = renderHook(() => usePermissions());
    expect(result.current.isWorkspaceOwner).toBe(true);
    expect(result.current.isSovereignRoot).toBe(false);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isOperator).toBe(true);
    expect(result.current.canManageSchema).toBe(true);
  });

  it('correctly derives inside-tenant roles (StandardMember)', () => {
    useSpringAuthStore.setState({
      currentTenantId: 'tenant-logistics',
      user: {
        sub: 'bob',
        roles: ['ROLE_STANDARD_MEMBER'],
        tenantId: 'tenant-logistics',
      } as any,
    });

    const { result } = renderHook(() => usePermissions());
    expect(result.current.isStandardMember).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.canMutateRecords).toBe(true);
    expect(result.current.canManageSchema).toBe(false);
  });
});
