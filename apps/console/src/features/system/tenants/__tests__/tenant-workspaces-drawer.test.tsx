import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantWorkspacesDrawer } from '../tenant-workspaces-drawer';
import { useProfileStore } from '@/stores/profile-store';

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('TenantWorkspacesDrawer - Phase 3 Immutable Default Workspace Invariant', () => {
  const mockTenant = {
    tenantId: 'tenant-acme',
    name: 'Acme International Corp',
    slug: 'acme-corp',
    tier: 'ENTERPRISE' as const,
    status: 'ACTIVE' as const,
    ownerEmail: 'admin@acme.com',
    workspacesCount: 2,
    maxWorkspaces: 10,
    schemasCount: 4,
    maxSchemas: -1,
    recordsCount: 1200,
    maxRecords: -1,
    cpuUsagePercent: 12.5,
    storageBytes: 1024 * 1024 * 50,
    rateLimitSpikes: 0,
    activeConnections: 5,
    expiresAt: null,
    createdDate: '2026-01-01',
    lastUpdatedDate: '2026-01-01',
    activeFeatures: [],
  };

  beforeEach(() => {
    useProfileStore.getState().setProfiles([
      {
        id: 'ws-acme-prod',
        name: 'Acme Prod',
        tenantId: 'tenant-acme',
        tenantName: 'Acme International Corp',
        isDefault: true,
      },
      {
        id: 'ws-acme-staging',
        name: 'Acme Staging',
        tenantId: 'tenant-acme',
        tenantName: 'Acme International Corp',
        isDefault: false,
      },
    ]);
  });

  it('renders default workspace with DEFAULT badge and disabled delete button', () => {
    renderWithClient(
      <TenantWorkspacesDrawer
        tenant={mockTenant}
        open={true}
        onOpenChange={() => {}}
      />
    );

    expect(screen.getByText('Workspaces for Acme International Corp')).toBeDefined();
    expect(screen.getByText('Acme Prod')).toBeDefined();
    expect(screen.getByText('DEFAULT')).toBeDefined();

    // Default workspace delete button must be disabled
    const defaultDeleteBtn = screen.getByTitle('Default workspace (Protected from deletion)');
    expect(defaultDeleteBtn).toBeDefined();
    expect((defaultDeleteBtn as HTMLButtonElement).disabled).toBe(true);

    // Staging (non-default) delete button must be enabled
    const stagingDeleteBtn = screen.getByTitle('Delete workspace');
    expect(stagingDeleteBtn).toBeDefined();
    expect((stagingDeleteBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables deletion when only 1 workspace remains for tenant', () => {
    useProfileStore.getState().setProfiles([
      {
        id: 'ws-acme-staging',
        name: 'Acme Staging',
        tenantId: 'tenant-acme',
        tenantName: 'Acme International Corp',
        isDefault: false,
      },
    ]);

    renderWithClient(
      <TenantWorkspacesDrawer
        tenant={mockTenant}
        open={true}
        onOpenChange={() => {}}
      />
    );

    const soleDeleteBtn = screen.getByTitle('Sole remaining workspace (Protected from deletion)');
    expect(soleDeleteBtn).toBeDefined();
    expect((soleDeleteBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
