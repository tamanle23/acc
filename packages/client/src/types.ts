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

export interface EntityType {
  id: string | number;
  name: string;
  systemName: string;
  description?: string;
  tenantId?: string;
  schemaVersion?: number;
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
// 3. Pagination & Query Types
// ==========================================

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // 1-indexed in unipost PageRequest
  size: number;
}

export interface PageRequestParams {
  number?: number;
  size?: number;
  sort?: string;
  tenantId?: string;
  direction?: 'incoming' | 'outgoing' | 'both';
  filters?: Record<string, string | Record<string, string>>;
  [key: string]: unknown;
}

// ==========================================
// 4. Mutation DTOs
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
// 5. Validation, Drift & Backfill Responses
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
// 6. Domain Blueprint Types
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

// ==========================================
// 7. Billing, Subscriptions & Quotas
// ==========================================

export type SubscriptionTier = 'BASIC' | 'PRO' | 'PRO_MAX' | 'ENTERPRISE';

export interface QuotaUsage {
  workspacesUsed: number;
  maxWorkspaces: number; // -1 for unlimited
  schemasUsed: number;
  maxSchemas: number; // -1 for unlimited
  recordsUsed: number;
  maxRecords: number; // -1 for unlimited
}

export interface VatInvoiceInfo {
  companyName: string;
  taxCode: string;
  address: string;
  email: string;
  isAutoInvoice: boolean;
}

export interface BillingTransaction {
  orderCode: number;
  amount: number;
  planTier: SubscriptionTier;
  billingCadence: 'MONTHLY' | 'YEARLY';
  status: string;
  description: string;
  createdAt: string;
  paidAt?: string | null;
}

export interface TenantBillingSummary {
  tenantId: string;
  planTier: SubscriptionTier;
  billingCadence: 'MONTHLY' | 'YEARLY';
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  amountPaid: number;
  expiresAt: string | null;
  entitledFeatures: string[];
  quotas?: QuotaUsage;
  vatInvoice?: VatInvoiceInfo;
  history?: BillingTransaction[];
}

export interface CreatePaymentLinkPayload {
  planTier: 'PRO' | 'PRO_MAX';
  cadence: 'MONTHLY' | 'YEARLY';
  returnUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResponse {
  orderCode: number;
  amount: number;
  description: string;
  checkoutUrl: string;
  qrCode: string;
  status: string;
}

export interface ContactSalesPayload {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  seatCount?: number;
  requirements?: string;
}

// ==========================================
// 8. RFC 7807 Problem Detail
// ==========================================

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}
