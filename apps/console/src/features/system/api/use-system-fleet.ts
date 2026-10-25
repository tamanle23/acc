import { springApiClient } from '@/features/spring-auth/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type SovereignSubscriptionTier = 'BASIC' | 'PRO' | 'PRO_MAX' | 'ENTERPRISE';
export type SovereignTenantStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface FleetTenantSummary {
  tenantId: string;
  name: string;
  slug: string;
  tier: SovereignSubscriptionTier;
  status: SovereignTenantStatus;
  ownerEmail: string;

  // Quotas & Telemetry
  workspacesCount: number;
  maxWorkspaces: number; // -1 represents unlimited
  schemasCount: number;
  maxSchemas: number; // -1 represents unlimited
  recordsCount: number;
  maxRecords: number; // -1 represents unlimited

  // Runtime counters & Health
  cpuUsagePercent: number;
  storageBytes: number;
  rateLimitSpikes: number;
  activeConnections: number;

  expiresAt: string | null;
  createdDate: string;
  lastUpdatedDate: string;
  activeFeatures: string[];
}

export interface DetailedTenantDiagnostics extends FleetTenantSummary {
  billingCadence?: string;
  amountPaid?: number;
  rateLimitCapacity?: number;
  memoryUsageBytes?: number;
  avgQueryLatencyMs?: number;
  metadataStats?: Record<string, unknown>;
}

export interface CreateTenantPayload {
  tenantId: string;
  tenantName: string;
  slug?: string;
  ownerEmail?: string;
  tier?: SovereignSubscriptionTier;
  blueprintId?: string;
}

export interface UpdateTenantStatusPayload {
  tenantId: string;
  status: SovereignTenantStatus;
  reason: string;
}

export interface OverrideSubscriptionPayload {
  tenantId: string;
  planTier: SovereignSubscriptionTier;
  features?: string[];
  expiresAt?: string | null;
  reason: string;
}

export interface UpdateTenantQuotasPayload {
  tenantId: string;
  maxWorkspaces?: number;
  maxSchemas?: number;
  maxRecords?: number;
  rateLimitBurst?: number;
  rateLimitReplenishRate?: number;
  reason: string;
}

export interface AssumeTenantPayload {
  tenantId: string;
  durationMinutes?: number;
  reason?: string;
}

export interface AssumeTenantTokenResult {
  ephemeralToken: string;
  actorTenantId: string;
  effectiveTenantId: string;
  issuedAt: string;
  expiresAt: string;
  authorities: string[];
  message: string;
}

export interface SystemRoleWithPermissions {
  roleId: string;
  roleName: string;
  description: string;
  systemRole: boolean;
  roleScope?: 'SYSTEM' | 'TENANT';
  minPlanTier?: 'COMMUNITY' | 'STANDARD' | 'PRO' | 'ENTERPRISE';
  tenantId?: string;
  permissions: string[];
  inheritedRoles: string[];
  userCount: number;
  createdDate: string;
}

export interface CreateRolePayload {
  roleId: string;
  roleName: string;
  description?: string;
  roleScope?: 'SYSTEM' | 'TENANT';
  minPlanTier?: 'COMMUNITY' | 'STANDARD' | 'PRO' | 'ENTERPRISE';
  tenantId?: string;
  permissions?: string[];
  inheritedRoles?: string[];
}

export interface UpdateRolePermissionsPayload {
  roleId: string;
  permissions: string[];
  inheritedRoles?: string[];
  reason?: string;
}

export interface PermissionOverridePayload {
  permissionCode: string;
  isGranted: boolean;
  reason?: string;
}

export interface DelegateUserRolesPayload {
  tenantId: string;
  userId: string;
  roles: string[];
  permissionOverrides?: PermissionOverridePayload[];
  reason: string;
}

export interface UserDelegationResult {
  userId: string;
  tenantId: string;
  assignedRoles: string[];
  activeOverrides: PermissionOverridePayload[];
  delegatedBy: string;
  reason: string;
}

export interface GlobalUserListItem {
  userId: string;
  username: string;
  email: string;
  displayName: string;
  tenantId: string;
  roles: string[];
  locked: boolean;
  active: boolean;
  lastLoginDate: string;
  createdDate: string;
}

export interface LockUserPayload {
  userId: string;
  locked: boolean;
  reason: string;
}

export interface SpringPageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export const SYSTEM_FLEET_QUERY_KEYS = {
  all: ['system-fleet'] as const,
  tenants: (search?: string, tier?: string, status?: string) =>
    ['system-fleet', 'tenants', { search, tier, status }] as const,
  tenantDiagnostics: (id: string) => ['system-fleet', 'tenant', id] as const,
  roles: () => ['system-fleet', 'roles'] as const,
  users: (search?: string, tenantId?: string) =>
    ['system-fleet', 'users', { search, tenantId }] as const,
};

