import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { metadataService } from './metadata-service';
import type {
  AttributeDefinition,
  CompiledSchema,
  CreateAttributeDefinitionDto,
  CreateEntityRecordDto,
  CreateEntityTypeDto,
  CreateEntityRelationshipDto,
  CreateRelationshipTypeDto,
  EntityRecord,
  EntityRelationship,
  EntityType,
  PageRequestParams,
  PageResponse,
  RelationshipType,
  SchemaBackfillExecutionResponse,
  SchemaDriftAnalysisResponse,
  UpdateAttributeDefinitionDto,
  UpdateEntityRecordDto,
  UpdateEntityTypeDto,
  UpdateRelationshipTypeDto,
  ValidateRecordResponse,
  EntityFacetsResponse,
  RecordAuditLog,
  RestorePreviewResponse,
  CompositeRecordResponse,
} from './types';
import type { ChildPaginationRequestMap } from './metadata-data-source';

// ==========================================
// 1. Entity Types Hooks
// ==========================================

export const useEntityTypes = (params?: PageRequestParams) => {
  return useQuery({
    queryKey: ['metadata', 'entity-types', params],
    queryFn: (): Promise<PageResponse<EntityType>> => metadataService.getEntityTypes(params),
    staleTime: 60 * 1000,
  });
};

export const useEntityType = (id: string | number | null) => {
  return useQuery({
    queryKey: ['metadata', 'entity-type', id],
    queryFn: (): Promise<EntityType | null> => (id ? metadataService.getEntityTypeById(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  });
};

export const useCompiledSchema = (entityTypeId: string | number | null) => {
  return useQuery({
    queryKey: ['metadata', 'compiled-schema', entityTypeId],
    queryFn: (): Promise<CompiledSchema | null> =>
      entityTypeId ? metadataService.getCompiledSchema(entityTypeId) : Promise.resolve(null),
    enabled: Boolean(entityTypeId),
    staleTime: 30 * 1000,
  });
};

export const useSchemaDriftAnalysis = (entityTypeId: string | number | null) => {
  return useQuery({
    queryKey: ['metadata', 'schema-drift', entityTypeId],
    queryFn: (): Promise<SchemaDriftAnalysisResponse | null> =>
      entityTypeId ? metadataService.getSchemaDriftAnalysis(entityTypeId) : Promise.resolve(null),
    enabled: Boolean(entityTypeId),
  });
};

export const useExecuteSchemaBackfill = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchSize?: number): Promise<SchemaBackfillExecutionResponse> =>
      metadataService.executeSchemaBackfill(entityTypeId, batchSize),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'schema-drift', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'records', entityTypeId] });
    },
  });
};

export const useCreateEntityType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEntityTypeDto): Promise<EntityType> => metadataService.createEntityType(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-types'] });
    },
  });
};

export const useUpdateEntityType = (id: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateEntityTypeDto): Promise<EntityType> => metadataService.updateEntityType(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-types'] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-type', id] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'compiled-schema', id] });
    },
  });
};

export const useDeleteEntityType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number): Promise<boolean> => metadataService.deleteEntityType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-types'] });
    },
  });
};

// ==========================================
// 2. Attribute Definitions Hooks
// ==========================================

export const useAttributeDefinitions = (
  entityTypeId: string | number | null,
  params?: PageRequestParams
) => {
  return useQuery({
    queryKey: ['metadata', 'attributes', entityTypeId, params],
    queryFn: (): Promise<PageResponse<AttributeDefinition>> => {
      if (!entityTypeId) {
        return Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 1, size: 10 });
      }
      return metadataService.getAttributeDefinitions(entityTypeId, params);
    },
    enabled: Boolean(entityTypeId),
    staleTime: 30 * 1000,
  });
};

export const useCreateAttributeDefinition = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAttributeDefinitionDto): Promise<AttributeDefinition> =>
      metadataService.createAttributeDefinition(entityTypeId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'attributes', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'compiled-schema', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-type', entityTypeId] });
    },
  });
};

export const useUpdateAttributeDefinition = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attributeId,
      dto,
    }: {
      attributeId: string | number;
      dto: UpdateAttributeDefinitionDto;
    }): Promise<AttributeDefinition> =>
      metadataService.updateAttributeDefinition(entityTypeId, attributeId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'attributes', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'compiled-schema', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-type', entityTypeId] });
    },
  });
};

export const useDeleteAttributeDefinition = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attributeId,
      force,
    }: {
      attributeId: string | number;
      force?: boolean;
    }): Promise<boolean> =>
      metadataService.deleteAttributeDefinition(entityTypeId, attributeId, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'attributes', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'compiled-schema', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-type', entityTypeId] });
    },
  });
};

