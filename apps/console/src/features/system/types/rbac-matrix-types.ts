export type RoleScope = 'SYSTEM' | 'TENANT';
export type SecurityPlane = 'PLATFORM' | 'METADATA' | 'SECURITY' | 'COMMERCIAL' | 'ORGANIZATION';
export type PlanTier = 'COMMUNITY' | 'STANDARD' | 'PRO' | 'ENTERPRISE';

export interface PermissionAtom {
  key: string;
  plane: SecurityPlane;
  category: string;
  label: string;
  description: string;
  clearanceTier: string;
  dangerous?: boolean;
}

export const CANONICAL_PERMISSION_ATOMS: PermissionAtom[] = [
  // Platform Fleet Governance (10)
  { key: 'platform:fleet:read', plane: 'PLATFORM', category: 'Fleet', label: 'Inspect Fleet Telemetry', description: 'Inspect fleet inventory and cluster runtime metrics', clearanceTier: 'Sovereign Tier 3' },
  { key: 'platform:fleet:mutate', plane: 'PLATFORM', category: 'Fleet', label: 'Mutate Fleet Configuration', description: 'Provision, suspend, or update tenant cluster resources', clearanceTier: 'Sovereign Tier 4' },
  { key: 'platform:fleet:circuit_trip', plane: 'PLATFORM', category: 'Fleet', label: 'Circuit Breaker Trip', description: 'Emergency systemic circuit breaker trip', clearanceTier: 'Sovereign Tier 3', dangerous: true },
  { key: 'platform:tenant:assume', plane: 'PLATFORM', category: 'Fleet', label: 'Assume-Tenant Impersonation', description: 'Assume tenant context for support and troubleshooting', clearanceTier: 'Sovereign Tier 3', dangerous: true },
  { key: 'platform:tenant:suspend', plane: 'PLATFORM', category: 'Fleet', label: 'Suspend Tenant Access', description: 'Temporarily lock tenant traffic and API access', clearanceTier: 'Sovereign Tier 4' },
  { key: 'platform:tenant:purge:request', plane: 'PLATFORM', category: 'Fleet', label: 'Request Tenant Purge', description: 'Request permanent cryptographic tenant data shredding', clearanceTier: 'Sovereign Tier 4', dangerous: true },
  { key: 'platform:tenant:purge:approve', plane: 'PLATFORM', category: 'Fleet', label: 'Approve Tenant Purge', description: 'Dual-custody sign-off for permanent tenant shredding', clearanceTier: 'Sovereign Tier 3', dangerous: true },
  { key: 'platform:quotas:override', plane: 'PLATFORM', category: 'Fleet', label: 'Override Tenant Quotas', description: 'Override workspace, schema, and record quota limits', clearanceTier: 'Sovereign Tier 3' },
  { key: 'platform:roles:manage', plane: 'PLATFORM', category: 'Governance', label: 'Manage RBAC Policies', description: 'Manage sovereign roles, permission matrices, and DAGs', clearanceTier: 'Sovereign Tier 4' },
  { key: 'platform:users:lock', plane: 'PLATFORM', category: 'Governance', label: 'Universal User Lock', description: 'Emergency cross-tenant account lockdown', clearanceTier: 'Sovereign Tier 4' },

  // System Quorum (4)
  { key: 'platform:workflow:submit', plane: 'PLATFORM', category: 'Quorum', label: 'Submit Quorum Task', description: 'Submit high-risk task to quorum queue', clearanceTier: 'Sovereign Tier 3' },
  { key: 'platform:workflow:verify', plane: 'PLATFORM', category: 'Quorum', label: 'Verify Quorum Task', description: 'Verify and pre-flight proposed system task', clearanceTier: 'Sovereign Tier 2' },
  { key: 'platform:workflow:approve', plane: 'PLATFORM', category: 'Quorum', label: 'Approve Quorum Task', description: 'Sign off and make permanent verified change', clearanceTier: 'Sovereign Tier 3' },
  { key: 'platform:workflow:reject', plane: 'PLATFORM', category: 'Quorum', label: 'Reject Quorum Task', description: 'Reject or return pending quorum task', clearanceTier: 'Sovereign Tier 3' },

  // Dynamic Metadata Plane (5)
  { key: 'metadata:schema:read', plane: 'METADATA', category: 'Schema', label: 'Read Entity Schemas', description: 'Read dynamic entity types and attribute definitions', clearanceTier: 'Community' },
  { key: 'metadata:schema:write', plane: 'METADATA', category: 'Schema', label: 'Author Entity Schemas', description: 'Author, modify, and deploy dynamic entity schemas', clearanceTier: 'Sovereign Tier 4' },
  { key: 'metadata:blueprint:package', plane: 'METADATA', category: 'Blueprint', label: 'Package Blueprints', description: 'Package system catalog blueprint manifests', clearanceTier: 'Sovereign Tier 4' },
  { key: 'metadata:blueprint:provision', plane: 'METADATA', category: 'Blueprint', label: 'Provision Blueprints', description: 'Provision blueprint packages into tenant workspaces', clearanceTier: 'Sovereign Tier 3' },
  { key: 'metadata:cache:evict', plane: 'METADATA', category: 'Infrastructure', label: 'Evict Schema Caches', description: 'Force invalidate L1/L2 schema cache partitions', clearanceTier: 'Sovereign Tier 4' },

  // Security & Audit Plane (4)
  { key: 'platform:security:inspect', plane: 'SECURITY', category: 'Audit', label: 'Inspect Security Telemetry', description: 'Inspect real-time security events and RLS alerts', clearanceTier: 'Sovereign Tier 2' },
  { key: 'platform:audit:verify', plane: 'SECURITY', category: 'Audit', label: 'Verify Audit Trail Hashes', description: 'Verify cryptographic audit trail forward hashes', clearanceTier: 'Sovereign Tier 2' },
  { key: 'platform:compliance:export', plane: 'SECURITY', category: 'Compliance', label: 'Export Compliance Evidence', description: 'Export tamper-evident compliance evidence bundles', clearanceTier: 'Sovereign Tier 2' },
  { key: 'platform:dlq:manage', plane: 'SECURITY', category: 'Operations', label: 'Manage DLQ Tasks', description: 'Inspect and replay mutation dead-letter queue records', clearanceTier: 'Sovereign Tier 3' },

  // Commercial Billing & KYC Plane (6)
  { key: 'billing:tier:override', plane: 'COMMERCIAL', category: 'Billing', label: 'Override Subscription Tier', description: 'Manually override tenant subscription tier', clearanceTier: 'Sovereign Tier 4' },
  { key: 'billing:manual:invoice', plane: 'COMMERCIAL', category: 'Billing', label: 'Manual Billing Adjustments', description: 'Issue manual credits and dispute adjustments', clearanceTier: 'Sovereign Tier 3' },
  { key: 'billing:reconcile', plane: 'COMMERCIAL', category: 'Billing', label: 'Reconcile Gateways', description: 'Trigger payment gateway reconciliation', clearanceTier: 'Sovereign Tier 3' },
  { key: 'tenant:feature:grant', plane: 'COMMERCIAL', category: 'Features', label: 'Grant Selective Features', description: 'Selectively enable tenant feature flags', clearanceTier: 'Sovereign Tier 3' },
  { key: 'platform:kyc:verify', plane: 'COMMERCIAL', category: 'KYC', label: 'Review KYC Submissions', description: 'Review tenant KYC and business registration proofs', clearanceTier: 'Sovereign Tier 2' },
  { key: 'platform:kyc:approve', plane: 'COMMERCIAL', category: 'KYC', label: 'Approve KYC Credit Lines', description: 'Approve commercial account credit lines and limits', clearanceTier: 'Sovereign Tier 3' },

  // Inside-Tenant Workspace Plane (6)
  { key: 'org:workspace:read', plane: 'ORGANIZATION', category: 'Workspace', label: 'Read Workspace Data', description: 'View workspace metadata and provisioned schemas', clearanceTier: 'Community' },
  { key: 'org:workspace:mutate', plane: 'ORGANIZATION', category: 'Workspace', label: 'Mutate Workspace Settings', description: 'Update workspace branding and settings', clearanceTier: 'Community' },
  { key: 'org:member:invite', plane: 'ORGANIZATION', category: 'Membership', label: 'Invite Workspace Members', description: 'Invite team members to workspace', clearanceTier: 'Community' },
  { key: 'org:member:manage', plane: 'ORGANIZATION', category: 'Membership', label: 'Manage Member Roles', description: 'Manage member statuses and role delegations', clearanceTier: 'Community' },
  { key: 'org:billing:read', plane: 'ORGANIZATION', category: 'Billing', label: 'Read Tenant Invoices', description: 'View subscription usage and invoices', clearanceTier: 'Community' },
  { key: 'org:billing:upgrade', plane: 'ORGANIZATION', category: 'Billing', label: 'Upgrade Subscription', description: 'Initiate plan tier upgrades', clearanceTier: 'Community' },
  { key: 'entity:record:read', plane: 'ORGANIZATION', category: 'Records', label: 'Read Entity Records', description: 'Read dynamic business entity records', clearanceTier: 'Community' },
  { key: 'entity:record:create', plane: 'ORGANIZATION', category: 'Records', label: 'Create Entity Records', description: 'Create dynamic business entity records', clearanceTier: 'Community' },
  { key: 'entity:record:update', plane: 'ORGANIZATION', category: 'Records', label: 'Update Entity Records', description: 'Update dynamic business entity records', clearanceTier: 'Community' },
  { key: 'entity:record:delete', plane: 'ORGANIZATION', category: 'Records', label: 'Delete Entity Records', description: 'Soft-delete dynamic business entity records', clearanceTier: 'Community' },
  { key: 'org:workflow:submit', plane: 'ORGANIZATION', category: 'Workflow', label: 'Submit Internal Approval', description: 'Submit record for internal approval', clearanceTier: 'Standard' },
  { key: 'org:workflow:approve', plane: 'ORGANIZATION', category: 'Workflow', label: 'Approve Internal Step', description: 'Approve internal workflow transition', clearanceTier: 'Standard' },
  { key: 'org:audit:read', plane: 'ORGANIZATION', category: 'Audit', label: 'Read Tenant Audit Logs', description: 'Read tenant record change history deltas', clearanceTier: 'Pro' },
];

