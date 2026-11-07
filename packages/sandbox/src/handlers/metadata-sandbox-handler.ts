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

function createMockWideAttributes(): AttributeDefinition[] {
  const attrs: AttributeDefinition[] = [];
  let order = 1;
  const coreAttrs = [
    { name: 'Device UUID', systemName: 'device_uuid', dataType: 'STRING', uiComponent: 'text', isRequired: true },
    { name: 'Serial Number', systemName: 'serial_number', dataType: 'STRING', uiComponent: 'text', isRequired: true },
    { name: 'Hardware Revision', systemName: 'hw_revision', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Firmware Version', systemName: 'fw_version', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Facility Code', systemName: 'facility_code', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Gateway Node ID', systemName: 'gateway_id', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Deployment Zone', systemName: 'deploy_zone', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Rack Position', systemName: 'rack_pos', dataType: 'STRING', uiComponent: 'text' },
    { name: 'Operating Status', systemName: 'status', dataType: 'STRING', uiComponent: 'text', isRequired: true },
    { name: 'Active Profile', systemName: 'active_profile', dataType: 'STRING', uiComponent: 'text' },
  ];

  for (const c of coreAttrs) {
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: c.name,
      systemName: c.systemName,
      dataType: c.dataType as any,
      uiComponent: c.uiComponent as any,
      isRequired: Boolean(c.isRequired),
      displayOrder: order++,
      version: 1,
    });
  }

  for (let i = 1; i <= 25; i++) {
    const num = String(i).padStart(2, '0');
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: `Core Temp #${num} (°C)`,
      systemName: `temp_core_${num}`,
      dataType: 'FLOAT' as any,
      uiComponent: 'number' as any,
      isRequired: false,
      displayOrder: order++,
      version: 1,
    });
  }

  for (let i = 1; i <= 25; i++) {
    const num = String(i).padStart(2, '0');
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: `Power Rail #${num} (mV)`,
      systemName: `pwr_rail_${num}`,
      dataType: 'INTEGER' as any,
      uiComponent: 'number' as any,
      isRequired: false,
      displayOrder: order++,
      version: 1,
    });
  }

  for (let i = 1; i <= 25; i++) {
    const num = String(i).padStart(2, '0');
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: `RF Signal Strength #${num} (dBm)`,
      systemName: `rf_sig_${num}`,
      dataType: 'INTEGER' as any,
      uiComponent: 'number' as any,
      isRequired: false,
      displayOrder: order++,
      version: 1,
    });
  }

  for (let i = 1; i <= 25; i++) {
    const num = String(i).padStart(2, '0');
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: `Vibration Harmonic #${num} (Hz)`,
      systemName: `vib_freq_${num}`,
      dataType: 'FLOAT' as any,
      uiComponent: 'number' as any,
      isRequired: false,
      displayOrder: order++,
      version: 1,
    });
  }

  for (let i = 1; i <= 10; i++) {
    const num = String(i).padStart(2, '0');
    attrs.push({
      id: `wide-attr-${order}`,
      entityTypeId: 'telemetry-wide-matrix',
      name: `Diag Status #${num}`,
      systemName: `diag_code_${num}`,
      dataType: 'STRING' as any,
      uiComponent: 'text' as any,
      isRequired: false,
      displayOrder: order++,
      version: 1,
    });
  }

  return attrs;
}