export const useArchiveAttributeDefinition = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attributeId: string | number): Promise<AttributeDefinition> =>
      metadataService.archiveAttribute(entityTypeId, attributeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'attributes', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'compiled-schema', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-type', entityTypeId] });
    },
  });
};

export const useUnarchiveAttributeDefinition = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attributeId: string | number): Promise<AttributeDefinition> =>
      metadataService.unarchiveAttribute(entityTypeId, attributeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'attributes', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'compiled-schema', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-type', entityTypeId] });
    },
  });
};

export const useReorderAttributeDefinitions = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attributeIds: Array<string | number>): Promise<boolean> =>
      metadataService.reorderAttributes(entityTypeId, attributeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'attributes', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'compiled-schema', entityTypeId] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'entity-type', entityTypeId] });
    },
  });
};

// ==========================================
// 3. Entity Records Hooks
// ==========================================

export const useEntityRecords = (
  entityTypeId: string | number | null,
  params?: PageRequestParams
) => {
  return useQuery({
    queryKey: ['metadata', 'records', entityTypeId, params],
    queryFn: (): Promise<PageResponse<EntityRecord>> => {
      if (!entityTypeId) {
        return Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 1, size: 10 });
      }
      return metadataService.getEntityRecords(entityTypeId, params);
    },
    enabled: Boolean(entityTypeId),
    staleTime: 30 * 1000,
  });
};

export const useEntityRecord = (
  entityTypeId: string | number | null,
  recordId: string | number | null
) => {
  return useQuery({
    queryKey: ['metadata', 'record', entityTypeId, recordId],
    queryFn: (): Promise<EntityRecord | null> => {
      if (!entityTypeId || !recordId) return Promise.resolve(null);
      return metadataService.getEntityRecord(entityTypeId, recordId);
    },
    enabled: Boolean(entityTypeId && recordId),
  });
};

export const useEntityFacets = (
  entityTypeId: string | number | null,
  params?: PageRequestParams
) => {
  return useQuery({
    queryKey: ['metadata', 'facets', entityTypeId, params],
    queryFn: (): Promise<EntityFacetsResponse | null> => {
      if (!entityTypeId) return Promise.resolve(null);
      return metadataService.getEntityFacets(entityTypeId, params);
    },
    enabled: Boolean(entityTypeId),
    staleTime: 30 * 1000,
  });
};

export const useCreateEntityRecord = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEntityRecordDto): Promise<EntityRecord> =>
      metadataService.createEntityRecord(entityTypeId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'records', entityTypeId] });
    },
  });
};

export const useUpdateEntityRecord = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      dto,
    }: {
      recordId: string | number;
      dto: UpdateEntityRecordDto;
    }): Promise<EntityRecord> =>
      metadataService.updateEntityRecord(entityTypeId, recordId, dto),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'records', entityTypeId] });
      queryClient.invalidateQueries({
        queryKey: ['metadata', 'record', entityTypeId, variables.recordId],
      });
    },
  });
};

export const usePatchEntityRecord = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      dto,
    }: {
      recordId: string | number;
      dto: Partial<CreateEntityRecordDto>;
    }): Promise<EntityRecord> =>
      metadataService.patchEntityRecord(entityTypeId, recordId, dto),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'records', entityTypeId] });
      queryClient.invalidateQueries({
        queryKey: ['metadata', 'record', entityTypeId, variables.recordId],
      });
    },
  });
};

export const useDeleteEntityRecord = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string | number): Promise<boolean> =>
      metadataService.deleteEntityRecord(entityTypeId, recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'records', entityTypeId] });
    },
  });
};

export const useValidateEntityRecord = (entityTypeId: string | number) => {
  return useMutation({
    mutationFn: (dto: CreateEntityRecordDto): Promise<ValidateRecordResponse> =>
      metadataService.validateEntityRecord(entityTypeId, dto),
  });
};

export const useTransitionEntityRecord = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      action,
      additionalAttributes,
    }: {
      recordId: string | number;
      action: string;
      additionalAttributes?: Record<string, unknown>;
    }): Promise<EntityRecord> =>
      metadataService.transitionRecordState(entityTypeId, recordId, action, additionalAttributes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'records', entityTypeId] });
      queryClient.invalidateQueries({
        queryKey: ['metadata', 'record', entityTypeId, variables.recordId],
      });
    },
  });
};

export const useRecordAuditLogs = (
  entityTypeId: string | number | null,
  recordId: string | number | null
) => {
  return useQuery({
    queryKey: ['metadata', 'record-audit', entityTypeId, recordId],
    queryFn: (): Promise<RecordAuditLog[]> => {
      if (!entityTypeId || !recordId) return Promise.resolve([]);
      return metadataService.getRecordAuditLogs(entityTypeId, recordId);
    },
    enabled: Boolean(entityTypeId && recordId),
  });
};

