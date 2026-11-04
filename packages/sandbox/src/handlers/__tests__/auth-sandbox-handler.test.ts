import { describe, it, expect } from 'vitest';
import { authSandboxHandler, createMockJwt, SANDBOX_AUTH_USERS, SANDBOX_REFRESH_TOKENS } from '../auth-sandbox-handler';
import { decodeJwt } from '../../jwt';

describe('Auth Sandbox Handler Test Suite', () => {
  const createContext = (method: string, path: string, headers: Record<string, string> = {}) => ({
    pathname: path,
    method,
    headers,
    searchParams: new URLSearchParams(),
    url: path,
  });

  describe('Route Matcher', () => {
    it('matches /auth/token POST requests', () => {
      const ctx = createContext('POST', '/api/v1/auth/token');
      expect(authSandboxHandler.matcher(ctx)).toBe(true);
    });

    it('matches /auth/refresh POST requests', () => {
      const ctx = createContext('POST', '/auth/refresh');
      expect(authSandboxHandler.matcher(ctx)).toBe(true);
    });

    it('matches /auth/logout POST requests', () => {
      const ctx = createContext('POST', '/api/v1/auth/logout');
      expect(authSandboxHandler.matcher(ctx)).toBe(true);
    });

    it('matches /admin/dashboard GET requests', () => {
      const ctx = createContext('GET', '/admin/dashboard');
      expect(authSandboxHandler.matcher(ctx)).toBe(true);
    });

    it('returns false for unrelated endpoints or wrong HTTP methods', () => {
      expect(authSandboxHandler.matcher(createContext('GET', '/auth/token'))).toBe(false);
      expect(authSandboxHandler.matcher(createContext('POST', '/api/v1/records'))).toBe(false);
    });
  });

  describe('Login Flow (/auth/token)', () => {
    it('authenticates valid credentials for each sandbox user persona', async () => {
      for (const [username, expectedRoles] of Object.entries(SANDBOX_AUTH_USERS)) {
        const ctx = createContext('POST', '/api/v1/auth/token');
        const req = { url: '/api/v1/auth/token', method: 'POST', headers: {}, data: { username, password: 'bypass' } };

        const res = await authSandboxHandler.handler(req, ctx);
        expect(res?.status).toBe(200);
        expect(res?.data?.accessToken).toBeDefined();
        expect(res?.data?.refreshToken).toBeDefined();

        const decoded = decodeJwt(res?.data?.accessToken);
        expect(decoded?.roles).toEqual(expectedRoles);
        if (username === 'custodian_root' || username === 'system_bypass') {
          expect(decoded?.tenantId).toBe('SYSTEM');
        }
      }
    });

    it('handles stringified JSON request body gracefully', async () => {
      const ctx = createContext('POST', '/api/v1/auth/token');
      const req = {
        url: '/api/v1/auth/token',
        method: 'POST',
        headers: {},
        data: JSON.stringify({ userName: 'admin_bypass', password: 'bypass' }),
      };

      const res = await authSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.accessToken).toBeDefined();
    });

    it('rejects invalid credentials with 401 Unauthorized', async () => {
      const ctx = createContext('POST', '/api/v1/auth/token');
      const req = {
        url: '/api/v1/auth/token',
        method: 'POST',
        headers: {},
        data: { username: 'unknown_user', password: 'wrong_password' },
      };

      const res = await authSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(401);
      expect(res?.data?.message).toBe('Bad credentials');
    });
  });

  describe('Token Refresh Flow (/auth/refresh)', () => {
    it('refreshes token for valid refresh tokens', async () => {
      for (const token of Object.keys(SANDBOX_REFRESH_TOKENS)) {
        const ctx = createContext('POST', '/api/v1/auth/refresh');
        const req = { url: '/api/v1/auth/refresh', method: 'POST', headers: {}, data: { refreshToken: token } };

        const res = await authSandboxHandler.handler(req, ctx);
        expect(res?.status).toBe(200);
        expect(res?.data?.accessToken).toBeDefined();
        expect(res?.data?.refreshToken).toBe(token);
      }
    });

    it('rejects invalid or missing refresh token with 401', async () => {
      const ctx = createContext('POST', '/api/v1/auth/refresh');
      const req = {
        url: '/api/v1/auth/refresh',
        method: 'POST',
        headers: {},
        data: { refreshToken: 'invalid_refresh_token' },
      };

      const res = await authSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(401);
      expect(res?.data?.message).toBe('Invalid refresh token');
    });
  });

  describe('Logout Flow (/auth/logout)', () => {
    it('returns success 200 on logout', async () => {
      const ctx = createContext('POST', '/api/v1/auth/logout');
      const req = { url: '/api/v1/auth/logout', method: 'POST', headers: {} };

      const res = await authSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.message).toBe('Successfully logged out');
    });
  });

  describe('Protected Dashboard Route (/admin/dashboard)', () => {
    it('rejects request with missing or non-Bearer authorization header', async () => {
      const ctx = createContext('GET', '/admin/dashboard');
      const req = { url: '/admin/dashboard', method: 'GET', headers: {} };

      const res = await authSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(401);
      expect(res?.data?.message).toBe('Missing token');
    });

    it('rejects expired token with 401', async () => {
      const expiredToken = createMockJwt({
        sub: 'admin',
        roles: ['ROLE_ADMIN'],
        exp: Math.floor(Date.now() / 1000) - 100,
      });

      const ctx = createContext('GET', '/admin/dashboard', { authorization: `Bearer ${expiredToken}` });
      const req = { url: '/admin/dashboard', method: 'GET', headers: { authorization: `Bearer ${expiredToken}` } };

      const res = await authSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(401);
      expect(res?.data?.message).toBe('Token expired');
    });

    it('rejects non-admin role with 403 Forbidden', async () => {
      const userToken = createMockJwt({
        sub: 'standard_user',
        roles: ['ROLE_STANDARD_MEMBER'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const ctx = createContext('GET', '/admin/dashboard', { authorization: `Bearer ${userToken}` });
      const req = { url: '/admin/dashboard', method: 'GET', headers: { authorization: `Bearer ${userToken}` } };

      const res = await authSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(403);
      expect(res?.data?.message).toBe('Forbidden');
    });

    it('allows access for admin role with 200 and metrics', async () => {
      const adminToken = createMockJwt({
        sub: 'admin',
        roles: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const ctx = createContext('GET', '/admin/dashboard', { authorization: `Bearer ${adminToken}` });
      const req = { url: '/admin/dashboard', method: 'GET', headers: { authorization: `Bearer ${adminToken}` } };

      const res = await authSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.message).toContain('Welcome to the Secure Admin Dashboard');
      expect(res?.data?.stats).toBeDefined();
    });

    it('returns authentication profile for /auth/me', async () => {
      const token = createMockJwt({
        sub: 'custodian_root',
        roles: ['ROLE_SYSTEM_ROOT'],
        tenantId: 'SYSTEM',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const ctx = createContext('GET', '/api/auth/me', { authorization: `Bearer ${token}` });
      const req = { url: '/api/auth/me', method: 'GET', headers: { authorization: `Bearer ${token}` } };

      const res = await authSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.username).toBe('custodian_root');
      expect(res?.data?.isSovereign).toBe(true);
      expect(res?.data?.roles).toContain('ROLE_SYSTEM_ROOT');
      expect(res?.data?.permissions).toContain('entity:record:read');
      expect(res?.data?.permissions).toContain('metadata:schema:write');
    });

    it('retrieves and updates user profile via /user/profile', async () => {
      const getCtx = createContext('GET', '/api/v1/user/profile');
      const getReq = { url: '/api/v1/user/profile', method: 'GET', headers: {} };
      const getRes = await authSandboxHandler.handler(getReq, getCtx);
      expect(getRes?.status).toBe(200);
      expect(getRes?.data?.username).toBeDefined();

      const putCtx = createContext('PUT', '/api/v1/user/profile');
      const putReq = {
        url: '/api/v1/user/profile',
        method: 'PUT',
        headers: {},
        data: { firstName: 'UpdatedAlice', phoneNumber: '+1-555-9999' },
      };
      const putRes = await authSandboxHandler.handler(putReq, putCtx);
      expect(putRes?.status).toBe(200);
      expect(putRes?.data?.firstName).toBe('UpdatedAlice');
      expect(putRes?.data?.phoneNumber).toBe('+1-555-9999');
    });

    it('returns 404 for unhandled paths inside auth handler', async () => {
      const ctx = createContext('PUT', '/unknown-route');
      const req = { url: '/unknown-route', method: 'PUT', headers: {} };

      const res = await authSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(404);
    });
  });
});
