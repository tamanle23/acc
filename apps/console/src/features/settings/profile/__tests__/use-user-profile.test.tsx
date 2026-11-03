import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserProfileQuery, useUpdateUserProfileMutation } from '../api/use-user-profile';
import { springApiClient } from '@/features/spring-auth';

vi.mock('@/features/spring-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/spring-auth')>();
  return {
    ...actual,
    springApiClient: {
      get: vi.fn(),
      put: vi.fn(),
    },
  };
});

describe('useUserProfile API Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('fetches user profile via GET /v1/user/profile', async () => {
    const mockProfile = {
      userId: 'usr-42',
      username: 'alice',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@acc.local',
      preferences: { language: 'vi', bio: 'Engineer' },
    };

    vi.mocked(springApiClient.get).mockResolvedValueOnce({ data: mockProfile });

    const { result } = renderHook(() => useUserProfileQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(springApiClient.get).toHaveBeenCalledWith('/v1/user/profile');
    expect(result.current.data).toEqual(mockProfile);
  });

  it('updates user profile via PUT /v1/user/profile', async () => {
    const updatePayload = {
      firstName: 'AliceUpdated',
      preferences: { language: 'en', bio: 'Architect' },
    };
    const updatedResponse = {
      userId: 'usr-42',
      username: 'alice',
      ...updatePayload,
    };

    vi.mocked(springApiClient.put).mockResolvedValueOnce({ data: updatedResponse });

    const { result } = renderHook(() => useUpdateUserProfileMutation(), { wrapper });

    await result.current.mutateAsync(updatePayload);

    expect(springApiClient.put).toHaveBeenCalledWith('/v1/user/profile', updatePayload);
  });
});
