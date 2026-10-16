import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PayloadDiffViewer } from '../payload-diff-viewer';

describe('PayloadDiffViewer Component', () => {
  const previousPayload = {
    orderId: 'ORD-101',
    status: 'PENDING',
    customerEmail: 'alice@example.com',
  };

  const currentPayload = {
    orderId: 'ORD-101',
    status: 'PAID', // modified
    trackingNumber: 'TRK-999', // added
    // customerEmail removed
  };

  it('detects and classifies added, modified, removed, and unchanged variables', () => {
    render(
      <PayloadDiffViewer
        previousPayload={previousPayload}
        currentPayload={currentPayload}
        stepIndex={2}
      />
    );

    expect(screen.getByTestId('payload-diff-viewer')).toBeDefined();
    expect(screen.getByText('+1 Added')).toBeDefined();
    expect(screen.getByText('~1 Modified')).toBeDefined();
    expect(screen.getByText('-1 Removed')).toBeDefined();

    // Check key labels
    expect(screen.getByText('status')).toBeDefined();
    expect(screen.getByText('trackingNumber')).toBeDefined();
    expect(screen.getByText('customerEmail')).toBeDefined();
  });

  it('toggles between Show Only Changes and Full Snapshot', () => {
    render(
      <PayloadDiffViewer
        previousPayload={previousPayload}
        currentPayload={currentPayload}
        stepIndex={2}
      />
    );

    // In "Only Changes" mode, unchanged key "orderId" is not displayed
    expect(screen.queryByText('orderId')).toBeNull();

    // Click toggle to "Full Snapshot"
    const toggleButton = screen.getByRole('button', { name: /only changes/i });
    fireEvent.click(toggleButton);

    // Now unchanged key "orderId" should be visible
    expect(screen.getByText('orderId')).toBeDefined();
  });

  it('filters variables by search query', () => {
    render(
      <PayloadDiffViewer
        previousPayload={previousPayload}
        currentPayload={currentPayload}
        stepIndex={2}
      />
    );

    const searchInput = screen.getByPlaceholderText(/filter keys\/values/i);
    fireEvent.change(searchInput, { target: { value: 'tracking' } });

    expect(screen.getByText('trackingNumber')).toBeDefined();
    expect(screen.queryByText('customerEmail')).toBeNull();
  });
});