/**
 * Hook to retrieve paginated fleet tenants with live search, tier, and status filtering.
 */
export function useFleetTenants(search?: string, tier?: string, status?: string) {
  return useQuery({
    queryKey: SYSTEM_FLEET_QUERY_KEYS.tenants(search, tier, status),
    queryFn: async (): Promise<FleetTenantSummary[]> => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (tier && tier !== 'ALL') params.tier = tier;
      if (status && status !== 'ALL') params.status = status;

      const response = await springApiClient.get<{
        header: { success: boolean };
        body: SpringPageResponse<FleetTenantSummary>;
      }>('/v1/system/tenants', { params });

      return response.data?.body?.content || [];
    },
    staleTime: 10_000,
  });
}

/**
 * Hook to retrieve deep diagnostics telemetry for a single fleet tenant.
 */
export function useFleetTenantDiagnostics(tenantId?: string) {
  return useQuery({
    queryKey: SYSTEM_FLEET_QUERY_KEYS.tenantDiagnostics(tenantId || ''),
    queryFn: async (): Promise<FleetTenantSummary | null> => {
      if (!tenantId) return null;
      const response = await springApiClient.get<{
        header: { success: boolean };
        body: FleetTenantSummary;
      }>(`/v1/system/tenants/${encodeURIComponent(tenantId)}`);

      return response.data?.body || null;
    },
    enabled: Boolean(tenantId),
    staleTime: 5_000,
  });
}

/**
 * Sovereign mutation: Provision new organization with domain blueprint seeding.
 */
export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTenantPayload) => {
      const response = await springApiClient.post<{
        header: { success: boolean };
        body: FleetTenantSummary;
      }>('/v1/system/tenants', payload);
      return response.data?.body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SYSTEM_FLEET_QUERY_KEYS.all });
      toast.success(`Tenant '${data?.tenantId}' successfully provisioned!`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to provision tenant';
      toast.error(msg);
    },
  });
}

/**
 * Sovereign mutation: Soft kill-switch toggle (ACTIVE <-> SUSPENDED <-> ARCHIVED).
 */
export function useUpdateTenantStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTenantStatusPayload) => {
      const response = await springApiClient.put<{
        header: { success: boolean };
        body: FleetTenantSummary;
      }>(`/v1/system/tenants/${encodeURIComponent(payload.tenantId)}/status`, {
        status: payload.status,
        reason: payload.reason,
      });
      return response.data?.body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SYSTEM_FLEET_QUERY_KEYS.all });
      toast.success(`Tenant '${data?.tenantId}' status updated to ${data?.status}`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update tenant status';
      toast.error(msg);
    },
  });
}

/**
 * Sovereign mutation: Commercial subscription override & feature flag cherry-picking.
 */
export function useOverrideSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: OverrideSubscriptionPayload) => {
      const response = await springApiClient.put<{
        header: { success: boolean };
        body: FleetTenantSummary;
      }>(`/v1/system/tenants/${encodeURIComponent(payload.tenantId)}/subscription`, {
        planTier: payload.planTier,
        features: payload.features,
        expiresAt: payload.expiresAt,
        reason: payload.reason,
      });
      return response.data?.body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SYSTEM_FLEET_QUERY_KEYS.all });
      toast.success(`Tenant '${data?.tenantId}' subscription updated to ${data?.tier}`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to override subscription';
      toast.error(msg);
    },
  });
}

/**
 * Sovereign mutation: Quota tuning override (maxWorkspaces, maxSchemas, maxRecords, burst).
 */
export function useUpdateTenantQuotas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTenantQuotasPayload) => {
      const response = await springApiClient.put<{
        header: { success: boolean };
        body: FleetTenantSummary;
      }>(`/v1/system/tenants/${encodeURIComponent(payload.tenantId)}/quotas`, {
        maxWorkspaces: payload.maxWorkspaces,
        maxSchemas: payload.maxSchemas,
        maxRecords: payload.maxRecords,
        rateLimitBurst: payload.rateLimitBurst,
        rateLimitReplenishRate: payload.rateLimitReplenishRate,
        reason: payload.reason,
      });
      return response.data?.body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SYSTEM_FLEET_QUERY_KEYS.all });
      toast.success(`Quotas updated for '${data?.tenantId}'!`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update quotas';
      toast.error(msg);
    },
  });
}

/**
 * Sovereign mutation: Assume-Tenant ephemeral token generation for seamless impersonation.
 */
