import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';
import { DEFAULT_SANDBOX_PERSONAS } from '@/core/sandbox/store/sandbox-store';

/**
 * Standard system and tenant role-to-permission mappings for client authorization checks.
 */
const ROLE_PERMISSIONS_FALLBACK: Record<string, string[]> = {
  ROLE_SYSTEM_ROOT: [
    'platform:fleet:read',
    'platform:fleet:mutate',
    'platform:fleet:circuit_trip',
    'platform:tenant:assume',
    'platform:tenant:suspend',
    'platform:tenant:purge:request',
    'platform:tenant:purge:approve',
    'platform:quotas:override',
    'platform:roles:manage',
    'platform:users:lock',
    'platform:workflow:submit',
    'platform:workflow:verify',
    'platform:workflow:approve',
    'platform:workflow:reject',
    'metadata:schema:read',
    'metadata:schema:write',
    'metadata:blueprint:package',
    'metadata:blueprint:provision',
    'metadata:cache:evict',
    'platform:security:inspect',
    'platform:audit:verify',
    'platform:compliance:export',
    'platform:dlq:manage',
    'billing:tier:override',
    'billing:manual:invoice',
    'billing:reconcile',
    'tenant:feature:grant',
    'platform:kyc:verify',
    'platform:kyc:approve',
    'org:workspace:read',
    'org:workspace:mutate',
    'org:member:invite',
    'org:member:manage',
    'org:billing:read',
    'org:billing:upgrade',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'entity:record:delete',
    'org:workflow:submit',
    'org:workflow:approve',
    'org:audit:read',
  ],
  ROLE_SYSTEM_SUPPORT: [
    'platform:fleet:read',
    'platform:tenant:assume',
    'platform:security:inspect',
    'platform:audit:verify',
    'platform:compliance:export',
    'metadata:schema:read',
    'org:audit:read',
    'entity:record:read',
  ],
  ROLE_WORKSPACE_OWNER: [
    'org:workspace:read',
    'org:workspace:mutate',
    'org:member:invite',
    'org:member:manage',
    'org:billing:read',
    'org:billing:upgrade',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'entity:record:delete',
    'org:workflow:submit',
    'org:workflow:approve',
    'org:audit:read',
    'metadata:schema:read',
  ],
  ROLE_OPERATIONS_MANAGER: [
    'org:workspace:read',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'entity:record:delete',
    'org:workflow:submit',
    'org:audit:read',
    'metadata:schema:read',
  ],
  ROLE_STANDARD_MEMBER: [
    'org:workspace:read',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'org:workflow:submit',
  ],
  ROLE_AUDITOR: [
    'org:workspace:read',
    'entity:record:read',
    'org:audit:read',
    'metadata:schema:read',
  ],
};

/**
 * Custom hook to verify whether the active user possesses a given permission atom.
 * Aggregates assigned roles and resolves against the sandbox persona in dev mode.
 */
export function useHasPermission(permissionCode: string): boolean {
  const authUser = useAuthStore((s) => s.auth.user);
  const isSandboxEnabled = useSandboxStore((s) => s.enabled);
  const activePersonaId = useSandboxStore((s) => s.activePersonaId);

  return useMemo(() => {
    // 1. In Dev Mode with Sandbox, infer permissions from active persona
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

    // 2. Production auth store resolution
    if (authUser?.role) {
      if (authUser.role.includes('ROLE_SYSTEM_ROOT') || authUser.role.includes('ROLE_SOVEREIGN_ADMIN')) {
        return true;
      }
      for (const r of authUser.role) {
        const perms = ROLE_PERMISSIONS_FALLBACK[r];
        if (perms && perms.includes(permissionCode)) return true;
      }
    }

    return false;
  }, [authUser, isSandboxEnabled, activePersonaId, permissionCode]);
}

/**
 * Hook to retrieve all active permission atoms for the current user/persona.
 */
export function useActivePermissions(): Set<string> {
  const authUser = useAuthStore((s) => s.auth.user);
  const isSandboxEnabled = useSandboxStore((s) => s.enabled);
  const activePersonaId = useSandboxStore((s) => s.activePersonaId);

  return useMemo(() => {
    const permSet = new Set<string>();

    if (import.meta.env.DEV && isSandboxEnabled && activePersonaId === 'system') {
      ROLE_PERMISSIONS_FALLBACK.ROLE_SYSTEM_ROOT.forEach((p) => permSet.add(p));
      return permSet;
    }

    const roles: string[] = [];
    if (import.meta.env.DEV && isSandboxEnabled && activePersonaId) {
      const persona = DEFAULT_SANDBOX_PERSONAS[activePersonaId];
      if (persona?.roles) roles.push(...persona.roles);
    } else if (authUser?.role) {
      roles.push(...authUser.role);
    }

    for (const r of roles) {
      const perms = ROLE_PERMISSIONS_FALLBACK[r];
      if (perms) perms.forEach((p) => permSet.add(p));
    }

    return permSet;
  }, [authUser, isSandboxEnabled, activePersonaId]);
}
