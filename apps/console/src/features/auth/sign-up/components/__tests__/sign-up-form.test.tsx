import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { SignUpForm } from '../sign-up-form';
import { springApiClient } from '@/features/spring-auth';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('SignUpForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form inputs and submit button', () => {
    render(<SignUpForm />);

    expect(screen.getByLabelText(/Email/i)).toBeDefined();
    expect(screen.getByLabelText(/^Password/i)).toBeDefined();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeDefined();
  });

  it('submits form with valid data and navigates to /otp', async () => {
    const postSpy = vi.spyOn(springApiClient, 'post').mockResolvedValueOnce({
      data: { success: true },
    } as any);

    render(<SignUpForm />);

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/^Password/i);
    const confirmInput = screen.getByLabelText(/Confirm Password/i);
    const submitBtn = screen.getByRole('button', { name: /Create Account/i });

    fireEvent.change(emailInput, { target: { value: 'testuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'ValidPass123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/auth/signup/person', {
        email: 'testuser@example.com',
        password: 'ValidPass123!',
      });
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/otp',
        search: { email: 'testuser@example.com' },
      });
    });
  });
});