export function useAssumeTenant() {
  return useMutation({
    mutationFn: async (payload: AssumeTenantPayload): Promise<AssumeTenantTokenResult> => {
      const response = await springApiClient.post<{
        header: { success: boolean };
        body: AssumeTenantTokenResult;
      }>(`/v1/system/tenants/${encodeURIComponent(payload.tenantId)}/assume`, {
        durationMinutes: payload.durationMinutes || 60,
        reason: payload.reason || 'Sovereign inspection',
      });
      return response.data.body;
    },
    onSuccess: (data) => {
      toast.success(`Assumed tenant '${data.effectiveTenantId}'! Session expires in 60m`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to assume tenant';
      toast.error(msg);
    },
  });
}

/**
 * Hook to retrieve RBAC roles and permissions matrix.
 */
export function useSystemRoles() {
  return useQuery({
    queryKey: SYSTEM_FLEET_QUERY_KEYS.roles(),
    queryFn: async (): Promise<SystemRoleWithPermissions[]> => {
      const response = await springApiClient.get<{
        header: { success: boolean };
        body: SystemRoleWithPermissions[];
      }>('/v1/system/roles');
      return response.data?.body || [];
    },
    staleTime: 30_000,
  });
}

/**
 * Sovereign mutation: Update role permissions bindings.
 */
export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateRolePermissionsPayload) => {
      const response = await springApiClient.put<{
        header: { success: boolean };
        body: SystemRoleWithPermissions;
      }>(`/v1/system/roles/${encodeURIComponent(payload.roleId)}/permissions`, {
        permissions: payload.permissions,
        inheritedRoles: payload.inheritedRoles,
        reason: payload.reason || 'Matrix reconfiguration',
      });
      return response.data?.body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SYSTEM_FLEET_QUERY_KEYS.roles() });
      toast.success(`Role '${data?.roleName}' permissions updated!`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update role permissions';
      toast.error(msg);
    },
  });
}

/**
 * Sovereign mutation: Provision a new custom role with declarative DAG inheritance.
 */
export function useCreateSystemRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateRolePayload) => {
      const response = await springApiClient.post<{
        header: { success: boolean };
        body: SystemRoleWithPermissions;
      }>('/v1/system/roles', payload);
      return response.data?.body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SYSTEM_FLEET_QUERY_KEYS.roles() });
      toast.success(`Role '${data?.roleName || 'Custom'}' successfully provisioned!`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create role';
      toast.error(msg);
    },
  });
}

/**
 * Hook to retrieve cross-tenant universal users.
 */
export function useGlobalUsers(search?: string, tenantId?: string) {
  return useQuery({
    queryKey: SYSTEM_FLEET_QUERY_KEYS.users(search, tenantId),
    queryFn: async (): Promise<GlobalUserListItem[]> => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (tenantId) params.tenantId = tenantId;

      const response = await springApiClient.get<{
        header: { success: boolean };
        body: SpringPageResponse<GlobalUserListItem>;
      }>('/v1/system/users', { params });

      return response.data?.body?.content || [];
    },
    staleTime: 10_000,
  });
}

/**
 * Sovereign mutation: Lock/unlock user account.
 */
export function useLockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LockUserPayload) => {
      const response = await springApiClient.put<{
        header: { success: boolean };
        body: GlobalUserListItem;
      }>(`/v1/system/users/${encodeURIComponent(payload.userId)}/lock`, {
        locked: payload.locked,
        reason: payload.reason,
      });
      return response.data?.body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SYSTEM_FLEET_QUERY_KEYS.users() });
      toast.success(`User '${data?.username}' ${data?.locked ? 'locked' : 'unlocked'}!`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to lock/unlock user';
      toast.error(msg);
    },
  });
}

/**
 * Sovereign mutation: Revoke/delete a custom system or tenant role.
 */
export function useDeleteSystemRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const response = await springApiClient.delete<{
        header: { success: boolean };
        body: { roleId: string; success: boolean };
      }>(`/v1/system/roles/${encodeURIComponent(roleId)}`);
      return response.data?.body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SYSTEM_FLEET_QUERY_KEYS.roles() });
      toast.success(`Role '${data?.roleId}' successfully revoked and deleted!`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to delete role';
      toast.error(msg);
    },
  });
}

/**
 * Tenant / Sovereign mutation: Delegate roles and ad-hoc permission overrides to a tenant user.
 */
export function useDelegateUserRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DelegateUserRolesPayload): Promise<UserDelegationResult> => {
      const response = await springApiClient.put<{
        header: { success: boolean };
        body: UserDelegationResult;
      }>(
        `/v1/system/tenants/${encodeURIComponent(payload.tenantId)}/users/${encodeURIComponent(payload.userId)}/delegation`,
        {
          roles: payload.roles,
          permissionOverrides: payload.permissionOverrides || [],
          reason: payload.reason,
        }
      );
      return response.data.body;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SYSTEM_FLEET_QUERY_KEYS.users() });
      queryClient.invalidateQueries({ queryKey: SYSTEM_FLEET_QUERY_KEYS.roles() });
      toast.success(`Successfully delegated permissions to user in tenant '${variables.tenantId}'!`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to delegate user permissions';
      toast.error(msg);
    },
  });
}
