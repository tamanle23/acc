import { springApiClient } from '@/features/spring-auth/api-client';
import type { MetadataDataSource, ChildPaginationRequestMap } from './metadata-data-source';
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

const BASE_URL = '/v1/metadata';

interface SpringResponseWrapper<T> {
  header?: unknown;
  body: T;
  errors?: unknown[];
}

function unwrapResponse<T>(data: SpringResponseWrapper<T> | T): T {
  if (data && typeof data === 'object' && 'body' in data) {
    return (data as SpringResponseWrapper<T>).body;
  }
  return data as T;
}

export class HttpMetadataService implements MetadataDataSource {
  // ==========================================
  // 1. Entity Types
  // ==========================================
  async getEntityTypes(params?: PageRequestParams): Promise<PageResponse<EntityType>> {
    const res = await springApiClient.get(`${BASE_URL}/entity-types`, {
      params: {
        number: params?.number || 1,
        size: params?.size || 10,
        sort: params?.sort,
        search: params?.search,
      },
    });
    return unwrapResponse(res.data);
  }

  async getEntityTypeById(id: string | number): Promise<EntityType | null> {
    const res = await springApiClient.get(`${BASE_URL}/entity-types/${id}`);
    return unwrapResponse(res.data);
  }

  async createEntityType(dto: CreateEntityTypeDto): Promise<EntityType> {
    const res = await springApiClient.post(`${BASE_URL}/entity-types`, dto);
    return unwrapResponse(res.data);
  }

  async updateEntityType(id: string | number, dto: UpdateEntityTypeDto): Promise<EntityType> {
    const res = await springApiClient.put(`${BASE_URL}/entity-types/${id}`, dto);
    return unwrapResponse(res.data);
  }

  async deleteEntityType(id: string | number): Promise<boolean> {
    await springApiClient.delete(`${BASE_URL}/entity-types/${id}`);
    return true;
  }

  async getCompiledSchema(id: string | number): Promise<CompiledSchema> {
    const res = await springApiClient.get(`${BASE_URL}/entity-types/${id}/schema`);
    return unwrapResponse(res.data);
  }

  async getSchemaDriftAnalysis(id: string | number): Promise<SchemaDriftAnalysisResponse> {
    const res = await springApiClient.get(`${BASE_URL}/entity-types/${id}/drift`);
    return unwrapResponse(res.data);
  }

  async executeSchemaBackfill(
    id: string | number,
    batchSize: number = 100
  ): Promise<SchemaBackfillExecutionResponse> {
    const res = await springApiClient.post(
      `${BASE_URL}/entity-types/${id}/backfill`,
      null,
      { params: { batchSize } }
    );
    return unwrapResponse(res.data);
  }

  // ==========================================
  // 2. Attribute Definitions
  // ==========================================
  async getAttributeDefinitions(
    entityTypeId: string | number,
    params?: PageRequestParams
  ): Promise<PageResponse<AttributeDefinition>> {
    const res = await springApiClient.get(`${BASE_URL}/entity-types/${entityTypeId}/attributes`, {
      params: {
        number: params?.number || 1,
        size: params?.size || 50,
        sort: params?.sort,
      },
    });
    return unwrapResponse(res.data);
  }

  async getAttributeDefinition(
    entityTypeId: string | number,
    attrId: string | number
  ): Promise<AttributeDefinition | null> {
    const res = await springApiClient.get(
      `${BASE_URL}/entity-types/${entityTypeId}/attributes/${attrId}`
    );
    return unwrapResponse(res.data);
  }

  async createAttributeDefinition(
    entityTypeId: string | number,
    dto: CreateAttributeDefinitionDto
  ): Promise<AttributeDefinition> {
    const res = await springApiClient.post(
      `${BASE_URL}/entity-types/${entityTypeId}/attributes`,
      dto
    );
    return unwrapResponse(res.data);
  }

  async updateAttributeDefinition(
    entityTypeId: string | number,
    attrId: string | number,
    dto: UpdateAttributeDefinitionDto
  ): Promise<AttributeDefinition> {
    const res = await springApiClient.put(
      `${BASE_URL}/entity-types/${entityTypeId}/attributes/${attrId}`,
      dto
    );
    return unwrapResponse(res.data);
  }

  async deleteAttributeDefinition(
    entityTypeId: string | number,
    attrId: string | number,
    force?: boolean
  ): Promise<boolean> {
    await springApiClient.delete(
      `${BASE_URL}/entity-types/${entityTypeId}/attributes/${attrId}`,
      {
        params: { force: Boolean(force) },
      }
    );
    return true;
  }

  async archiveAttribute(
    entityTypeId: string | number,
    attrId: string | number
  ): Promise<AttributeDefinition> {
    const res = await springApiClient.post(
      `${BASE_URL}/entity-types/${entityTypeId}/attributes/${attrId}/archive`
    );
    return unwrapResponse(res.data);
  }