export interface SystemRoleWithPermissions {
  roleId: string;
  roleName: string;
  description: string;
  systemRole: boolean;
  roleScope: RoleScope;
  minPlanTier: PlanTier;
  tenantId: string;
  permissions: string[];
  inheritedRoles: string[];
  userCount: number;
  createdDate: string;
}

export interface PermissionOverride {
  permissionCode: string;
  isGranted: boolean;
  reason?: string;
}

export interface DelegateUserRolesPayload {
  tenantId: string;
  userId: string;
  roles: string[];
  permissionOverrides: PermissionOverride[];
  reason: string;
}

export interface CanonicalPermission {
  code: string;
  plane: SecurityPlane;
  category: string;
  label: string;
  description: string;
  clearanceTier: string;
  dangerous?: boolean;
}

export const CANONICAL_PERMISSIONS: CanonicalPermission[] = CANONICAL_PERMISSION_ATOMS.map((p) => ({
  ...p,
  code: p.key,
}));

export const SECURITY_PLANES: { id: SecurityPlane; label: string; color: string }[] = [
  { id: 'PLATFORM', label: 'Platform & Fleet', color: 'text-indigo-700 dark:text-indigo-300 border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/40' },
  { id: 'METADATA', label: 'Dynamic Metadata', color: 'text-sky-700 dark:text-sky-300 border-sky-500/30 bg-sky-50 dark:bg-sky-950/40' },
  { id: 'SECURITY', label: 'Security & Audit', color: 'text-rose-700 dark:text-rose-300 border-rose-500/30 bg-rose-50 dark:bg-rose-950/40' },
  { id: 'COMMERCIAL', label: 'Commercial & KYC', color: 'text-amber-800 dark:text-amber-300 border-amber-500/30 bg-amber-50 dark:bg-amber-950/40' },
  { id: 'ORGANIZATION', label: 'Tenant Operations', color: 'text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40' },
];
