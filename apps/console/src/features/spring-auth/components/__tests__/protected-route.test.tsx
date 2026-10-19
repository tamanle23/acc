import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProtectedRoute } from '../ProtectedRoute';
import { useSpringAuthStore } from '../../store';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

describe('ProtectedRoute Component - Phase 2 Tenant Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSpringAuthStore.getState().clearTokens();
    useSpringAuthStore.getState().setHydrating(false);
  });

  it('redirects to /sign-in if user is unauthenticated', () => {
    render(
      <ProtectedRoute>
        <div>Protected Children</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Protected Children')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/sign-in', replace: true });
  });

  it('renders children when user is authenticated with a valid tenantId', () => {
    useSpringAuthStore.setState({
      isAuthenticated: true,
      isHydrating: false,
      currentTenantId: 'tenant-acme',
      user: {
        sub: 'john.doe',
        roles: ['ROLE_USER'],
        tenantId: 'tenant-acme',
      } as any,
    });

    render(
      <ProtectedRoute>
        <div>Protected Children</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected Children')).toBeDefined();
    expect(screen.queryByText('No Organization Assigned')).toBeNull();
  });

  it('renders Unassigned Tenant Intervention Screen when authenticated user has no tenantId', () => {
    useSpringAuthStore.setState({
      isAuthenticated: true,
      isHydrating: false,
      currentTenantId: null,
      user: {
        sub: 'orphan.user',
        roles: ['ROLE_USER'],
        tenantId: '',
      } as any,
    });

    render(
      <ProtectedRoute>
        <div>Protected Children</div>
      </ProtectedRoute>
    );

    // Protected content must NOT be shown
    expect(screen.queryByText('Protected Children')).toBeNull();

    // Intervention screen elements MUST be shown
    expect(screen.getByText('No Organization Assigned')).toBeDefined();
    expect(
      screen.getByText(
        'Your account is not assigned to any active tenant organization. Access to workspace services is prohibited until a SYSTEM Custodian assigns your membership.'
      )
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Contact Custodian/i })).toBeDefined();
  });

  it('clears tokens and navigates to /sign-in when clicking Sign Out on intervention screen', () => {
    useSpringAuthStore.setState({
      isAuthenticated: true,
      isHydrating: false,
      currentTenantId: null,
      user: {
        sub: 'orphan.user',
        roles: ['ROLE_USER'],
        tenantId: '',
      } as any,
    });

    render(
      <ProtectedRoute>
        <div>Protected Children</div>
      </ProtectedRoute>
    );

    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    fireEvent.click(signOutBtn);

    expect(useSpringAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/sign-in', replace: true });
  });

  it('allows SYSTEM custodians through even if commercial tenantId is not present', () => {
    useSpringAuthStore.setState({
      isAuthenticated: true,
      isHydrating: false,
      currentTenantId: 'SYSTEM',
      user: {
        sub: 'custodian_root',
        roles: ['ROLE_SYSTEM_CUSTODIAN'],
        tenantId: 'SYSTEM',
      } as any,
    });

    render(
      <ProtectedRoute>
        <div>Sovereign Custodian Console</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Sovereign Custodian Console')).toBeDefined();
    expect(screen.queryByText('No Organization Assigned')).toBeNull();
  });
});
