import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useHasPermission, useActivePermissions } from '../use-has-permission';
import { useAuthStore } from '@/stores/auth-store';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';

describe('useHasPermission Hook', () => {
  beforeEach(() => {
    useAuthStore.setState({
      auth: {
        user: null,
        setUser: () => {},
        accessToken: '',
        setAccessToken: () => {},
        resetAccessToken: () => {},
        reset: () => {},
      },
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
});
