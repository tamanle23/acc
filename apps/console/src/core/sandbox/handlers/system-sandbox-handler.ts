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
    roleId: 'ROLE_SYSTEM_CUSTODIAN',
    roleName: 'Sovereign Custodian',
    description: 'Ultimate sovereign authority across all tenants and infrastructure.',
    systemRole: true,
    permissions: [
      'platform:fleet:read',
      'platform:fleet:mutate',
      'platform:tenant:assume',
      'platform:quotas:override',
      'platform:roles:manage',
      'platform:users:lock',
      'METADATA_SCHEMA_READ',
      'METADATA_SCHEMA_WRITE',
      'METADATA_RECORD_READ',
      'METADATA_RECORD_WRITE',
    ],
    inheritedRoles: ['ROLE_ADMIN', 'ROLE_USER'],
    userCount: 1,
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    roleId: 'ROLE_ADMIN',
    roleName: 'Organization Admin',
    description: 'Tenant administrator with workspace, schema, and billing authority.',
    systemRole: true,
    permissions: [
      'METADATA_SCHEMA_READ',
      'METADATA_SCHEMA_WRITE',
      'METADATA_RECORD_READ',
      'METADATA_RECORD_WRITE',
      'TENANT_SETTINGS_MANAGE',
      'BILLING_MANAGE',
    ],
    inheritedRoles: ['ROLE_USER'],
    userCount: 12,
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    roleId: 'ROLE_USER',
    roleName: 'Standard Member',
    description: 'Standard member with data record read/write access.',
    systemRole: true,
    permissions: ['METADATA_SCHEMA_READ', 'METADATA_RECORD_READ', 'METADATA_RECORD_WRITE'],
    inheritedRoles: [],
    userCount: 148,
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    roleId: 'ROLE_READONLY',
    roleName: 'Auditor / Read-Only',
    description: 'Restricted view-only role for compliance and audits.',
    systemRole: false,
    permissions: ['METADATA_SCHEMA_READ', 'METADATA_RECORD_READ'],
    inheritedRoles: [],
    userCount: 5,
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
      permissions: role.permissions || [],
      inheritedRoles: role.inheritedRoles || ['ROLE_USER'],
      userCount: 0,
      createdDate: new Date().toISOString(),
    };

    this.roles.push(newRole);
    return newRole;
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

    return {
      status: 404,
      data: { header: { success: false, message: `System endpoint not found: ${method} ${path}` } },
    };
  },
};
