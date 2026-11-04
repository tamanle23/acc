import { describe, test, expect, beforeEach } from 'bun:test';
import {
  authSandboxHandler,
  createMockJwt,
  SANDBOX_AUTH_USERS,
  SANDBOX_REFRESH_TOKENS,
  defaultSandboxStore,
} from '../packages/sandbox/src';

/**
 * Formal Verification Suite: Canonical Authorization & User Profile Architecture
 * Target: packages/client/src/contracts/auth.ts, packages/client/src/contracts/users.ts, packages/sandbox/src/handlers/auth-sandbox-handler.ts
 * Standards: UNIFIED-SANDBOX-PLATFORM-MANDATE, Single Source of Truth (SSOT), Zero-Stub Prohibition
 */
describe('Canonical Authorization & User Profile Architecture', () => {
  const createContext = (method: string, path: string, headers: Record<string, string> = {}) => ({
    pathname: path,
    method,
    headers,
    searchParams: new URLSearchParams(),
    url: path,
  });

  beforeEach(() => {
    defaultSandboxStore.resetToDefaults();
  });

  test('SANDBOX_AUTH_USERS and REFRESH_TOKENS strictly adhere to canonical roles', () => {
    const validCanonicalRoles = new Set([
      'ROLE_SYSTEM_ROOT',
      'ROLE_SYSTEM_SUPPORT',
      'ROLE_WORKSPACE_OWNER',
      'ROLE_OPERATIONS_MANAGER',
      'ROLE_STANDARD_MEMBER',
      'ROLE_AUDITOR',
    ]);

    for (const [user, roles] of Object.entries(SANDBOX_AUTH_USERS)) {
      for (const role of roles) {
        expect(validCanonicalRoles.has(role)).toBe(true);
      }
    }

    for (const [token, roles] of Object.entries(SANDBOX_REFRESH_TOKENS)) {
      for (const role of roles) {
        expect(validCanonicalRoles.has(role)).toBe(true);
      }
    }
  });

  test('GET /api/auth/me returns strongly typed AuthenticationProfile with canonical permission atoms', async () => {
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

    const profile = res?.data;
    expect(profile.userId).toBe('usr-custodian_root');
    expect(profile.username).toBe('custodian_root');
    expect(profile.tenantId).toBe('SYSTEM');
    expect(profile.isSovereign).toBe(true);
    expect(profile.roles).toContain('ROLE_SYSTEM_ROOT');

    // Verify canonical atoms across multiple planes
    expect(profile.permissions).toContain('platform:fleet:read');
    expect(profile.permissions).toContain('metadata:schema:read');
    expect(profile.permissions).toContain('entity:record:read');
    expect(profile.permissions).toContain('workspace:settings:manage');
    expect(profile.permissions).toContain('workflow:execution:submit');
    expect(profile.permissions).toContain('audit:log:read');
    expect(profile.permissions).toContain('billing:subscription:read');

    // Ensure legacy string constants and Quorum atoms do not exist
    expect(profile.permissions).not.toContain('METADATA_RECORD_READ');
    expect(profile.permissions).not.toContain('METADATA_SCHEMA_WRITE');
    expect(profile.permissions).not.toContain('platform:workflow:verify');
  });

  test('GET /api/v1/user/profile and PUT /api/v1/user/profile handle self-service profile and preferences', async () => {
    const token = createMockJwt({
      sub: 'engineer_alice',
      roles: ['ROLE_WORKSPACE_OWNER'],
      tenantId: 'tenant-acme',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const getCtx = createContext('GET', '/api/v1/user/profile', { authorization: `Bearer ${token}` });
    const getReq = { url: '/api/v1/user/profile', method: 'GET', headers: { authorization: `Bearer ${token}` } };

    const getRes = await authSandboxHandler.handler(getReq, getCtx);
    expect(getRes?.status).toBe(200);
    expect(getRes?.data?.username).toBe('engineer_alice');
    expect(getRes?.data?.preferences).toBeDefined();

    // Mutate profile and UI preferences
    const putCtx = createContext('PUT', '/api/v1/user/profile', { authorization: `Bearer ${token}` });
    const putReq = {
      url: '/api/v1/user/profile',
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
      data: {
        firstName: 'Alice',
        lastName: 'Wonderland',
        phoneNumber: '+84988123456',
        preferences: {
          language: 'vi',
          bio: 'Principal Architect at Acc Logistics',
          avatarUrl: '/avatars/alice.png',
        },
      },
    };

    const putRes = await authSandboxHandler.handler(putReq, putCtx);
    expect(putRes?.status).toBe(200);
    expect(putRes?.data?.firstName).toBe('Alice');
    expect(putRes?.data?.lastName).toBe('Wonderland');
    expect(putRes?.data?.phoneNumber).toBe('+84988123456');
    expect(putRes?.data?.preferences?.language).toBe('vi');
    expect(putRes?.data?.preferences?.bio).toBe('Principal Architect at Acc Logistics');
  });
});
