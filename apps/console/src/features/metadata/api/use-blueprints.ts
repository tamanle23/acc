import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth/api-client';
import type {
  BlueprintManifest,
  BlueprintSummaryDto,
  TenantProvisioningRequest,
  TenantProvisioningResult,
} from './types';
import { toast } from 'sonner';

import { mockBlueprintManifests, mockBlueprintSummaries } from '../data/mock-blueprints';

export const useBlueprintCatalog = () => {
  return useQuery({
    queryKey: ['metadata', 'blueprints'],
    queryFn: async (): Promise<BlueprintSummaryDto[]> => {
      try {
        const res = await springApiClient.get('/v1/metadata/blueprints');
        if (res.status === 200) {
          const body = res.data?.body ?? res.data?.data ?? res.data;
          if (Array.isArray(body) && body.length > 0) {
            return body;
          }
        }
        return mockBlueprintSummaries;
      } catch (err) {
        console.warn('Failed to load blueprint catalog from API, falling back to local blueprints:', err);
        return mockBlueprintSummaries;
      }
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useBlueprintDetails = (blueprintId: string | null) => {
  return useQuery({
    queryKey: ['metadata', 'blueprint', blueprintId],
    queryFn: async (): Promise<BlueprintManifest | null> => {
      if (!blueprintId) return null;
      try {
        const res = await springApiClient.get(`/v1/metadata/blueprints/${blueprintId}`);
        if (res.status === 200) {
          const body = res.data?.body ?? res.data?.data ?? res.data;
          if (body && typeof body === 'object' && body.id) {
            return body;
          }
        }
        return mockBlueprintManifests.find((b) => b.id === blueprintId) ?? null;
      } catch (err) {
        console.warn(`Failed to fetch blueprint details for ${blueprintId}, falling back to local manifest:`, err);
        return mockBlueprintManifests.find((b) => b.id === blueprintId) ?? null;
      }
    },
    enabled: Boolean(blueprintId),
    staleTime: 30 * 60 * 1000,
  });
};

export const useProvisionTenantBlueprint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TenantProvisioningRequest): Promise<TenantProvisioningResult> => {
      const res = await springApiClient.post('/v1/metadata/tenants/provision', payload);
      return res.data?.body ?? res.data?.data ?? res.data;
    },
    onSuccess: (data) => {
      // Invalidate metadata queries so left rail and relationship graphs update immediately
      queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-types'] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'relationship-types'] });
      toast.success(
        `Workspace initialized with "${data.blueprintName}" (${data.createdEntityTypesCount} models, ${data.createdAttributesCount} fields)`
      );
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to provision blueprint';
      toast.error(`Blueprint provisioning failed: ${msg}`);
    },
  });
};