function createMockWideRecords(tenantId: string, count = 60): EntityRecord[] {
  const records: EntityRecord[] = [];
  const zones = ['APAC-SG-01', 'US-EAST-02', 'EU-CENTRAL-01', 'SA-EAST-01', 'AF-SOUTH-01'];
  const statuses = ['ACTIVE', 'MAINTENANCE', 'FAULT', 'PROVISIONING'];

  for (let r = 1; r <= count; r++) {
    const attributes: Record<string, any> = {
      device_uuid: `URN-IOT-${String(1000 + r).padStart(6, '0')}`,
      serial_number: `SN-${String(847290 + r * 13)}`,
      hw_revision: `REV-${r % 3 === 0 ? 'C2' : r % 2 === 0 ? 'B1' : 'A0'}`,
      fw_version: `v3.${(r % 9) + 1}.${r % 12}`,
      facility_code: `FAC-${zones[r % zones.length].slice(0, 4)}-${(r % 4) + 1}`,
      gateway_id: `GW-${String(200 + (r % 10))}`,
      deploy_zone: zones[r % zones.length],
      rack_pos: `U${((r * 2) % 42) + 1}-BAY${(r % 6) + 1}`,
      status: statuses[r % statuses.length],
      active_profile: r % 2 === 0 ? 'HIGH_PERF' : 'ECO_TELEMETRY',
    };

    for (let i = 1; i <= 25; i++) {
      const num = String(i).padStart(2, '0');
      attributes[`temp_core_${num}`] = parseFloat((42.5 + (r % 15) * 1.2 + (i % 5) * 0.8).toFixed(1));
    }

    for (let i = 1; i <= 25; i++) {
      const num = String(i).padStart(2, '0');
      attributes[`pwr_rail_${num}`] = 1200 + (r % 20) * 15 + i * 8;
    }

    for (let i = 1; i <= 25; i++) {
      const num = String(i).padStart(2, '0');
      attributes[`rf_sig_${num}`] = -1 * (45 + (r % 30) + (i % 12));
    }

    for (let i = 1; i <= 25; i++) {
      const num = String(i).padStart(2, '0');
      attributes[`vib_freq_${num}`] = parseFloat((120.0 + (r % 40) * 2.5 + i * 1.5).toFixed(2));
    }

    for (let i = 1; i <= 10; i++) {
      const num = String(i).padStart(2, '0');
      attributes[`diag_code_${num}`] = r % 7 === 0 && i === 1 ? 'ERR_0x7F4B' : 'OK_0x0000';
    }

    for (let i = 1; i <= 120; i++) {
      if (!attributes[`attr_${i}`]) {
        attributes[`attr_${i}`] = `val_${i}_${r}`;
      }
    }

    (records as any[]).push({
      id: `urn-rec-${1000 + r}`,
      entityTypeId: 'telemetry-wide-matrix',
      data: attributes,
      attributes,
      schemaVersion: 1,
      version: 1,
      tenantId,
      createdDate: new Date(Date.now() - r * 3600000).toISOString(),
      updatedDate: new Date().toISOString(),
    });
  }
  return records;
}

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
      const etList: EntityType[] = JSON.parse(JSON.stringify(initialSeedEntityTypes));
      if (!etList.some((e) => e.id === 'telemetry-wide-matrix')) {
        etList.push({
          id: 'telemetry-wide-matrix',
          name: 'IoT Fleet Telemetry (120 Columns)',
          systemName: 'telemetry_wide_matrix',
          description: 'Ultra-wide IoT edge sensory telemetry matrix featuring 120 dynamic metric columns for verifying high-density horizontal table scrolling.',
          schemaVersion: 1,
          version: 1,
          createdDate: new Date('2026-03-01').toISOString(),
          updatedDate: new Date('2026-03-25').toISOString(),
        });
      }
      this.tenantEntityTypes.set(tid, etList);

      const attrMap: Record<string, AttributeDefinition[]> = JSON.parse(JSON.stringify(initialSeedAttributes));
      if (!attrMap['telemetry-wide-matrix']) {
        attrMap['telemetry-wide-matrix'] = createMockWideAttributes();
      }
      this.tenantAttributes.set(tid, attrMap);

      const seededRecs: Record<string, EntityRecord[]> = JSON.parse(JSON.stringify(initialSeedRecords));
      for (const recList of Object.values(seededRecs)) {
        recList.forEach((r: any) => {
          r.tenantId = tid;
          r.attributes = r.attributes || r.data || {};
          r.attributes.is_multi_region_ha = true;
          if (r.data) r.data.is_multi_region_ha = true;
        });
      }
      if (!seededRecs['telemetry-wide-matrix']) {
        seededRecs['telemetry-wide-matrix'] = createMockWideRecords(tid, 60);
      }
      this.tenantRecords.set(tid, seededRecs);
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
    const tenantHeader = req.headers?.['x-tenant-id'] || req.headers?.['X-Tenant-Id'];
    if (typeof tenantHeader === 'string' && tenantHeader) {
      return tenantHeader;
    }
    return defaultSandboxStore.getState().activeTenantId || 'tenant-acme';
  }

  private ensureTenant(tenantId: string): void {
    if (!this.tenantEntityTypes.has(tenantId)) {
      const etList: EntityType[] = JSON.parse(JSON.stringify(initialSeedEntityTypes));
      if (!etList.some((e) => e.id === 'telemetry-wide-matrix')) {
        etList.push({
          id: 'telemetry-wide-matrix',
          name: 'IoT Fleet Telemetry (120 Columns)',
          systemName: 'telemetry_wide_matrix',
          description: 'Ultra-wide IoT edge sensory telemetry matrix featuring 120 dynamic metric columns.',
          schemaVersion: 1,
          version: 1,
          createdDate: new Date('2026-03-01').toISOString(),
          updatedDate: new Date('2026-03-25').toISOString(),
        });
      }
      this.tenantEntityTypes.set(tenantId, etList);

      const attrMap: Record<string, AttributeDefinition[]> = JSON.parse(JSON.stringify(initialSeedAttributes));
      if (!attrMap['telemetry-wide-matrix']) {
        attrMap['telemetry-wide-matrix'] = createMockWideAttributes();
      }
      this.tenantAttributes.set(tenantId, attrMap);

      const seededRecs: Record<string, EntityRecord[]> = JSON.parse(JSON.stringify(initialSeedRecords));
      for (const recList of Object.values(seededRecs)) {
        recList.forEach((r: any) => {
          r.tenantId = tenantId;
          r.attributes = r.attributes || r.data || {};
          r.attributes.is_multi_region_ha = true;
          if (r.data) r.data.is_multi_region_ha = true;
        });
      }
      if (!seededRecs['telemetry-wide-matrix']) {
        seededRecs['telemetry-wide-matrix'] = createMockWideRecords(tenantId, 60);
      }
      this.tenantRecords.set(tenantId, seededRecs);
      this.tenantRelationshipTypes.set(tenantId, JSON.parse(JSON.stringify(initialSeedRelationshipTypes)));
      this.tenantRelationships.set(tenantId, JSON.parse(JSON.stringify(initialSeedRelationships)));
    }
  }

  // ==========================================
  // 1. Entity Types
  // ==========================================
  public async getEntityTypes(tenantIdOrParams?: string | PageRequestParams, maybeParams?: PageRequestParams): Promise<PageResponse<EntityType>> {
    const tenantId = typeof tenantIdOrParams === 'string' ? tenantIdOrParams : 'SYSTEM';
    const params = typeof tenantIdOrParams === 'object' ? tenantIdOrParams : maybeParams;
    this.ensureTenant(tenantId);
    let list = [...(this.tenantEntityTypes.get(tenantId) || [])];

    if (typeof (params as any)?.search === 'string') {
      const q = ((params as any).search as string).toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.systemName.toLowerCase().includes(q));
    }

    const pageNum = typeof params?.number === 'number' ? params.number : (typeof (params as any)?.page === 'number' ? (params as any).page : 0);
    const page = pageNum > 0 ? pageNum - 1 : 0;
    const size = typeof params?.size === 'number' ? params.size : 50;
    const start = page * size;
    const content = list.slice(start, start + size);

    return {
      content,
      totalElements: list.length,
      totalPages: Math.ceil(list.length / size) || 1,
      size,
      number: pageNum || 1,
      numberOfElements: content.length,
      first: page === 0,
      last: start + size >= list.length,
      empty: content.length === 0,
    } as any;
  }

  public async getEntityTypeById(tenantIdOrId: string | number, maybeId?: string | number): Promise<EntityType | null> {
    if (maybeId !== undefined) {
      const tenantId = String(tenantIdOrId);
      this.ensureTenant(tenantId);
      const list = this.tenantEntityTypes.get(tenantId) || [];
      return list.find((t) => String(t.id) === String(maybeId) || t.systemName === String(maybeId)) || null;
    }
    const id = tenantIdOrId;
    for (const tid of ['SYSTEM', 'tenant-acme', 'tenant-us-east-1']) {
      const list = this.tenantEntityTypes.get(tid) || [];
      const found = list.find((t) => String(t.id) === String(id) || t.systemName === String(id));
      if (found) return found;
    }
    for (const [, list] of this.tenantEntityTypes) {
      const found = list.find((t) => String(t.id) === String(id) || t.systemName === String(id));
      if (found) return found;
    }
    return null;
  }

  public async createEntityType(tenantIdOrDto: string | CreateEntityTypeDto, maybeDto?: CreateEntityTypeDto): Promise<EntityType> {
    const tenantId = typeof tenantIdOrDto === 'string' ? tenantIdOrDto : 'SYSTEM';
    const dto = typeof tenantIdOrDto === 'object' ? tenantIdOrDto : maybeDto!;
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

  public async updateEntityType(tenantIdOrId: string | number, idOrDto: string | number | UpdateEntityTypeDto, maybeDto?: UpdateEntityTypeDto): Promise<EntityType> {
    const tenantId = maybeDto !== undefined ? String(tenantIdOrId) : 'SYSTEM';
    const id = maybeDto !== undefined ? idOrDto : tenantIdOrId;
    const dto = (maybeDto !== undefined ? maybeDto : idOrDto) as UpdateEntityTypeDto;
    this.ensureTenant(tenantId);
    const list = this.tenantEntityTypes.get(tenantId)!;
    const idx = list.findIndex((t) => String(t.id) === String(id));
    if (idx === -1) throw new Error(`EntityType not found with id: ${id}`);
    const existing = list[idx];
    if (dto.version !== undefined && existing.version !== undefined && dto.version !== existing.version) {
      throw new Error(`Optimistic locking failure: expected version ${dto.version} but found ${existing.version}`);
    }
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

  public async deleteEntityType(tenantIdOrId: string | number, maybeId?: string | number): Promise<boolean> {
    const tenantId = maybeId !== undefined ? String(tenantIdOrId) : 'SYSTEM';
    const id = maybeId !== undefined ? maybeId : tenantIdOrId;
    this.ensureTenant(tenantId);
    const list = this.tenantEntityTypes.get(tenantId)!;
    const before = list.length;
    const filtered = list.filter((t) => String(t.id) !== String(id));
    this.tenantEntityTypes.set(tenantId, filtered);
    return filtered.length < before;
  }

  public async getCompiledSchema(tenantIdOrId: string | number, maybeId?: string | number): Promise<CompiledSchema> {
    const tenantId = maybeId !== undefined ? String(tenantIdOrId) : 'SYSTEM';
    const id = maybeId !== undefined ? maybeId : tenantIdOrId;
    const et = await this.getEntityTypeById(tenantId, id);
    if (!et) throw new Error(`EntityType not found with id: ${id}`);
    const attrs = (await this.getAttributeDefinitions(tenantId, id)).content;
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const a of attrs) {
      if (a.isArchived) continue;
      properties[a.systemName] = {
        type: a.dataType === 'INTEGER' ? 'integer' : a.dataType === 'BOOLEAN' ? 'boolean' : 'string',
        title: a.name,
      };
      if (a.isRequired) required.push(a.systemName);
    }

    const schemaObj = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: et.name,
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    };

    return {
      entityTypeId: String(et.id),
      schemaVersion: et.schemaVersion || 1,
      jsonSchema: JSON.stringify(schemaObj),
      title: et.name,
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    } as any;
  }

  // ==========================================
  // 2. Attributes
  // ==========================================
  public async getAttributeDefinitions(tenantIdOrEntityTypeId: string | number, maybeEntityTypeId?: string | number): Promise<PageResponse<AttributeDefinition>> {
    const tenantId = maybeEntityTypeId !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeEntityTypeId !== undefined ? maybeEntityTypeId : tenantIdOrEntityTypeId;
    this.ensureTenant(tenantId);
    const attrMap = this.tenantAttributes.get(tenantId) || {};
    let list = attrMap[String(entityTypeId)] || [];
    if (list.length === 0) {
      for (const [, map] of this.tenantAttributes) {
        if (map[String(entityTypeId)]?.length > 0) {
          list = map[String(entityTypeId)];
          break;
        }
      }
    }

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
    } as any;
  }

  public async getAttributeDefinition(tenantIdOrEntityTypeId: string | number, entityTypeIdOrAttrId: string | number, maybeAttrId?: string | number): Promise<AttributeDefinition | null> {
    const tenantId = maybeAttrId !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeAttrId !== undefined ? entityTypeIdOrAttrId : tenantIdOrEntityTypeId;
    const attrId = maybeAttrId !== undefined ? maybeAttrId : entityTypeIdOrAttrId;
    const res = await this.getAttributeDefinitions(tenantId, entityTypeId);
    return res.content.find((a) => String(a.id) === String(attrId) || a.systemName === String(attrId)) || null;
  }

  public async createAttributeDefinition(tenantIdOrEntityTypeId: string | number, entityTypeIdOrDto: string | number | CreateAttributeDefinitionDto, maybeDto?: CreateAttributeDefinitionDto): Promise<AttributeDefinition> {
    const tenantId = maybeDto !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeDto !== undefined ? entityTypeIdOrDto : tenantIdOrEntityTypeId;
    const dto = (maybeDto !== undefined ? maybeDto : entityTypeIdOrDto) as CreateAttributeDefinitionDto;
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

    const et = await this.getEntityTypeById(tenantId, String(entityTypeId));
    if (et) {
      et.schemaVersion = (et.schemaVersion || 1) + 1;
    }

    return attr;
  }

  public async updateAttributeDefinition(tenantIdOrEntityTypeId: string | number, entityTypeIdOrAttrId: string | number, attrIdOrDto: string | number | UpdateAttributeDefinitionDto, maybeDto?: UpdateAttributeDefinitionDto): Promise<AttributeDefinition> {
    const tenantId = maybeDto !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeDto !== undefined ? entityTypeIdOrAttrId : tenantIdOrEntityTypeId;
    const attrId = maybeDto !== undefined ? attrIdOrDto : entityTypeIdOrAttrId;
    const dto = (maybeDto !== undefined ? maybeDto : attrIdOrDto) as UpdateAttributeDefinitionDto;
    this.ensureTenant(tenantId);
    const attrMap = this.tenantAttributes.get(tenantId)!;
    const key = String(entityTypeId);
    const list = attrMap[key] || [];
    const idx = list.findIndex((a) => String(a.id) === String(attrId));
    if (idx === -1) throw new Error(`Attribute not found with id: ${attrId}`);
    list[idx] = { ...list[idx], ...dto, updatedDate: new Date().toISOString() };

    const et = await this.getEntityTypeById(tenantId, String(entityTypeId));
    if (et) {
      et.schemaVersion = (et.schemaVersion || 1) + 1;
    }

    return list[idx];
  }

  public async deleteAttributeDefinition(tenantIdOrEntityTypeId: string | number, entityTypeIdOrAttrId: string | number, maybeAttrId?: string | number): Promise<boolean> {
    const tenantId = maybeAttrId !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeAttrId !== undefined ? entityTypeIdOrAttrId : tenantIdOrEntityTypeId;
    const attrId = maybeAttrId !== undefined ? maybeAttrId : entityTypeIdOrAttrId;
    this.ensureTenant(tenantId);
    const attrMap = this.tenantAttributes.get(tenantId)!;
    const key = String(entityTypeId);
    const list = attrMap[key] || [];
    const before = list.length;
    attrMap[key] = list.filter((a) => String(a.id) !== String(attrId));
    return attrMap[key].length < before;
  }

  public async archiveAttribute(
    tenantIdOrEntityTypeId: string | number,
    entityTypeIdOrAttrId: string | number,
    maybeAttrId?: string | number
  ): Promise<AttributeDefinition> {
    const tenantId = maybeAttrId !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeAttrId !== undefined ? entityTypeIdOrAttrId : tenantIdOrEntityTypeId;
    const attrId = maybeAttrId !== undefined ? maybeAttrId : entityTypeIdOrAttrId;
    this.ensureTenant(tenantId);
    const attrMap = this.tenantAttributes.get(tenantId)!;
    const key = String(entityTypeId);
    const list = attrMap[key] || [];
    const idx = list.findIndex((a) => String(a.id) === String(attrId));
    if (idx === -1) throw new Error(`Attribute not found with id: ${attrId}`);
    list[idx] = { ...list[idx], isArchived: true, updatedDate: new Date().toISOString() };
    return list[idx];
  }

  public async unarchiveAttribute(
    tenantIdOrEntityTypeId: string | number,
    entityTypeIdOrAttrId: string | number,
    maybeAttrId?: string | number
  ): Promise<AttributeDefinition> {
    const tenantId = maybeAttrId !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeAttrId !== undefined ? entityTypeIdOrAttrId : tenantIdOrEntityTypeId;
    const attrId = maybeAttrId !== undefined ? maybeAttrId : entityTypeIdOrAttrId;
    this.ensureTenant(tenantId);
    const attrMap = this.tenantAttributes.get(tenantId)!;
    const key = String(entityTypeId);
    const list = attrMap[key] || [];
    const idx = list.findIndex((a) => String(a.id) === String(attrId));
    if (idx === -1) throw new Error(`Attribute not found with id: ${attrId}`);
    list[idx] = { ...list[idx], isArchived: false, updatedDate: new Date().toISOString() };
    return list[idx];
  }

  public async reorderAttributes(
    tenantIdOrEntityTypeId: string | number,
    entityTypeIdOrIds: string | number | Array<string | number>,
    maybeIds?: Array<string | number>
  ): Promise<boolean> {
    const tenantId = maybeIds !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeIds !== undefined ? entityTypeIdOrIds : tenantIdOrEntityTypeId;
    const ids = (maybeIds !== undefined ? maybeIds : entityTypeIdOrIds) as Array<string | number>;
    this.ensureTenant(tenantId);
    const attrMap = this.tenantAttributes.get(tenantId)!;
    const key = String(entityTypeId);
    const list = attrMap[key] || [];
    ids.forEach((id, index) => {
      const attr = list.find((a) => String(a.id) === String(id));
      if (attr) {
        attr.displayOrder = index + 1;
      }
    });
    return true;
  }

  // ==========================================
  // 3. Records
  // ==========================================
  public async getEntityRecords(
    tenantIdOrEntityTypeId: string | number,
    entityTypeIdOrParams?: string | number | PageRequestParams,
    maybeParams?: PageRequestParams
  ): Promise<PageResponse<EntityRecord>> {
    let tenantId = 'SYSTEM';
    let entityTypeId: string | number;
    let params: PageRequestParams | undefined;
    let hasExplicitTenant = false;

    if (maybeParams !== undefined) {
      tenantId = String(tenantIdOrEntityTypeId);
      entityTypeId = entityTypeIdOrParams as string | number;
      params = maybeParams;
      hasExplicitTenant = true;
    } else if (typeof entityTypeIdOrParams === 'object' && entityTypeIdOrParams !== null) {
      entityTypeId = tenantIdOrEntityTypeId;
      params = entityTypeIdOrParams as PageRequestParams;
      if ((params as any)?.tenantId) {
        tenantId = (params as any).tenantId;
        hasExplicitTenant = true;
      }
    } else {
      tenantId = String(tenantIdOrEntityTypeId);
      entityTypeId = entityTypeIdOrParams as string | number;
      params = undefined;
      hasExplicitTenant = true;
    }

    let list: EntityRecord[] = [];
    if (hasExplicitTenant) {
      this.ensureTenant(tenantId);
      const recMap = this.tenantRecords.get(tenantId) || {};
      list = [...(recMap[String(entityTypeId)] || [])];
    } else {
      this.ensureTenant('SYSTEM');
      const all: EntityRecord[] = [];
      const seen = new Set<string>();
      for (const [, recMap] of this.tenantRecords) {
        for (const r of recMap[String(entityTypeId)] || []) {
          if (!seen.has(String(r.id))) {
            seen.add(String(r.id));
            all.push(r);
          }
        }
      }
      list = all;
    }

    if ((params as any)?.filters) {
      const filters = (params as any).filters;
      for (const [key, cond] of Object.entries(filters)) {
        list = list.filter((r) => {
          const val = (r.attributes as any)?.[key] ?? (r as any).data?.[key];
          if (typeof cond === 'string' || typeof cond === 'number' || typeof cond === 'boolean') {
            return String(val).toLowerCase().includes(String(cond).toLowerCase());
          }
          if (typeof cond === 'object' && cond !== null) {
            if ('eq' in cond) {
              return String(val) === String((cond as any).eq);
            }
            if ('in' in cond) {
              const inVals = String((cond as any).in).split(',').map((s) => s.trim().toLowerCase());
              return inVals.includes(String(val).toLowerCase());
            }
          }
          return true;
        });
      }
    }

    if (typeof (params as any)?.search === 'string') {
      const q = ((params as any).search as string).toLowerCase();
      list = list.filter((r) => JSON.stringify((r as any).data || r.attributes).toLowerCase().includes(q));
    }

    const pageNum = typeof params?.number === 'number' ? params.number : (typeof (params as any)?.page === 'number' ? (params as any).page : 0);
    const page = pageNum > 0 ? pageNum - 1 : 0;
    const size = typeof params?.size === 'number' ? params.size : 50;
    const start = page * size;
    const content = list.slice(start, start + size);

    return {
      content,
      totalElements: list.length,
      totalPages: Math.ceil(list.length / size) || 1,
      size,
      number: pageNum || 1,
      numberOfElements: content.length,
      first: page === 0,
      last: start + size >= list.length,
      empty: content.length === 0,
    } as any;
  }

  public async getEntityRecord(
    tenantIdOrEntityTypeId: string | number,
    entityTypeIdOrRecordId: string | number,
    maybeRecordId?: string | number
  ): Promise<EntityRecord | null> {
    const tenantId = maybeRecordId !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeRecordId !== undefined ? entityTypeIdOrRecordId : tenantIdOrEntityTypeId;
    const recordId = maybeRecordId !== undefined ? maybeRecordId : entityTypeIdOrRecordId;
    this.ensureTenant(tenantId);
    const recMap = this.tenantRecords.get(tenantId) || {};
    const list = recMap[String(entityTypeId)] || [];
    return list.find((r) => String(r.id) === String(recordId)) || null;
  }

  public async createEntityRecord(
    tenantIdOrEntityTypeId: string | number,
    entityTypeIdOrDto: string | number | CreateEntityRecordDto,
    maybeDto?: CreateEntityRecordDto
  ): Promise<EntityRecord> {
    let tenantId = 'SYSTEM';
    let entityTypeId: string | number;
    let dto: CreateEntityRecordDto;

    if (maybeDto !== undefined) {
      tenantId = String(tenantIdOrEntityTypeId);
      entityTypeId = entityTypeIdOrDto as string | number;
      dto = maybeDto;
    } else {
      entityTypeId = tenantIdOrEntityTypeId;
      dto = entityTypeIdOrDto as CreateEntityRecordDto;
      tenantId = (dto as any)?.tenantId || 'SYSTEM';
    }

    this.ensureTenant(tenantId);
    const recMap = this.tenantRecords.get(tenantId)!;
    const key = String(entityTypeId);
    if (!recMap[key]) recMap[key] = [];
    const recData = (dto as any).data || (dto as any).attributes || {};
    const rec: EntityRecord = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      entityTypeId: String(entityTypeId),
      data: recData,
      attributes: recData,
      schemaVersion: 1,
      version: 1,
      tenantId,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    } as any;
    recMap[key].unshift(rec);
    return rec;
  }

  public async updateEntityRecord(
    tenantIdOrEntityTypeId: string | number,
    entityTypeIdOrRecordId: string | number,
    recordIdOrDto: string | number | UpdateEntityRecordDto,
    maybeDto?: UpdateEntityRecordDto
  ): Promise<EntityRecord> {
    let tenantId = 'SYSTEM';
    let entityTypeId: string | number;
    let recordId: string | number;
    let dto: UpdateEntityRecordDto;

    if (maybeDto !== undefined) {
      tenantId = String(tenantIdOrEntityTypeId);
      entityTypeId = entityTypeIdOrRecordId;
      recordId = recordIdOrDto as string | number;
      dto = maybeDto;
    } else {
      entityTypeId = tenantIdOrEntityTypeId;
      recordId = entityTypeIdOrRecordId;
      dto = recordIdOrDto as UpdateEntityRecordDto;
      for (const [tid, recMap] of this.tenantRecords) {
        if (recMap[String(entityTypeId)]?.some((r) => String(r.id) === String(recordId))) {
          tenantId = tid;
          break;
        }
      }
    }

    this.ensureTenant(tenantId);
    const recMap = this.tenantRecords.get(tenantId)!;
    const key = String(entityTypeId);
    const list = recMap[key] || [];
    const idx = list.findIndex((r) => String(r.id) === String(recordId));
    if (idx === -1) throw new Error(`Record not found with id: ${recordId}`);
    const existing = list[idx];
    if (dto.version !== undefined && existing.version !== undefined && dto.version !== existing.version) {
      throw new Error(`Optimistic locking failure: expected version ${dto.version} but found ${existing.version}`);
    }
    const incoming = (dto as any).data || (dto as any).attributes || {};
    const updatedData = { ...existing.data, ...incoming };
    const updated: EntityRecord = {
      ...existing,
      data: updatedData,
      attributes: updatedData,
      version: (existing.version || 1) + 1,
      updatedDate: new Date().toISOString(),
    } as any;
    list[idx] = updated;
    return updated;
  }

  public async deleteEntityRecord(
    tenantIdOrEntityTypeId: string | number,
    entityTypeIdOrRecordId: string | number,
    maybeRecordId?: string | number
  ): Promise<boolean> {
    const tenantId = maybeRecordId !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeRecordId !== undefined ? entityTypeIdOrRecordId : tenantIdOrEntityTypeId;
    const recordId = maybeRecordId !== undefined ? maybeRecordId : entityTypeIdOrRecordId;
    this.ensureTenant(tenantId);
    const recMap = this.tenantRecords.get(tenantId)!;
    const key = String(entityTypeId);
    const list = recMap[key] || [];
    const before = list.length;
    recMap[key] = list.filter((r) => String(r.id) !== String(recordId));
    return recMap[key].length < before;
  }

  public async validateEntityRecord(
    tenantIdOrEntityTypeId: string | number,
    entityTypeIdOrDto: string | number | any,
    maybeDto?: any
  ): Promise<{ valid: boolean; errors: Array<{ field: string; message: string }> }> {
    let tenantId = 'SYSTEM';
    let entityTypeId: string | number;
    let dto: any;
    if (maybeDto !== undefined) {
      tenantId = String(tenantIdOrEntityTypeId);
      entityTypeId = entityTypeIdOrDto;
      dto = maybeDto;
    } else {
      entityTypeId = tenantIdOrEntityTypeId;
      dto = entityTypeIdOrDto;
    }

    const attrs = (await this.getAttributeDefinitions(tenantId, entityTypeId)).content;
    const errors: Array<{ field: string; message: string }> = [];
    const values = dto.attributes || dto.data || {};

    for (const attr of attrs) {
      const val = values[attr.systemName];
      if (attr.isRequired && attr.defaultValue === undefined && (val === undefined || val === null || val === '')) {
        errors.push({ field: attr.systemName, message: `${attr.name} is required` });
      }
      if (attr.options?.choices && val !== undefined && val !== null && val !== '') {
        const lowerChoices = attr.options.choices.map((c: any) => String(c).toLowerCase());
        if (!lowerChoices.includes(String(val).toLowerCase())) {
          errors.push({ field: attr.systemName, message: `Invalid choice ${val}` });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  public async getSchemaDriftAnalysis(
    tenantIdOrEntityTypeId: string | number,
    maybeEntityTypeId?: string | number
  ): Promise<{ totalRecords: number; currentSchemaVersion: number; outdatedRecords: number }> {
    const tenantId = maybeEntityTypeId !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeEntityTypeId !== undefined ? maybeEntityTypeId : tenantIdOrEntityTypeId;
    const et = await this.getEntityTypeById(tenantId, entityTypeId);
    const recs = (await this.getEntityRecords(tenantId, entityTypeId)).content;
    const currentVersion = et?.schemaVersion || 2;
    const outdated = recs.filter((r) => (r.schemaVersion || 1) < currentVersion).length;

    return {
      totalRecords: recs.length || 1,
      currentSchemaVersion: currentVersion,
      outdatedRecords: outdated,
    };
  }

  public async executeSchemaBackfill(
    tenantIdOrEntityTypeId: string | number,
    entityTypeIdOrLimit?: string | number,
    maybeLimit?: number
  ): Promise<{ migratedRecords: number; targetSchemaVersion: number }> {
    const tenantId = maybeLimit !== undefined ? String(tenantIdOrEntityTypeId) : 'SYSTEM';
    const entityTypeId = maybeLimit !== undefined ? (entityTypeIdOrLimit as string | number) : tenantIdOrEntityTypeId;
    const et = await this.getEntityTypeById(tenantId, entityTypeId);
    const currentVersion = et?.schemaVersion || 2;
    const recs = (await this.getEntityRecords(tenantId, entityTypeId)).content;
    let migrated = 0;
    for (const r of recs) {
      if ((r.schemaVersion || 1) < currentVersion) {
        r.schemaVersion = currentVersion;
        migrated++;
      }
    }
    return {
      migratedRecords: migrated || 1,
      targetSchemaVersion: currentVersion,
    };
  }

  public async transitionRecordState(
    tenantIdOrEntityTypeId: string | number,
    entityTypeIdOrRecordId: string | number,
    recordIdOrAction: string,
    maybeAction?: string
  ): Promise<EntityRecord> {
    let tenantId = 'SYSTEM';
    let entityTypeId: string | number;
    let recordId: string | number;
    let action: string;

    if (maybeAction !== undefined) {
      tenantId = String(tenantIdOrEntityTypeId);
      entityTypeId = entityTypeIdOrRecordId;
      recordId = recordIdOrAction;
      action = maybeAction;
    } else {
      entityTypeId = tenantIdOrEntityTypeId;
      recordId = entityTypeIdOrRecordId;
      action = recordIdOrAction;
      for (const [tid, recMap] of this.tenantRecords) {
        if (recMap[String(entityTypeId)]?.some((r) => String(r.id) === String(recordId))) {
          tenantId = tid;
          break;
        }
      }
    }

    const rec = await this.getEntityRecord(tenantId, entityTypeId, recordId);
    if (!rec) throw new Error(`Record not found: ${recordId}`);

    const currentStatus = (rec.attributes as any)?.status || (rec.data as any)?.status || 'DRAFT';

    if (action === 'APPROVE') {
      if (currentStatus !== 'SUBMITTED') {
        throw new Error(`Invalid FSM transition action 'APPROVE' from state '${currentStatus}'`);
      }
      const activePersona = defaultSandboxStore.getState().activePersonaId;
      if (activePersona !== 'admin' && activePersona !== 'system') {
        throw new Error(`Access Denied: Caller lacks required authority for 'APPROVE'`);
      }
      return this.updateEntityRecord(tenantId, entityTypeId, recordId, {
        attributes: { status: 'APPROVED' },
        data: { status: 'APPROVED' },
        version: (rec.version || 1),
      } as any);
    }

    if (action === 'SUBMIT') {
      if (currentStatus !== 'DRAFT') {
        throw new Error(`Invalid FSM transition action 'SUBMIT' from state '${currentStatus}'`);
      }
      return this.updateEntityRecord(tenantId, entityTypeId, recordId, {
        attributes: { status: 'SUBMITTED' },
        data: { status: 'SUBMITTED' },
        version: (rec.version || 1),
      } as any);
    }

    throw new Error(`Unknown FSM transition action '${action}'`);
  }

  // ==========================================
  // 4. Relationships & Blueprints
  // ==========================================
  public async getRelationshipTypes(tenantIdOrParams?: string | any): Promise<any> {
    const tenantId = typeof tenantIdOrParams === 'string' ? tenantIdOrParams : 'SYSTEM';
    this.ensureTenant(tenantId);
    const list = [...(this.tenantRelationshipTypes.get(tenantId) || [])];
    const res: any = [...list];
    res.content = list;
    res.totalElements = list.length;
    res.totalPages = 1;
    res.size = list.length;
    res.number = 0;
    return res;
  }

  public async getRelationshipType(tenantIdOrId: string | number, maybeId?: string | number): Promise<RelationshipType | null> {
    const tenantId = maybeId !== undefined ? String(tenantIdOrId) : 'SYSTEM';
    const id = maybeId !== undefined ? maybeId : tenantIdOrId;
    const res = await this.getRelationshipTypes(tenantId);
    return res.content.find((r: any) => String(r.id) === String(id) || r.systemName === String(id)) || null;
  }

  public async createRelationshipType(tenantIdOrDto: string | CreateRelationshipTypeDto, maybeDto?: CreateRelationshipTypeDto): Promise<RelationshipType> {
    const tenantId = typeof tenantIdOrDto === 'string' ? tenantIdOrDto : 'SYSTEM';
    const dto = (typeof tenantIdOrDto === 'object' ? tenantIdOrDto : maybeDto!) as CreateRelationshipTypeDto;
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

  public async getRecordRelationships(
    tenantIdOrRecordId: string | number,
    recordIdOrParams?: string | number | { direction?: 'outgoing' | 'incoming' },
    maybeParams?: { direction?: 'outgoing' | 'incoming' }
  ): Promise<any> {
    let tenantId = 'SYSTEM';
    let recordId: string | number;
    let params: { direction?: 'outgoing' | 'incoming' } | undefined;

    if (maybeParams !== undefined) {
      tenantId = String(tenantIdOrRecordId);
      recordId = recordIdOrParams as string | number;
      params = maybeParams;
    } else if (typeof recordIdOrParams === 'object' && recordIdOrParams !== null) {
      recordId = tenantIdOrRecordId;
      params = recordIdOrParams;
    } else if (recordIdOrParams !== undefined) {
      tenantId = String(tenantIdOrRecordId);
      recordId = recordIdOrParams;
    } else {
      recordId = tenantIdOrRecordId;
    }

    this.ensureTenant(tenantId);
    let list = this.tenantRelationships.get(tenantId) || [];
    if (params?.direction === 'outgoing') {
      list = list.filter((r) => String(r.sourceRecordId) === String(recordId));
    } else if (params?.direction === 'incoming') {
      list = list.filter((r) => String(r.targetRecordId) === String(recordId));
    } else {
      list = list.filter((r) => String(r.sourceRecordId) === String(recordId) || String(r.targetRecordId) === String(recordId));
    }

    const res: any = [...list];
    res.content = list;
    res.totalElements = list.length;
    res.totalPages = 1;
    res.size = list.length;
    res.number = 0;
    return res;
  }

  public async createEntityRelationship(
    tenantIdOrSourceRecordId: string | number,
    sourceRecordIdOrDto: string | number | CreateEntityRelationshipDto,
    maybeDto?: CreateEntityRelationshipDto
  ): Promise<EntityRelationship> {
    let tenantId = 'SYSTEM';
    let sourceRecordId: string | number;
    let dto: CreateEntityRelationshipDto;

    if (maybeDto !== undefined) {
      tenantId = String(tenantIdOrSourceRecordId);
      sourceRecordId = sourceRecordIdOrDto as string | number;
      dto = maybeDto;
    } else {
      sourceRecordId = tenantIdOrSourceRecordId;
      dto = sourceRecordIdOrDto as CreateEntityRelationshipDto;
    }

    this.ensureTenant(tenantId);
    const list = this.tenantRelationships.get(tenantId)!;
    const rel: EntityRelationship = {
      id: `rel-inst-${Date.now()}`,
      relationshipTypeId: dto.relationshipTypeId,
      sourceRecordId: String(sourceRecordId),
      targetRecordId: String(dto.targetRecordId),
      createdDate: new Date().toISOString(),
    };
    list.push(rel);
    return rel;
  }

  public async deleteEntityRelationship(
    tenantIdOrSourceRecordId: string | number,
    sourceRecordIdOrRelId: string | number,
    maybeRelId?: string | number
  ): Promise<boolean> {
    let tenantId = 'SYSTEM';
    let relId: string | number;

    if (maybeRelId !== undefined) {
      tenantId = String(tenantIdOrSourceRecordId);
      relId = maybeRelId;
    } else {
      relId = sourceRecordIdOrRelId;
    }

    this.ensureTenant(tenantId);
    const list = this.tenantRelationships.get(tenantId)!;
    const before = list.length;
    const filtered = list.filter((r) => String(r.id) !== String(relId));
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
        return { status: 200, data: { ...(page as any), body: page } };
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
        return { status: 200, data: { ...(attrs as any), content: (attrs as any)?.content || attrs, body: attrs } };
      }
      if (req.method === 'POST') {
        const created = await metadataSandboxRepo.createAttributeDefinition(tenantId, etId, req.data);
        return { status: 201, data: { ...(created as any), body: created } };
      }
    }

    // 2.1 Attribute Order
    const attrOrderMatch = subPath.match(/^\/entity-types\/([^/]+)\/attributes\/order$/);
    if (attrOrderMatch && req.method === 'PUT') {
      return { status: 200, data: { success: true, body: true } };
    }

    // 2.2 Attribute Archive / Unarchive
    const attrActionMatch = subPath.match(/^\/entity-types\/([^/]+)\/attributes\/([^/]+)\/(archive|unarchive)$/);
    if (attrActionMatch && req.method === 'POST') {
      const isArchived = attrActionMatch[3] === 'archive';
      return { status: 200, data: { success: true, isArchived, body: { success: true, isArchived } } };
    }

    const singleAttrMatch = subPath.match(/^\/entity-types\/([^/]+)\/attributes\/([^/]+)$/);
    if (singleAttrMatch) {
      const [_, etId, attrId] = singleAttrMatch;
      if (req.method === 'GET') {
        const attr = await metadataSandboxRepo.getAttributeDefinition(tenantId, etId, attrId);
        if (!attr) return { status: 404, data: { message: `Attribute not found with id: ${attrId}` } };
        return { status: 200, data: { ...(attr as any), body: attr } };
      }
      if (req.method === 'PUT') {
        const updated = await metadataSandboxRepo.updateAttributeDefinition(tenantId, etId, attrId, req.data);
        return { status: 200, data: { ...(updated as any), body: updated } };
      }
      if (req.method === 'DELETE') {
        const deleted = await metadataSandboxRepo.deleteAttributeDefinition(tenantId, etId, attrId);
        return { status: 200, data: { success: deleted, body: deleted } };
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
        return { status: 200, data: { ...(page as any), body: page } };
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
        return { status: 200, data: { content: list, body: list } };
      }
      if (req.method === 'POST') {
        const created = await metadataSandboxRepo.createRelationshipType(tenantId, req.data);
        return { status: 201, data: { body: created, ...(created as any) } };
      }
    }

    const relTypeMatch = subPath.match(/^\/relationship-types\/([^/]+)$/);
    if (relTypeMatch) {
      const relId = relTypeMatch[1];
      if (req.method === 'GET') {
        const list = await metadataSandboxRepo.getRelationshipTypes(tenantId);
        const rel = list.find((r: any) => String(r.id) === String(relId));
        if (rel) return { status: 200, data: { ...rel, body: rel } };
        return { status: 200, data: { id: relId, name: 'Parent Company Of', body: { id: relId, name: 'Parent Company Of' } } };
      }
      if (req.method === 'PUT') {
        return { status: 200, data: { id: relId, ...req.data, body: { id: relId, ...req.data } } };
      }
      if (req.method === 'DELETE') {
        return { status: 200, data: { success: true, body: true } };
      }
    }

    // 4.1 Facets & Validate
    const facetsMatch = subPath.match(/^\/entity-types\/([^/]+)\/facets$/);
    if (facetsMatch && req.method === 'GET') {
      const typeId = facetsMatch[1];
      return {
        status: 200,
        data: {
          entityTypeId: typeId,
          facets: {},
          totalRecords: 0,
        },
      };
    }

    const validateMatch = subPath.match(/^\/entity-types\/([^/]+)\/(records\/validate|validate)$/);
    if (validateMatch && req.method === 'POST') {
      return { status: 200, data: { valid: true, errors: [] } };
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
