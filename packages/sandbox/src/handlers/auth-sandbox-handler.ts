import type { SandboxRouteHandler, SandboxRequest, SandboxPersona } from '../types';
import { decodeJwt } from '../jwt';
import { DEFAULT_SANDBOX_PERSONAS } from '../store';

// Helper to base64 encode without padding/symbols standard for JWTs
const b64 = (str: string) => {
  if (typeof btoa === 'function') {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const createMockJwt = (payload: Record<string, unknown>) => {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify(payload));
  const signature = b64('mock_signature');
  return `${header}.${body}.${signature}`;
};

export function resolveSandboxPersona(input?: string | null): SandboxPersona | undefined {
  if (!input) return undefined;
  const normalized = input.trim().toLowerCase();
  for (const persona of Object.values(DEFAULT_SANDBOX_PERSONAS)) {
    if (persona.id.toLowerCase() === normalized) return persona;
    if (persona.username.toLowerCase() === normalized) return persona;
    if (persona.aliases?.some((a) => a.toLowerCase() === normalized)) return persona;
  }
  return undefined;
}

export const SANDBOX_AUTH_USERS: Record<string, string[]> = {
  // Admin & aliases
  'admin@acc.io': ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER', 'ROLE_ADMIN'],
  admin_bypass: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER', 'ROLE_ADMIN'],
  admin: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER', 'ROLE_ADMIN'],
  'tenant-admin': ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER', 'ROLE_ADMIN'],

  // Sovereign Custodian & aliases
  'custodian@system': ['ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
  custodian_root: ['ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
  system: ['ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
  'sovereign-custodian@acc.io': ['ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
  'system-custodian': ['ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
  system_bypass: ['ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],

  // Operations Manager (Creator) & aliases
  'creator@acc.io': ['ROLE_OPERATIONS_MANAGER', 'ROLE_STANDARD_MEMBER'],
  creator_bypass: ['ROLE_OPERATIONS_MANAGER', 'ROLE_STANDARD_MEMBER'],
  creator: ['ROLE_OPERATIONS_MANAGER', 'ROLE_STANDARD_MEMBER'],
  'tenant-creator': ['ROLE_OPERATIONS_MANAGER', 'ROLE_STANDARD_MEMBER'],

  // Standard Member (User) & aliases
  'user@acc.io': ['ROLE_STANDARD_MEMBER'],
  user_bypass: ['ROLE_STANDARD_MEMBER'],
  user: ['ROLE_STANDARD_MEMBER'],
  'tenant-user': ['ROLE_STANDARD_MEMBER'],

  // Custom persona & aliases
  'custom@acc.io': ['ROLE_STANDARD_MEMBER'],
  custom_bypass: ['ROLE_STANDARD_MEMBER'],
  custom: ['ROLE_STANDARD_MEMBER'],
};

export const SANDBOX_REFRESH_TOKENS: Record<string, string[]> = {
  mock_refresh_token_custodian: ['ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
  mock_refresh_token_system: ['ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
  mock_refresh_token_admin: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER', 'ROLE_ADMIN'],
  mock_refresh_token_creator: ['ROLE_OPERATIONS_MANAGER', 'ROLE_STANDARD_MEMBER'],
  mock_refresh_token_user: ['ROLE_STANDARD_MEMBER'],
  mock_refresh_token_custom: ['ROLE_STANDARD_MEMBER'],
};

const CANONICAL_ROLE_PERMISSIONS: Record<string, string[]> = {
  ROLE_SYSTEM_ROOT: [
    'platform:fleet:read',
    'platform:fleet:mutate',
    'platform:fleet:trip_circuit',
    'platform:tenant:assume',
    'platform:tenant:purge',
    'platform:quotas:manage',
    'platform:roles:manage',
    'platform:users:manage',
    'platform:dlq:manage',
    'platform:workers:manage',
    'metadata:schema:read',
    'metadata:schema:write',
    'metadata:blueprint:package',
    'metadata:blueprint:provision',
    'metadata:cache:evict',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'entity:record:delete',
    'entity:record:export',
    'workspace:settings:read',
    'workspace:settings:manage',
    'workspace:members:read',
    'workspace:members:manage',
    'workflow:definition:read',
    'workflow:definition:manage',
    'workflow:execution:read',
    'workflow:execution:submit',
    'workflow:approval:execute',
    'audit:log:read',
    'audit:hash:verify',
    'audit:compliance:export',
    'billing:subscription:read',
    'billing:subscription:upgrade',
    'billing:tier:override',
    'billing:invoice:adjust',
  ],
  ROLE_SYSTEM_SUPPORT: [
    'platform:fleet:read',
    'platform:tenant:assume',
    'platform:dlq:manage',
    'metadata:schema:read',
    'entity:record:read',
    'workspace:settings:read',
    'workspace:members:read',
    'audit:log:read',
  ],
  ROLE_WORKSPACE_OWNER: [
    'workspace:settings:read',
    'workspace:settings:manage',
    'workspace:members:read',
    'workspace:members:manage',
    'metadata:schema:read',
    'metadata:schema:write',
    'metadata:blueprint:provision',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'entity:record:delete',
    'entity:record:export',
    'workflow:definition:read',
    'workflow:definition:manage',
    'workflow:execution:read',
    'workflow:execution:submit',
    'workflow:approval:execute',
    'audit:log:read',
    'billing:subscription:read',
    'billing:subscription:upgrade',
  ],
  ROLE_OPERATIONS_MANAGER: [
    'workspace:settings:read',
    'metadata:schema:read',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'entity:record:delete',
    'entity:record:export',
    'workflow:definition:read',
    'workflow:execution:read',
    'workflow:execution:submit',
    'workflow:approval:execute',
    'audit:log:read',
  ],
  ROLE_STANDARD_MEMBER: [
    'workspace:settings:read',
    'entity:record:read',
    'entity:record:create',
    'entity:record:update',
    'workflow:execution:read',
    'workflow:execution:submit',
  ],
  ROLE_AUDITOR: [
    'workspace:settings:read',
    'workspace:members:read',
    'metadata:schema:read',
    'entity:record:read',
    'audit:log:read',
    'audit:hash:verify',
    'audit:compliance:export',
  ],
};

const mockUserProfileState: Record<string, any> = {
  firstName: 'Sandbox',
  lastName: 'User',
  email: 'user@acc.local',
  phoneNumber: '+1-555-0199',
  preferences: {
    language: 'en',
    avatarUrl: '/avatars/shadcn.jpg',
    bio: 'Unified Sandbox Simulated Profile',
    urls: [{ value: 'https://acc.io' }],
  },
};

export const authSandboxHandler: SandboxRouteHandler = {
  id: 'auth-sandbox-handler',
  name: 'Spring Security Auth Sandbox',
  description: 'Handles /auth/token, /auth/refresh, /auth/me, /auth/logout, and /user/profile in sandbox mode',
  priority: 100,
  matcher: (ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api|v1)/, '');
    const isMockRequest = ctx.headers['x-sandbox-mock'] === 'true';
    const authHeader = ctx.headers['authorization'];
    const isMockToken = Boolean(authHeader && authHeader.includes('mock_signature'));

    if (cleanPath === '/auth/token' && ctx.method === 'POST') {
      return isMockRequest || true;
    }
    if (cleanPath === '/auth/refresh' && ctx.method === 'POST') {
      return true;
    }
    if (cleanPath === '/auth/me' && ctx.method === 'GET') {
      return true;
    }
    if ((cleanPath === '/user/profile' || cleanPath === '/v1/user/profile') && (ctx.method === 'GET' || ctx.method === 'PUT')) {
      return true;
    }
    if (cleanPath === '/auth/logout' && ctx.method === 'POST') {
      return isMockToken || true;
    }
    if (cleanPath === '/admin/dashboard' && ctx.method === 'GET') {
      return true;
    }

    return false;
  },
  handler: async (req: SandboxRequest, ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api|v1)/, '');
    let body: Record<string, any> = {};
    try {
      body = typeof req.data === 'string' ? JSON.parse(req.data) : (req.data || {});
    } catch {
      body = req.data || {};
    }

    // 1. Mock Login (/auth/token)
    if (cleanPath === '/auth/token' && ctx.method === 'POST') {
      const username = body.username || body.userName;
      const password = body.password;

      const persona = resolveSandboxPersona(username);
      const isAllowedPassword = password === 'bypass' || password === 'password';

      if (persona && isAllowedPassword) {
        const roles = persona.roles;
        const sub = persona.username;
        const tenantId = persona.defaultTenantId;
        const isSovereign = tenantId === 'SYSTEM';

        const token = createMockJwt({
          sub,
          personaId: persona.id,
          uid: persona.uid,
          roles,
          tenantId,
          isSandbox: true,
          isSovereign,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 60 * 15,
        });

        const refreshKey = `mock_refresh_token_${persona.id}`;

        return {
          status: 200,
          statusText: 'OK',
          data: {
            accessToken: token,
            refreshToken: refreshKey,
            body: {
              accessToken: token,
              refreshToken: refreshKey,
            },
          },
        };
      }

      return {
        status: 401,
        statusText: 'Unauthorized',
        data: { message: 'Bad credentials' },
      };
    }

    // 2. Mock Refresh (/auth/refresh)
    if (cleanPath === '/auth/refresh' && ctx.method === 'POST') {
      const refreshToken = body.refreshToken;
      if (refreshToken && refreshToken in SANDBOX_REFRESH_TOKENS) {
        const roles = SANDBOX_REFRESH_TOKENS[refreshToken];
        const rawKey = refreshToken.replace('mock_refresh_token_', '');
        const persona = resolveSandboxPersona(rawKey) || DEFAULT_SANDBOX_PERSONAS.admin;
        const sub = persona.username;
        const tenantId = persona.defaultTenantId;
        const isSovereign = tenantId === 'SYSTEM';

        const token = createMockJwt({
          sub,
          personaId: persona.id,
          uid: persona.uid,
          roles,
          tenantId,
          isSandbox: true,
          isSovereign,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 60 * 15,
        });

        return {
          status: 200,
          statusText: 'OK',
          data: {
            accessToken: token,
            refreshToken,
            body: {
              accessToken: token,
              refreshToken,
            },
          },
        };
      }

      return {
        status: 401,
        statusText: 'Unauthorized',
        data: { message: 'Invalid refresh token' },
      };
    }

    // 3. Mock Logout (/auth/logout)
    if (cleanPath === '/auth/logout' && ctx.method === 'POST') {
      return {
        status: 200,
        statusText: 'OK',
        data: { message: 'Successfully logged out' },
      };
    }

    // 4. Mock Current Session Profile (/auth/me)
    if (cleanPath === '/auth/me' && ctx.method === 'GET') {
      const authHeader = ctx.headers['authorization'];
      let decoded: any = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        decoded = decodeJwt(authHeader.split(' ')[1]);
      }
      const rawUser = decoded?.sub || decoded?.personaId || 'admin@acc.io';
      const persona = resolveSandboxPersona(rawUser) || DEFAULT_SANDBOX_PERSONAS.admin;

      const username = decoded?.sub || persona.username;
      const tenantId = decoded?.tenantId || persona.defaultTenantId;
      const roles: string[] = decoded?.roles || persona.roles;
      const isSovereign = roles.includes('ROLE_SYSTEM_ROOT') || tenantId === 'SYSTEM';

      const permSet = new Set<string>();
      for (const r of roles) {
        const perms = CANONICAL_ROLE_PERMISSIONS[r] || [];
        perms.forEach((p) => permSet.add(p));
      }
      persona.permissions?.forEach((p) => permSet.add(p));

      const profileData = {
        userId: persona.uid || `usr-${persona.id}`,
        username,
        tenantId,
        isSovereign,
        sovereign: isSovereign,
        roles,
        permissions: Array.from(permSet),
        activeFeatures: ['auth', 'metadata', 'users', 'tasks'],
      };

      return {
        status: 200,
        statusText: 'OK',
        data: {
          ...profileData,
          body: profileData,
        },
      };
    }

    // 5. Mock User Profile (/v1/user/profile or /user/profile)
    if ((cleanPath === '/user/profile' || cleanPath === '/v1/user/profile') && ctx.method === 'GET') {
      const authHeader = ctx.headers['authorization'];
      let decoded: any = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        decoded = decodeJwt(authHeader.split(' ')[1]);
      }
      const rawUser = decoded?.sub || decoded?.personaId || 'admin@acc.io';
      const persona = resolveSandboxPersona(rawUser) || DEFAULT_SANDBOX_PERSONAS.admin;

      const profileRes = {
        userId: persona.uid || `usr-${persona.id}`,
        username: persona.username,
        ...mockUserProfileState,
        email: persona.username,
      };

      return {
        status: 200,
        statusText: 'OK',
        data: {
          ...profileRes,
          body: profileRes,
        },
      };
    }

    if ((cleanPath === '/user/profile' || cleanPath === '/v1/user/profile') && ctx.method === 'PUT') {
      const authHeader = ctx.headers['authorization'];
      let decoded: any = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        decoded = decodeJwt(authHeader.split(' ')[1]);
      }
      const username = decoded?.sub || 'custodian_root';

      if (body.firstName !== undefined) mockUserProfileState.firstName = body.firstName;
      if (body.lastName !== undefined) mockUserProfileState.lastName = body.lastName;
      if (body.email !== undefined) mockUserProfileState.email = body.email;
      if (body.phoneNumber !== undefined) mockUserProfileState.phoneNumber = body.phoneNumber;
      if (body.preferences !== undefined) {
        mockUserProfileState.preferences = {
          ...mockUserProfileState.preferences,
          ...body.preferences,
        };
      }

      return {
        status: 200,
        statusText: 'OK',
        data: {
          userId: `usr-${username}`,
          username,
          ...mockUserProfileState,
        },
      };
    }

    // 6. Mock Protected Endpoint (/admin/dashboard)
    if (cleanPath === '/admin/dashboard' && ctx.method === 'GET') {
      const authHeader = ctx.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          status: 401,
          statusText: 'Unauthorized',
          data: { message: 'Missing token' },
        };
      }

      const token = authHeader.split(' ')[1];
      const decoded = decodeJwt(token);

      if (!decoded || !decoded.exp || decoded.exp * 1000 < Date.now()) {
        return {
          status: 401,
          statusText: 'Unauthorized',
          data: { message: 'Token expired' },
        };
      }

      const hasAdminRole =
        decoded.roles?.includes('ROLE_ADMIN') ||
        decoded.roles?.includes('ROLE_WORKSPACE_OWNER') ||
        decoded.roles?.includes('ROLE_SYSTEM_ROOT');

      if (!hasAdminRole) {
        return {
          status: 403,
          statusText: 'Forbidden',
          data: { message: 'Forbidden' },
        };
      }

      return {
        status: 200,
        statusText: 'OK',
        data: {
          message: 'Welcome to the Secure Admin Dashboard',
          stats: { users: 124, revenue: 8430 },
        },
      };
    }

    return {
      status: 404,
      statusText: 'Not Found',
      data: { message: 'Route not found in auth sandbox' },
    };
  },
};
