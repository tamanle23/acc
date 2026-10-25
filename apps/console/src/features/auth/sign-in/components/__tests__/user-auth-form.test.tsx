import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { UserAuthForm } from '../user-auth-form';
import { springApiClient, useSpringAuthStore } from '@/features/spring-auth';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

describe('UserAuthForm Component - Passkeys & Password Rotation Triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSpringAuthStore.getState().clearTokens();
  });

  it('renders sign in fields and Passkey button', () => {
    render(<UserAuthForm />);

    expect(screen.getByLabelText(/Email or Username/i)).toBeDefined();
    expect(screen.getByLabelText(/^Password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeDefined();
    expect(
      screen.getByRole('button', { name: /Sign in with Passkey \/ Security Key/i })
    ).toBeDefined();
  });

  it('opens PasswordRotationModal when backend responds with PASSWORD_ROTATION_REQUIRED', async () => {
    vi.spyOn(springApiClient, 'post').mockRejectedValueOnce({
      response: {
        data: {
          error: 'PASSWORD_ROTATION_REQUIRED',
          message: 'Initial credentials expired.',
        },
      },
    });

    render(<UserAuthForm />);

    fireEvent.change(screen.getByLabelText(/Email or Username/i), {
      target: { value: 'custodian' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: 'temporary_pwd' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText('Mandatory Password Rotation')).toBeDefined();
    });
  });

  it('executes Passkey authentication flow and stores access token', async () => {
    vi.spyOn(springApiClient, 'post')
      .mockResolvedValueOnce({
        data: {
          challenge: 'bW9jay1jaGFsbGVuZ2U=', // 'mock-challenge' base64
          rpId: 'localhost',
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          accessToken: 'mock-passkey-jwt',
          refreshToken: 'mock-passkey-refresh',
        },
      } as any);

    render(<UserAuthForm />);

    fireEvent.change(screen.getByLabelText(/Email or Username/i), {
      target: { value: 'custodian@unipost.io' },
    });

    const passkeyBtn = screen.getByRole('button', {
      name: /Sign in with Passkey \/ Security Key/i,
    });
    fireEvent.click(passkeyBtn);

    await waitFor(() => {
      expect(useSpringAuthStore.getState().accessToken).toBe('mock-passkey-jwt');
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/', replace: true });
    });
  });
});
