import { useSpringAuthStore } from '../store';

/**
 * Standard enterprise hook providing reactive permissions and sovereign authority
 * derived directly from authenticated JWT authorities and session context.
 */
export function usePermissions() {
  const user = useSpringAuthStore((state) => state.user);
  const currentTenantId = useSpringAuthStore((state) => state.currentTenantId);

  const roles = user?.roles || [];

  const isSovereignCustodian = Boolean(
    roles.includes('ROLE_SYSTEM_CUSTODIAN') ||
    currentTenantId === 'SYSTEM' ||
    user?.tenantId === 'SYSTEM' ||
    user?.tid === 'SYSTEM'
  );

  const isAdmin = isSovereignCustodian || roles.includes('ROLE_ADMIN') || roles.includes('TENANT_ADMIN');
  const isOperator = isAdmin || roles.includes('TENANT_OPERATOR') || roles.includes('ROLE_CREATOR');

  return {
    user,
    roles,
    currentTenantId,
    isSovereignCustodian,
    isAdmin,
    isOperator,
    canManageSchema: isAdmin,
    canMutateRecords: isOperator,
  };
}
