import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { OtpForm } from '../otp-form';
import { springApiClient, useSpringAuthStore } from '@/features/spring-auth';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({ email: 'testuser@example.com' }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('OtpForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSpringAuthStore.getState().clearTokens();
  });

  it('renders OTP inputs, verify button, and resend button', () => {
    render(<OtpForm />);

    expect(screen.getByRole('button', { name: /Verify & Sign In/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Resend code/i })).toBeDefined();
  });

  it('submits OTP and stores tokens on successful response', async () => {
    const postSpy = vi.spyOn(springApiClient, 'post').mockResolvedValueOnce({
      data: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      },
    } as any);

    render(<OtpForm />);

    const inputs = screen.getAllByRole('textbox');
    // Set 6 digits
    const input = inputs[0];
    fireEvent.change(input, { target: { value: '123456' } });

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/auth/verify-otp', {
        email: 'testuser@example.com',
        otp: '123456',
      });
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
      expect(useSpringAuthStore.getState().accessToken).toBe('mock-access-token');
    });
  });
});
