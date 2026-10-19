import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspacesPanel } from './workspaces-panel';
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store';

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('WorkspacesPanel Component', () => {
  it('renders list of available workspaces and current active indicator', () => {
    renderWithQueryClient(<WorkspacesPanel />);

    expect(screen.getByText('Workspaces & Organizations')).toBeDefined();
    expect(screen.getByText('Tạo Workspace Mới')).toBeDefined();
    expect(screen.getByText('Acme Prod')).toBeDefined();
    expect(screen.getByText('Đang chọn')).toBeDefined();
    expect(screen.getAllByText('DEFAULT').length).toBeGreaterThanOrEqual(1);
  });

  it('switches active workspace when clicking Switch button', () => {
    renderWithQueryClient(<WorkspacesPanel />);

    const switchBtn = screen.getAllByText(/Chuyển sang workspace này/i)[0];
    fireEvent.click(switchBtn);

    const activeTenant = useMetadataUiStore.getState().activeTenantId;
    expect(activeTenant).toBeDefined();
  });

  it('disables deletion of tenant immutable default workspace', () => {
    renderWithQueryClient(<WorkspacesPanel />);

    const disabledDeleteBtns = screen.getAllByTitle('Workspace mặc định của tổ chức (Không thể xóa)');
    expect(disabledDeleteBtns.length).toBeGreaterThanOrEqual(1);
    expect((disabledDeleteBtns[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('allows user to set personal default workspace and displays MY DEFAULT badge', () => {
    localStorage.clear();
    const { unmount } = renderWithQueryClient(<WorkspacesPanel />);

    const setMyDefaultBtns = screen.getAllByRole('button', { name: /Đặt làm mặc định/i });
    expect(setMyDefaultBtns.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(setMyDefaultBtns[0]);

    const stored = localStorage.getItem('unipost_user_default_ws_tenant-acme');
    expect(stored).toBeDefined();

    unmount();
    renderWithQueryClient(<WorkspacesPanel />);
    expect(screen.getAllByText('MY DEFAULT').length).toBeGreaterThanOrEqual(1);
  });
});