  async unarchiveAttribute(
    entityTypeId: string | number,
    attrId: string | number
  ): Promise<AttributeDefinition> {
    const res = await springApiClient.post(
      `${BASE_URL}/entity-types/${entityTypeId}/attributes/${attrId}/unarchive`
    );
    return unwrapResponse(res.data);
  }

  async reorderAttributes(
    entityTypeId: string | number,
    attributeIds: Array<string | number>
  ): Promise<boolean> {
    await springApiClient.put(`${BASE_URL}/entity-types/${entityTypeId}/attributes/order`, {
      attributeIds: attributeIds.map((id) => Number(id)),
    });
    return true;
  }

  // ==========================================
  // 3. Entity Records
  // ==========================================
  async getEntityRecords(
    entityTypeId: string | number,
    params?: PageRequestParams
  ): Promise<PageResponse<EntityRecord>> {
    const queryParams: Record<string, unknown> = {
      number: params?.number || 1,
      size: params?.size || 10,
      sort: params?.sort,
      tenantId: params?.tenantId,
    };

    if (params?.filters) {
      Object.entries(params.filters).forEach(([field, filterVal]) => {
        if (typeof filterVal === 'object' && filterVal !== null) {
          Object.entries(filterVal).forEach(([op, val]) => {
            queryParams[`filter[${field}][${op}]`] = val;
          });
        } else if (filterVal !== undefined && filterVal !== '') {
          queryParams[`filter[${field}]`] = filterVal;
        }
      });
    }

    const res = await springApiClient.get(
      `${BASE_URL}/entity-types/${entityTypeId}/records`,
      { params: queryParams }
    );
    return unwrapResponse(res.data);
  }

  async getEntityRecord(
    entityTypeId: string | number,
    recordId: string | number
  ): Promise<EntityRecord | null> {
    const res = await springApiClient.get(
      `${BASE_URL}/entity-types/${entityTypeId}/records/${recordId}`
    );
    return unwrapResponse(res.data);
  }

  async createEntityRecord(
    entityTypeId: string | number,
    dto: CreateEntityRecordDto
  ): Promise<EntityRecord> {
    const res = await springApiClient.post(
      `${BASE_URL}/entity-types/${entityTypeId}/records`,
      dto
    );
    return unwrapResponse(res.data);
  }

  async updateEntityRecord(
    entityTypeId: string | number,
    recordId: string | number,
    dto: UpdateEntityRecordDto
  ): Promise<EntityRecord> {
    const res = await springApiClient.put(
      `${BASE_URL}/entity-types/${entityTypeId}/records/${recordId}`,
      dto
    );
    return unwrapResponse(res.data);
  }

  async patchEntityRecord(
    entityTypeId: string | number,
    recordId: string | number,
    dto: Partial<CreateEntityRecordDto>
  ): Promise<EntityRecord> {
    const res = await springApiClient.patch(
      `${BASE_URL}/entity-types/${entityTypeId}/records/${recordId}`,
      dto
    );
    return unwrapResponse(res.data);
  }

  async deleteEntityRecord(
    entityTypeId: string | number,
    recordId: string | number
  ): Promise<boolean> {
    await springApiClient.delete(
      `${BASE_URL}/entity-types/${entityTypeId}/records/${recordId}`
    );
    return true;
  }

  async transitionRecordState(
    entityTypeId: string | number,
    recordId: string | number,
    action: string,
    additionalAttributes?: Record<string, unknown>
  ): Promise<EntityRecord> {
    const res = await springApiClient.post(
      `${BASE_URL}/entity-types/${entityTypeId}/records/${recordId}/transition`,
      additionalAttributes || {},
      {
        params: { action },
      }
    );
    return unwrapResponse(res.data);
  }

  async getRecordAuditLogs(
    entityTypeId: string | number,
    recordId: string | number
  ): Promise<RecordAuditLog[]> {
    const res = await springApiClient.get(
      `${BASE_URL}/entity-types/${entityTypeId}/records/${recordId}/audit`
    );
    return unwrapResponse(res.data);
  }

  async previewRestoreRecord(
    entityTypeId: string | number,
    recordId: string | number,
    auditLogId: string | number
  ): Promise<RestorePreviewResponse> {
    const res = await springApiClient.get(
      `${BASE_URL}/entity-types/${entityTypeId}/records/${recordId}/restore-preview/${auditLogId}`
    );
    return unwrapResponse(res.data);
  }

  async restoreRecordVersion(
    entityTypeId: string | number,
    recordId: string | number,
    auditLogId: string | number
  ): Promise<EntityRecord> {
    const res = await springApiClient.post(
      `${BASE_URL}/entity-types/${entityTypeId}/records/${recordId}/restore/${auditLogId}`
    );
    return unwrapResponse(res.data);
  }

