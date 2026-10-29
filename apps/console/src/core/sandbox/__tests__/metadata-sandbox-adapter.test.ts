import { describe, it, expect, beforeEach } from 'vitest';
import { sandboxManager, useSandboxStore, sandboxRegistry, metadataSandboxAdapter, mockMetadataStore } from '../index';

describe('Extended Metadata Sandbox Adapter Routes', () => {
  beforeEach(() => {
    sandboxRegistry.clear();
    sandboxRegistry.register(metadataSandboxAdapter);
    useSandboxStore.getState().resetToDefaults();
    useSandboxStore.getState().setEnabled(true);
    mockMetadataStore.resetToInitialState();
  });

  describe('Attribute Definitions CRUD & Lifecycle', () => {
    it('should list attribute definitions for entity type', async () => {
      const res = await sandboxManager.handleRequest({
        url: '/v1/metadata/entity-types/1/attributes',
        method: 'GET',
      });

      expect(res?.status).toBe(200);
      expect(res?.data.content.length).toBeGreaterThan(0);
    });

    it('should create, update, archive, unarchive, and delete attribute definition', async () => {
      // 1. Create attribute
      const createRes = await sandboxManager.handleRequest({
        url: '/v1/metadata/entity-types/1/attributes',
        method: 'POST',
        data: {
          name: 'loyalty_tier',
          displayName: 'Loyalty Tier',
          dataType: 'STRING',
          isSearchable: true,
          isFilterable: true,
        },
      });

      expect(createRes?.status).toBe(201);
      const attrId = createRes?.data.id;
      expect(attrId).toBeDefined();

      // 2. Update attribute
      const updateRes = await sandboxManager.handleRequest({
        url: `/v1/metadata/entity-types/1/attributes/${attrId}`,
        method: 'PUT',
        data: { displayName: 'VIP Loyalty Tier' },
      });
      expect(updateRes?.status).toBe(200);
      expect(updateRes?.data.displayName).toBe('VIP Loyalty Tier');

      // 3. Archive attribute
      const archiveRes = await sandboxManager.handleRequest({
        url: `/v1/metadata/entity-types/1/attributes/${attrId}/archive`,
        method: 'POST',
      });
      expect(archiveRes?.status).toBe(200);
      expect(archiveRes?.data.isArchived).toBe(true);

      // 4. Unarchive attribute
      const unarchiveRes = await sandboxManager.handleRequest({
        url: `/v1/metadata/entity-types/1/attributes/${attrId}/unarchive`,
        method: 'POST',
      });
      expect(unarchiveRes?.status).toBe(200);
      expect(unarchiveRes?.data.isArchived).toBe(false);

      // 5. Delete attribute
      const deleteRes = await sandboxManager.handleRequest({
        url: `/v1/metadata/entity-types/1/attributes/${attrId}?force=true`,
        method: 'DELETE',
      });
      expect(deleteRes?.status).toBe(200);
      expect(deleteRes?.data.success).toBe(true);
    });

    it('should reorder attributes', async () => {
      const attrsRes = await sandboxManager.handleRequest({
        url: '/v1/metadata/entity-types/1/attributes',
        method: 'GET',
      });
      const ids = attrsRes?.data.content.map((a: any) => a.id) || [];

      const reorderRes = await sandboxManager.handleRequest({
        url: '/v1/metadata/entity-types/1/attributes/order',
        method: 'PUT',
        data: { attributeIds: [...ids].reverse() },
      });

      expect(reorderRes?.status).toBe(200);
      expect(reorderRes?.data.success).toBe(true);
    });
  });

  describe('Relationship Types & Record Relationships', () => {
    it('should list, create, update, and delete relationship types', async () => {
      // 1. List
      const listRes = await sandboxManager.handleRequest({
        url: '/v1/metadata/relationship-types',
        method: 'GET',
      });
      expect(listRes?.status).toBe(200);

      // 2. Create
      const createRes = await sandboxManager.handleRequest({
        url: '/v1/metadata/relationship-types',
        method: 'POST',
        data: {
          name: 'Parent Company Of',
          systemName: 'parent_company_of',
          sourceEntityTypeId: '1',
          targetEntityTypeId: '1',
          cardinality: 'ONE_TO_MANY',
        },
      });
      expect(createRes?.status).toBe(201);
      const relId = createRes?.data.id;

      // 3. Detail
      const detailRes = await sandboxManager.handleRequest({
        url: `/v1/metadata/relationship-types/${relId}`,
        method: 'GET',
      });
      expect(detailRes?.status).toBe(200);
      expect(detailRes?.data.name).toBe('Parent Company Of');

      // 4. Delete
      const delRes = await sandboxManager.handleRequest({
        url: `/v1/metadata/relationship-types/${relId}?force=true`,
        method: 'DELETE',
      });
      expect(delRes?.status).toBe(200);
    });

    it('should manage record relationships', async () => {
      // Create edge
      const edgeRes = await sandboxManager.handleRequest({
        url: '/v1/metadata/records/rec-1001/relationships',
        method: 'POST',
        data: {
          relationshipTypeId: 'rel-1',
          targetRecordId: 'rec-1002',
        },
      });
      expect(edgeRes?.status).toBe(201);
      const linkId = edgeRes?.data.id;

      // Query relationships
      const queryRes = await sandboxManager.handleRequest({
        url: '/v1/metadata/records/rec-1001/relationships?direction=OUTGOING',
        method: 'GET',
      });
      expect(queryRes?.status).toBe(200);

      // Delete relationship
      const delRes = await sandboxManager.handleRequest({
        url: `/v1/metadata/records/rec-1001/relationships/${linkId}`,
        method: 'DELETE',
      });
      expect(delRes?.status).toBe(200);
    });
  });

  describe('Entity Record Facets, Validation & Patch', () => {
    it('should return facets and validate record payload', async () => {
      const facetsRes = await sandboxManager.handleRequest({
        url: '/v1/metadata/entity-types/1/facets',
        method: 'GET',
      });
      expect(facetsRes?.status).toBe(200);

      const valRes = await sandboxManager.handleRequest({
        url: '/v1/metadata/entity-types/1/records/validate',
        method: 'POST',
        data: {
          attributes: { company_name: 'Acme Corp' },
        },
      });
      expect(valRes?.status).toBe(200);
      expect(valRes?.data.valid).toBeDefined();
      expect(Array.isArray(valRes?.data.errors)).toBe(true);
    });
  });
});
