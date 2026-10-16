// ==========================================
// 1. Primitive Metadata Data Types & UI Components
// ==========================================

export type DataType =
  | 'STRING'
  | 'INTEGER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'JSON'
  | 'RELATIONSHIP';

export type UiComponentType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'switch'
  | 'select'
  | 'multiselect'
  | 'datepicker'
  | 'json_editor'
  | 'relation_picker'
  | 'signature_pad'
  | 'geo_location'
  | 'barcode_scanner'
  | (string & {});

export type CardinalityType =
  | 'ONE_TO_ONE'
  | 'ONE_TO_MANY'
  | 'MANY_TO_ONE'
  | 'MANY_TO_MANY';

export interface AttributeDefinitionOptions {
  choices?: string[];
  min?: number;
  max?: number;
  pattern?: string;
  targetEntityTypeId?: string | number;
  placeholder?: string;
  [key: string]: unknown;
}

// ==========================================
// 2. Core Dynamic Entities
// ==========================================

export interface TransitionConfig {
  from: string;
  to: string;
  action: string;
  required_attributes?: string[];
  guard_expression?: string;
  allowed_roles?: string[];
}

export interface LifecycleConfig {
  state_field?: string;
  initial_state?: string;
  states?: string[];
  transitions?: TransitionConfig[];
}

export type CompositeJoinPattern = 'PATTERN_B_FOREIGN_KEY' | 'PATTERN_C_ASSOCIATION';

export interface CompositeField {
  source_attribute: string;
  alias?: string;
  data_type?: string;
  default_value?: any;
  required?: boolean;
}

export interface CompositeNode {
  target_entity_type_id: string | number;
  target_entity_system_name: string;
  alias?: string;
  join_pattern: CompositeJoinPattern;
  foreign_key_attribute?: string;
  relationship_type_id?: string | number;
  cardinality: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';
  fields: CompositeField[];
  children?: CompositeNode[];
}

export interface CompositeSpec {
  root_entity_type_id: string | number;
  root_entity_system_name: string;
  root_alias?: string;
  fields: CompositeField[];
  children?: CompositeNode[];
}

export interface EntityType {
  id: string | number;
  name: string;
  systemName: string;
  description?: string;
  tenantId?: string;
  schemaVersion?: number;
  lifecycleConfig?: LifecycleConfig;
  isComposite?: boolean;
  compositeSpec?: CompositeSpec;
  version?: number;
  createdDate?: string;
  updatedDate?: string;
}

export interface AttributeDefinition {
  id: string | number;
  entityTypeId?: string | number;
  tenantId?: string;
  name: string;
  systemName: string;
  dataType: DataType;
  uiComponent: UiComponentType;
  isRequired: boolean;
  isArchived?: boolean;
  displayOrder?: number;
  options?: AttributeDefinitionOptions;
  defaultValue?: string;
  version?: number;
  createdDate?: string;
  updatedDate?: string;
}

export interface EntityRecord {
  id: string | number;
  entityTypeId: string | number;
  tenantId?: string;
  attributes: Record<string, unknown>;
  version?: number;
  schemaVersion?: number;
  createdDate?: string;
  updatedDate?: string;
}

export interface RelationshipType {
  id: string | number;
  name: string;
  systemName: string;
  sourceEntityTypeId: string | number;
  targetEntityTypeId: string | number;
  cardinality: CardinalityType;
  cascadePolicy?: 'RESTRICT' | 'CASCADE' | 'SET_NULL';
  description?: string;
  version?: number;
  createdDate?: string;
  updatedDate?: string;
}

export interface EntityRelationship {
  id: string | number;
  relationshipTypeId: string | number;
  sourceRecordId: string | number;
  targetRecordId: string | number;
  attributes?: Record<string, unknown>;
  version?: number;
  createdDate?: string;
  updatedDate?: string;
}

export interface CompiledSchema {
  entityTypeId: string | number;
  schemaVersion: number;
  jsonSchema: string | Record<string, unknown>;
  updatedDate?: string;
}

// ==========================================
// 3. Mutation DTOs
// ==========================================

export type CreateEntityTypeDto = Omit<EntityType, 'id' | 'createdDate' | 'updatedDate' | 'schemaVersion'>;
export type UpdateEntityTypeDto = Partial<CreateEntityTypeDto> & { version?: number };

export type CreateAttributeDefinitionDto = Omit<
  AttributeDefinition,
  'id' | 'createdDate' | 'updatedDate'
>;
export type UpdateAttributeDefinitionDto = Partial<CreateAttributeDefinitionDto> & { version?: number };

