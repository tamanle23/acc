import type { SandboxRouteHandler, SandboxResponse, SandboxRequest } from '../types';
import { defaultSandboxStore } from '../store';
import { sandboxResetRegistry } from '../reset-registry';
import { decodeJwt } from '../jwt';
import type {
  EntityType,
  AttributeDefinition,
  EntityRecord,
  RelationshipType,
  EntityRelationship,
  PageResponse,
  PageRequestParams,
  CompiledSchema,
  CreateEntityTypeDto,
  UpdateEntityTypeDto,
  CreateAttributeDefinitionDto,
  UpdateAttributeDefinitionDto,
  CreateEntityRecordDto,
  UpdateEntityRecordDto,
  CreateRelationshipTypeDto,
  UpdateRelationshipTypeDto,
  CreateEntityRelationshipDto,
  RecordAuditLog,
  CompositeRecordResponse,
} from '@acc/client';
import {
  initialSeedEntityTypes,
  initialSeedAttributes,
  initialSeedRecords,
  initialSeedRelationshipTypes,
  initialSeedRelationships,
} from './data/metadata';
import { mockBlueprintManifests, mockBlueprintSummaries } from './data/mock-blueprints';

export class MetadataSandboxRepository {
  private tenantEntityTypes: Map<string, EntityType[]> = new Map();
  private tenantAttributes: Map<string, Record<string, AttributeDefinition[]>> = new Map();
  private tenantRecords: Map<string, Record<string, EntityRecord[]>> = new Map();
  private tenantRelationshipTypes: Map<string, RelationshipType[]> = new Map();
  private tenantRelationships: Map<string, EntityRelationship[]> = new Map();
  private recordAuditLogs: Map<string, RecordAuditLog[]> = new Map();

  constructor() {
    this.reset();
    sandboxResetRegistry.register(() => this.reset());
  }

  public reset(): void {
    this.tenantEntityTypes.clear();
    this.tenantAttributes.clear();
    this.tenantRecords.clear();
    this.tenantRelationshipTypes.clear();
    this.tenantRelationships.clear();
    this.recordAuditLogs.clear();

    const seedTenants = ['SYSTEM', 'tenant-acme', 'tenant-us-east-1'];
    for (const tid of seedTenants) {
      this.tenantEntityTypes.set(tid, JSON.parse(JSON.stringify(initialSeedEntityTypes)));
      this.tenantAttributes.set(tid, JSON.parse(JSON.stringify(initialSeedAttributes)));
      this.tenantRecords.set(tid, JSON.parse(JSON.stringify(initialSeedRecords)));
      this.tenantRelationshipTypes.set(tid, JSON.parse(JSON.stringify(initialSeedRelationshipTypes)));
      this.tenantRelationships.set(tid, JSON.parse(JSON.stringify(initialSeedRelationships)));
    }
  }

  public resetToInitialState(): void {
    this.reset();
  }

