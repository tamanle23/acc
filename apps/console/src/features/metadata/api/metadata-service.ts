import { httpMetadataService } from './http-metadata-service';
import type { MetadataDataSource } from './metadata-data-source';
import { mockMetadataStore } from '../data/mock-metadata';

export type MetadataMode = 'http' | 'mock';

class MetadataServiceStrategy implements MetadataDataSource {
  private currentMode: MetadataMode;

  constructor() {
    // In production, strictly enforce http mode
    if (!import.meta.env.DEV) {
      this.currentMode = 'http';
      return;
    }

    // Default to mock if VITE_METADATA_MOCK is explicitly true or fallback
    const isMock =
      import.meta.env.VITE_METADATA_MOCK === 'true' ||
      import.meta.env.VITE_METADATA_MOCK === '1';

    this.currentMode = isMock ? 'mock' : 'http';
  }

  public setMode(mode: MetadataMode) {
    if (!import.meta.env.DEV && mode === 'mock') {
      return;
    }
    this.currentMode = mode;
  }

  public getMode(): MetadataMode {
    return this.currentMode;
  }

  private get activeService(): MetadataDataSource {
    // If explicitly set, respect currentMode; otherwise fallback to unified sandbox or env flag
    if (this.currentMode === 'mock') {
      return mockMetadataStore;
    }
    return httpMetadataService;
  }

  // 1. Entity Types
  getEntityTypes(params?: any) {
    return this.activeService.getEntityTypes(params);
  }

  getEntityTypeById(id: string | number) {
    return this.activeService.getEntityTypeById(id);
  }

  createEntityType(dto: any) {
    return this.activeService.createEntityType(dto);
  }

  updateEntityType(id: string | number, dto: any) {
    return this.activeService.updateEntityType(id, dto);
  }

  deleteEntityType(id: string | number) {
    return this.activeService.deleteEntityType(id);
  }

  getCompiledSchema(id: string | number) {
    return this.activeService.getCompiledSchema(id);
  }

  getSchemaDriftAnalysis(id: string | number) {
    return this.activeService.getSchemaDriftAnalysis(id);
  }

  executeSchemaBackfill(id: string | number, batchSize?: number) {
    return this.activeService.executeSchemaBackfill(id, batchSize);
  }

  // 2. Attribute Definitions
  getAttributeDefinitions(entityTypeId: string | number, params?: any) {
    return this.activeService.getAttributeDefinitions(entityTypeId, params);
  }

  getAttributeDefinition(entityTypeId: string | number, attrId: string | number) {
    return this.activeService.getAttributeDefinition(entityTypeId, attrId);
  }

  createAttributeDefinition(entityTypeId: string | number, dto: any) {
    return this.activeService.createAttributeDefinition(entityTypeId, dto);
  }

  updateAttributeDefinition(entityTypeId: string | number, attrId: string | number, dto: any) {
    return this.activeService.updateAttributeDefinition(entityTypeId, attrId, dto);
  }

  deleteAttributeDefinition(entityTypeId: string | number, attrId: string | number, force?: boolean) {
    return this.activeService.deleteAttributeDefinition(entityTypeId, attrId, force);
  }

  archiveAttribute(entityTypeId: string | number, attrId: string | number) {
    return this.activeService.archiveAttribute(entityTypeId, attrId);
  }

  unarchiveAttribute(entityTypeId: string | number, attrId: string | number) {
    return this.activeService.unarchiveAttribute(entityTypeId, attrId);
  }

  reorderAttributes(entityTypeId: string | number, attributeIds: Array<string | number>) {
    return this.activeService.reorderAttributes(entityTypeId, attributeIds);
  }

  // 3. Entity Records
  getEntityRecords(entityTypeId: string | number, params?: any) {
    return this.activeService.getEntityRecords(entityTypeId, params);
  }

  getEntityRecord(entityTypeId: string | number, recordId: string | number) {
    return this.activeService.getEntityRecord(entityTypeId, recordId);
  }

  createEntityRecord(entityTypeId: string | number, dto: any) {
    return this.activeService.createEntityRecord(entityTypeId, dto);
  }

  updateEntityRecord(entityTypeId: string | number, recordId: string | number, dto: any) {
    return this.activeService.updateEntityRecord(entityTypeId, recordId, dto);
  }

  patchEntityRecord(entityTypeId: string | number, recordId: string | number, dto: any) {
    return this.activeService.patchEntityRecord(entityTypeId, recordId, dto);
  }

  deleteEntityRecord(entityTypeId: string | number, recordId: string | number) {
    return this.activeService.deleteEntityRecord(entityTypeId, recordId);
  }

  getEntityFacets(entityTypeId: string | number, params?: any) {
    return this.activeService.getEntityFacets(entityTypeId, params);
  }

  validateEntityRecord(entityTypeId: string | number, dto: any) {
    return this.activeService.validateEntityRecord(entityTypeId, dto);
  }

  transitionRecordState(
    entityTypeId: string | number,
    recordId: string | number,
    action: string,
    additionalAttributes?: Record<string, unknown>
  ) {
    return this.activeService.transitionRecordState(entityTypeId, recordId, action, additionalAttributes);
  }

  getRecordAuditLogs(entityTypeId: string | number, recordId: string | number) {
    return this.activeService.getRecordAuditLogs(entityTypeId, recordId);
  }

  previewRestoreRecord(entityTypeId: string | number, recordId: string | number, auditLogId: string | number) {
    return this.activeService.previewRestoreRecord(entityTypeId, recordId, auditLogId);
  }

  restoreRecordVersion(entityTypeId: string | number, recordId: string | number, auditLogId: string | number) {
    return this.activeService.restoreRecordVersion(entityTypeId, recordId, auditLogId);
  }

  // 4. Relationship Types
  getRelationshipTypes(params?: any) {
    return this.activeService.getRelationshipTypes(params);
  }

  getRelationshipType(id: string | number) {
    return this.activeService.getRelationshipType(id);
  }

  createRelationshipType(dto: any) {
    return this.activeService.createRelationshipType(dto);
  }

  updateRelationshipType(id: string | number, dto: any) {
    return this.activeService.updateRelationshipType(id, dto);
  }

  deleteRelationshipType(id: string | number, force?: boolean) {
    return this.activeService.deleteRelationshipType(id, force);
  }

  // 5. Entity Relationships
  getRecordRelationships(recordId: string | number, params?: any) {
    return this.activeService.getRecordRelationships(recordId, params);
  }

  createEntityRelationship(recordId: string | number, dto: any) {
    return this.activeService.createEntityRelationship(recordId, dto);
  }

  deleteEntityRelationship(recordId: string | number, relationshipId: string | number) {
    return this.activeService.deleteEntityRelationship(recordId, relationshipId);
  }

  // 6. Composite Records
  getCompositeRecords(
    entityTypeId: string | number,
    params?: any,
    childParams?: any
  ) {
    return this.activeService.getCompositeRecords(entityTypeId, params, childParams);
  }

  getCompositeRecordById(
    entityTypeId: string | number,
    recordId: string | number,
    childParams?: any
  ) {
    return this.activeService.getCompositeRecordById(entityTypeId, recordId, childParams);
  }
}

export const metadataService = new MetadataServiceStrategy();
