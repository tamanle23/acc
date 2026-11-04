import { useMemo } from 'react';
import type { CanonicalPermission } from '@acc/client';
import { useSpringAuthStore } from '@/features/spring-auth';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';
import { DEFAULT_SANDBOX_PERSONAS } from '@/core/sandbox/store/sandbox-store';

/**
 * Custom hook to verify whether the active user possesses a given permission atom or set of atoms.
 * Single authoritative source of truth for UI client authorization checks.
 */
export function useHasPermission(
  permissionCode: CanonicalPermission | CanonicalPermission[] | string | string[],
  mode: 'all' | 'any' = 'all'
): boolean {
  const authUser = useSpringAuthStore((s) => s.user);
  const isSandboxEnabled = useSandboxStore((s) => s.enabled);
  const activePersonaId = useSandboxStore((s) => s.activePersonaId);

  return useMemo(() => {
    const codes = Array.isArray(permissionCode) ? permissionCode : [permissionCode];
    if (codes.length === 0) return true;

    // 1. Sovereign Root Custodian holds absolute sovereign authority across everything
    if (
      authUser?.isSovereign ||
      authUser?.roles?.includes('ROLE_SYSTEM_ROOT' as any) ||
      authUser?.roles?.includes('ROLE_SYSTEM_CUSTODIAN' as any) ||
      authUser?.tenantId === 'SYSTEM' ||
      (import.meta.env.DEV && isSandboxEnabled && activePersonaId === 'system')
    ) {
      return true;
    }

    // 2. Resolve active permissions set from profile or sandbox persona
    const userPermissions = new Set<string>();

    if (authUser?.permissions) {
      authUser.permissions.forEach((p) => userPermissions.add(p));
    }

    if (import.meta.env.DEV && isSandboxEnabled && activePersonaId) {
      const persona = DEFAULT_SANDBOX_PERSONAS[activePersonaId];
      if (persona?.permissions) {
        persona.permissions.forEach((p) => userPermissions.add(p));
      }
    }

    const check = (code: string) => userPermissions.has(code);

    return mode === 'any' ? codes.some(check) : codes.every(check);
  }, [authUser, isSandboxEnabled, activePersonaId, permissionCode, mode]);
}

/**
 * Hook to retrieve all active permission atoms for the current user/persona.
 */
export function useActivePermissions(): Set<string> {
  const authUser = useSpringAuthStore((s) => s.user);
  const isSandboxEnabled = useSandboxStore((s) => s.enabled);
  const activePersonaId = useSandboxStore((s) => s.activePersonaId);

  return useMemo(() => {
    const permSet = new Set<string>();

    if (
      authUser?.isSovereign ||
      authUser?.roles?.includes('ROLE_SYSTEM_ROOT' as any) ||
      authUser?.roles?.includes('ROLE_SYSTEM_CUSTODIAN' as any) ||
      authUser?.tenantId === 'SYSTEM' ||
      (import.meta.env.DEV && isSandboxEnabled && activePersonaId === 'system')
    ) {
      const systemPersona = DEFAULT_SANDBOX_PERSONAS.system;
      systemPersona.permissions?.forEach((p) => permSet.add(p));
      return permSet;
    }

    if (authUser?.permissions) {
      authUser.permissions.forEach((p) => permSet.add(p));
    }

    if (import.meta.env.DEV && isSandboxEnabled && activePersonaId) {
      const persona = DEFAULT_SANDBOX_PERSONAS[activePersonaId];
      if (persona?.permissions) {
        persona.permissions.forEach((p) => permSet.add(p));
      }
    }

    return permSet;
  }, [authUser, isSandboxEnabled, activePersonaId]);
}
