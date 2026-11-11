// ==========================================
// Authentication, Tokens & Authorization Contracts
// ==========================================

export type CanonicalRole =
  | 'ROLE_SYSTEM_ROOT'
  | 'ROLE_SYSTEM_SUPPORT'
  | 'ROLE_WORKSPACE_OWNER'
  | 'ROLE_OPERATIONS_MANAGER'
  | 'ROLE_STANDARD_MEMBER'
  | 'ROLE_AUDITOR';

export type CanonicalPermission =
  // Platform Plane
  | 'platform:fleet:read'
  | 'platform:fleet:mutate'
  | 'platform:fleet:trip_circuit'
  | 'platform:tenant:assume'
  | 'platform:tenant:purge'
  | 'platform:quotas:manage'
  | 'platform:roles:manage'
  | 'platform:users:manage'
  | 'platform:dlq:manage'
  | 'platform:workers:manage'
  // Metadata Plane
  | 'metadata:schema:read'
  | 'metadata:schema:write'
  | 'metadata:blueprint:package'
  | 'metadata:blueprint:provision'
  | 'metadata:cache:evict'
  // Entity Records Plane
  | 'entity:record:read'
  | 'entity:record:create'
  | 'entity:record:update'
  | 'entity:record:delete'
  | 'entity:record:export'
  // Workspace Plane
  | 'workspace:settings:read'
  | 'workspace:settings:manage'
  | 'workspace:members:read'
  | 'workspace:members:manage'
  // Workflow Plane
  | 'workflow:definition:read'
  | 'workflow:definition:manage'
  | 'workflow:execution:read'
  | 'workflow:execution:submit'
  | 'workflow:approval:execute'
  // Audit Plane
  | 'audit:log:read'
  | 'audit:hash:verify'
  | 'audit:compliance:export'
  // Billing Plane
  | 'billing:subscription:read'
  | 'billing:subscription:upgrade'
  | 'billing:tier:override'
  | 'billing:invoice:adjust';

/**
 * Strongly-typed session profile hydrated via GET /api/auth/me.
 * Represents current authenticated caller's security credentials and active permissions.
 */
export interface AuthenticationProfile {
  userId: string;
  username: string;
  tenantId: string;
  isSovereign: boolean;
  roles: CanonicalRole[];
  permissions: CanonicalPermission[] | string[];
  activeFeatures: string[];
}

export interface AuthenticationToken {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  issuedAt?: number;
  [key: string]: unknown;
}

export interface LoginRequest {
  username?: string;
  email?: string;
  password?: string;
  tenantId?: string;
  [key: string]: unknown;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user?: AuthenticationProfile;
}

export interface TokenRefreshRequest {
  refreshToken: string;
  [key: string]: unknown;
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken?: string;
}

export interface LogoutRequest {
  refreshToken?: string;
  [key: string]: unknown;
}
