import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProfileSwitcher } from '../profile-switcher';
import { ProfileProvider } from '@/context/profile-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useProfileStore } from '@/stores/profile-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function renderSwitcher() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <SidebarProvider>
          <ProfileSwitcher />
        </SidebarProvider>
      </ProfileProvider>
    </QueryClientProvider>
  );
}

describe('ProfileSwitcher Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useProfileStore.getState().syncAssumedTenant(null);
  });

  it('renders standard workspace switcher when not assumed', () => {
    renderSwitcher();
    expect(screen.getByText('Unipost Main')).toBeDefined();
    expect(screen.getByText('Default Organization')).toBeDefined();
    expect(screen.queryByText('ASSUMED')).toBeNull();
  });

  it('renders delegated indicator and badge when an assumed tenant session is active', () => {
    localStorage.setItem('unipost_assumed_tenant', 'tenant-acme');
    localStorage.setItem('unipost_assumed_tenant_name', 'Acme International Corp');
    useProfileStore.getState().syncAssumedTenant('tenant-acme', 'Acme International Corp');

    renderSwitcher();

    expect(screen.getByText('ASSUMED')).toBeDefined();
    expect(screen.getByText('Acme Prod')).toBeDefined();
    expect(screen.getByText(/Delegated: Acme International Corp/i)).toBeDefined();
  });

  it('strictly isolates workspace dropdown to assumed tenant workspaces only, excluding Default Organization', () => {
    localStorage.setItem('unipost_assumed_tenant', 'tenant-acme');
    localStorage.setItem('unipost_assumed_tenant_name', 'Acme International Corp');
    useProfileStore.getState().syncAssumedTenant('tenant-acme', 'Acme International Corp');

    renderSwitcher();

    // Trigger button shows Acme context
    expect(screen.getByText('Acme Prod')).toBeDefined();

    // Default Organization and Unipost Main must NOT be rendered when inside assumed tenant
    expect(screen.queryByText('Unipost Main')).toBeNull();
    expect(screen.queryByText('Default Organization')).toBeNull();
  });

  it('renders orphaned tenant state with NO WORKSPACE badge when a tenant has 0 workspaces', () => {
    // Empty out all profiles
    useProfileStore.getState().setProfiles([]);
    localStorage.setItem('unipost_assumed_tenant', 'tenant-empty');
    localStorage.setItem('unipost_assumed_tenant_name', 'Empty Org');

    renderSwitcher();

    expect(screen.getByText('NO WORKSPACE')).toBeDefined();
    expect(screen.getByText('Tenant: Empty Org')).toBeDefined();
  });
});
