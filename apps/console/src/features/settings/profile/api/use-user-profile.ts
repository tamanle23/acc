import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth';
import type { UserProfileDto, UpdateUserProfileRequest } from '@acc/client';

export const USER_PROFILE_QUERY_KEY = ['user', 'profile'] as const;

/**
 * Standard Spring ResponseWrapper unwrapper.
 * Extracts the inner payload if wrapped in { headers, status, body, errors },
 * otherwise returns data directly.
 */
export function unwrapUserProfile(data: unknown): UserProfileDto {
  if (!data || typeof data !== 'object') {
    return {} as UserProfileDto;
  }
  const obj = data as Record<string, unknown>;
  if ('body' in obj && obj.body && typeof obj.body === 'object') {
    return obj.body as UserProfileDto;
  }
  return data as UserProfileDto;
}

/**
 * Hook to retrieve user profile details and preferences via GET /api/v1/user/profile.
 */
export function useUserProfileQuery() {
  return useQuery({
    queryKey: USER_PROFILE_QUERY_KEY,
    queryFn: async (): Promise<UserProfileDto> => {
      const { data } = await springApiClient.get<unknown>('/v1/user/profile');
      return unwrapUserProfile(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to update self-service user profile details and UI preferences via PUT /api/v1/user/profile.
 */
export function useUpdateUserProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateUserProfileRequest): Promise<UserProfileDto> => {
      const { data } = await springApiClient.put<unknown>('/v1/user/profile', payload);
      return unwrapUserProfile(data);
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(USER_PROFILE_QUERY_KEY, updatedProfile);
    },
  });
}
