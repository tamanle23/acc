import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataTableRowActions } from '../data-table-row-actions';
import { UsersProvider, useUsers } from '../users-provider';
import { type User } from '../../data/schema';
import { type Row } from '@tanstack/react-table';

// Test consumer to read current dialog state
function DialogStateInspector() {
  const { open, currentRow } = useUsers();
  return (
    <div>
      <div data-testid="dialog-open">{open || 'none'}</div>
      <div data-testid="dialog-current-user">{currentRow?.username || 'none'}</div>
    </div>
  );
}

describe('DataTableRowActions - Delegate Permissions', () => {
  let queryClient: QueryClient;

  const mockUser: User = {
    id: 'usr-101',
    firstName: 'Jane',
    lastName: 'Doe',
    username: 'jane_doe',
    email: 'jane@acme.com',
    phoneNumber: '+1234567890',
    status: 'active',
    role: 'ROLE_STANDARD_MEMBER',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockRow: Row<User> = {
    original: mockUser,
    getValue: vi.fn(),
  } as unknown as Row<User>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders dropdown menu trigger with accessible label', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <UsersProvider>
          <DataTableRowActions row={mockRow} />
        </UsersProvider>
      </QueryClientProvider>
    );

    const trigger = screen.getByRole('button', { name: /Actions for user jane_doe/i });
    expect(trigger).toBeTruthy();
  });

  it('triggers delegate dialog with user context when Delegate Permissions is clicked', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <UsersProvider>
          <DataTableRowActions row={mockRow} />
          <DialogStateInspector />
        </UsersProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('dialog-open').textContent).toBe('none');

    // Open dropdown menu via pointerDown / click
    const trigger = screen.getByRole('button', { name: /Actions for user jane_doe/i });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    // Wait for Delegate Permissions to appear in Radix portal
    const delegateMenuItem = await screen.findByText(/Delegate Permissions/i);
    expect(delegateMenuItem).toBeTruthy();
    fireEvent.click(delegateMenuItem);

    // Verify dialog state updated to 'delegate' with current user set
    expect(screen.getByTestId('dialog-open').textContent).toBe('delegate');
    expect(screen.getByTestId('dialog-current-user').textContent).toBe('jane_doe');
  });
});
