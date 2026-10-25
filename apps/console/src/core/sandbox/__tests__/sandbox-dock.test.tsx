import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SandboxDock } from '../ui/sandbox-dock';
import { useSandboxStore } from '../store/sandbox-store';
import { useSpringAuthStore } from '@/features/spring-auth/store';

// Helper to render with QueryClientProvider
const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('SandboxDock UI Component', () => {
  beforeEach(() => {
    useSandboxStore.getState().resetToDefaults();
    useSandboxStore.getState().setEnabled(true);
    useSpringAuthStore.getState().clearTokens();

    // Mock URL search params with ?sandbox=true
    delete (window as any).location;
    (window as any).location = new URL('http://localhost/?sandbox=true');
  });

  it('should render the expanded SandboxDock when ?sandbox=true is present', () => {
    renderWithQueryClient(<SandboxDock />);

    expect(screen.getByText('Unified Sandbox Dock')).toBeTruthy();
    expect(screen.getByText('Persona & Scope')).toBeTruthy();
    expect(screen.getByText('Network / Chaos')).toBeTruthy();
  });

  it('should switch active persona when clicking persona buttons', () => {
    renderWithQueryClient(<SandboxDock />);

    const creatorBtn = screen.getByText('Operations');
    fireEvent.click(creatorBtn);

    expect(useSandboxStore.getState().activePersonaId).toBe('creator');
    expect(useSandboxStore.getState().activeTenantId).toBe('tenant-eu-central-1');
    expect(useSpringAuthStore.getState().user?.sub).toBe('creator');
  });

  it('should allow switching tabs and adjusting latency settings', () => {
    renderWithQueryClient(<SandboxDock />);

    const networkTab = screen.getByText('Network / Chaos');
    fireEvent.click(networkTab);

    expect(screen.getByText('Latency Jitter')).toBeTruthy();

    const highLatencyBtn = screen.getByText('1.5s');
    fireEvent.click(highLatencyBtn);

    expect(useSandboxStore.getState().networkSimulation.latencyMaxMs).toBe(2000);
  });

  it('should support switching scope tenant to tenant-acme and synchronizing active tenant', () => {
    renderWithQueryClient(<SandboxDock />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'tenant-acme' } });

    expect(useSandboxStore.getState().activeTenantId).toBe('tenant-acme');
  });

  it('should simulate unassigned user edge-case with warning toast', () => {
    renderWithQueryClient(<SandboxDock />);

    const unassignedBtn = screen.getByText('Unassigned User');
    fireEvent.click(unassignedBtn);

    expect(useSpringAuthStore.getState().currentTenantId).toBeNull();
    expect(useSpringAuthStore.getState().user?.tenantId).toBeUndefined();
  });

  it('should clear localStorage user defaults and assumed session on reset all data', () => {
    localStorage.setItem('acc_user_default_ws_tenant-acme', 'ws-acme-staging');
    localStorage.setItem('acc_assumed_tenant', 'tenant-acme');

    renderWithQueryClient(<SandboxDock />);

    const resetBtn = screen.getByTitle('Reset all mock data across all features');
    fireEvent.click(resetBtn);

    expect(localStorage.getItem('acc_user_default_ws_tenant-acme')).toBeNull();
    expect(localStorage.getItem('acc_assumed_tenant')).toBeNull();
  });
});