export type CreateEntityRecordDto = Omit<
  EntityRecord,
  'id' | 'createdDate' | 'updatedDate'
>;
export type UpdateEntityRecordDto = Partial<CreateEntityRecordDto> & { version?: number };

export type CreateRelationshipTypeDto = Omit<
  RelationshipType,
  'id' | 'createdDate' | 'updatedDate'
>;
export type UpdateRelationshipTypeDto = Partial<CreateRelationshipTypeDto> & { version?: number };

export type CreateEntityRelationshipDto = Omit<
  EntityRelationship,
  'id' | 'createdDate' | 'updatedDate'
>;

// ==========================================
// 4. Validation, Drift, Backfill & Facets
// ==========================================

export interface ValidationErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ValidateRecordResponse {
  valid: boolean;
  entityTypeId: string | number;
  schemaVersion: number;
  errors: ValidationErrorDetail[];
}

export interface SchemaDriftAnalysisResponse {
  entityTypeId: string | number;
  currentSchemaVersion: number;
  totalRecords: number;
  outdatedRecords: number;
  compliantRecords: number;
}

export interface BackfillFailureDetail {
  recordId: string | number;
  reason: string;
}

export interface SchemaBackfillExecutionResponse {
  entityTypeId: string | number;
  targetSchemaVersion: number;
  processedRecords: number;
  migratedRecords: number;
  failedRecords: number;
  failures: BackfillFailureDetail[];
}

export interface FacetBucketDto {
  value: string;
  label?: string;
  count: number;
}

export interface FacetGroupDto {
  field: string;
  dataType: string;
  buckets: FacetBucketDto[];
}

export interface EntityFacetsResponse {
  entityTypeId: string | number;
  totalRecords: number;
  facets: FacetGroupDto[];
}

// ==========================================
// 5. Domain Blueprint Types
// ==========================================

export interface BlueprintSummaryDto {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  entityTypesCount: number;
  relationshipTypesCount: number;
}

export interface BlueprintAttribute {
  systemName: string;
  name: string;
  dataType: string;
  uiComponent: string;
  isRequired?: boolean;
  displayOrder?: number;
  defaultValue?: string;
  options?: Record<string, unknown>;
}

export interface BlueprintEntityType {
  systemName: string;
  name: string;
  description?: string;
  attributes: BlueprintAttribute[];
}

export interface BlueprintRelationship {
  systemName: string;
  name: string;
  description?: string;
  sourceEntityType: string;
  targetEntityType: string;
  cardinality: string;
}

export interface BlueprintManifest {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  entityTypes: BlueprintEntityType[];
  relationshipTypes: BlueprintRelationship[];
}

export interface TenantProvisioningRequest {
  tenantId: string;
  tenantName: string;
  blueprintId: string;
}

export interface TenantProvisioningResult {
  tenantId: string;
  tenantName: string;
  blueprintId: string;
  blueprintName: string;
  createdEntityTypesCount: number;
  createdAttributesCount: number;
  createdRelationshipsCount: number;
  createdEntityTypeNames: string[];
  durationMs: number;
}

export interface RecordAuditLog {
  id: string | number;
  tenantId?: string;
  entityTypeId: string | number;
  recordId: string | number;
  version: number;
  operation: 'CREATE' | 'UPDATE' | 'PATCH' | 'SOFT_DELETE' | 'RESTORE';
  oldAttributes?: Record<string, unknown> | null;
  newAttributes?: Record<string, unknown> | null;
  delta?: Record<string, { old: unknown; new: unknown }> | null;
  changedBy?: string | null;
  createdAt: string;
}

export interface RestorePreviewResponse {
  recordId: string | number;
  entityTypeId: string | number;
  targetAuditLogId: string | number;
  targetVersion: number;
  currentVersion: number;
  nextVersion: number;
  currentAttributes: Record<string, unknown>;
  restoredAttributes: Record<string, unknown>;
  delta: Record<string, { old: unknown; new: unknown }>;
}

export interface ChildPaginationMetadata {
  totalElements: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface CompositeRecordResponse {
  id: string | number;
  tenantId?: string;
  entityTypeId: string | number;
  isComposite: boolean;
  schemaVersion: number;
  attributes: Record<string, unknown>;
  childPagination?: Record<string, ChildPaginationMetadata>;
  engineUsed?: 'dynamic-sql-pushdown' | 'dataloader-fallback' | string;
  createdDate?: string;
  updatedDate?: string;
}

export interface CompositeRecordPageResponse {
  content: CompositeRecordResponse[];
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  pageSize: number;
}