  public resolveTenantId(req: SandboxRequest): string {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = decodeJwt(token);
      if (decoded && decoded.tenantId) {
        return decoded.tenantId;
      }
    }
    return defaultSandboxStore.getState().activeTenantId || 'tenant-acme';
  }

  private ensureTenant(tenantId: string): void {
    if (!this.tenantEntityTypes.has(tenantId)) {
      this.tenantEntityTypes.set(tenantId, JSON.parse(JSON.stringify(initialSeedEntityTypes)));
      this.tenantAttributes.set(tenantId, JSON.parse(JSON.stringify(initialSeedAttributes)));
      this.tenantRecords.set(tenantId, JSON.parse(JSON.stringify(initialSeedRecords)));
      this.tenantRelationshipTypes.set(tenantId, JSON.parse(JSON.stringify(initialSeedRelationshipTypes)));
      this.tenantRelationships.set(tenantId, JSON.parse(JSON.stringify(initialSeedRelationships)));
    }
  }

  // ==========================================
  // 1. Entity Types
  // ==========================================
  public async getEntityTypes(tenantId: string, params?: PageRequestParams): Promise<PageResponse<EntityType>> {
    this.ensureTenant(tenantId);
    let list = [...(this.tenantEntityTypes.get(tenantId) || [])];

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.systemName.toLowerCase().includes(q));
    }

    const page = params?.page || params?.number || 0;
    const size = params?.size || 50;
    const start = page * size;
    const content = list.slice(start, start + size);

    return {
      content,
      totalElements: list.length,
      totalPages: Math.ceil(list.length / size) || 1,
      size,
      number: page,
      numberOfElements: content.length,
      first: page === 0,
      last: start + size >= list.length,
      empty: content.length === 0,
    };
  }

  public async getEntityTypeById(tenantId: string, id: string | number): Promise<EntityType | null> {
    this.ensureTenant(tenantId);
    const list = this.tenantEntityTypes.get(tenantId) || [];
    return list.find((t) => String(t.id) === String(id) || t.systemName === String(id)) || null;
  }

  public async createEntityType(tenantId: string, dto: CreateEntityTypeDto): Promise<EntityType> {
    this.ensureTenant(tenantId);
    const list = this.tenantEntityTypes.get(tenantId)!;
    const newId = String(Date.now());
    const entityType: EntityType = {
      id: newId,
      name: dto.name,
      systemName: dto.systemName,
      description: dto.description,
      schemaVersion: 1,
      version: 1,
      lifecycleConfig: dto.lifecycleConfig || {
        state_field: 'status',
        initial_state: 'DRAFT',
        states: ['DRAFT', 'ACTIVE'],
        transitions: [{ from: 'DRAFT', to: 'ACTIVE', action: 'ACTIVATE' }],
      },
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    list.unshift(entityType);
    const attrs = this.tenantAttributes.get(tenantId)!;
    attrs[newId] = [];
    return entityType;
  }

  public async updateEntityType(tenantId: string, id: string | number, dto: UpdateEntityTypeDto): Promise<EntityType> {
    this.ensureTenant(tenantId);
    const list = this.tenantEntityTypes.get(tenantId)!;
    const idx = list.findIndex((t) => String(t.id) === String(id));
    if (idx === -1) throw new Error(`EntityType not found with id: ${id}`);
    const existing = list[idx];
    const updated: EntityType = {
      ...existing,
      ...dto,
      schemaVersion: (existing.schemaVersion || 1) + 1,
      version: (existing.version || 1) + 1,
      updatedDate: new Date().toISOString(),
    };
    list[idx] = updated;
    return updated;
  }

  public async deleteEntityType(tenantId: string, id: string | number): Promise<boolean> {
    this.ensureTenant(tenantId);
    const list = this.tenantEntityTypes.get(tenantId)!;
    const before = list.length;
    const filtered = list.filter((t) => String(t.id) !== String(id));
    this.tenantEntityTypes.set(tenantId, filtered);
    return filtered.length < before;
  }

  public async getCompiledSchema(tenantId: string, id: string | number): Promise<CompiledSchema> {
    const et = await this.getEntityTypeById(tenantId, id);
    if (!et) throw new Error(`EntityType not found with id: ${id}`);
    const attrs = (await this.getAttributeDefinitions(tenantId, id)).content;
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const a of attrs) {
      properties[a.systemName] = {
        type: a.dataType === 'INTEGER' ? 'integer' : a.dataType === 'BOOLEAN' ? 'boolean' : 'string',
        title: a.name,
      };
      if (a.isRequired) required.push(a.systemName);
    }

    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: et.name,
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    };
  }

  // ==========================================
  // 2. Attributes
  // ==========================================
  public async getAttributeDefinitions(tenantId: string, entityTypeId: string | number): Promise<PageResponse<AttributeDefinition>> {
    this.ensureTenant(tenantId);
    const attrMap = this.tenantAttributes.get(tenantId) || {};
    const list = attrMap[String(entityTypeId)] || [];
    return {
      content: list,
      totalElements: list.length,
      totalPages: 1,
      size: list.length || 50,
      number: 0,
      numberOfElements: list.length,
      first: true,
      last: true,
      empty: list.length === 0,
    };
  }

  public async getAttributeDefinition(tenantId: string, entityTypeId: string | number, attrId: string | number): Promise<AttributeDefinition | null> {
    const res = await this.getAttributeDefinitions(tenantId, entityTypeId);
    return res.content.find((a) => String(a.id) === String(attrId) || a.systemName === String(attrId)) || null;
  }

  public async createAttributeDefinition(tenantId: string, entityTypeId: string | number, dto: CreateAttributeDefinitionDto): Promise<AttributeDefinition> {
    this.ensureTenant(tenantId);
    const attrMap = this.tenantAttributes.get(tenantId)!;
    const key = String(entityTypeId);
    if (!attrMap[key]) attrMap[key] = [];
    const attr: AttributeDefinition = {
      id: `attr-${Date.now()}`,
      entityTypeId: String(entityTypeId),
      name: dto.name,
      systemName: dto.systemName,
      dataType: dto.dataType,
      uiComponent: dto.uiComponent,
      isRequired: Boolean(dto.isRequired),
      defaultValue: dto.defaultValue,
      displayOrder: dto.displayOrder || attrMap[key].length + 1,
      options: dto.options,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    attrMap[key].push(attr);
    return attr;
  }

  public async updateAttributeDefinition(tenantId: string, entityTypeId: string | number, attrId: string | number, dto: UpdateAttributeDefinitionDto): Promise<AttributeDefinition> {
    this.ensureTenant(tenantId);
    const attrMap = this.tenantAttributes.get(tenantId)!;
    const key = String(entityTypeId);
    const list = attrMap[key] || [];
    const idx = list.findIndex((a) => String(a.id) === String(attrId));
    if (idx === -1) throw new Error(`Attribute not found with id: ${attrId}`);
    list[idx] = { ...list[idx], ...dto, updatedDate: new Date().toISOString() };
    return list[idx];
  }

  public async deleteAttributeDefinition(tenantId: string, entityTypeId: string | number, attrId: string | number): Promise<boolean> {
    this.ensureTenant(tenantId);
    const attrMap = this.tenantAttributes.get(tenantId)!;
    const key = String(entityTypeId);
    const list = attrMap[key] || [];
    const before = list.length;
    attrMap[key] = list.filter((a) => String(a.id) !== String(attrId));
    return attrMap[key].length < before;
  }

  // ==========================================
  // 3. Records
  // ==========================================
  public async getEntityRecords(tenantId: string, entityTypeId: string | number, params?: PageRequestParams): Promise<PageResponse<EntityRecord>> {
    this.ensureTenant(tenantId);
    const recMap = this.tenantRecords.get(tenantId) || {};
    let list = recMap[String(entityTypeId)] || [];

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter((r) => JSON.stringify(r.data).toLowerCase().includes(q));
    }

    const page = params?.page || params?.number || 0;
    const size = params?.size || 50;
    const start = page * size;
    const content = list.slice(start, start + size);

    return {
      content,
      totalElements: list.length,
      totalPages: Math.ceil(list.length / size) || 1,
      size,
      number: page,
      numberOfElements: content.length,
      first: page === 0,
      last: start + size >= list.length,
      empty: content.length === 0,
    };
  }

  public async getEntityRecord(tenantId: string, entityTypeId: string | number, recordId: string | number): Promise<EntityRecord | null> {
    this.ensureTenant(tenantId);
    const recMap = this.tenantRecords.get(tenantId) || {};
    const list = recMap[String(entityTypeId)] || [];
    return list.find((r) => String(r.id) === String(recordId)) || null;
  }

  public async createEntityRecord(tenantId: string, entityTypeId: string | number, dto: CreateEntityRecordDto): Promise<EntityRecord> {
    this.ensureTenant(tenantId);
    const recMap = this.tenantRecords.get(tenantId)!;
    const key = String(entityTypeId);
    if (!recMap[key]) recMap[key] = [];
    const rec: EntityRecord = {
      id: `rec-${Date.now()}`,
      entityTypeId: String(entityTypeId),
      data: dto.data || {},
      schemaVersion: 1,
      version: 1,
      tenantId,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    recMap[key].unshift(rec);
    return rec;
  }

  public async updateEntityRecord(tenantId: string, entityTypeId: string | number, recordId: string | number, dto: UpdateEntityRecordDto): Promise<EntityRecord> {
    this.ensureTenant(tenantId);
    const recMap = this.tenantRecords.get(tenantId)!;
    const key = String(entityTypeId);
    const list = recMap[key] || [];
    const idx = list.findIndex((r) => String(r.id) === String(recordId));
    if (idx === -1) throw new Error(`Record not found with id: ${recordId}`);
    const existing = list[idx];
    const updated: EntityRecord = {
      ...existing,
      data: { ...existing.data, ...dto.data },
      version: (existing.version || 1) + 1,
      updatedDate: new Date().toISOString(),
    };
    list[idx] = updated;
    return updated;
  }

  public async deleteEntityRecord(tenantId: string, entityTypeId: string | number, recordId: string | number): Promise<boolean> {
    this.ensureTenant(tenantId);
    const recMap = this.tenantRecords.get(tenantId)!;
    const key = String(entityTypeId);
    const list = recMap[key] || [];
    const before = list.length;
    recMap[key] = list.filter((r) => String(r.id) !== String(recordId));
    return recMap[key].length < before;
  }

  // ==========================================
  // 4. Relationships & Blueprints
  // ==========================================
  public async getRelationshipTypes(tenantId: string): Promise<RelationshipType[]> {
    this.ensureTenant(tenantId);
    return [...(this.tenantRelationshipTypes.get(tenantId) || [])];
  }

  public async getRelationshipType(tenantId: string, id: string | number): Promise<RelationshipType | null> {
    const list = await this.getRelationshipTypes(tenantId);
    return list.find((r) => String(r.id) === String(id) || r.systemName === String(id)) || null;
  }

  public async createRelationshipType(tenantId: string, dto: CreateRelationshipTypeDto): Promise<RelationshipType> {
    this.ensureTenant(tenantId);
    const list = this.tenantRelationshipTypes.get(tenantId)!;
    const rel: RelationshipType = {
      id: `rel-${Date.now()}`,
      name: dto.name,
      systemName: dto.systemName,
      description: dto.description,
      sourceEntityTypeId: dto.sourceEntityTypeId,
      targetEntityTypeId: dto.targetEntityTypeId,
      cardinality: dto.cardinality || 'ONE_TO_MANY',
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    list.push(rel);
    return rel;
  }

  public async getRecordRelationships(tenantId: string, recordId: string | number): Promise<EntityRelationship[]> {
    this.ensureTenant(tenantId);
    const list = this.tenantRelationships.get(tenantId) || [];
    return list.filter((r) => String(r.sourceRecordId) === String(recordId) || String(r.targetRecordId) === String(recordId));
  }

  public async createEntityRelationship(tenantId: string, recordId: string | number, dto: CreateEntityRelationshipDto): Promise<EntityRelationship> {
    this.ensureTenant(tenantId);
    const list = this.tenantRelationships.get(tenantId)!;
    const rel: EntityRelationship = {
      id: `rel-inst-${Date.now()}`,
      relationshipTypeId: dto.relationshipTypeId,
      sourceRecordId: String(recordId),
      targetRecordId: String(dto.targetRecordId),
      createdDate: new Date().toISOString(),
    };
    list.push(rel);
    return rel;
  }

  public async deleteEntityRelationship(tenantId: string, recordId: string | number, relationshipId: string | number): Promise<boolean> {
    this.ensureTenant(tenantId);
    const list = this.tenantRelationships.get(tenantId)!;
    const before = list.length;
    const filtered = list.filter((r) => String(r.id) !== String(relationshipId));
    this.tenantRelationships.set(tenantId, filtered);
    return filtered.length < before;
  }
}

export const metadataSandboxRepo = new MetadataSandboxRepository();
export const mockMetadataStore = metadataSandboxRepo; // Backwards-compatible alias

export const metadataSandboxHandler: SandboxRouteHandler = {
  id: 'metadata-sandbox-handler',
  name: 'Metadata Platform Sandbox Handler',
  description: 'Enterprise multi-tenant mock engine for Dynamic Metadata, schema compilation, entity records, and facet indexing',
  priority: 90,
  matcher: (ctx) =>
    ctx.pathname.startsWith('/api/v1/metadata') ||
    ctx.pathname.startsWith('/v1/metadata') ||
    ctx.pathname.startsWith('/api/metadata'),
  handler: async (req: SandboxRequest, ctx): Promise<SandboxResponse> => {
    const { pathname, searchParams } = ctx;
    const tenantId = metadataSandboxRepo.resolveTenantId(req);
    const subPath = pathname.replace(/^\/(api\/v1\/metadata|v1\/metadata|api\/metadata)/, '');

    // 0. Blueprints Catalog & Provisioning
    if (subPath === '/blueprints' || subPath === '/blueprints/') {
      if (req.method === 'GET') {
        return { status: 200, data: { body: mockBlueprintSummaries } };
      }
    }

    const blueprintDetailMatch = subPath.match(/^\/blueprints\/([^/]+)$/);
    if (blueprintDetailMatch && req.method === 'GET') {
      const bp = mockBlueprintManifests.find((b) => b.id === blueprintDetailMatch[1]);
      if (!bp) return { status: 404, data: { message: `Blueprint not found with id: ${blueprintDetailMatch[1]}` } };
      return { status: 200, data: { body: bp } };
    }

    // 1. Entity Types
    if (subPath === '/entity-types' || subPath === '/entity-types/') {
      if (req.method === 'GET') {
        const number = parseInt(searchParams.get('number') || searchParams.get('page') || '0', 10);
        const size = parseInt(searchParams.get('size') || '50', 10);
        const search = searchParams.get('search') || undefined;
        const page = await metadataSandboxRepo.getEntityTypes(tenantId, { number, size, search });
        return { status: 200, data: { body: page } };
      }
      if (req.method === 'POST') {
        const created = await metadataSandboxRepo.createEntityType(tenantId, req.data);
        return { status: 201, data: { body: created } };
      }
    }

    // 1.1 Entity Type by ID
    const entityTypeMatch = subPath.match(/^\/entity-types\/([^/]+)$/);
    if (entityTypeMatch) {
      const id = entityTypeMatch[1];
      if (req.method === 'GET') {
        const et = await metadataSandboxRepo.getEntityTypeById(tenantId, id);
        if (!et) return { status: 404, data: { message: `EntityType not found with id: ${id}` } };
        return { status: 200, data: { body: et } };
      }
      if (req.method === 'PUT') {
        const updated = await metadataSandboxRepo.updateEntityType(tenantId, id, req.data);
        return { status: 200, data: { body: updated } };
      }
      if (req.method === 'DELETE') {
        const deleted = await metadataSandboxRepo.deleteEntityType(tenantId, id);
        return { status: 200, data: { body: deleted } };
      }
    }

    // 1.2 Compiled Schema
    const schemaMatch = subPath.match(/^\/entity-types\/([^/]+)\/schema$/);
    if (schemaMatch && req.method === 'GET') {
      const schema = await metadataSandboxRepo.getCompiledSchema(tenantId, schemaMatch[1]);
      return { status: 200, data: { body: schema } };
    }

    // 2. Attribute Definitions
    const attrCollectionMatch = subPath.match(/^\/entity-types\/([^/]+)\/attributes$/);
    if (attrCollectionMatch) {
      const etId = attrCollectionMatch[1];
      if (req.method === 'GET') {
        const attrs = await metadataSandboxRepo.getAttributeDefinitions(tenantId, etId);
        return { status: 200, data: { body: attrs } };
      }
      if (req.method === 'POST') {
        const created = await metadataSandboxRepo.createAttributeDefinition(tenantId, etId, req.data);
        return { status: 201, data: { body: created } };
      }
    }

    const singleAttrMatch = subPath.match(/^\/entity-types\/([^/]+)\/attributes\/([^/]+)$/);
    if (singleAttrMatch) {
      const [_, etId, attrId] = singleAttrMatch;
      if (req.method === 'GET') {
        const attr = await metadataSandboxRepo.getAttributeDefinition(tenantId, etId, attrId);
        if (!attr) return { status: 404, data: { message: `Attribute not found with id: ${attrId}` } };
        return { status: 200, data: { body: attr } };
      }
      if (req.method === 'PUT') {
        const updated = await metadataSandboxRepo.updateAttributeDefinition(tenantId, etId, attrId, req.data);
        return { status: 200, data: { body: updated } };
      }
      if (req.method === 'DELETE') {
        const deleted = await metadataSandboxRepo.deleteAttributeDefinition(tenantId, etId, attrId);
        return { status: 200, data: { body: deleted } };
      }
    }

    // 3. Entity Records
    const recCollectionMatch = subPath.match(/^\/entity-types\/([^/]+)\/records$/);
    if (recCollectionMatch) {
      const etId = recCollectionMatch[1];
      if (req.method === 'GET') {
        const number = parseInt(searchParams.get('number') || searchParams.get('page') || '0', 10);
        const size = parseInt(searchParams.get('size') || '50', 10);
        const search = searchParams.get('search') || undefined;
        const page = await metadataSandboxRepo.getEntityRecords(tenantId, etId, { number, size, search });
        return { status: 200, data: { body: page } };
      }
      if (req.method === 'POST') {
        const created = await metadataSandboxRepo.createEntityRecord(tenantId, etId, req.data);
        return { status: 201, data: { body: created } };
      }
    }

    const singleRecMatch = subPath.match(/^\/entity-types\/([^/]+)\/records\/([^/]+)$/);
    if (singleRecMatch) {
      const [_, etId, recId] = singleRecMatch;
      if (req.method === 'GET') {
        const rec = await metadataSandboxRepo.getEntityRecord(tenantId, etId, recId);
        if (!rec) return { status: 404, data: { message: `Record not found with id: ${recId}` } };
        return { status: 200, data: { body: rec } };
      }
      if (req.method === 'PUT' || req.method === 'PATCH') {
        const updated = await metadataSandboxRepo.updateEntityRecord(tenantId, etId, recId, req.data);
        return { status: 200, data: { body: updated } };
      }
      if (req.method === 'DELETE') {
        const deleted = await metadataSandboxRepo.deleteEntityRecord(tenantId, etId, recId);
        return { status: 200, data: { body: deleted } };
      }
    }

    // 4. Relationship Types
    if (subPath === '/relationship-types' || subPath === '/relationship-types/') {
      if (req.method === 'GET') {
        const list = await metadataSandboxRepo.getRelationshipTypes(tenantId);
        return { status: 200, data: { body: list } };
      }
      if (req.method === 'POST') {
        const created = await metadataSandboxRepo.createRelationshipType(tenantId, req.data);
        return { status: 201, data: { body: created } };
      }
    }

    // 5. Record Relationships
    const recRelMatch = subPath.match(/^\/records\/([^/]+)\/relationships$/);
    if (recRelMatch) {
      const recId = recRelMatch[1];
      if (req.method === 'GET') {
        const list = await metadataSandboxRepo.getRecordRelationships(tenantId, recId);
        return { status: 200, data: { body: list } };
      }
      if (req.method === 'POST') {
        const created = await metadataSandboxRepo.createEntityRelationship(tenantId, recId, req.data);
        return { status: 201, data: { body: created } };
      }
    }

    const singleRelMatch = subPath.match(/^\/records\/([^/]+)\/relationships\/([^/]+)$/);
    if (singleRelMatch && req.method === 'DELETE') {
      const [_, recId, relId] = singleRelMatch;
      const deleted = await metadataSandboxRepo.deleteEntityRelationship(tenantId, recId, relId);
      return { status: 200, data: { body: deleted } };
    }

    return { status: 404, data: { message: `Unhandled metadata route: ${subPath}` } };
  },
};
