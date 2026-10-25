import type { SandboxRouteHandler, SandboxRequest } from '../types';
import { useSandboxStore } from '../store/sandbox-store';
import { createMockJwt } from './auth-sandbox-handler';

export interface SandboxFleetTenant {
  tenantId: string;
  name: string;
  slug: string;
  tier: 'BASIC' | 'PRO' | 'PRO_MAX' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  ownerEmail: string;

  // Quotas & Telemetry
  workspacesCount: number;
  maxWorkspaces: number;
  schemasCount: number;
  maxSchemas: number;
  recordsCount: number;
  maxRecords: number;

  // Runtime counters
  cpuUsagePercent: number;
  storageBytes: number;
  rateLimitSpikes: number;
  activeConnections: number;

  expiresAt: string | null;
  createdDate: string;
  lastUpdatedDate: string;
  activeFeatures: string[];
}

export interface SandboxRoleWithPermissions {
  roleId: string;
  roleName: string;
  description: string;
  systemRole: boolean;
  roleScope: 'SYSTEM' | 'TENANT';
  minPlanTier: 'COMMUNITY' | 'STANDARD' | 'PRO' | 'ENTERPRISE';
  tenantId: string;
  permissions: string[];
  inheritedRoles: string[];
  userCount: number;
  createdDate: string;
}

