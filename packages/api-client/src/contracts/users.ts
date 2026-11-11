// ==========================================
// Identity & User Management Contracts
// ==========================================

export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended';

export const SovereignRole = {
  SystemRoot: 'ROLE_SYSTEM_ROOT',
  SystemSupport: 'ROLE_SYSTEM_SUPPORT',
} as const;

export type SovereignRole = typeof SovereignRole[keyof typeof SovereignRole];

export const TenantRole = {
  WorkspaceOwner: 'ROLE_WORKSPACE_OWNER',
  OperationsManager: 'ROLE_OPERATIONS_MANAGER',
  StandardMember: 'ROLE_STANDARD_MEMBER',
  Auditor: 'ROLE_AUDITOR',
} as const;

export type TenantRole = typeof TenantRole[keyof typeof TenantRole];

export type UserRole =
  | SovereignRole
  | TenantRole
  | 'ROLE_SYSTEM_ROOT'
  | 'ROLE_SYSTEM_SUPPORT'
  | 'ROLE_WORKSPACE_OWNER'
  | 'ROLE_OPERATIONS_MANAGER'
  | 'ROLE_STANDARD_MEMBER'
  | 'ROLE_AUDITOR'
  | (string & {});

export interface UserPreferences {
  language?: string;
  avatarUrl?: string;
  bio?: string;
  theme?: 'light' | 'dark' | 'system';
  urls?: Array<{ value: string }>;
  [key: string]: unknown;
}

export interface UserProfileDto {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  preferences: UserPreferences;
}

export interface UpdateUserProfileRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  preferences?: UserPreferences;
}

export interface UserVm {
  id: string;
  uid?: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  status: UserStatus;
  role: UserRole;
  tenantId?: string;
  roles?: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
}

export type User = UserVm;

export interface UserProfileVm {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  roles: string[];
  tenantId?: string;
  activeWorkspaceId?: string;
  [key: string]: unknown;
}

export interface UserSearchCondition {
  keyword?: string;
  status?: UserStatus;
  role?: string;
  page?: number;
  size?: number;
  sort?: string;
  tenantId?: string;
  [key: string]: unknown;
}

export interface CreateUserRequest {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  status?: UserStatus;
  role?: UserRole;
  password?: string;
  tenantId?: string;
  [key: string]: unknown;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  status?: UserStatus;
  role?: UserRole;
  [key: string]: unknown;
}
