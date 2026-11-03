import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useHasPermission, useActivePermissions } from '../use-has-permission';
import { useSpringAuthStore } from '@/features/spring-auth';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';

describe('useHasPermission Hook', () => {
  beforeEach(() => {
    useSpringAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isSandbox: false,
    });
    useSandboxStore.setState({
      enabled: true,
      activePersonaId: 'system',
    });
  });

  it('allows all permissions for sovereign root persona (system)', () => {
    const { result } = renderHook(() => useHasPermission('platform:fleet:mutate'));
    expect(result.current).toBe(true);

    const { result: createPerm } = renderHook(() => useHasPermission('entity:record:create'));
    expect(createPerm.current).toBe(true);
  });

  it('correctly gates permissions for workspace owner (admin)', () => {
    useSandboxStore.setState({
      enabled: true,
      activePersonaId: 'admin',
    });

    const { result: canCreate } = renderHook(() => useHasPermission('entity:record:create'));
    expect(canCreate.current).toBe(true);

    const { result: canMutateFleet } = renderHook(() => useHasPermission('platform:fleet:mutate'));
    expect(canMutateFleet.current).toBe(false);
  });

  it('denies delete permission for standard member (user)', () => {
    useSandboxStore.setState({
      enabled: true,
      activePersonaId: 'user',
    });

    const { result: canCreate } = renderHook(() => useHasPermission('entity:record:create'));
    expect(canCreate.current).toBe(true);

    const { result: canDelete } = renderHook(() => useHasPermission('entity:record:delete'));
    expect(canDelete.current).toBe(false);
  });

  it('evaluates active permissions set correctly', () => {
    useSandboxStore.setState({
      enabled: true,
      activePersonaId: 'user',
    });

    const { result } = renderHook(() => useActivePermissions());
    expect(result.current.has('entity:record:read')).toBe(true);
    expect(result.current.has('entity:record:create')).toBe(true);
    expect(result.current.has('entity:record:delete')).toBe(false);
  });

  it('evaluates permissions from production hydrated AuthenticationProfile when sandbox is disabled', () => {
    useSandboxStore.setState({
      enabled: false,
    });

    useSpringAuthStore.setState({
      user: {
        userId: 'usr-42',
        username: 'alice',
        tenantId: 'tenant-acme',
        isSovereign: false,
        roles: ['ROLE_OPERATIONS_MANAGER'],
        permissions: ['entity:record:read', 'entity:record:create', 'entity:record:export'],
        activeFeatures: [],
      },
      isAuthenticated: true,
    });

    const { result: canRead } = renderHook(() => useHasPermission('entity:record:read'));
    expect(canRead.current).toBe(true);

    const { result: canExport } = renderHook(() => useHasPermission('entity:record:export'));
    expect(canExport.current).toBe(true);

    const { result: canMutateFleet } = renderHook(() => useHasPermission('platform:fleet:mutate'));
    expect(canMutateFleet.current).toBe(false);
  });
});
