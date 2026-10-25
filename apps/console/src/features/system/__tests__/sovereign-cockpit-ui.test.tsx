import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FleetTenantsTable } from '../tenants/fleet-tenants-table';
import { RbacMatrixGrid } from '../roles/rbac-matrix-grid';
import { UserMembershipDrawer } from '../roles/user-membership-drawer';
import { TenantUsersDrawer } from '../tenants/tenant-users-drawer';
import { AssumeTenantBar } from '@/components/layout/assume-tenant-bar';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: any) => <a>{children}</a>,
}));

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

describe('Sovereign Cockpit UI Components', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders FleetTenantsTable with search and filters', () => {
    renderWithClient(<FleetTenantsTable />);
    expect(screen.getByPlaceholderText(/search fleet tenants/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /provision tenant/i })).toBeTruthy();
  });

  it('renders RbacMatrixGrid with permission matrix table and create role button', () => {
    renderWithClient(<RbacMatrixGrid />);
    expect(screen.getByPlaceholderText(/search 35 permission atoms/i)).toBeTruthy();
    expect(screen.getByText(/permission atom & security plane/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /create role/i })).toBeTruthy();
  });

  it('renders UserMembershipDrawer with universal user directory and inspect action', () => {
    renderWithClient(<UserMembershipDrawer />);
    expect(screen.getByPlaceholderText(/search users by name/i)).toBeTruthy();
    expect(screen.getByText(/user account & credentials/i)).toBeTruthy();
  });

  it('renders AssumeTenantBar when assumed tenant session is active in localStorage', () => {
    localStorage.setItem('acc_assumed_tenant', 'tenant-acme');
    renderWithClient(<AssumeTenantBar />);
    expect(screen.getByText(/assume-tenant active:/i)).toBeTruthy();
    expect(screen.getByText('tenant-acme')).toBeTruthy();
    expect(screen.getByRole('button', { name: /exit sub-session/i })).toBeTruthy();
  });

  it('does not render AssumeTenantBar when no assumed session is active', () => {
    const { container } = renderWithClient(<AssumeTenantBar />);
    expect(container.firstChild).toBeNull();
  });

  it('renders TenantUsersDrawer when opened with tenant details', () => {
    const mockTenant = {
      tenantId: 'tenant-acme',
      name: 'Acme International Corp',
      tier: 'ENTERPRISE' as const,
      status: 'ACTIVE' as const,
      workspacesCount: 2,
      maxWorkspaces: 10,
      schemasCount: 4,
      maxSchemas: -1,
      recordsCount: 1200,
      maxRecords: -1,
      rateLimitBurst: 200,
      rateLimitReplenishRate: 100,
      createdDate: '2026-01-01',
      lastAssumedDate: null,
    };
    renderWithClient(
      <TenantUsersDrawer
        tenant={mockTenant}
        open={true}
        onOpenChange={() => {}}
      />
    );
    expect(screen.getByText(/assigned users for acme international corp/i)).toBeTruthy();
  });
});