export const usePreviewRestoreRecord = (
  entityTypeId: string | number | null,
  recordId: string | number | null,
  auditLogId: string | number | null
) => {
  return useQuery({
    queryKey: ['metadata', 'restore-preview', entityTypeId, recordId, auditLogId],
    queryFn: (): Promise<RestorePreviewResponse | null> => {
      if (!entityTypeId || !recordId || !auditLogId) return Promise.resolve(null);
      return metadataService.previewRestoreRecord(entityTypeId, recordId, auditLogId);
    },
    enabled: Boolean(entityTypeId && recordId && auditLogId),
  });
};

export const useRestoreRecordVersion = (entityTypeId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      auditLogId,
    }: {
      recordId: string | number;
      auditLogId: string | number;
    }): Promise<EntityRecord> =>
      metadataService.restoreRecordVersion(entityTypeId, recordId, auditLogId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'records', entityTypeId] });
      queryClient.invalidateQueries({
        queryKey: ['metadata', 'record', entityTypeId, variables.recordId],
      });
      queryClient.invalidateQueries({
        queryKey: ['metadata', 'record-audit', entityTypeId, variables.recordId],
      });
    },
  });
};

// ==========================================
// 4. Relationship Types Hooks
// ==========================================

export const useRelationshipTypes = (params?: PageRequestParams) => {
  return useQuery({
    queryKey: ['metadata', 'relationship-types', params],
    queryFn: (): Promise<PageResponse<RelationshipType>> =>
      metadataService.getRelationshipTypes(params),
    staleTime: 60 * 1000,
  });
};

export const useRelationshipType = (id: string | number | null) => {
  return useQuery({
    queryKey: ['metadata', 'relationship-type', id],
    queryFn: (): Promise<RelationshipType | null> =>
      id ? metadataService.getRelationshipType(id) : Promise.resolve(null),
    enabled: Boolean(id),
  });
};

export const useCreateRelationshipType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateRelationshipTypeDto): Promise<RelationshipType> =>
      metadataService.createRelationshipType(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'relationship-types'] });
    },
  });
};

export const useUpdateRelationshipType = (id: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateRelationshipTypeDto): Promise<RelationshipType> =>
      metadataService.updateRelationshipType(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'relationship-types'] });
      queryClient.invalidateQueries({ queryKey: ['metadata', 'relationship-type', id] });
    },
  });
};

export const useDeleteRelationshipType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string | number; force?: boolean }): Promise<boolean> =>
      metadataService.deleteRelationshipType(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'relationship-types'] });
    },
  });
};

// ==========================================
// 5. Entity Relationships Hooks
// ==========================================

export const useRecordRelationships = (
  recordId: string | number | null,
  params?: PageRequestParams
) => {
  return useQuery({
    queryKey: ['metadata', 'record-relationships', recordId, params],
    queryFn: (): Promise<PageResponse<EntityRelationship>> => {
      if (!recordId) {
        return Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 1, size: 20 });
      }
      return metadataService.getRecordRelationships(recordId, params);
    },
    enabled: Boolean(recordId),
  });
};

export const useCreateEntityRelationship = (recordId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEntityRelationshipDto): Promise<EntityRelationship> =>
      metadataService.createEntityRelationship(recordId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'record-relationships', recordId] });
    },
  });
};

export const useDeleteEntityRelationship = (recordId: string | number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (relationshipId: string | number): Promise<boolean> =>
      metadataService.deleteEntityRelationship(recordId, relationshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata', 'record-relationships', recordId] });
    },
  });
};

// ==========================================
// 6. Composite Records Hooks
// ==========================================

export const useCompositeRecords = (
  entityTypeId: string | number | null,
  params?: PageRequestParams,
  childParams?: ChildPaginationRequestMap
) => {
  return useQuery({
    queryKey: ['metadata', 'composite-records', entityTypeId, params, childParams],
    queryFn: (): Promise<PageResponse<CompositeRecordResponse>> => {
      if (!entityTypeId) {
        return Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 1, size: 10 });
      }
      return metadataService.getCompositeRecords(entityTypeId, params, childParams);
    },
    enabled: Boolean(entityTypeId),
    staleTime: 15 * 1000,
  });
};

export const useCompositeRecord = (
  entityTypeId: string | number | null,
  recordId: string | number | null,
  childParams?: ChildPaginationRequestMap
) => {
  return useQuery({
    queryKey: ['metadata', 'composite-record', entityTypeId, recordId, childParams],
    queryFn: (): Promise<CompositeRecordResponse | null> => {
      if (!entityTypeId || !recordId) {
        return Promise.resolve(null);
      }
      return metadataService.getCompositeRecordById(entityTypeId, recordId, childParams);
    },
    enabled: Boolean(entityTypeId && recordId),
    staleTime: 15 * 1000,
  });
};