  async getEntityFacets(
    entityTypeId: string | number,
    params?: PageRequestParams
  ): Promise<EntityFacetsResponse> {
    const queryParams: Record<string, unknown> = {
      tenantId: params?.tenantId,
    };

    if (params?.filters) {
      Object.entries(params.filters).forEach(([field, filterVal]) => {
        if (typeof filterVal === 'object' && filterVal !== null) {
          Object.entries(filterVal).forEach(([op, val]) => {
            queryParams[`filter[${field}][${op}]`] = val;
          });
        } else if (filterVal !== undefined && filterVal !== '') {
          queryParams[`filter[${field}]`] = filterVal;
        }
      });
    }

    const res = await springApiClient.get(
      `${BASE_URL}/entity-types/${entityTypeId}/facets`,
      { params: queryParams }
    );
    return unwrapResponse(res.data);
  }

  async validateEntityRecord(
    entityTypeId: string | number,
    dto: CreateEntityRecordDto
  ): Promise<ValidateRecordResponse> {
    const res = await springApiClient.post(
      `${BASE_URL}/entity-types/${entityTypeId}/records/validate`,
      dto
    );
    return unwrapResponse(res.data);
  }

  // ==========================================
  // 4. Relationship Types
  // ==========================================
  async getRelationshipTypes(params?: PageRequestParams): Promise<PageResponse<RelationshipType>> {
    const res = await springApiClient.get(`${BASE_URL}/relationship-types`, {
      params: {
        number: params?.number || 1,
        size: params?.size || 50,
        sort: params?.sort,
      },
    });
    return unwrapResponse(res.data);
  }

  async getRelationshipType(id: string | number): Promise<RelationshipType | null> {
    const res = await springApiClient.get(`${BASE_URL}/relationship-types/${id}`);
    return unwrapResponse(res.data);
  }

  async createRelationshipType(dto: CreateRelationshipTypeDto): Promise<RelationshipType> {
    const res = await springApiClient.post(`${BASE_URL}/relationship-types`, dto);
    return unwrapResponse(res.data);
  }

  async updateRelationshipType(
    id: string | number,
    dto: UpdateRelationshipTypeDto
  ): Promise<RelationshipType> {
    const res = await springApiClient.put(`${BASE_URL}/relationship-types/${id}`, dto);
    return unwrapResponse(res.data);
  }

  async deleteRelationshipType(id: string | number, force?: boolean): Promise<boolean> {
    await springApiClient.delete(`${BASE_URL}/relationship-types/${id}`, {
      params: { force: Boolean(force) },
    });
    return true;
  }

  // ==========================================
  // 5. Entity Relationships
  // ==========================================
  async getRecordRelationships(
    recordId: string | number,
    params?: PageRequestParams
  ): Promise<PageResponse<EntityRelationship>> {
    const res = await springApiClient.get(`${BASE_URL}/records/${recordId}/relationships`, {
      params: {
        number: params?.number || 1,
        size: params?.size || 20,
        direction: params?.direction,
      },
    });
    return unwrapResponse(res.data);
  }

  async createEntityRelationship(
    recordId: string | number,
    dto: CreateEntityRelationshipDto
  ): Promise<EntityRelationship> {
    const res = await springApiClient.post(
      `${BASE_URL}/records/${recordId}/relationships`,
      dto
    );
    return unwrapResponse(res.data);
  }

  async deleteEntityRelationship(
    recordId: string | number,
    relationshipId: string | number
  ): Promise<boolean> {
    await springApiClient.delete(
      `${BASE_URL}/records/${recordId}/relationships/${relationshipId}`
    );
    return true;
  }

  // ==========================================
  // 6. Composite Records
  // ==========================================
  async getCompositeRecords(
    entityTypeId: string | number,
    params?: PageRequestParams,
    childParams?: ChildPaginationRequestMap
  ): Promise<PageResponse<CompositeRecordResponse>> {
    const queryParams: Record<string, unknown> = {
      number: params?.number || 1,
      size: params?.size || 10,
    };
    if (childParams) {
      for (const [alias, child] of Object.entries(childParams)) {
        if (child.limit !== undefined) {
          queryParams[`childLimit[${alias}]`] = child.limit;
        }
        if (child.offset !== undefined) {
          queryParams[`childOffset[${alias}]`] = child.offset;
        }
      }
    }
    const res = await springApiClient.get(`${BASE_URL}/composite-entities/${entityTypeId}/records`, {
      params: queryParams,
    });
    return unwrapResponse(res.data);
  }

  async getCompositeRecordById(
    entityTypeId: string | number,
    recordId: string | number,
    childParams?: ChildPaginationRequestMap
  ): Promise<CompositeRecordResponse | null> {
    const queryParams: Record<string, unknown> = {};
    if (childParams) {
      for (const [alias, child] of Object.entries(childParams)) {
        if (child.limit !== undefined) {
          queryParams[`childLimit[${alias}]`] = child.limit;
        }
        if (child.offset !== undefined) {
          queryParams[`childOffset[${alias}]`] = child.offset;
        }
      }
    }
    const res = await springApiClient.get(
      `${BASE_URL}/composite-entities/${entityTypeId}/records/${recordId}`,
      { params: queryParams }
    );
    return unwrapResponse(res.data);
  }
}

export const httpMetadataService = new HttpMetadataService();
