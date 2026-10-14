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
} from './types';

export interface MetadataDataSource {
  // 1. Entity Types
  getEntityTypes(params?: PageRequestParams): Promise<PageResponse<EntityType>>;
  getEntityTypeById(id: string | number): Promise<EntityType | null>;
  createEntityType(dto: CreateEntityTypeDto): Promise<EntityType>;
  updateEntityType(id: string | number, dto: UpdateEntityTypeDto): Promise<EntityType>;
  deleteEntityType(id: string | number): Promise<boolean>;
  getCompiledSchema(id: string | number): Promise<CompiledSchema>;
  getSchemaDriftAnalysis(id: string | number): Promise<SchemaDriftAnalysisResponse>;
  executeSchemaBackfill(id: string | number, batchSize?: number): Promise<SchemaBackfillExecutionResponse>;

  // 2. Attribute Definitions
  getAttributeDefinitions(
    entityTypeId: string | number,
    params?: PageRequestParams
  ): Promise<PageResponse<AttributeDefinition>>;
  getAttributeDefinition(
    entityTypeId: string | number,
    attrId: string | number
  ): Promise<AttributeDefinition | null>;
  createAttributeDefinition(
    entityTypeId: string | number,
    dto: CreateAttributeDefinitionDto
  ): Promise<AttributeDefinition>;
  updateAttributeDefinition(
    entityTypeId: string | number,
    attrId: string | number,
    dto: UpdateAttributeDefinitionDto
  ): Promise<AttributeDefinition>;
  deleteAttributeDefinition(
    entityTypeId: string | number,
    attrId: string | number,
    force?: boolean
  ): Promise<boolean>;
  archiveAttribute(
    entityTypeId: string | number,
    attrId: string | number
  ): Promise<AttributeDefinition>;
  unarchiveAttribute(
    entityTypeId: string | number,
    attrId: string | number
  ): Promise<AttributeDefinition>;
  reorderAttributes(
    entityTypeId: string | number,
    attributeIds: Array<string | number>
  ): Promise<boolean>;

  // 3. Entity Records
  getEntityRecords(
    entityTypeId: string | number,
    params?: PageRequestParams
  ): Promise<PageResponse<EntityRecord>>;
  getEntityRecord(
    entityTypeId: string | number,
    recordId: string | number
  ): Promise<EntityRecord | null>;
  createEntityRecord(
    entityTypeId: string | number,
    dto: CreateEntityRecordDto
  ): Promise<EntityRecord>;
  updateEntityRecord(
    entityTypeId: string | number,
    recordId: string | number,
    dto: UpdateEntityRecordDto
  ): Promise<EntityRecord>;
  patchEntityRecord(
    entityTypeId: string | number,
    recordId: string | number,
    dto: Partial<CreateEntityRecordDto>
  ): Promise<EntityRecord>;
  deleteEntityRecord(
    entityTypeId: string | number,
    recordId: string | number
  ): Promise<boolean>;
  getEntityFacets(
    entityTypeId: string | number,
    params?: PageRequestParams
  ): Promise<EntityFacetsResponse>;
  validateEntityRecord(
    entityTypeId: string | number,
    dto: CreateEntityRecordDto
  ): Promise<ValidateRecordResponse>;
  transitionRecordState(
    entityTypeId: string | number,
    recordId: string | number,
    action: string,
    additionalAttributes?: Record<string, unknown>
  ): Promise<EntityRecord>;

  // 4. Relationship Types
  getRelationshipTypes(params?: PageRequestParams): Promise<PageResponse<RelationshipType>>;
  getRelationshipType(id: string | number): Promise<RelationshipType | null>;
  createRelationshipType(dto: CreateRelationshipTypeDto): Promise<RelationshipType>;
  updateRelationshipType(
    id: string | number,
    dto: UpdateRelationshipTypeDto
  ): Promise<RelationshipType>;
  deleteRelationshipType(id: string | number, force?: boolean): Promise<boolean>;

  // 5. Entity Relationships
  getRecordRelationships(
    recordId: string | number,
    params?: PageRequestParams
  ): Promise<PageResponse<EntityRelationship>>;
  createEntityRelationship(
    recordId: string | number,
    dto: CreateEntityRelationshipDto
  ): Promise<EntityRelationship>;
  deleteEntityRelationship(
    recordId: string | number,
    relationshipId: string | number
  ): Promise<boolean>;
}