export interface SandboxGlobalUser {
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

const DEFAULT_FLEET_TENANTS: SandboxFleetTenant[] = [
  {
    tenantId: 'SYSTEM',
    name: 'Sovereign Root System',
    slug: 'system',
    tier: 'ENTERPRISE',
    status: 'ACTIVE',
    ownerEmail: 'custodian@unipost.io',
    workspacesCount: 1,
    maxWorkspaces: -1,
    schemasCount: 18,
    maxSchemas: -1,
    recordsCount: 42000,
    maxRecords: -1,
    cpuUsagePercent: 1.2,
    storageBytes: 104857600,
    rateLimitSpikes: 0,
    activeConnections: 6,
    expiresAt: null,
    createdDate: '2026-01-01T00:00:00Z',
    lastUpdatedDate: '2026-10-10T12:00:00Z',
    activeFeatures: [
      'FEATURE_METADATA_READ',
      'FEATURE_RECORDS_CRUD',
      'FEATURE_SCHEMA_STUDIO',
      'FEATURE_PATTERN_C_GRAPH',
      'FEATURE_DATA_EXPORT',
      'FEATURE_AI_AGENT_MCP',
      'FEATURE_STATE_MACHINE',
      'FEATURE_STREAMING_EXPORT',
      'FEATURE_DEDICATED_REPLICA',
    ],
  },
  {
    tenantId: 'tenant-acme',
    name: 'Acme International Corp',
    slug: 'acme-corp',
    tier: 'PRO',
    status: 'ACTIVE',
    ownerEmail: 'admin@acme.com',
    workspacesCount: 3,
    maxWorkspaces: 5,
    schemasCount: 14,
    maxSchemas: 50,
    recordsCount: 48500,
    maxRecords: 100000,
    cpuUsagePercent: 5.4,
    storageBytes: 52428800,
    rateLimitSpikes: 2,
    activeConnections: 12,
    expiresAt: '2026-12-31T23:59:59Z',
    createdDate: '2026-03-15T08:30:00Z',
    lastUpdatedDate: '2026-10-09T14:20:00Z',
    activeFeatures: [
      'FEATURE_METADATA_READ',
      'FEATURE_RECORDS_CRUD',
      'FEATURE_SCHEMA_STUDIO',
      'FEATURE_PATTERN_C_GRAPH',
      'FEATURE_DATA_EXPORT',
    ],
  },
  {
    tenantId: 'tenant-us-east-1',
    name: 'Global Logistics Hub',
    slug: 'us-east-logistics',
    tier: 'PRO_MAX',
    status: 'ACTIVE',
    ownerEmail: 'ops@logistics.vn',
    workspacesCount: 8,
    maxWorkspaces: 15,
    schemasCount: 42,
    maxSchemas: 200,
    recordsCount: 380000,
    maxRecords: 1000000,
    cpuUsagePercent: 8.9,
    storageBytes: 419430400,
    rateLimitSpikes: 5,
    activeConnections: 24,
    expiresAt: '2027-01-15T00:00:00Z',
    createdDate: '2026-02-10T11:00:00Z',
    lastUpdatedDate: '2026-10-10T09:15:00Z',
    activeFeatures: [
      'FEATURE_METADATA_READ',
      'FEATURE_RECORDS_CRUD',
      'FEATURE_SCHEMA_STUDIO',
      'FEATURE_PATTERN_C_GRAPH',
      'FEATURE_DATA_EXPORT',
      'FEATURE_AI_AGENT_MCP',
      'FEATURE_STATE_MACHINE',
      'FEATURE_STREAMING_EXPORT',
    ],
  },
  {
    tenantId: 'tenant-startup-alpha',
    name: 'Alpha AI Labs',
    slug: 'alpha-ai',
    tier: 'BASIC',
    status: 'SUSPENDED',
    ownerEmail: 'founder@alpha-ai.dev',
    workspacesCount: 1,
    maxWorkspaces: 1,
    schemasCount: 4,
    maxSchemas: 20,
    recordsCount: 9800,
    maxRecords: 10000,
    cpuUsagePercent: 0.1,
    storageBytes: 10485760,
    rateLimitSpikes: 42,
    activeConnections: 0,
    expiresAt: '2026-09-30T23:59:59Z',
    createdDate: '2026-05-01T10:00:00Z',
    lastUpdatedDate: '2026-10-01T08:00:00Z',
    activeFeatures: ['FEATURE_METADATA_READ', 'FEATURE_RECORDS_CRUD'],
  },
];

const DEFAULT_ROLES: SandboxRoleWithPermissions[] = [
  {
    roleId: 'ROLE_SYSTEM_ROOT',
    roleName: 'Sovereign Root Custodian',
    description: 'Supreme platform owner with full infrastructure and schema control',
    systemRole: true,
    roleScope: 'SYSTEM',
    minPlanTier: 'ENTERPRISE',
    tenantId: 'SYSTEM',
    permissions: [
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
    ],
    inheritedRoles: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
    userCount: 1,
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    roleId: 'ROLE_SYSTEM_SUPPORT',
    roleName: 'Customer Operations & Support',
    description: 'Customer operations, Assume-Tenant support, and billing reconciliation',
    systemRole: true,
    roleScope: 'SYSTEM',
    minPlanTier: 'ENTERPRISE',
    tenantId: 'SYSTEM',
    permissions: [
      'platform:fleet:read',
      'platform:tenant:assume',
      'platform:quotas:override',
      'billing:reconcile',
      'tenant:feature:grant',
      'metadata:schema:read',
    ],
    inheritedRoles: ['ROLE_STANDARD_MEMBER'],
    userCount: 4,
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    roleId: 'ROLE_SYSTEM_VERIFIER',
    roleName: 'Governance & KYC Verifier',
    description: 'System governance, audit trail verification, and commercial KYC review',
    systemRole: true,
    roleScope: 'SYSTEM',
    minPlanTier: 'ENTERPRISE',
    tenantId: 'SYSTEM',
    permissions: [
      'platform:audit:verify',
      'platform:security:inspect',
      'platform:compliance:export',
      'platform:kyc:verify',
      'platform:workflow:verify',
      'platform:fleet:read',
    ],
    inheritedRoles: ['ROLE_STANDARD_MEMBER'],
    userCount: 2,
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    roleId: 'ROLE_SYSTEM_APPROVER',
    roleName: 'Quorum Approver',
    description: 'Four-eyes quorum approver for high-risk fleet and operational gates',
    systemRole: true,
    roleScope: 'SYSTEM',
    minPlanTier: 'ENTERPRISE',
    tenantId: 'SYSTEM',
    permissions: [
      'platform:workflow:approve',
      'platform:tenant:purge:approve',
      'platform:fleet:circuit_trip',
      'platform:kyc:approve',
    ],
    inheritedRoles: [],
    userCount: 2,
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    roleId: 'ROLE_WORKSPACE_OWNER',
    roleName: 'Workspace Owner',
    description: 'Workspace Owner with full administrative authority over tenant workspace',
    systemRole: true,
    roleScope: 'TENANT',
    minPlanTier: 'COMMUNITY',
    tenantId: 'SYSTEM',
    permissions: [
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
    inheritedRoles: ['ROLE_OPERATIONS_MANAGER', 'ROLE_STANDARD_MEMBER'],
    userCount: 18,
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    roleId: 'ROLE_OPERATIONS_MANAGER',
    roleName: 'Operations Manager',
    description: 'Operations manager over business entities, dispatching, and approvals',
    systemRole: true,
    roleScope: 'TENANT',
    minPlanTier: 'STANDARD',
    tenantId: 'SYSTEM',
    permissions: [
      'entity:record:read',
      'entity:record:create',
      'entity:record:update',
      'entity:record:delete',
      'org:workflow:submit',
      'org:workflow:approve',
      'metadata:schema:read',
    ],
    inheritedRoles: ['ROLE_STANDARD_MEMBER'],
    userCount: 42,
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    roleId: 'ROLE_STANDARD_MEMBER',
    roleName: 'Standard Member',
    description: 'Standard team member with data record read and write access',
    systemRole: true,
    roleScope: 'TENANT',
    minPlanTier: 'COMMUNITY',
    tenantId: 'SYSTEM',
    permissions: [
      'entity:record:read',
      'entity:record:write',
      'entity:record:create',
      'metadata:schema:read',
    ],
    inheritedRoles: [],
    userCount: 156,
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    roleId: 'ROLE_AUDITOR',
    roleName: 'Compliance Auditor',
    description: 'Tenant compliance and read-only auditor',
    systemRole: false,
    roleScope: 'TENANT',
    minPlanTier: 'PRO',
    tenantId: 'SYSTEM',
    permissions: [
      'entity:record:read',
      'org:audit:read',
      'metadata:schema:read',
    ],
    inheritedRoles: [],
    userCount: 6,
    createdDate: '2026-03-01T00:00:00Z',
  },
];

const DEFAULT_GLOBAL_USERS: SandboxGlobalUser[] = [
  {
    userId: 'usr-custodian-root',
    username: 'custodian',
    email: 'custodian@unipost.io',
    displayName: 'Sovereign Custodian (Me)',
    tenantId: 'SYSTEM',
    roles: ['ROLE_SYSTEM_CUSTODIAN', 'ROLE_ADMIN', 'ROLE_USER'],
    locked: false,
    active: true,
    lastLoginDate: '2026-10-10T12:00:00Z',
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    userId: 'usr-acme-admin',
    username: 'alice@acme.com',
    email: 'alice@acme.com',
    displayName: 'Alice Henderson',
    tenantId: 'tenant-acme',
    roles: ['ROLE_ADMIN', 'ROLE_USER'],
    locked: false,
    active: true,
    lastLoginDate: '2026-10-10T10:30:00Z',
    createdDate: '2026-03-15T08:30:00Z',
  },
  {
    userId: 'usr-logistics-ops',
    username: 'bob@logistics.vn',
    email: 'bob@logistics.vn',
    displayName: 'Bob Nguyen',
    tenantId: 'tenant-us-east-1',
    roles: ['ROLE_USER'],
    locked: false,
    active: true,
    lastLoginDate: '2026-10-09T18:00:00Z',
    createdDate: '2026-02-10T11:00:00Z',
  },
  {
    userId: 'usr-alpha-founder',
    username: 'founder@alpha-ai.dev',
    email: 'founder@alpha-ai.dev',
    displayName: 'David Vance',
    tenantId: 'tenant-startup-alpha',
    roles: ['ROLE_ADMIN', 'ROLE_USER'],
    locked: true,
    active: false,
    lastLoginDate: '2026-09-30T14:00:00Z',
    createdDate: '2026-05-01T10:00:00Z',
  },
];

class MockFleetRepository {
  private tenants: SandboxFleetTenant[] = [];
  private roles: SandboxRoleWithPermissions[] = [];
  private users: SandboxGlobalUser[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.tenants = JSON.parse(JSON.stringify(DEFAULT_FLEET_TENANTS));
    this.roles = JSON.parse(JSON.stringify(DEFAULT_ROLES));
    this.users = JSON.parse(JSON.stringify(DEFAULT_GLOBAL_USERS));
  }

  getTenants(search?: string, tier?: string, status?: string): SandboxFleetTenant[] {
    return this.tenants.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.tenantId.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (tier && t.tier.toUpperCase() !== tier.toUpperCase()) return false;
      if (status && t.status.toUpperCase() !== status.toUpperCase()) return false;
      return true;
    });
  }

