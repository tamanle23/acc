import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth';
import type { UserProfileDto, UpdateUserProfileRequest } from '@acc/client';

export const USER_PROFILE_QUERY_KEY = ['user', 'profile'] as const;

/**
 * Hook to retrieve user profile details and preferences via GET /api/v1/user/profile.
 */
export function useUserProfileQuery() {
  return useQuery({
    queryKey: USER_PROFILE_QUERY_KEY,
    queryFn: async (): Promise<UserProfileDto> => {
      const { data } = await springApiClient.get<UserProfileDto>('/v1/user/profile');
      return data;
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
      const { data } = await springApiClient.put<UserProfileDto>('/v1/user/profile', payload);
      return data;
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(USER_PROFILE_QUERY_KEY, updatedProfile);
    },
  });
}
