import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { PasswordRotationModal } from '../password-rotation-modal';
import { springApiClient } from '@/features/spring-auth';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('PasswordRotationModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open is true', () => {
    render(
      <PasswordRotationModal
        open={true}
        onSuccess={vi.fn()}
        username="custodian"
      />
    );

    expect(screen.getByText('Mandatory Password Rotation')).toBeDefined();
    expect(screen.getByLabelText(/Temporary \/ Current Password/i)).toBeDefined();
    expect(screen.getByLabelText(/New Secure Password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Rotate Password & Continue/i })).toBeDefined();
  });

  it('submits valid rotation payload to API', async () => {
    const onSuccess = vi.fn();
    const postSpy = vi.spyOn(springApiClient, 'post').mockResolvedValueOnce({
      data: { success: true },
    } as any);

    render(
      <PasswordRotationModal
        open={true}
        onSuccess={onSuccess}
        username="custodian"
      />
    );

    fireEvent.change(screen.getByLabelText(/Temporary \/ Current Password/i), {
      target: { value: 'OldPassword123!' },
    });
    fireEvent.change(screen.getByLabelText(/New Secure Password/i), {
      target: { value: 'BrandNewPass123!@#' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), {
      target: { value: 'BrandNewPass123!@#' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Rotate Password & Continue/i })
    );

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/auth/password/rotate', {
        username: 'custodian',
        currentPassword: 'OldPassword123!',
        newPassword: 'BrandNewPass123!@#',
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
