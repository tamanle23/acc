import { describe, it, expect, beforeEach } from 'vitest';
import { useSpringAuthStore } from '../store';

describe('useSpringAuthStore', () => {
  beforeEach(() => {
    useSpringAuthStore.getState().clearTokens();
    useSpringAuthStore.getState().setHydrating(false);
  });

  const createMockToken = (payload: Record<string, unknown>, isMockSig = false) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.${isMockSig ? 'mock_signature' : 'valid_sig'}`;
  };

  it('initializes in unauthenticated state after clearTokens', () => {
    const state = useSpringAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.currentTenantId).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isSandbox).toBe(false);
  });

  it('treats tokens as opaque credentials and sets session via setUser', () => {
    const access = 'mock.access.token.mock_signature';
    const refresh = 'mock_refresh_token_12345';

    useSpringAuthStore.getState().setTokens(access, refresh);

    let state = useSpringAuthStore.getState();
    expect(state.accessToken).toBe(access);
    expect(state.refreshToken).toBe(refresh);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isSandbox).toBe(true);

    useSpringAuthStore.getState().setUser({
      userId: 'custodian_1',
      username: 'custodian_root',
      roles: ['ROLE_SYSTEM_ROOT'],
      tenantId: 'SYSTEM',
      isSovereign: true,
      permissions: ['platform:fleet:read'],
      activeFeatures: ['auth'],
    });

    state = useSpringAuthStore.getState();
    expect(state.currentTenantId).toBe('SYSTEM');
    expect(state.user?.username).toBe('custodian_root');
    expect(state.user?.isSovereign).toBe(true);
  });

  it('updates hydration flag via setHydrating', () => {
    useSpringAuthStore.getState().setHydrating(true);
    expect(useSpringAuthStore.getState().isHydrating).toBe(true);
    useSpringAuthStore.getState().setHydrating(false);
    expect(useSpringAuthStore.getState().isHydrating).toBe(false);
  });

  it('expires access token and refresh token on diagnostic triggers', () => {
    const access = createMockToken({ sub: 'usr_3', username: 'bob' });
    useSpringAuthStore.getState().setTokens(access, 'refresh_abc');

    // Expire access token
    useSpringAuthStore.getState().expireAccessToken();
    expect(useSpringAuthStore.getState().accessToken).toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');

    // Expire refresh token
    useSpringAuthStore.getState().expireRefreshToken();
    expect(useSpringAuthStore.getState().refreshToken).toBe('expired_mock_refresh_token');
  });

  it('clears all session state on logout / clearTokens', () => {
    const access = createMockToken({ sub: 'usr_4', username: 'charlie' });
    useSpringAuthStore.getState().setTokens(access, 'refresh_xyz');
    expect(useSpringAuthStore.getState().isAuthenticated).toBe(true);

    useSpringAuthStore.getState().clearTokens();
    const state = useSpringAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
  });
});
