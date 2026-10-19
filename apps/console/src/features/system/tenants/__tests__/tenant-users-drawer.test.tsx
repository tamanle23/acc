import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantUsersDrawer } from '../tenant-users-drawer';
import * as useSystemFleetModule from '../../api/use-system-fleet';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockUsers: useSystemFleetModule.GlobalUserListItem[] = [
  {
    userId: 'user-001-uuid',
    username: 'acme.admin',
    email: 'admin@acme.com',
    displayName: 'Acme Admin Officer',
    tenantId: 'tenant-acme',
    roles: ['ROLE_ADMIN', 'ROLE_USER'],
    locked: false,
    active: true,
    lastLoginDate: '2026-10-10T12:00:00Z',
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    userId: 'user-002-uuid',
    username: 'acme.operator',
    email: 'operator@acme.com',
    displayName: 'Acme Data Operator',
    tenantId: 'tenant-acme',
    roles: ['ROLE_USER'],
    locked: true,
    active: false,
    lastLoginDate: '2026-10-09T08:00:00Z',
    createdDate: '2026-02-01T00:00:00Z',
  },
  {
    userId: 'user-003-uuid',
    username: 'acme.creator',
    email: 'creator@acme.com',
    displayName: 'Acme Content Creator',
    tenantId: 'tenant-acme',
    roles: ['ROLE_CREATOR', 'ROLE_USER'],
    locked: false,
    active: true,
    lastLoginDate: '2026-10-11T01:00:00Z',
    createdDate: '2026-03-01T00:00:00Z',
  },
];

const mockTenant: useSystemFleetModule.FleetTenantSummary = {
  tenantId: 'tenant-acme',
  name: 'Acme International Corp',
  slug: 'acme-corp',
  tier: 'ENTERPRISE',
  status: 'ACTIVE',
  ownerEmail: 'owner@acme.com',
  workspacesCount: 2,
  maxWorkspaces: 10,
  schemasCount: 4,
  maxSchemas: -1,
  recordsCount: 1200,
  maxRecords: -1,
  cpuUsagePercent: 12,
  storageBytes: 1024000,
  rateLimitSpikes: 0,
  activeConnections: 5,
  expiresAt: null,
  createdDate: '2026-01-01',
  lastUpdatedDate: '2026-10-11',
  activeFeatures: ['UNLIMITED_WORKSPACES'],
};

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('TenantUsersDrawer - Phase 5 Symmetrical Sovereign Drawer', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useSystemFleetModule, 'useGlobalUsers').mockReturnValue({
      data: mockUsers,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(useSystemFleetModule, 'useLockUser').mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
  });

  it('renders slide-over sheet with tenant header and member count', () => {
    renderWithClient(
      <TenantUsersDrawer
        tenant={mockTenant}
        open={true}
        onOpenChange={() => {}}
      />
    );

    expect(screen.getByText('Assigned Users for Acme International Corp')).toBeDefined();
    expect(screen.getByText(/Tenant ID: tenant-acme/i)).toBeDefined();
    expect(screen.getByText(/3 members/i)).toBeDefined();
  });

  it('renders user cards with display names, usernames, and role badges', () => {
    renderWithClient(
      <TenantUsersDrawer
        tenant={mockTenant}
        open={true}
        onOpenChange={() => {}}
      />
    );

    expect(screen.getByText('Acme Admin Officer')).toBeDefined();
    expect(screen.getByText('@acme.admin')).toBeDefined();
    expect(screen.getByText('admin@acme.com')).toBeDefined();

    expect(screen.getByText('Acme Data Operator')).toBeDefined();
    expect(screen.getByText('@acme.operator')).toBeDefined();

    // Check status badges
    expect(screen.getAllByText('ACTIVE').length).toBe(2);
    expect(screen.getByText('LOCKED')).toBeDefined();

    // Check RBAC role badges (ADMIN, USER, CREATOR)
    expect(screen.getByText('ADMIN')).toBeDefined();
    expect(screen.getByText('CREATOR')).toBeDefined();
  });

  it('filters users by search query input', () => {
    vi.useFakeTimers();

    renderWithClient(
      <TenantUsersDrawer
        tenant={mockTenant}
        open={true}
        onOpenChange={() => {}}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Tìm kiếm user, email/i);
    fireEvent.change(searchInput, { target: { value: 'admin' } });

    // Advance timer past debounce delay (300ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // useGlobalUsers was called with debounced search query
    expect(useSystemFleetModule.useGlobalUsers).toHaveBeenLastCalledWith('admin', 'tenant-acme');

    vi.useRealTimers();
  });

  it('triggers emergency lock confirmation dialog and executes lockMutation', () => {
    renderWithClient(
      <TenantUsersDrawer
        tenant={mockTenant}
        open={true}
        onOpenChange={() => {}}
      />
    );

    // Click "Khóa" on active user
    const lockBtns = screen.getAllByRole('button', { name: /Khóa/i });
    fireEvent.click(lockBtns[0]);

    // Dialog must open
    expect(screen.getByText('Khóa khẩn cấp tài khoản')).toBeDefined();

    // Enter lock reason
    const reasonInput = screen.getByPlaceholderText(/VD: Tuân thủ chính sách/i);
    fireEvent.change(reasonInput, { target: { value: 'Security policy violation' } });

    // Click confirm
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận khóa/i });
    fireEvent.click(confirmBtn);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-001-uuid',
        locked: true,
        reason: 'Security policy violation',
      }),
      expect.any(Object)
    );
  });

  it('triggers session revocation toast when clicking Thu hồi phiên', () => {
    renderWithClient(
      <TenantUsersDrawer
        tenant={mockTenant}
        open={true}
        onOpenChange={() => {}}
      />
    );

    const revokeBtns = screen.getAllByRole('button', { name: /Thu hồi phiên/i });
    fireEvent.click(revokeBtns[0]);

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('Đã thu hồi tất cả phiên làm việc và refresh token')
    );
  });

  it('copies user ID to clipboard when clicking ID button', () => {
    const writeTextMock = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    renderWithClient(
      <TenantUsersDrawer
        tenant={mockTenant}
        open={true}
        onOpenChange={() => {}}
      />
    );

    const copyBtn = screen.getAllByTitle('Sao chép User ID')[0];
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith('user-001-uuid');
    expect(toast.info).toHaveBeenCalledWith('Đã sao chép User ID vào clipboard.');
  });
});
