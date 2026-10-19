import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalsInbox } from '../approvals-inbox';

describe('ApprovalsInbox Component', () => {
  it('renders approvals inbox with mock tasks and headers', () => {
    render(<ApprovalsInbox />);

    expect(screen.getByText('Human-in-the-Loop Approvals Inbox')).toBeDefined();
    expect(screen.getByText('Vendor Compliance & Security Review')).toBeDefined();
    expect(screen.getByText('Carrier Zone Rate Schedule Mutation')).toBeDefined();
    expect(screen.getAllByText('Acme Logistics Ltd').length).toBeGreaterThanOrEqual(1);
  });

  it('allows approving a pending task', () => {
    render(<ApprovalsInbox />);

    const approveButtons = screen.getAllByText('Approve Step');
    expect(approveButtons.length).toBeGreaterThan(0);

    fireEvent.click(approveButtons[0]);
    expect(screen.getByText('APPROVED')).toBeDefined();
  });

  it('filters approval tasks based on search query', () => {
    render(<ApprovalsInbox />);

    const searchInput = screen.getByPlaceholderText('Filter approvals...');
    fireEvent.change(searchInput, { target: { value: 'Acme' } });

    expect(screen.getByText('Vendor Compliance & Security Review')).toBeDefined();
    expect(screen.queryByText('Carrier Zone Rate Schedule Mutation')).toBeNull();
  });
});
