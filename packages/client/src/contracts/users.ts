// ==========================================
// Identity & User Management Contracts
// ==========================================

export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended';

export type UserRole =
  | 'superadmin'
  | 'admin'
  | 'cashier'
  | 'manager'
  | 'ROLE_USER'
  | 'ROLE_ADMIN'
  | 'ROLE_SYSTEM_CUSTODIAN'
  | 'ROLE_CREATOR'
  | (string & {});

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
