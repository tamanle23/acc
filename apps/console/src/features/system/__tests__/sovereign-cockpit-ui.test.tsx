import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FleetTenantsTable } from '../tenants/fleet-tenants-table';
import { RbacMatrixGrid } from '../roles/rbac-matrix-grid';
import { UserMembershipDrawer } from '../roles/user-membership-drawer';
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
    expect(screen.getByPlaceholderText(/search permissions/i)).toBeTruthy();
    expect(screen.getByText(/permission atom/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /create custom role/i })).toBeTruthy();
  });

  it('renders UserMembershipDrawer with universal user directory and inspect action', () => {
    renderWithClient(<UserMembershipDrawer />);
    expect(screen.getByPlaceholderText(/search users by name/i)).toBeTruthy();
    expect(screen.getByText(/emergency custody/i)).toBeTruthy();
  });

  it('renders AssumeTenantBar when assumed tenant session is active in localStorage', () => {
    localStorage.setItem('unipost_assumed_tenant', 'tenant-acme');
    renderWithClient(<AssumeTenantBar />);
    expect(screen.getByText(/assume-tenant active:/i)).toBeTruthy();
    expect(screen.getByText('tenant-acme')).toBeTruthy();
    expect(screen.getByRole('button', { name: /exit sub-session/i })).toBeTruthy();
  });

  it('does not render AssumeTenantBar when no assumed session is active', () => {
    const { container } = renderWithClient(<AssumeTenantBar />);
    expect(container.firstChild).toBeNull();
  });
});