  getTenantById(tenantId: string): SandboxFleetTenant | undefined {
    return this.tenants.find((t) => t.tenantId.toLowerCase() === tenantId.toLowerCase());
  }

  createTenant(payload: {
    tenantId: string;
    tenantName: string;
    slug?: string;
    ownerEmail?: string;
    tier?: string;
    blueprintId?: string;
  }): SandboxFleetTenant {
    const tid = payload.tenantId.trim().toLowerCase();
    const existing = this.getTenantById(tid);
    if (existing) {
      throw new Error(`Tenant '${tid}' already exists in fleet store`);
    }

    const tier = (payload.tier?.toUpperCase() || 'BASIC') as SandboxFleetTenant['tier'];
    const maxWorkspaces = tier === 'ENTERPRISE' ? -1 : tier === 'PRO_MAX' ? 15 : tier === 'PRO' ? 5 : 1;
    const maxSchemas = tier === 'ENTERPRISE' ? -1 : tier === 'PRO_MAX' ? 200 : tier === 'PRO' ? 50 : 20;
    const maxRecords = tier === 'ENTERPRISE' ? -1 : tier === 'PRO_MAX' ? 1000000 : tier === 'PRO' ? 100000 : 10000;

    const newTenant: SandboxFleetTenant = {
      tenantId: tid,
      name: payload.tenantName,
      slug: payload.slug || tid,
      tier,
      status: 'ACTIVE',
      ownerEmail: payload.ownerEmail || `admin@${tid}.io`,
      workspacesCount: 1,
      maxWorkspaces,
      schemasCount: 6,
      maxSchemas,
      recordsCount: 0,
      maxRecords,
      cpuUsagePercent: 0.8,
      storageBytes: 1048576,
      rateLimitSpikes: 0,
      activeConnections: 1,
      expiresAt: null,
      createdDate: new Date().toISOString(),
      lastUpdatedDate: new Date().toISOString(),
      activeFeatures: ['FEATURE_METADATA_READ', 'FEATURE_RECORDS_CRUD'],
    };

    this.tenants.push(newTenant);
    return newTenant;
  }

