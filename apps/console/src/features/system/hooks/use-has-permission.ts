import { useMemo } from 'react';
import { useSpringAuthStore } from '@/features/spring-auth';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';
import { DEFAULT_SANDBOX_PERSONAS } from '@/core/sandbox/store/sandbox-store';

/**
 * Standard system and tenant role-to-permission mappings for client authorization checks.
 */
export const ROLE_PERMISSIONS_FALLBACK: Record<string, string[]> = {
  ROLE_SYSTEM_ROOT: [
    'platform:fleet:read',
    'platform:fleet:mutate',
    'platform:fleet:trip_circuit',
    'platform:tenant:assume',
    'platform:tenant:purge',
    'platform:quotas:manage',
    'platform:roles:manage',
    'platform:users:manage',
    'platform:dlq:manage',
    'platform:workers:manage',
    'metadata:schema:read',
    'metadata:schema:write',
    'metadata:blueprint:package',
    'metadata:blueprint:provision',
    'metadata:cache:evict',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'entity:record:delete',
    'entity:record:export',
    'workspace:settings:read',
    'workspace:settings:manage',
    'workspace:members:read',
    'workspace:members:manage',
    'workflow:definition:read',
    'workflow:definition:manage',
    'workflow:execution:read',
    'workflow:execution:submit',
    'workflow:approval:execute',
    'audit:log:read',
    'audit:hash:verify',
    'audit:compliance:export',
    'billing:subscription:read',
    'billing:subscription:upgrade',
    'billing:tier:override',
    'billing:invoice:adjust',
  ],
  ROLE_SYSTEM_SUPPORT: [
    'platform:fleet:read',
    'platform:tenant:assume',
    'platform:dlq:manage',
    'metadata:schema:read',
    'entity:record:read',
    'workspace:settings:read',
    'workspace:members:read',
    'audit:log:read',
  ],
  ROLE_WORKSPACE_OWNER: [
    'workspace:settings:read',
    'workspace:settings:manage',
    'workspace:members:read',
    'workspace:members:manage',
    'metadata:schema:read',
    'metadata:schema:write',
    'metadata:blueprint:provision',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'entity:record:delete',
    'entity:record:export',
    'workflow:definition:read',
    'workflow:definition:manage',
    'workflow:execution:read',
    'workflow:execution:submit',
    'workflow:approval:execute',
    'audit:log:read',
    'billing:subscription:read',
    'billing:subscription:upgrade',
  ],
  ROLE_OPERATIONS_MANAGER: [
    'workspace:settings:read',
    'metadata:schema:read',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'entity:record:delete',
    'entity:record:export',
    'workflow:definition:read',
    'workflow:execution:read',
    'workflow:execution:submit',
    'workflow:approval:execute',
    'audit:log:read',
  ],
  ROLE_STANDARD_MEMBER: [
    'workspace:settings:read',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'workflow:execution:read',
    'workflow:execution:submit',
  ],
  ROLE_AUDITOR: [
    'workspace:settings:read',
    'workspace:members:read',
    'metadata:schema:read',
    'entity:record:read',
    'audit:log:read',
    'audit:hash:verify',
    'audit:compliance:export',
  ],
};

/**
 * Custom hook to verify whether the active user possesses a given permission atom.
 * Prioritizes backend-hydrated permission claims in useSpringAuthStore.
 */
export function useHasPermission(permissionCode: string): boolean {
  const authUser = useSpringAuthStore((s) => s.user);
  const isSandboxEnabled = useSandboxStore((s) => s.enabled);
  const activePersonaId = useSandboxStore((s) => s.activePersonaId);

  return useMemo(() => {
    // 1. In Dev Mode with Sandbox active, infer permissions from active persona
    if (import.meta.env.DEV && isSandboxEnabled && activePersonaId) {
      if (activePersonaId === 'system') return true; // Sovereign root custodian holds all permissions

      const persona = DEFAULT_SANDBOX_PERSONAS[activePersonaId];
      if (persona?.roles) {
        for (const r of persona.roles) {
          const perms = ROLE_PERMISSIONS_FALLBACK[r];
          if (perms && perms.includes(permissionCode)) return true;
        }
      }
    }

    // 2. Production auth session profile resolution
    if (authUser) {
      if (authUser.isSovereign || authUser.roles?.includes('ROLE_SYSTEM_ROOT')) {
        return true;
      }
      if (authUser.permissions && authUser.permissions.includes(permissionCode as any)) {
        return true;
      }
      if (authUser.roles) {
        for (const r of authUser.roles) {
          const perms = ROLE_PERMISSIONS_FALLBACK[r];
          if (perms && perms.includes(permissionCode)) return true;
        }
      }
    }

    return false;
  }, [authUser, isSandboxEnabled, activePersonaId, permissionCode]);
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

    if (import.meta.env.DEV && isSandboxEnabled && activePersonaId === 'system') {
      ROLE_PERMISSIONS_FALLBACK.ROLE_SYSTEM_ROOT.forEach((p) => permSet.add(p));
      return permSet;
    }

    if (import.meta.env.DEV && isSandboxEnabled && activePersonaId) {
      const persona = DEFAULT_SANDBOX_PERSONAS[activePersonaId];
      if (persona?.roles) {
        for (const r of persona.roles) {
          const perms = ROLE_PERMISSIONS_FALLBACK[r];
          if (perms) perms.forEach((p) => permSet.add(p));
        }
      }
    } else if (authUser) {
      if (authUser.permissions) {
        authUser.permissions.forEach((p) => permSet.add(p));
      }
      if (authUser.roles) {
        for (const r of authUser.roles) {
          const perms = ROLE_PERMISSIONS_FALLBACK[r];
          if (perms) perms.forEach((p) => permSet.add(p));
        }
      }
    }

    return permSet;
  }, [authUser, isSandboxEnabled, activePersonaId]);
}
