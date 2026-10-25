import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RbacMatrixGrid } from '../rbac-matrix-grid';
import { RoleManagementTab } from '../role-management-tab';
import { TenantRoleDelegationModal } from '../tenant-role-delegation-modal';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('RBAC Governance Studio & Matrix Tests', () => {
  it('renders RbacMatrixGrid with 35 permission atoms search and segmented switchers', () => {
    renderWithClient(<RbacMatrixGrid />);
    expect(screen.getByPlaceholderText(/search 35 permission atoms/i)).toBeTruthy();
    expect(screen.getByText(/all scopes/i)).toBeTruthy();
    expect(screen.getByText(/tenant matrix/i)).toBeTruthy();
    expect(screen.getByText(/sovereign matrix/i)).toBeTruthy();
    expect(screen.getByText(/all planes \(35\)/i)).toBeTruthy();
  });

  it('renders RoleManagementTab with roles catalog and action buttons', () => {
    renderWithClient(<RoleManagementTab />);
    expect(screen.getByPlaceholderText(/filter roles by key, name, or tenant/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /create role/i })).toBeTruthy();
    expect(screen.getByText(/role identifier/i)).toBeTruthy();
    expect(screen.getByText(/scope & custody/i)).toBeTruthy();
  });

  it('renders TenantRoleDelegationModal with ceiling warning and override fields', () => {
    const mockUser = {
      userId: 'usr-member-1',
      username: 'member1@alpha.io',
      email: 'member1@alpha.io',
      displayName: 'Alice Engineer',
      tenantId: 'tenant-startup-alpha',
      roles: ['ROLE_STANDARD_MEMBER'],
      locked: false,
      active: true,
      lastLoginDate: '2026-10-20T10:00:00Z',
      createdDate: '2026-06-01T10:00:00Z',
    };

    renderWithClient(
      <TenantRoleDelegationModal
        user={mockUser}
        open={true}
        onOpenChange={() => {}}
      />
    );

    expect(screen.getByText(/tenant role delegation & authority assignment/i)).toBeTruthy();
    expect(screen.getByText(/delegation ceiling enforced/i)).toBeTruthy();
    expect(screen.getByText(/ad-hoc permission overrides/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /commit delegation/i })).toBeTruthy();
  });
});