  updateTenantStatus(tenantId: string, status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'): SandboxFleetTenant {
    const tenant = this.getTenantById(tenantId);
    if (!tenant) throw new Error(`Tenant '${tenantId}' not found`);
    if (tenant.tenantId === 'SYSTEM') throw new Error('SYSTEM tenant cannot be suspended');

    tenant.status = status;
    tenant.lastUpdatedDate = new Date().toISOString();
    return tenant;
  }

  overrideSubscription(
    tenantId: string,
    tier: SandboxFleetTenant['tier'],
    features?: string[],
    expiresAt?: string | null
  ): SandboxFleetTenant {
    const tenant = this.getTenantById(tenantId);
    if (!tenant) throw new Error(`Tenant '${tenantId}' not found`);

    tenant.tier = tier;
    if (expiresAt !== undefined) tenant.expiresAt = expiresAt;
    if (features && features.length > 0) {
      tenant.activeFeatures = features;
    }
    tenant.lastUpdatedDate = new Date().toISOString();
    return tenant;
  }

  updateQuotas(
    tenantId: string,
    quotas: {
      maxWorkspaces?: number;
      maxSchemas?: number;
      maxRecords?: number;
    }
  ): SandboxFleetTenant {
    const tenant = this.getTenantById(tenantId);
    if (!tenant) throw new Error(`Tenant '${tenantId}' not found`);

    if (quotas.maxWorkspaces !== undefined) tenant.maxWorkspaces = quotas.maxWorkspaces;
    if (quotas.maxSchemas !== undefined) tenant.maxSchemas = quotas.maxSchemas;
    if (quotas.maxRecords !== undefined) tenant.maxRecords = quotas.maxRecords;
    tenant.lastUpdatedDate = new Date().toISOString();
    return tenant;
  }

