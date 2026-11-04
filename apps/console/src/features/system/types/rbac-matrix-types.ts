export type RoleScope = 'SYSTEM' | 'TENANT';
export type SecurityPlane = 'PLATFORM' | 'METADATA' | 'RECORDS' | 'WORKSPACE' | 'WORKFLOW' | 'AUDIT' | 'BILLING';
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
  { key: 'platform:fleet:read', plane: 'PLATFORM', category: 'Fleet', label: 'Inspect Fleet Telemetry', description: 'Inspect fleet inventory and cluster runtime metrics', clearanceTier: 'Sovereign Tier 2' },
  { key: 'platform:fleet:mutate', plane: 'PLATFORM', category: 'Fleet', label: 'Mutate Fleet Configuration', description: 'Provision, suspend, or update tenant cluster resources', clearanceTier: 'Sovereign Tier 4' },
  { key: 'platform:fleet:trip_circuit', plane: 'PLATFORM', category: 'Fleet', label: 'Circuit Breaker Trip', description: 'Emergency systemic circuit breaker trip', clearanceTier: 'Sovereign Tier 4', dangerous: true },
  { key: 'platform:tenant:assume', plane: 'PLATFORM', category: 'Fleet', label: 'Assume-Tenant Impersonation', description: 'Assume tenant context for support and troubleshooting', clearanceTier: 'Sovereign Tier 3', dangerous: true },
  { key: 'platform:tenant:purge', plane: 'PLATFORM', category: 'Fleet', label: 'Purge Tenant Data', description: 'Cryptographic tenant data purge', clearanceTier: 'Sovereign Tier 4', dangerous: true },
  { key: 'platform:quotas:manage', plane: 'PLATFORM', category: 'Fleet', label: 'Override Tenant Quotas', description: 'Override workspace, schema, and record quota limits', clearanceTier: 'Sovereign Tier 3' },
  { key: 'platform:roles:manage', plane: 'PLATFORM', category: 'Governance', label: 'Manage RBAC Policies', description: 'Manage sovereign roles, permission matrices, and DAGs', clearanceTier: 'Sovereign Tier 4' },
  { key: 'platform:users:manage', plane: 'PLATFORM', category: 'Governance', label: 'Universal User Management', description: 'Cross-tenant user directory lookup and credential lockdown', clearanceTier: 'Sovereign Tier 4' },
  { key: 'platform:dlq:manage', plane: 'PLATFORM', category: 'Operations', label: 'Manage DLQ Tasks', description: 'Inspect and replay mutation dead-letter queue records', clearanceTier: 'Sovereign Tier 3' },
  { key: 'platform:workers:manage', plane: 'PLATFORM', category: 'Operations', label: 'Manage Media Workers', description: 'Scale and manage distributed media worker pool', clearanceTier: 'Sovereign Tier 3' },

  // Dynamic Metadata Plane (5)
  { key: 'metadata:schema:read', plane: 'METADATA', category: 'Schema', label: 'Read Entity Schemas', description: 'Read dynamic entity types and attribute definitions', clearanceTier: 'Community' },
  { key: 'metadata:schema:write', plane: 'METADATA', category: 'Schema', label: 'Author Entity Schemas', description: 'Author, modify, and deploy dynamic entity schemas', clearanceTier: 'Operations' },
  { key: 'metadata:blueprint:package', plane: 'METADATA', category: 'Blueprint', label: 'Package Blueprints', description: 'Package system catalog blueprint manifests', clearanceTier: 'Sovereign Tier 4' },
  { key: 'metadata:blueprint:provision', plane: 'METADATA', category: 'Blueprint', label: 'Provision Blueprints', description: 'Provision blueprint packages into tenant workspaces', clearanceTier: 'Operations' },
  { key: 'metadata:cache:evict', plane: 'METADATA', category: 'Infrastructure', label: 'Evict Schema Caches', description: 'Force invalidate L1/L2 schema cache partitions', clearanceTier: 'Sovereign Tier 3' },

  // Entity Records Plane (5)
  { key: 'entity:record:read', plane: 'RECORDS', category: 'Records', label: 'Read Entity Records', description: 'Query, filter, and seek dynamic entity records', clearanceTier: 'Community' },
  { key: 'entity:record:create', plane: 'RECORDS', category: 'Records', label: 'Create Entity Records', description: 'Insert new dynamic entity record', clearanceTier: 'Standard' },
  { key: 'entity:record:update', plane: 'RECORDS', category: 'Records', label: 'Update Entity Records', description: 'Update existing dynamic entity record', clearanceTier: 'Standard' },
  { key: 'entity:record:delete', plane: 'RECORDS', category: 'Records', label: 'Delete Entity Records', description: 'Soft-delete dynamic entity record', clearanceTier: 'Standard' },
  { key: 'entity:record:export', plane: 'RECORDS', category: 'Records', label: 'Export Entity Records', description: 'Bulk export dynamic entity records', clearanceTier: 'Operations' },

  // Workspace Plane (4)
  { key: 'workspace:settings:read', plane: 'WORKSPACE', category: 'Workspace', label: 'Read Workspace Settings', description: 'View workspace profile and settings', clearanceTier: 'Community' },
  { key: 'workspace:settings:manage', plane: 'WORKSPACE', category: 'Workspace', label: 'Manage Workspace Settings', description: 'Update workspace branding, quotas, and integrations', clearanceTier: 'Workspace Owner' },
  { key: 'workspace:members:read', plane: 'WORKSPACE', category: 'Membership', label: 'Read Workspace Members', description: 'View workspace members and assigned roles', clearanceTier: 'Community' },
  { key: 'workspace:members:manage', plane: 'WORKSPACE', category: 'Membership', label: 'Manage Workspace Members', description: 'Invite members, revoke access, and delegate tenant roles', clearanceTier: 'Workspace Owner' },

  // Workflow Plane (5)
  { key: 'workflow:definition:read', plane: 'WORKFLOW', category: 'Definition', label: 'Read Workflow Definitions', description: 'Inspect workflow definitions and step DAGs', clearanceTier: 'Community' },
  { key: 'workflow:definition:manage', plane: 'WORKFLOW', category: 'Definition', label: 'Manage Workflow Definitions', description: 'Author and publish workflow definitions', clearanceTier: 'Operations' },
  { key: 'workflow:execution:read', plane: 'WORKFLOW', category: 'Execution', label: 'Read Workflow Executions', description: 'View execution runs, step states, and trace logs', clearanceTier: 'Community' },
  { key: 'workflow:execution:submit', plane: 'WORKFLOW', category: 'Execution', label: 'Submit Workflow Execution', description: 'Trigger or submit workflow execution', clearanceTier: 'Standard' },
  { key: 'workflow:approval:execute', plane: 'WORKFLOW', category: 'Execution', label: 'Execute Workflow Approval', description: 'Approve or reject pending workflow task approval', clearanceTier: 'Standard' },

  // Audit Plane (3)
  { key: 'audit:log:read', plane: 'AUDIT', category: 'Audit', label: 'Read Audit Logs', description: 'Read tenant record change deltas and timeline', clearanceTier: 'Auditor' },
  { key: 'audit:hash:verify', plane: 'AUDIT', category: 'Audit', label: 'Verify Audit Trail Hashes', description: 'Verify cryptographic SHA-256 forward hash chains', clearanceTier: 'Auditor' },
  { key: 'audit:compliance:export', plane: 'AUDIT', category: 'Compliance', label: 'Export Compliance Bundles', description: 'Export signed tamper-evident compliance bundles', clearanceTier: 'Auditor' },

  // Commercial Billing Plane (4)
  { key: 'billing:subscription:read', plane: 'BILLING', category: 'Billing', label: 'Read Subscription', description: 'View subscription plan, usage, and invoices', clearanceTier: 'Workspace Owner' },
  { key: 'billing:subscription:upgrade', plane: 'BILLING', category: 'Billing', label: 'Upgrade Subscription', description: 'Upgrade plan tier and manage payment methods', clearanceTier: 'Workspace Owner' },
  { key: 'billing:tier:override', plane: 'BILLING', category: 'Billing', label: 'Override Subscription Tier', description: 'Sovereign manual tier override and feature flags', clearanceTier: 'Sovereign Tier 4' },
  { key: 'billing:invoice:adjust', plane: 'BILLING', category: 'Billing', label: 'Manual Invoice Adjustments', description: 'Issue manual credits and dispute adjustments', clearanceTier: 'Sovereign Tier 3' },
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
