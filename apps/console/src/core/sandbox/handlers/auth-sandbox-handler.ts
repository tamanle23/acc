import type { SandboxRouteHandler, SandboxRequest } from '../types';
import { decodeJwt } from '../../../features/spring-auth/utils/jwt';

// Helper to base64 encode without padding/symbols standard for JWTs
const b64 = (str: string) =>
  btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const createMockJwt = (payload: Record<string, unknown>) => {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify(payload));
  const signature = b64('mock_signature');
  return `${header}.${body}.${signature}`;
};

export const SANDBOX_AUTH_USERS: Record<string, string[]> = {
  custodian_root: ['ROLE_SYSTEM_ROOT', 'ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
  support_ops: ['ROLE_SYSTEM_SUPPORT'],
  system_verifier: ['ROLE_SYSTEM_VERIFIER'],
  system_approver: ['ROLE_SYSTEM_APPROVER'],
  system_bypass: ['ROLE_SYSTEM_ROOT'],
  admin_bypass: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER', 'ROLE_ADMIN'],
  creator_bypass: ['ROLE_OPERATIONS_MANAGER', 'ROLE_STANDARD_MEMBER'],
  user_bypass: ['ROLE_STANDARD_MEMBER'],
  custom_bypass: ['ROLE_STANDARD_MEMBER'],
};

export const SANDBOX_REFRESH_TOKENS: Record<string, string[]> = {
  mock_refresh_token_custodian: ['ROLE_SYSTEM_ROOT'],
  mock_refresh_token_support: ['ROLE_SYSTEM_SUPPORT'],
  mock_refresh_token_verifier: ['ROLE_SYSTEM_VERIFIER'],
  mock_refresh_token_approver: ['ROLE_SYSTEM_APPROVER'],
  mock_refresh_token_system: ['ROLE_SYSTEM_ROOT'],
  mock_refresh_token_admin: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
  mock_refresh_token_creator: ['ROLE_OPERATIONS_MANAGER', 'ROLE_STANDARD_MEMBER'],
  mock_refresh_token_user: ['ROLE_STANDARD_MEMBER'],
  mock_refresh_token_custom: ['ROLE_STANDARD_MEMBER'],
};

export const authSandboxHandler: SandboxRouteHandler = {
  id: 'auth-sandbox-handler',
  name: 'Spring Security Auth Sandbox',
  description: 'Handles /auth/token, /auth/refresh, /auth/logout, signup, otp, passkey, and password rotation in sandbox mode',
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
    if (cleanPath === '/auth/logout' && ctx.method === 'POST') {
      return isMockToken || true;
    }
    if ((cleanPath === '/auth/signup/person' || cleanPath === '/auth/signup') && ctx.method === 'POST') {
      return true;
    }
    if (cleanPath === '/auth/verify-otp' && ctx.method === 'POST') {
      return true;
    }
    if (cleanPath === '/auth/resend-otp' && ctx.method === 'POST') {
      return true;
    }
    if (cleanPath === '/auth/passkey/login/options' && ctx.method === 'POST') {
      return true;
    }
    if (cleanPath === '/auth/passkey/login/verify' && ctx.method === 'POST') {
      return true;
    }
    if (cleanPath === '/auth/password/rotate' && ctx.method === 'POST') {
      return true;
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

      if (username in SANDBOX_AUTH_USERS && password === 'bypass') {
        const roles = SANDBOX_AUTH_USERS[username];
        const sub = username.split('_')[0];

        let tenantId = 'tenant-acme';
        if (username === 'custodian_root' || username === 'system_bypass') {
          tenantId = 'SYSTEM';
        } else if (username === 'custom_bypass') {
          tenantId = 'tenant-us-east-1';
        }

        const token = createMockJwt({
          sub,
          roles,
          tenantId,
          isSandbox: true,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 60 * 15,
        });

        return {
          status: 200,
          statusText: 'OK',
          data: { accessToken: token, refreshToken: `mock_refresh_token_${sub}` },
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
        const sub = refreshToken.split('_').pop();
        let tenantId = 'tenant-acme';
        if (sub === 'custodian' || sub === 'root' || sub === 'system') {
          tenantId = 'SYSTEM';
        } else if (sub === 'custom') {
          tenantId = 'tenant-us-east-1';
        }

        const token = createMockJwt({
          sub,
          roles,
          tenantId,
          isSandbox: true,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 60 * 15,
        });

        return {
          status: 200,
          statusText: 'OK',
          data: { accessToken: token, refreshToken },
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

    // 4. Mock Protected Endpoint (/admin/dashboard)
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

      if (!decoded || decoded.exp * 1000 < Date.now()) {
        return {
          status: 401,
          statusText: 'Unauthorized',
          data: { message: 'Token expired' },
        };
      }

      if (!decoded.roles.includes('ROLE_ADMIN')) {
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

    // 5. Mock Sign-up Person (/auth/signup/person or /auth/signup)
    if ((cleanPath === '/auth/signup/person' || cleanPath === '/auth/signup') && ctx.method === 'POST') {
      const email = body.email || 'newuser@unipost.io';
      return {
        status: 201,
        statusText: 'Created',
        data: {
          success: true,
          email,
          requiresOtp: true,
          tenantId: 'usr-sandbox-' + Math.random().toString(36).substring(2, 9),
          message: 'Account registered. Verification code sent to email.',
        },
      };
    }

    // 6. Mock Verify OTP (/auth/verify-otp)
    if (cleanPath === '/auth/verify-otp' && ctx.method === 'POST') {
      const otp = body.otp;
      if (otp === '000000') {
        return {
          status: 400,
          statusText: 'Bad Request',
          data: { message: 'Invalid or expired verification code' },
        };
      }
      const token = createMockJwt({
        sub: 'usr-new-person',
        roles: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
        tenantId: 'usr-tenant-person',
        isSandbox: true,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 15,
      });
      return {
        status: 200,
        statusText: 'OK',
        data: {
          accessToken: token,
          refreshToken: 'mock_refresh_token_person',
          user: {
            id: 'usr-new-person',
            email: body.email || 'user@example.com',
            roles: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
          },
        },
      };
    }

    // 7. Mock Resend OTP (/auth/resend-otp)
    if (cleanPath === '/auth/resend-otp' && ctx.method === 'POST') {
      return {
        status: 200,
        statusText: 'OK',
        data: { success: true, message: 'New code sent' },
      };
    }

    // 8. Mock Passkey Options (/auth/passkey/login/options)
    if (cleanPath === '/auth/passkey/login/options' && ctx.method === 'POST') {
      return {
        status: 200,
        statusText: 'OK',
        data: {
          challenge: 'mock-challenge-fido2-base64',
          rpId: window.location.hostname || 'localhost',
          allowCredentials: [],
          timeout: 60000,
          userVerification: 'preferred',
        },
      };
    }

    // 9. Mock Passkey Verify (/auth/passkey/login/verify)
    if (cleanPath === '/auth/passkey/login/verify' && ctx.method === 'POST') {
      const token = createMockJwt({
        sub: 'usr-custodian-root',
        roles: ['ROLE_SYSTEM_ROOT'],
        tenantId: 'SYSTEM',
        isSandbox: true,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 15,
      });
      return {
        status: 200,
        statusText: 'OK',
        data: {
          accessToken: token,
          refreshToken: 'mock_refresh_token_custodian',
        },
      };
    }

    // 10. Mock Password Rotate (/auth/password/rotate)
    if (cleanPath === '/auth/password/rotate' && ctx.method === 'POST') {
      return {
        status: 200,
        statusText: 'OK',
        data: { success: true, message: 'Password rotated successfully' },
      };
    }

    return {
      status: 404,
      statusText: 'Not Found',
      data: { message: 'Route not found in auth sandbox' },
    };
  },
};