  getRoles(): SandboxRoleWithPermissions[] {
    return this.roles;
  }

  createRole(role: {
    roleId: string;
    roleName: string;
    description?: string;
    roleScope?: 'SYSTEM' | 'TENANT';
    minPlanTier?: 'COMMUNITY' | 'STANDARD' | 'PRO' | 'ENTERPRISE';
    tenantId?: string;
    permissions?: string[];
    inheritedRoles?: string[];
  }): SandboxRoleWithPermissions {
    const existing = this.roles.find((r) => r.roleId === role.roleId);
    if (existing) {
      throw new Error(`Role '${role.roleId}' already exists`);
    }

    const newRole: SandboxRoleWithPermissions = {
      roleId: role.roleId,
      roleName: role.roleName,
      description: role.description || '',
      systemRole: false,
      roleScope: role.roleScope || 'TENANT',
      minPlanTier: role.minPlanTier || 'COMMUNITY',
      tenantId: role.tenantId || 'SYSTEM',
      permissions: role.permissions || [],
      inheritedRoles: role.inheritedRoles || ['ROLE_STANDARD_MEMBER'],
      userCount: 0,
      createdDate: new Date().toISOString(),
    };

    this.roles.push(newRole);
    return newRole;
  }

  deleteRole(roleId: string): { roleId: string; success: boolean } {
    const index = this.roles.findIndex((r) => r.roleId === roleId);
    if (index === -1) throw new Error(`Role '${roleId}' not found`);
    if (this.roles[index].systemRole) {
      throw new Error(`Cannot delete system-protected core role '${roleId}'`);
    }
    this.roles.splice(index, 1);
    return { roleId, success: true };
  }

  delegateUser(
    tenantId: string,
    userId: string,
    roles: string[],
    permissionOverrides: { permissionCode: string; isGranted: boolean; reason?: string }[],
    reason: string
  ): { userId: string; tenantId: string; assignedRoles: string[]; activeOverrides: any[]; delegatedBy: string; reason: string } {
    const user = this.users.find((u) => u.userId === userId || u.username === userId);
    if (!user) throw new Error(`User '${userId}' not found`);

    user.roles = roles;
    return {
      userId: user.userId,
      tenantId,
      assignedRoles: roles,
      activeOverrides: permissionOverrides || [],
      delegatedBy: 'admin',
      reason,
    };
  }

  updateRolePermissions(roleId: string, permissions: string[], inheritedRoles?: string[]): SandboxRoleWithPermissions {
    const role = this.roles.find((r) => r.roleId === roleId);
    if (!role) throw new Error(`Role '${roleId}' not found`);

    role.permissions = permissions;
    if (inheritedRoles) role.inheritedRoles = inheritedRoles;
    return role;
  }

  getUsers(search?: string, tenantId?: string): SandboxGlobalUser[] {
    return this.users.filter((u) => {
      if (search && !u.username.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase()) && !u.displayName.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (tenantId && u.tenantId.toLowerCase() !== tenantId.toLowerCase()) return false;
      return true;
    });
  }

  lockUser(userId: string, locked: boolean): SandboxGlobalUser {
    const user = this.users.find((u) => u.userId === userId);
    if (!user) throw new Error(`User '${userId}' not found`);
    user.locked = locked;
    return user;
  }
}

export const mockFleetStore = new MockFleetRepository();

