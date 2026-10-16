import type { SandboxRouteHandler, SandboxRequest } from '../types';
import { mockMetadataStore } from '../../../features/metadata/data/mock-metadata';
import { useSandboxStore } from '../store/sandbox-store';
import { mockBlueprintManifests, mockBlueprintSummaries } from '../../../features/metadata/data/mock-blueprints';

/**
 * MetadataSandboxAdapter: Bridges incoming metadata API requests (/api/metadata/*, /v1/metadata/*, /api/v1/metadata/*)
 * to mockMetadataStore while respecting active tenant context.
 */
export const metadataSandboxAdapter: SandboxRouteHandler = {
  id: 'metadata-sandbox-adapter',
  name: 'Metadata Platform Sandbox Adapter',
  description: 'Routes metadata platform API queries to mockMetadataStore with tenant context',
  priority: 90,
  matcher: (ctx) =>
    ctx.pathname.startsWith('/api/metadata') ||
    ctx.pathname.startsWith('/v1/metadata') ||
    ctx.pathname.startsWith('/api/v1/metadata'),
  handler: async (req: SandboxRequest, ctx) => {
    const { pathname, searchParams } = ctx;
    const activeTenantId = useSandboxStore.getState().activeTenantId;

    // Standardize sub-path by stripping API base prefix
    const subPath = pathname.replace(/^\/(api\/v1\/metadata|v1\/metadata|api\/metadata)/, '');

    // 0. Blueprints Catalog & Details
    if (subPath === '/blueprints' || subPath === '/blueprints/') {
      if (req.method === 'GET') {
        return { status: 200, data: mockBlueprintSummaries };
      }
    }

    const blueprintDetailMatch = subPath.match(/^\/blueprints\/([^/]+)$/);
    if (blueprintDetailMatch) {
      const bpId = blueprintDetailMatch[1];
      if (req.method === 'GET') {
        const found = mockBlueprintManifests.find((b) => b.id === bpId);
        if (!found) {
          return { status: 404, data: { message: `Blueprint not found with id: ${bpId}` } };
        }
        return { status: 200, data: found };
      }
    }

    // 0.1 Tenant Provisioning with Blueprint
    if (subPath === '/tenants/provision' && req.method === 'POST') {
      const { tenantId, tenantName, blueprintId } = req.data || {};
      const manifest = mockBlueprintManifests.find((b) => b.id === blueprintId);
      if (!manifest) {
        return { status: 404, data: { message: `Blueprint template not found with id: ${blueprintId}` } };
      }

      const createdNames: string[] = [];
      let totalAttributes = 0;

      // Seed models into mockMetadataStore
      for (const bType of manifest.entityTypes) {
        const createdEt = await mockMetadataStore.createEntityType({
          name: bType.name,
          systemName: bType.systemName,
          description: bType.description,
        });
        createdNames.push(createdEt.name);

        for (const bAttr of bType.attributes) {
          await mockMetadataStore.createAttributeDefinition(createdEt.id, {
            name: bAttr.name,
            systemName: bAttr.systemName,
            dataType: bAttr.dataType as any,
            uiComponent: bAttr.uiComponent as any,
            isRequired: Boolean(bAttr.isRequired),
            displayOrder: bAttr.displayOrder,
            defaultValue: bAttr.defaultValue,
            options: bAttr.options,
          });
          totalAttributes++;
        }
      }

      return {
        status: 200,
        data: {
          tenantId: tenantId || activeTenantId,
          tenantName: tenantName || 'Provisioned Workspace',
          blueprintId: manifest.id,
          blueprintName: manifest.name,
          createdEntityTypesCount: manifest.entityTypes.length,
          createdAttributesCount: totalAttributes,
          createdRelationshipsCount: manifest.relationshipTypes.length,
          createdEntityTypeNames: createdNames,
          durationMs: 42,
        },
      };
    }

    // 1. Entity Types List or Create

    if (subPath === '/entity-types' || subPath === '/entity-types/') {
      if (req.method === 'GET') {
        const page = parseInt(searchParams.get('number') || searchParams.get('page') || '0', 10);
        const size = parseInt(searchParams.get('size') || '50', 10);
        const search = searchParams.get('search') || undefined;
        const isComposite = searchParams.has('isComposite')
          ? searchParams.get('isComposite') === 'true'
          : undefined;
        const data = await mockMetadataStore.getEntityTypes({ page, size, search, isComposite } as any);
        return { status: 200, data };
      }
      if (req.method === 'POST') {
        const created = await mockMetadataStore.createEntityType(req.data);
        return { status: 201, data: created };
      }
    }

    // 2. Relationship Types List or Create
    if (subPath === '/relationship-types' || subPath === '/relationship-types/') {
      if (req.method === 'GET') {
        const data = await mockMetadataStore.getRelationshipTypes();
        return { status: 200, data };
      }
      if (req.method === 'POST') {
        const created = await mockMetadataStore.createRelationshipType(req.data);
        return { status: 201, data: created };
      }
    }

    // 3. Relationship Type Detail, Update, Delete
    const relTypeMatch = subPath.match(/^\/relationship-types\/([^/]+)$/);
    if (relTypeMatch) {
      const relId = relTypeMatch[1];
      if (req.method === 'GET') {
        const rel = await mockMetadataStore.getRelationshipType(relId);
        if (!rel) return { status: 404, data: { message: 'Relationship type not found' } };
        return { status: 200, data: rel };
      }
      if (req.method === 'PUT') {
        const updated = await mockMetadataStore.updateRelationshipType(relId, req.data);
        return { status: 200, data: updated };
      }
      if (req.method === 'DELETE') {
        const force = searchParams.get('force') === 'true';
        const deleted = await mockMetadataStore.deleteRelationshipType(relId, force);
        return { status: 200, data: { success: deleted } };
      }
    }

    // 4. Record Relationships
    const recRelMatch = subPath.match(/^\/records\/([^/]+)\/relationships$/);
    if (recRelMatch) {
      const recordId = recRelMatch[1];
      if (req.method === 'GET') {
        const direction = (searchParams.get('direction') as any) || 'BOTH';
        const data = await mockMetadataStore.getRecordRelationships(recordId, { direction });
        return { status: 200, data };
      }
      if (req.method === 'POST') {
        const created = await mockMetadataStore.createEntityRelationship(recordId, req.data);
        return { status: 201, data: created };
      }
    }

    const recRelDeleteMatch = subPath.match(/^\/records\/([^/]+)\/relationships\/([^/]+)$/);
    if (recRelDeleteMatch && req.method === 'DELETE') {
      const recordId = recRelDeleteMatch[1];
      const relId = recRelDeleteMatch[2];
      const deleted = await mockMetadataStore.deleteEntityRelationship(recordId, relId);
      return { status: 200, data: { success: deleted } };
    }

    // 5. Schema / Compiled Schema
    const schemaMatch = subPath.match(/^\/entity-types\/([^/]+)\/(schema|compiled-schema)$/);
    if (schemaMatch && req.method === 'GET') {
      const compiled = await mockMetadataStore.getCompiledSchema(schemaMatch[1]);
      return { status: 200, data: compiled };
    }

    // 6. Schema Drift Analysis
    const driftMatch = subPath.match(/^\/entity-types\/([^/]+)\/(drift|drift-analysis)$/);
    if (driftMatch && req.method === 'GET') {
      const drift = await mockMetadataStore.getSchemaDriftAnalysis(driftMatch[1]);
      return { status: 200, data: drift };
    }

    // 7. Schema Backfill
    const backfillMatch = subPath.match(/^\/entity-types\/([^/]+)\/backfill$/);
    if (backfillMatch && req.method === 'POST') {
      const batchSize = parseInt(searchParams.get('batchSize') || req.data?.batchSize || '100', 10);
      const res = await mockMetadataStore.executeSchemaBackfill(backfillMatch[1], batchSize);
      return { status: 200, data: res };
    }

    // 8. Entity Record Facets
    const facetsMatch = subPath.match(/^\/entity-types\/([^/]+)\/facets$/);
    if (facetsMatch && req.method === 'GET') {
      const tenantId = searchParams.get('tenantId') || activeTenantId;
      const data = await mockMetadataStore.getEntityFacets(facetsMatch[1], { tenantId });
      return { status: 200, data };
    }

    // 9. Entity Record Validation
    const validateMatch = subPath.match(/^\/entity-types\/([^/]+)\/records\/validate$/);
    if (validateMatch && req.method === 'POST') {
      const res = await mockMetadataStore.validateEntityRecord(validateMatch[1], req.data);
      return { status: 200, data: res };
    }

    // 9.1 Entity Record FSM State Transition
    const transitionMatch = subPath.match(/^\/entity-types\/([^/]+)\/records\/([^/]+)\/transition$/);
    if (transitionMatch && req.method === 'POST') {
      const typeId = transitionMatch[1];
      const recordId = transitionMatch[2];
      const action = searchParams.get('action') || (req.data && req.data.action);
      if (!action) {
        return { status: 400, data: { message: 'Transition action is required as a query parameter or body field' } };
      }
      try {
        const transitioned = await mockMetadataStore.transitionRecordState(
          typeId,
          recordId,
          action,
          req.data
        );
        return { status: 200, data: transitioned };
      } catch (err: any) {
        const status = err.status || 400;
        return { status, data: { message: err.message || 'FSM Transition Failed' } };
      }
    }

    // 9.2 Record Audit Logs (GET /entity-types/:typeId/records/:recordId/audit)
    const auditMatch = subPath.match(/^\/entity-types\/([^/]+)\/records\/([^/]+)\/audit$/);
    if (auditMatch && req.method === 'GET') {
      const typeId = auditMatch[1];
      const recordId = auditMatch[2];
      try {
        const logs = await mockMetadataStore.getRecordAuditLogs(typeId, recordId);
        return { status: 200, data: logs };
      } catch (err: any) {
        return { status: err.status || 500, data: { message: err.message } };
      }
    }

    // 9.3 Record Restore Preview (GET /entity-types/:typeId/records/:recordId/restore-preview/:auditLogId)
    const restorePreviewMatch = subPath.match(
      /^\/entity-types\/([^/]+)\/records\/([^/]+)\/restore-preview\/([^/]+)$/
    );
    if (restorePreviewMatch && req.method === 'GET') {
      const typeId = restorePreviewMatch[1];
      const recordId = restorePreviewMatch[2];
      const auditLogId = restorePreviewMatch[3];
      try {
        const preview = await mockMetadataStore.previewRestoreRecord(typeId, recordId, auditLogId);
        return { status: 200, data: preview };
      } catch (err: any) {
        return { status: err.status || 404, data: { message: err.message } };
      }
    }

    // 9.4 Record Restore Execute (POST /entity-types/:typeId/records/:recordId/restore/:auditLogId)
    const restoreExecMatch = subPath.match(
      /^\/entity-types\/([^/]+)\/records\/([^/]+)\/restore\/([^/]+)$/
    );
    if (restoreExecMatch && req.method === 'POST') {
      const typeId = restoreExecMatch[1];
      const recordId = restoreExecMatch[2];
      const auditLogId = restoreExecMatch[3];
      try {
        const restored = await mockMetadataStore.restoreRecordVersion(typeId, recordId, auditLogId);
        return { status: 200, data: restored };
      } catch (err: any) {
        return { status: err.status || 400, data: { message: err.message } };
      }
    }

    // 10. Entity Record Detail (GET, PUT, PATCH, DELETE)
    const recordDetailMatch = subPath.match(/^\/entity-types\/([^/]+)\/records\/([^/]+)$/);
    if (recordDetailMatch) {
      const typeId = recordDetailMatch[1];
      const recordId = recordDetailMatch[2];
      if (req.method === 'GET') {
        const record = await mockMetadataStore.getEntityRecord(typeId, recordId);
        if (!record) return { status: 404, data: { message: 'Entity record not found' } };
        return { status: 200, data: record };
      }
      if (req.method === 'PUT') {
        const updated = await mockMetadataStore.updateEntityRecord(typeId, recordId, req.data);
        return { status: 200, data: updated };
      }
      if (req.method === 'PATCH') {
        const patched = await mockMetadataStore.patchEntityRecord(typeId, recordId, req.data);
        return { status: 200, data: patched };
      }
      if (req.method === 'DELETE') {
        const deleted = await mockMetadataStore.deleteEntityRecord(typeId, recordId);
        return { status: 200, data: { success: deleted } };
      }
    }

    // 11. Entity Records List / Create
    const recordsMatch = subPath.match(/^\/entity-types\/([^/]+)\/records$/);
    if (recordsMatch) {
      const typeId = recordsMatch[1];
      if (req.method === 'GET') {
        const page = parseInt(searchParams.get('number') || searchParams.get('page') || '0', 10);
        const size = parseInt(searchParams.get('size') || '50', 10);
        const sort = searchParams.get('sort') || undefined;
        const tenantId = searchParams.get('tenantId') || activeTenantId;

        // Parse query filters
        const filters: Record<string, any> = {};
        for (const [key, value] of searchParams.entries()) {
          if (!['number', 'page', 'size', 'sort', 'tenantId'].includes(key)) {
            if (value.includes(',')) {
              filters[key] = { in: value };
            } else {
              filters[key] = { eq: value };
            }
          }
        }

        const data = await mockMetadataStore.getEntityRecords(typeId, {
          page,
          size,
          sort,
          tenantId,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        });
        return { status: 200, data };
      }

      if (req.method === 'POST') {
        const created = await mockMetadataStore.createEntityRecord(typeId, {
          ...req.data,
          tenantId: req.data?.tenantId || activeTenantId,
        });
        return { status: 201, data: created };
      }
    }

    // 12. Attribute Definitions Reorder
    const attrOrderMatch = subPath.match(/^\/entity-types\/([^/]+)\/attributes\/order$/);
    if (attrOrderMatch && req.method === 'PUT') {
      const typeId = attrOrderMatch[1];
      const attributeIds = req.data?.attributeIds || [];
      const res = await mockMetadataStore.reorderAttributes(typeId, attributeIds);
      return { status: 200, data: { success: res } };
    }

    // 13. Attribute Archive / Unarchive
    const attrArchiveMatch = subPath.match(/^\/entity-types\/([^/]+)\/attributes\/([^/]+)\/(archive|unarchive)$/);
    if (attrArchiveMatch && req.method === 'POST') {
      const typeId = attrArchiveMatch[1];
      const attrId = attrArchiveMatch[2];
      const action = attrArchiveMatch[3];

      if (action === 'archive') {
        const res = await mockMetadataStore.archiveAttribute(typeId, attrId);
        return { status: 200, data: res };
      } else {
        const res = await mockMetadataStore.unarchiveAttribute(typeId, attrId);
        return { status: 200, data: res };
      }
    }

    // 14. Attribute Definition Detail (GET, PUT, DELETE)
    const attrDetailMatch = subPath.match(/^\/entity-types\/([^/]+)\/attributes\/([^/]+)$/);
    if (attrDetailMatch) {
      const typeId = attrDetailMatch[1];
      const attrId = attrDetailMatch[2];
      if (req.method === 'GET') {
        const attr = await mockMetadataStore.getAttributeDefinition(typeId, attrId);
        if (!attr) return { status: 404, data: { message: 'Attribute not found' } };
        return { status: 200, data: attr };
      }
      if (req.method === 'PUT') {
        const updated = await mockMetadataStore.updateAttributeDefinition(typeId, attrId, req.data);
        return { status: 200, data: updated };
      }
      if (req.method === 'DELETE') {
        const force = searchParams.get('force') === 'true';
        const deleted = await mockMetadataStore.deleteAttributeDefinition(typeId, attrId, force);
        return { status: 200, data: { success: deleted } };
      }
    }

    // 15. Attribute Definitions List / Create
    const attrMatch = subPath.match(/^\/entity-types\/([^/]+)\/attributes$/);
    if (attrMatch) {
      const typeId = attrMatch[1];
      if (req.method === 'GET') {
        const data = await mockMetadataStore.getAttributeDefinitions(typeId);
        return { status: 200, data };
      }
      if (req.method === 'POST') {
        const created = await mockMetadataStore.createAttributeDefinition(typeId, req.data);
        return { status: 201, data: created };
      }
    }

    // 16. Entity Type Detail / Schema (GET, PUT, DELETE)
    const typeMatch = subPath.match(/^\/entity-types\/([^/]+)$/);
    if (typeMatch) {
      const typeId = typeMatch[1];
      if (req.method === 'GET') {
        const entityType = await mockMetadataStore.getEntityTypeById(typeId);
        if (!entityType) return { status: 404, data: { message: 'Entity type not found' } };
        return { status: 200, data: entityType };
      }
      if (req.method === 'PUT') {
        const updated = await mockMetadataStore.updateEntityType(typeId, req.data);
        return { status: 200, data: updated };
      }
      if (req.method === 'DELETE') {
        const deleted = await mockMetadataStore.deleteEntityType(typeId);
        return { status: 200, data: { success: deleted } };
      }
    }

    // 17. Composite Entity Record Detail
    const compositeRecordDetailMatch = subPath.match(/^\/composite-entities\/([^/]+)\/records\/([^/]+)$/);
    if (compositeRecordDetailMatch) {
      const typeId = compositeRecordDetailMatch[1];
      const recordId = compositeRecordDetailMatch[2];
      if (req.method === 'GET') {
        const childParams: Record<string, { limit?: number; offset?: number }> = {};
        for (const [key, val] of searchParams.entries()) {
          const limitMatch = key.match(/^childLimit\[([^\]]+)\]$/);
          if (limitMatch) {
            const alias = limitMatch[1];
            childParams[alias] = childParams[alias] || {};
            childParams[alias].limit = parseInt(val, 10);
          }
          const offsetMatch = key.match(/^childOffset\[([^\]]+)\]$/);
          if (offsetMatch) {
            const alias = offsetMatch[1];
            childParams[alias] = childParams[alias] || {};
            childParams[alias].offset = parseInt(val, 10);
          }
        }
        const data = await mockMetadataStore.getCompositeRecordById(typeId, recordId, childParams);
        if (!data) return { status: 404, data: { message: 'Composite record not found' } };
        return {
          status: 200,
          headers: { 'X-Composite-Engine': 'dynamic-sql-pushdown' },
          data,
        };
      }
    }

    // 18. Composite Entity Records Page
    const compositeRecordsMatch = subPath.match(/^\/composite-entities\/([^/]+)\/records$/);
    if (compositeRecordsMatch) {
      const typeId = compositeRecordsMatch[1];
      if (req.method === 'GET') {
        const page = parseInt(searchParams.get('number') || '1', 10);
        const size = parseInt(searchParams.get('size') || '10', 10);
        const childParams: Record<string, { limit?: number; offset?: number }> = {};
        for (const [key, val] of searchParams.entries()) {
          const limitMatch = key.match(/^childLimit\[([^\]]+)\]$/);
          if (limitMatch) {
            const alias = limitMatch[1];
            childParams[alias] = childParams[alias] || {};
            childParams[alias].limit = parseInt(val, 10);
          }
          const offsetMatch = key.match(/^childOffset\[([^\]]+)\]$/);
          if (offsetMatch) {
            const alias = offsetMatch[1];
            childParams[alias] = childParams[alias] || {};
            childParams[alias].offset = parseInt(val, 10);
          }
        }
        const data = await mockMetadataStore.getCompositeRecords(
          typeId,
          { number: page, size, tenantId: activeTenantId },
          childParams
        );
        return {
          status: 200,
          headers: { 'X-Composite-Engine': 'dynamic-sql-pushdown' },
          data,
        };
      }
    }

    // Fallback to generic not found for unregistered metadata paths
    return {
      status: 404,
      statusText: 'Not Found',
      data: { message: `Metadata sandbox endpoint not mapped: ${pathname}` },
    };
  },
};
