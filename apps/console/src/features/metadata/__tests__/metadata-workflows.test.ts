import { describe, it, expect, beforeEach } from 'vitest';
import { mockMetadataStore } from '../data/mock-metadata';
import type { CreateAttributeDefinitionDto, CreateEntityRecordDto } from '../api/types';

describe('Metadata Management Full E2E & Flow Test Suite', () => {
  beforeEach(() => {
    mockMetadataStore.resetToInitialState();
  });

  describe('Workflow 1: Entity Model Lifecycle', () => {
    it('should list pre-seeded entity types', async () => {
      const res = await mockMetadataStore.getEntityTypes();
      expect(res.content.length).toBeGreaterThanOrEqual(3);
      expect(res.content.some((e) => e.systemName === 'customer_account')).toBe(true);
    });

    it('should create, update, and detect optimistic locking conflict on entity models', async () => {
      const newModel = await mockMetadataStore.createEntityType({
        name: 'Service Ticket',
        systemName: 'service_ticket',
        description: 'Customer support tickets',
      });

      expect(newModel.id).toBeDefined();
      expect(newModel.systemName).toBe('service_ticket');
      expect(newModel.version).toBe(1);

      // Successful update
      const updatedModel = await mockMetadataStore.updateEntityType(newModel.id, {
        name: 'Enterprise Service Ticket',
        description: 'Updated description',
        version: 1,
      });
      expect(updatedModel.name).toBe('Enterprise Service Ticket');
      expect(updatedModel.version).toBe(2);

      // Stale update (HTTP 409 simulation)
      await expect(
        mockMetadataStore.updateEntityType(newModel.id, {
          name: 'Conflict Try',
          version: 1, // Stale version!
        })
      ).rejects.toThrow();
    });
  });

  describe('Workflow 2: Schema Builder & Attribute Evolution', () => {
    it('should create new attributes and bump schemaVersion', async () => {
      const entityTypes = await mockMetadataStore.getEntityTypes();
      const targetEntity = entityTypes.content[0];
      const initialSchemaVersion = targetEntity.schemaVersion || 1;

      const newAttrDto: CreateAttributeDefinitionDto = {
        name: 'Priority Level',
        systemName: 'priority_level',
        uiComponent: 'select',
        dataType: 'STRING',
        isRequired: true,
        options: { choices: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      };

      const createdAttr = await mockMetadataStore.createAttributeDefinition(
        targetEntity.id,
        newAttrDto
      );

      expect(createdAttr.id).toBeDefined();
      expect(createdAttr.name).toBe('Priority Level');
      expect(createdAttr.displayOrder).toBeDefined();

      // Check schema compile
      const compiled = await mockMetadataStore.getCompiledSchema(targetEntity.id);
      expect(compiled.schemaVersion).toBeGreaterThan(initialSchemaVersion);
      const schemaObj = typeof compiled.jsonSchema === 'string' ? JSON.parse(compiled.jsonSchema) : compiled.jsonSchema;
      expect(schemaObj.properties).toHaveProperty('priority_level');
      expect(schemaObj.required).toContain('priority_level');
    });

    it('should archive and unarchive attribute without losing definitions', async () => {
      const entityTypes = await mockMetadataStore.getEntityTypes();
      const targetEntity = entityTypes.content[0];
      const attrs = await mockMetadataStore.getAttributeDefinitions(targetEntity.id);
      const testAttr = attrs.content[0];

      // Archive
      const archived = await mockMetadataStore.archiveAttribute(targetEntity.id, testAttr.id);
      expect(archived.isArchived).toBe(true);

      // Unarchive
      const unarchived = await mockMetadataStore.unarchiveAttribute(targetEntity.id, testAttr.id);
      expect(unarchived.isArchived).toBe(false);
    });

    it('should reorder attributes and persist displayOrder', async () => {
      const entityTypes = await mockMetadataStore.getEntityTypes();
      const targetEntity = entityTypes.content[0];
      const attrs = await mockMetadataStore.getAttributeDefinitions(targetEntity.id);

      const attrIds = attrs.content.map((a) => a.id);
      const reversedIds = [...attrIds].reverse();

      const success = await mockMetadataStore.reorderAttributes(targetEntity.id, reversedIds);
      expect(success).toBe(true);

      const refreshed = await mockMetadataStore.getAttributeDefinitions(targetEntity.id);
      const firstAttr = refreshed.content.find((a) => String(a.id) === String(reversedIds[0]));
      expect(firstAttr?.displayOrder).toBe(1);
    });
  });

  describe('Workflow 3: Data Explorer (Pattern B Entity Reference & Record CRUD)', () => {
    it('should create record with Entity Reference (Pattern B) and validate payload', async () => {
      const entityTypes = await mockMetadataStore.getEntityTypes();
      const accountEntity = entityTypes.content.find((e) => e.systemName === 'customer_account')!;

      const newRecordDto: CreateEntityRecordDto = {
        entityTypeId: accountEntity.id,
        tenantId: 'tenant-test',
        attributes: {
          legal_name: 'Test Aerospace Inc',
          account_tier: 'Enterprise',
          default_policy_id: '301', // Pattern B Entity Reference
        },
      };

      const createdRecord = await mockMetadataStore.createEntityRecord(
        accountEntity.id,
        newRecordDto
      );

      expect(createdRecord.id).toBeDefined();
      expect(createdRecord.attributes.legal_name).toBe('Test Aerospace Inc');
      expect(createdRecord.attributes.default_policy_id).toBe('301');
      expect(createdRecord.version).toBe(1);

      // Fetch and verify pagination & search
      const queryResult = await mockMetadataStore.getEntityRecords(accountEntity.id, {
        number: 1,
        size: 10,
        filters: { legal_name: 'Aerospace' },
      });

      expect(queryResult.content.some((r) => r.id === createdRecord.id)).toBe(true);
    });

    it('should enforce optimistic locking (version conflict) on record updates', async () => {
      const entityTypes = await mockMetadataStore.getEntityTypes();
      const accountEntity = entityTypes.content[0];
      const records = await mockMetadataStore.getEntityRecords(accountEntity.id, { size: 1 });
      const record = records.content[0];

      // Successful update
      const updated = await mockMetadataStore.updateEntityRecord(
        accountEntity.id,
        record.id,
        {
          attributes: { ...record.attributes, legal_name: 'Updated Concurrency Name' },
          version: record.version,
        }
      );
      expect(updated.version).toBe((record.version || 1) + 1);

      // Stale version update should fail
      await expect(
        mockMetadataStore.updateEntityRecord(accountEntity.id, record.id, {
          attributes: { ...record.attributes, legal_name: 'Conflict Name' },
          version: record.version, // Stale!
        })
      ).rejects.toThrow();
    });
  });

  describe('Workflow 4: Connected Edges (Pattern C Graph Edge Management)', () => {
    it('should create relationship edge type with cardinality constraints', async () => {
      const newEdgeType = await mockMetadataStore.createRelationshipType({
        name: 'Account to Policies',
        systemName: 'rel_acct_policies',
        sourceEntityTypeId: '1',
        targetEntityTypeId: '3',
        cardinality: 'ONE_TO_MANY',
        description: 'Customer account policy attachments',
      });

      expect(newEdgeType.id).toBeDefined();
      expect(newEdgeType.cardinality).toBe('ONE_TO_MANY');

      const allTypes = await mockMetadataStore.getRelationshipTypes();
      expect(allTypes.content.some((t) => t.id === newEdgeType.id)).toBe(true);
    });

    it('should create, inspect, and delete concrete record-to-record edge links', async () => {
      const sourceRecordId = '101';
      const targetRecordId = '301';

      // 1. Create edge link
      const edgeLink = await mockMetadataStore.createEntityRelationship(sourceRecordId, {
        relationshipTypeId: '1',
        targetRecordId,
        sourceRecordId,
        attributes: { role: 'primary_policy' },
      });

      expect(edgeLink.id).toBeDefined();
      expect(String(edgeLink.sourceRecordId)).toBe(sourceRecordId);
      expect(String(edgeLink.targetRecordId)).toBe(targetRecordId);

      // 2. Query bidirectional relationships
      const linksOut = await mockMetadataStore.getRecordRelationships(sourceRecordId, {
        direction: 'outgoing',
      });
      expect(linksOut.content.some((l) => String(l.targetRecordId) === targetRecordId)).toBe(true);

      const linksIn = await mockMetadataStore.getRecordRelationships(targetRecordId, {
        direction: 'incoming',
      });
      expect(linksIn.content.some((l) => String(l.sourceRecordId) === sourceRecordId)).toBe(true);

      // 3. Delete edge link
      const deleted = await mockMetadataStore.deleteEntityRelationship(sourceRecordId, edgeLink.id);
      expect(deleted).toBe(true);

      // 4. Verify removed
      const remaining = await mockMetadataStore.getRecordRelationships(sourceRecordId);
      expect(remaining.content.some((l) => String(l.id) === String(edgeLink.id))).toBe(false);
    });
  });

  describe('Workflow 5: Enhancements 1-5 Verification (JSONB Containment, Two-Tier Cache, Dry-Run Validation, Schema Backfill, Faceted Search)', () => {
    it('Enhancement 1: should support exact match eq and multi-value in filters simulating JSONB containment', async () => {
      const records = await mockMetadataStore.getEntityRecords('1', {
        filters: {
          subscription_tier: { in: 'Enterprise,Strategic' },
        },
      });

      expect(records.content.length).toBeGreaterThan(0);
      records.content.forEach((r) => {
        expect(['Enterprise', 'Strategic']).toContain(r.attributes.subscription_tier);
      });
    });

    it('Enhancement 2: should compile and cache schema in L1 and L2, and invalidate upon attribute change', async () => {
      // First call: compiles and caches
      const first = await mockMetadataStore.getCompiledSchema('1');
      expect(first.schemaVersion).toBeDefined();

      // Second call: served directly from cache
      const cached = await mockMetadataStore.getCompiledSchema('1');
      expect(cached).toEqual(first);

      // Add attribute: triggers schema bump and cache invalidation
      await mockMetadataStore.createAttributeDefinition('1', {
        name: 'Cluster Identifier',
        systemName: 'cluster_id',
        dataType: 'STRING',
        uiComponent: 'text',
        isRequired: false,
      });

      const bumped = await mockMetadataStore.getCompiledSchema('1');
      expect(bumped.schemaVersion).toBeGreaterThan(first.schemaVersion);
    });

    it('Enhancement 3: should dry-run pre-validate records including required fields and enum choices', async () => {
      // Valid record
      const validRes = await mockMetadataStore.validateEntityRecord('1', {
        entityTypeId: '1',
        attributes: {
          legal_name: 'Valid Enterprise Corp',
          contact_email: 'test@unipost.io',
          subscription_tier: 'Enterprise',
        },
      });
      expect(validRes.valid).toBe(true);
      expect(validRes.errors).toHaveLength(0);

      // Invalid record: missing required field and invalid choice
      const invalidRes = await mockMetadataStore.validateEntityRecord('1', {
        entityTypeId: '1',
        attributes: {
          legal_name: '', // Required!
          subscription_tier: 'NonExistentTier', // Invalid choice!
        },
      });
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.errors.some((e) => e.field === 'legal_name')).toBe(true);
      expect(invalidRes.errors.some((e) => e.field === 'subscription_tier')).toBe(true);
    });

    it('Enhancement 4: should detect schema drift and execute retroactive schema backfill with default values', async () => {
      const drift = await mockMetadataStore.getSchemaDriftAnalysis('1');
      expect(drift.totalRecords).toBeGreaterThan(0);
      expect(drift.currentSchemaVersion).toBeDefined();

      // If there are outdated records, backfill should migrate them
      if (drift.outdatedRecords > 0) {
        const backfillResult = await mockMetadataStore.executeSchemaBackfill('1', 50);
        expect(backfillResult.migratedRecords).toBeGreaterThan(0);
        expect(backfillResult.targetSchemaVersion).toBe(drift.currentSchemaVersion);

        // Check updated drift analysis
        const postDrift = await mockMetadataStore.getSchemaDriftAnalysis('1');
        expect(postDrift.outdatedRecords).toBeLessThan(drift.outdatedRecords);
      }
    });

    it('Enhancement 5: should filter by multi-attribute faceted criteria and tenant', async () => {
      const filtered = await mockMetadataStore.getEntityRecords('1', {
        tenantId: 'tenant-us-east-1',
        filters: {
          is_multi_region_ha: { eq: 'true' },
        },
      });

      expect(filtered.content.length).toBeGreaterThan(0);
      filtered.content.forEach((r) => {
        expect(r.tenantId).toBe('tenant-us-east-1');
        expect(r.attributes.is_multi_region_ha).toBe(true);
      });
    });
  });

  describe('Workflow 6: Unified Sandbox FSM State Machine Transition Engine', () => {
    it('should transition record from DRAFT to SUBMITTED via SUBMIT action', async () => {
      const draftRecord = await mockMetadataStore.createEntityRecord('1', {
        entityTypeId: '1',
        tenantId: 'tenant-acme',
        attributes: {
          legal_name: 'FSM Test Corp',
          contact_email: 'fsm@test.com',
          status: 'DRAFT',
        },
      });
      expect(draftRecord.attributes.status).toBe('DRAFT');

      const transitioned = await mockMetadataStore.transitionRecordState('1', draftRecord.id, 'SUBMIT');
      expect(transitioned.attributes.status).toBe('SUBMITTED');
      expect(transitioned.version).toBeGreaterThan(draftRecord.version || 1);
    });

    it('should reject invalid transition action not permitted from current state', async () => {
      const draftRecord = await mockMetadataStore.createEntityRecord('1', {
        entityTypeId: '1',
        tenantId: 'tenant-acme',
        attributes: {
          legal_name: 'Invalid Action Corp',
          contact_email: 'invalid@test.com',
          status: 'DRAFT',
        },
      });

      // APPROVE is only allowed from SUBMITTED, not DRAFT
      await expect(
        mockMetadataStore.transitionRecordState('1', draftRecord.id, 'APPROVE')
      ).rejects.toThrow(/Invalid FSM transition action 'APPROVE'/);
    });

    it('should enforce role-based authority gate respecting active sandbox persona', async () => {
      const { useSandboxStore } = await import('../../../core/sandbox/store/sandbox-store');
      
      const submittedRecord = await mockMetadataStore.createEntityRecord('1', {
        entityTypeId: '1',
        tenantId: 'tenant-acme',
        attributes: {
          legal_name: 'Role Test Corp',
          contact_email: 'role@test.com',
          status: 'SUBMITTED',
        },
      });

      // 1. Switch persona to standard 'user' (only has ROLE_USER, lacks ROLE_ADMIN)
      useSandboxStore.getState().setActivePersona('user');

      await expect(
        mockMetadataStore.transitionRecordState('1', submittedRecord.id, 'APPROVE')
      ).rejects.toThrow(/Access Denied: Caller lacks required authority/);

      // 2. Switch persona to 'admin' (has ROLE_ADMIN)
      useSandboxStore.getState().setActivePersona('admin');

      const approved = await mockMetadataStore.transitionRecordState('1', submittedRecord.id, 'APPROVE');
      expect(approved.attributes.status).toBe('APPROVED');
    });
  });
});
