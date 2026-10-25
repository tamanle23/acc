import { useSpringAuthStore } from '../store';

/**
 * Standard enterprise hook providing reactive permissions and sovereign authority
 * derived directly from authenticated JWT authorities and session context.
 */
export function usePermissions() {
  const user = useSpringAuthStore((state) => state.user);
  const currentTenantId = useSpringAuthStore((state) => state.currentTenantId);

  const roles = user?.roles || [];

  const isSovereignRoot = roles.includes('ROLE_SYSTEM_ROOT');
  const isSovereignSupport = roles.includes('ROLE_SYSTEM_SUPPORT');
  const isSovereignVerifier = roles.includes('ROLE_SYSTEM_VERIFIER');
  const isSovereignApprover = roles.includes('ROLE_SYSTEM_APPROVER');

  const isSovereignCustodian = Boolean(
    isSovereignRoot ||
    isSovereignSupport ||
    isSovereignVerifier ||
    isSovereignApprover ||
    roles.includes('ROLE_SYSTEM_CUSTODIAN') ||
    currentTenantId === 'SYSTEM' ||
    user?.tenantId === 'SYSTEM' ||
    user?.tid === 'SYSTEM'
  );

  const isSovereignActor = isSovereignCustodian;

  // Inside-Tenant Roles
  const isWorkspaceOwner = roles.includes('ROLE_WORKSPACE_OWNER');
  const isOperationsManager = roles.includes('ROLE_OPERATIONS_MANAGER');
  const isStandardMember = roles.includes('ROLE_STANDARD_MEMBER');
  const isAuditor = roles.includes('ROLE_AUDITOR');

  const isAdmin = isSovereignRoot || isWorkspaceOwner || roles.includes('ROLE_ADMIN') || roles.includes('TENANT_ADMIN');
  const isOperator = isAdmin || isOperationsManager || roles.includes('TENANT_OPERATOR') || roles.includes('ROLE_CREATOR');

  return {
    user,
    roles,
    currentTenantId,
    isSovereignCustodian,
    isSovereignActor,
    isSovereignRoot,
    isSovereignSupport,
    isSovereignVerifier,
    isSovereignApprover,
    isWorkspaceOwner,
    isOperationsManager,
    isStandardMember,
    isAuditor,
    isAdmin,
    isOperator,
    canManageSchema: isAdmin || isOperationsManager,
    canMutateRecords: isOperator || isStandardMember,
    canVerifyTasks: isSovereignVerifier || isSovereignRoot,
    canApproveQuorum: isSovereignApprover || isSovereignRoot,
  };
}