export const systemSandboxHandler: SandboxRouteHandler = {
  id: 'system-fleet-handler',
  name: 'System Sovereign Fleet Control Handler',
  description: 'Simulates sovereign fleet tenant management, quota tuning, assume-tenant tokens, and RBAC matrix',
  priority: 98,
  matcher: (context) => {
    return context.pathname.startsWith('/api/v1/system');
  },
  handler: (req: SandboxRequest) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    const method = req.method.toUpperCase();

    // 1. GET /api/v1/system/tenants
    if (method === 'GET' && path === '/api/v1/system/tenants') {
      const search = url.searchParams.get('search') || undefined;
      const tier = url.searchParams.get('tier') || undefined;
      const status = url.searchParams.get('status') || undefined;
      const filtered = mockFleetStore.getTenants(search, tier, status);

      return {
        status: 200,
        data: {
          header: { success: true },
          body: {
            content: filtered,
            totalElements: filtered.length,
            totalPages: 1,
            size: 20,
            number: 0,
          },
        },
      };
    }

    // 2. POST /api/v1/system/tenants
    if (method === 'POST' && path === '/api/v1/system/tenants') {
      const created = mockFleetStore.createTenant(req.data || {});
      return {
        status: 200,
        data: {
          header: { success: true },
          body: created,
        },
      };
    }

    // 3. GET /api/v1/system/tenants/{id}
    const tenantDetailMatch = path.match(/^\/api\/v1\/system\/tenants\/([^/]+)$/);
    if (method === 'GET' && tenantDetailMatch) {
      const tenantId = tenantDetailMatch[1];
      const tenant = mockFleetStore.getTenantById(tenantId);
      if (!tenant) {
        return {
          status: 404,
          data: { header: { success: false, message: `Tenant '${tenantId}' not found` } },
        };
      }
      return {
        status: 200,
        data: {
          header: { success: true },
          body: tenant,
        },
      };
    }

    // 4. PUT /api/v1/system/tenants/{id}/status
    const statusMatch = path.match(/^\/api\/v1\/system\/tenants\/([^/]+)\/status$/);
    if (method === 'PUT' && statusMatch) {
      const tenantId = statusMatch[1];
      const { status } = req.data || {};
      const updated = mockFleetStore.updateTenantStatus(tenantId, status);
      return {
        status: 200,
        data: {
          header: { success: true },
          body: updated,
        },
      };
    }

    // 5. PUT /api/v1/system/tenants/{id}/subscription
    const subMatch = path.match(/^\/api\/v1\/system\/tenants\/([^/]+)\/subscription$/);
    if (method === 'PUT' && subMatch) {
      const tenantId = subMatch[1];
      const { planTier, features, expiresAt } = req.data || {};
      const updated = mockFleetStore.overrideSubscription(tenantId, planTier, features, expiresAt);
      return {
        status: 200,
        data: {
          header: { success: true },
          body: updated,
        },
      };
    }

    // 6. PUT /api/v1/system/tenants/{id}/quotas
    const quotaMatch = path.match(/^\/api\/v1\/system\/tenants\/([^/]+)\/quotas$/);
    if (method === 'PUT' && quotaMatch) {
      const tenantId = quotaMatch[1];
      const updated = mockFleetStore.updateQuotas(tenantId, req.data || {});
      return {
        status: 200,
        data: {
          header: { success: true },
          body: updated,
        },
      };
    }

    // 7. POST /api/v1/system/tenants/{id}/assume
    const assumeMatch = path.match(/^\/api\/v1\/system\/tenants\/([^/]+)\/assume$/);
    if (method === 'POST' && assumeMatch) {
      const tenantId = assumeMatch[1];
      const durationMinutes = req.data?.durationMinutes || 60;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + durationMinutes * 60000).toISOString();

      const authorities = [
        'ROLE_SYSTEM_CUSTODIAN',
        'ROLE_ADMIN',
        'ROLE_USER',
        'METADATA_SCHEMA_READ',
        'METADATA_SCHEMA_WRITE',
        'METADATA_RECORD_READ',
        'METADATA_RECORD_WRITE',
      ];

      const ephemeralToken = createMockJwt({
        sub: 'custodian_root',
        username: 'custodian_root',
        roles: authorities,
        tenantId,
        tid: tenantId,
        actor_tid: 'SYSTEM',
        is_ephemeral_delegation: true,
        isSandbox: true,
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(now.getTime() / 1000) + durationMinutes * 60,
      });

      return {
        status: 200,
        data: {
          header: { success: true },
          body: {
            ephemeralToken,
            actorTenantId: 'SYSTEM',
            effectiveTenantId: tenantId,
            issuedAt: now.toISOString(),
            expiresAt,
            authorities,
            message: `Assume-Tenant ephemeral token active for ${durationMinutes} minutes.`,
          },
        },
      };
    }

    // 8. GET /api/v1/system/roles
    if (method === 'GET' && path === '/api/v1/system/roles') {
      return {
        status: 200,
        data: {
          header: { success: true },
          body: mockFleetStore.getRoles(),
        },
      };
    }

    // 8b. POST /api/v1/system/roles
    if (method === 'POST' && path === '/api/v1/system/roles') {
      try {
        const created = mockFleetStore.createRole(req.data || {});
        return {
          status: 200,
          data: {
            header: { success: true },
            body: created,
          },
        };
      } catch (err: any) {
        return {
          status: 400,
          data: {
            header: { success: false },
            message: err.message || 'Failed to create role',
          },
        };
      }
    }

    // 8c. DELETE /api/v1/system/roles/{id}
    const deleteRoleMatch = path.match(/^\/api\/v1\/system\/roles\/([^/]+)$/);
    if (method === 'DELETE' && deleteRoleMatch) {
      try {
        const roleId = deleteRoleMatch[1];
        const result = mockFleetStore.deleteRole(roleId);
        return {
          status: 200,
          data: {
            header: { success: true },
            body: result,
          },
        };
      } catch (err: any) {
        return {
          status: 400,
          data: {
            header: { success: false },
            message: err.message || 'Failed to delete role',
          },
        };
      }
    }

    // 8d. GET /api/v1/system/tenants/{tenantId}/roles
    const tenantRolesMatch = path.match(/^\/api\/v1\/system\/tenants\/([^/]+)\/roles$/);
    if (method === 'GET' && tenantRolesMatch) {
      const tenantId = tenantRolesMatch[1];
      const allRoles = mockFleetStore.getRoles();
      const filtered = allRoles.filter((r) => r.roleScope === 'TENANT' || r.tenantId === tenantId);
      return {
        status: 200,
        data: {
          header: { success: true },
          body: filtered,
        },
      };
    }

    // 8e. PUT /api/v1/system/tenants/{tenantId}/users/{userId}/delegation
    const delegationMatch = path.match(/^\/api\/v1\/system\/tenants\/([^/]+)\/users\/([^/]+)\/delegation$/);
    if (method === 'PUT' && delegationMatch) {
      try {
        const tenantId = delegationMatch[1];
        const userId = delegationMatch[2];
        const { roles, permissionOverrides, reason } = req.data || {};
        const result = mockFleetStore.delegateUser(
          tenantId,
          userId,
          roles || [],
          permissionOverrides || [],
          reason || 'Delegated via console'
        );
        return {
          status: 200,
          data: {
            header: { success: true },
            body: result,
          },
        };
      } catch (err: any) {
        return {
          status: 400,
          data: {
            header: { success: false },
            message: err.message || 'Failed to delegate user',
          },
        };
      }
    }

    // 9. PUT /api/v1/system/roles/{id}/permissions
    const rolePermMatch = path.match(/^\/api\/v1\/system\/roles\/([^/]+)\/permissions$/);
    if (method === 'PUT' && rolePermMatch) {
      const roleId = rolePermMatch[1];
      const { permissions, inheritedRoles } = req.data || {};
      const updated = mockFleetStore.updateRolePermissions(roleId, permissions, inheritedRoles);
      return {
        status: 200,
        data: {
          header: { success: true },
          body: updated,
        },
      };
    }

    // 10. GET /api/v1/system/users
    if (method === 'GET' && path === '/api/v1/system/users') {
      const search = url.searchParams.get('search') || undefined;
      const tenantId = url.searchParams.get('tenantId') || undefined;
      const users = mockFleetStore.getUsers(search, tenantId);
      return {
        status: 200,
        data: {
          header: { success: true },
          body: {
            content: users,
            totalElements: users.length,
            totalPages: 1,
            size: 20,
            number: 0,
          },
        },
      };
    }

    // 11. PUT /api/v1/system/users/{id}/lock
    const lockMatch = path.match(/^\/api\/v1\/system\/users\/([^/]+)\/lock$/);
    if (method === 'PUT' && lockMatch) {
      const userId = lockMatch[1];
      const { locked } = req.data || {};
      const updated = mockFleetStore.lockUser(userId, Boolean(locked));
      return {
        status: 200,
        data: {
          header: { success: true },
          body: updated,
        },
      };
    }

    // 12. GET /api/v1/system/audit/records
    if (method === 'GET' && path === '/api/v1/system/audit/records') {
      const tenantId = url.searchParams.get('tenantId') || 'SYSTEM';
      const operation = url.searchParams.get('operation') || undefined;
      const actor = url.searchParams.get('actor') || undefined;

      const mockAuditRecords = [
        {
          id: 101,
          tenantId: 'SYSTEM',
          recordId: 1,
          entityTypeId: 10,
          operation: 'CREATE',
          actor: 'custodian_root',
          version: 1,
          oldAttributes: null,
          newAttributes: { name: 'Customer Acme', code: 'CUST-001' },
          delta: { name: { old: null, new: 'Customer Acme' } },
          prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
          currentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          signature: 'sig_ed25519_mock_001',
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        },
        {
          id: 102,
          tenantId: 'tenant-us-east-1',
          recordId: 1,
          entityTypeId: 10,
          operation: 'UPDATE',
          actor: 'alice_admin',
          version: 2,
          oldAttributes: { name: 'Customer Acme', status: 'DRAFT' },
          newAttributes: { name: 'Customer Acme Inc', status: 'ACTIVE' },
          delta: { status: { old: 'DRAFT', new: 'ACTIVE' } },
          prevHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          currentHash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
          signature: 'sig_ed25519_mock_002',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 103,
          tenantId: 'tenant-us-east-1',
          recordId: 2,
          entityTypeId: 12,
          operation: 'CREATE',
          actor: 'bob_operator',
          version: 1,
          oldAttributes: null,
          newAttributes: { amount: 1500, currency: 'USD' },
          delta: { amount: { old: null, new: 1500 } },
          prevHash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
          currentHash: 'b5a2c96250612366ea8e479d617f3595ff4c94415b4c418b276f4581b453dd52',
          signature: 'sig_ed25519_mock_003',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ];

      const filtered = mockAuditRecords.filter((r) => {
        if (tenantId !== 'SYSTEM' && r.tenantId !== tenantId) return false;
        if (operation && r.operation.toUpperCase() !== operation.toUpperCase()) return false;
        if (actor && !r.actor.toLowerCase().includes(actor.toLowerCase())) return false;
        return true;
      });

      return {
        status: 200,
        data: {
          header: { success: true },
          body: {
            content: filtered,
            totalElements: filtered.length,
            totalPages: 1,
            page: 0,
            size: 25,
          },
        },
      };
    }

    // 13. POST /api/v1/system/audit/verify
    if (method === 'POST' && path === '/api/v1/system/audit/verify') {
      const { tenantId = 'SYSTEM' } = req.data || {};
      return {
        status: 200,
        data: {
          header: { success: true },
          body: {
            tenantId,
            verifiedCount: 3,
            intact: true,
            tamperedId: null,
            latestHash: 'b5a2c96250612366ea8e479d617f3595ff4c94415b4c418b276f4581b453dd52',
            message: 'Cryptographic forward-hash chain 100% intact across 3 verified blocks in sandbox',
          },
        },
      };
    }

    // 14. GET /api/v1/system/audit/export
    if (method === 'GET' && path === '/api/v1/system/audit/export') {
      const tenantId = url.searchParams.get('tenantId') || 'SYSTEM';
      return {
        status: 200,
        data: {
          header: { success: true },
          body: {
            tenantId,
            exportedAt: new Date().toISOString(),
            recordCount: 3,
            chainIntact: true,
            rootHash: 'b5a2c96250612366ea8e479d617f3595ff4c94415b4c418b276f4581b453dd52',
            records: [
              {
                id: 101,
                tenantId: 'SYSTEM',
                recordId: 1,
                entityTypeId: 10,
                operation: 'CREATE',
                actor: 'custodian_root',
                version: 1,
                delta: { name: { old: null, new: 'Customer Acme' } },
                prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
                currentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
              },
            ],
          },
        },
      };
    }

    return {
      status: 404,
      data: { header: { success: false, message: `System endpoint not found: ${method} ${path}` } },
    };
  },
};
