import type { MetadataDataSource } from '../api/metadata-data-source';
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
  FacetGroupDto,
  ValidationErrorDetail,
  RecordAuditLog,
  RestorePreviewResponse,
} from '../api/types';

import {
  additionalEntityTypes,
  additionalAttributes,
  generateAdditionalRecords,
} from './mock-catalog-data';

export const initialMockEntityTypes: EntityType[] = [
  {
    id: '1',
    name: 'Customer Account',
    systemName: 'customer_account',
    description: 'Profiles, corporate identities, and billing configurations for enterprise customers.',
    schemaVersion: 2,
    version: 2,
    lifecycleConfig: {
      state_field: 'status',
      initial_state: 'DRAFT',
      states: ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'SUSPENDED'],
      transitions: [
        {
          from: 'DRAFT',
          to: 'SUBMITTED',
          action: 'SUBMIT',
          required_attributes: ['legal_name', 'contact_email'],
        },
        {
          from: 'SUBMITTED',
          to: 'APPROVED',
          action: 'APPROVE',
          allowed_roles: ['ROLE_ADMIN', 'ROLE_SYSTEM_CUSTODIAN'],
        },
        {
          from: 'APPROVED',
          to: 'ACTIVE',
          action: 'ACTIVATE',
        },
        {
          from: 'ACTIVE',
          to: 'SUSPENDED',
          action: 'SUSPEND',
          allowed_roles: ['ROLE_ADMIN', 'ROLE_SYSTEM_CUSTODIAN'],
        },
        {
          from: 'SUSPENDED',
          to: 'ACTIVE',
          action: 'REACTIVATE',
          allowed_roles: ['ROLE_ADMIN', 'ROLE_SYSTEM_CUSTODIAN'],
        },
      ],
    },
    createdDate: new Date('2026-01-10').toISOString(),
    updatedDate: new Date('2026-03-15').toISOString(),
  },
  {
    id: '2',
    name: 'Cloud Resource Specification',
    systemName: 'cloud_resource_spec',
    description: 'Hardware, topology, and regional availability for managed virtual clusters.',
    schemaVersion: 1,
    version: 1,
    lifecycleConfig: {
      state_field: 'status',
      initial_state: 'DRAFT',
      states: ['DRAFT', 'ACTIVE', 'DECOMMISSIONED'],
      transitions: [
        {
          from: 'DRAFT',
          to: 'ACTIVE',
          action: 'PROVISION',
        },
        {
          from: 'ACTIVE',
          to: 'DECOMMISSIONED',
          action: 'DECOMMISSION',
          allowed_roles: ['ROLE_ADMIN'],
        },
        {
          from: 'DECOMMISSIONED',
          to: 'ACTIVE',
          action: 'REINSTATE',
          allowed_roles: ['ROLE_ADMIN'],
        },
      ],
    },
    createdDate: new Date('2026-01-15').toISOString(),
    updatedDate: new Date('2026-03-20').toISOString(),
  },
  {
    id: '3',
    name: 'Deployment Policy',
    systemName: 'deployment_policy',
    description: 'Governance rules, canary thresholds, and cluster isolation directives.',
    schemaVersion: 1,
    version: 1,
    lifecycleConfig: {
      state_field: 'status',
      initial_state: 'DRAFT',
      states: ['DRAFT', 'STAGED', 'ENFORCED', 'RETIRED'],
      transitions: [
        {
          from: 'DRAFT',
          to: 'STAGED',
          action: 'STAGE',
        },
        {
          from: 'STAGED',
          to: 'ENFORCED',
          action: 'ENFORCE',
          allowed_roles: ['ROLE_ADMIN', 'ROLE_SYSTEM_CUSTODIAN'],
        },
        {
          from: 'ENFORCED',
          to: 'RETIRED',
          action: 'RETIRE',
          allowed_roles: ['ROLE_ADMIN'],
        },
      ],
    },
    createdDate: new Date('2026-02-01').toISOString(),
    updatedDate: new Date('2026-03-25').toISOString(),
  },
  {
    id: 'customer-360-composite',
    name: 'Customer 360 View',
    systemName: 'customer_360_composite',
    description: 'Real-time synthesized 360-degree customer view joining accounts, cloud resources, and audit logs.',
    schemaVersion: 1,
    version: 1,
    isComposite: true,
    compositeSpec: {
      root_entity_type_id: '1',
      root_entity_system_name: 'customer_account',
      root_alias: 'customer',
      fields: [
        { source_attribute: 'legal_name', alias: 'name', data_type: 'string', required: true },
        { source_attribute: 'contact_email', alias: 'email', data_type: 'string', required: true },
      ],
      children: [
        {
          target_entity_type_id: '2',
          target_entity_system_name: 'cloud_resource_spec',
          alias: 'cloud_resources',
          join_pattern: 'PATTERN_B_FOREIGN_KEY',
          foreign_key_attribute: 'account_id',
          cardinality: 'ONE_TO_MANY',
          fields: [
            { source_attribute: 'resource_name', alias: 'name', data_type: 'string' },
            { source_attribute: 'region', alias: 'region', data_type: 'string' },
          ],
        },
      ],
    },
    createdDate: new Date('2026-03-01').toISOString(),
    updatedDate: new Date('2026-03-25').toISOString(),
  },
  ...additionalEntityTypes,
];

export const initialMockAttributes: Record<string, AttributeDefinition[]> = {
  ...additionalAttributes,
  '1': [
    {
      id: '101',
      entityTypeId: '1',
      name: 'Account Legal Name',
      systemName: 'legal_name',
      dataType: 'STRING',
      uiComponent: 'text',
      isRequired: true,
      displayOrder: 1,
      version: 1,
      defaultValue: '',
      options: { placeholder: 'e.g. Acme International Corp' },
    },
    {
      id: '102',
      entityTypeId: '1',
      name: 'Primary Contact Email',
      systemName: 'contact_email',
      dataType: 'STRING',
      uiComponent: 'text',
      isRequired: true,
      displayOrder: 2,
      version: 1,
      options: { placeholder: 'admin@acme.com', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
    },
    {
      id: '103',
      entityTypeId: '1',
      name: 'Subscription Tier',
      systemName: 'subscription_tier',
      dataType: 'STRING',
      uiComponent: 'select',
      isRequired: true,
      displayOrder: 3,
      version: 1,
      defaultValue: 'Enterprise',
      options: { choices: ['Starter', 'Professional', 'Enterprise', 'Strategic'] },
    },
    {
      id: '104',
      entityTypeId: '1',
      name: 'Max Compute Allocation (vCPU)',
      systemName: 'max_vcpu_quota',
      dataType: 'INTEGER',
      uiComponent: 'number',
      isRequired: false,
      displayOrder: 4,
      version: 1,
      defaultValue: '64',
      options: { min: 1, max: 2048 },
    },
    {
      id: '105',
      entityTypeId: '1',
      name: 'Multi-Region High Availability',
      systemName: 'is_multi_region_ha',
      dataType: 'BOOLEAN',
      uiComponent: 'switch',
      isRequired: false,
      displayOrder: 5,
      version: 1,
      defaultValue: 'true',
    },
    {
      id: '106',
      entityTypeId: '1',
      name: 'Contract Effective Date',
      systemName: 'contract_effective_date',
      dataType: 'DATE',
      uiComponent: 'datepicker',
      isRequired: false,
      displayOrder: 6,
      version: 1,
    },
    {
      id: '107',
      entityTypeId: '1',
      name: 'Operational Notes',
      systemName: 'operational_notes',
      dataType: 'STRING',
      uiComponent: 'textarea',
      isRequired: false,
      displayOrder: 7,
      version: 1,
      options: { placeholder: 'Special routing rules or custom SLA requirements...' },
    },
    {
      id: '108',
      entityTypeId: '1',
      name: 'Default Deployment Policy',
      systemName: 'default_policy_id',
      dataType: 'RELATIONSHIP',
      uiComponent: 'relation_picker',
      isRequired: false,
      displayOrder: 8,
      version: 1,
      options: {
        targetEntityTypeId: '3',
        placeholder: 'Select bound deployment policy...',
      },
    },
    {
      id: '109',
      entityTypeId: '1',
      name: 'Security Compliance Tier',
      systemName: 'compliance_tier',
      dataType: 'STRING',
      uiComponent: 'select',
      isRequired: false,
      displayOrder: 9,
      version: 1,
      defaultValue: 'SOC2_TYPE_II',
      options: {
        choices: ['SOC2_TYPE_II', 'HIPAA', 'PCI_DSS', 'FEDRAMP_MODERATE', 'ISO_27001'],
      },
    },
    {
      id: '110',
      entityTypeId: '1',
      name: 'Lifecycle Status',
      systemName: 'status',
      dataType: 'STRING',
      uiComponent: 'select',
      isRequired: false,
      displayOrder: 10,
      version: 1,
      defaultValue: 'DRAFT',
      options: {
        choices: ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'SUSPENDED'],
      },
    },
  ],
  '2': [
    {
      id: '201',
      entityTypeId: '2',
      name: 'Resource Codename',
      systemName: 'resource_code',
      dataType: 'STRING',
      uiComponent: 'text',
      isRequired: true,
      displayOrder: 1,
      version: 1,
      options: { placeholder: 'e.g. g4-highmem-32' },
    },
    {
      id: '202',
      entityTypeId: '2',
      name: 'vCPU Cores',
      systemName: 'vcpu_cores',
      dataType: 'INTEGER',
      uiComponent: 'number',
      isRequired: true,
      displayOrder: 2,
      version: 1,
      defaultValue: '16',
      options: { min: 1, max: 256 },
    },
    {
      id: '203',
      entityTypeId: '2',
      name: 'RAM (GiB)',
      systemName: 'ram_gib',
      dataType: 'DECIMAL',
      uiComponent: 'number',
      isRequired: true,
      displayOrder: 3,
      version: 1,
      defaultValue: '64.0',
      options: { min: 0.5, max: 2048 },
    },
    {
      id: '204',
      entityTypeId: '2',
      name: 'GPU Enabled',
      systemName: 'gpu_enabled',
      dataType: 'BOOLEAN',
      uiComponent: 'switch',
      isRequired: false,
      displayOrder: 4,
      version: 1,
      defaultValue: 'false',
    },
    {
      id: '205',
      entityTypeId: '2',
      name: 'Hardware Architecture',
      systemName: 'architecture',
      dataType: 'STRING',
      uiComponent: 'select',
      isRequired: true,
      displayOrder: 5,
      version: 1,
      defaultValue: 'arm64',
      options: { choices: ['x86_64', 'arm64', 'riscv64'] },
    },
  ],
  '3': [
    {
      id: '301',
      entityTypeId: '3',
      name: 'Policy Identifier',
      systemName: 'policy_id',
      dataType: 'STRING',
      uiComponent: 'text',
      isRequired: true,
      displayOrder: 1,
      version: 1,
    },
    {
      id: '302',
      entityTypeId: '3',
      name: 'Rollout Strategy',
      systemName: 'rollout_strategy',
      dataType: 'STRING',
      uiComponent: 'select',
      isRequired: true,
      displayOrder: 2,
      version: 1,
      defaultValue: 'Canary',
      options: { choices: ['Rolling', 'Blue-Green', 'Canary', 'Recreate'] },
    },
    {
      id: '303',
      entityTypeId: '3',
      name: 'Strict Zero-Downtime Guarantee',
      systemName: 'strict_zero_downtime',
      dataType: 'BOOLEAN',
      uiComponent: 'switch',
      isRequired: false,
      displayOrder: 3,
      version: 1,
      defaultValue: 'true',
    },
  ],
};

const generateInitialRecords = (): Record<string, EntityRecord[]> => {
  const customerTiers = ['Starter', 'Professional', 'Enterprise', 'Strategic'];
  const regions = [
    'tenant-us-east-1',
    'tenant-us-west-2',
    'tenant-eu-central-1',
    'tenant-eu-west-1',
    'tenant-ap-southeast-1',
    'tenant-ap-northeast-1',
  ];
  const companyPrefixes = [
    'Acme', 'Apex', 'Aegis', 'Atlas', 'Beacon', 'BlueShift', 'Centauri', 'CloudScale',
    'CyberWave', 'Delta', 'Echo', 'Falcon', 'Flux', 'Genesis', 'Helios', 'Hyperion',
    'Infinity', 'Ironclad', 'Krypton', 'Luminary', 'Matrix', 'Nebula', 'Nexus', 'Nova',
    'Omni', 'Orion', 'Pulse', 'Quantum', 'Radiant', 'Solstice', 'Starlight', 'Strata',
    'Synapse', 'Titan', 'Vanguard', 'Velocity', 'Vertex', 'Zenith', 'Zephyr',
  ];
  const companySuffixes = [
    'Corp', 'Technologies', 'Systems', 'Networks', 'Labs', 'Solutions', 'Global',
    'Enterprises', 'Holdings', 'Data', 'Dynamics', 'Logistics', 'Services', 'Software',
    'Robotics', 'Aerospace', 'Health', 'Finance', 'Media', 'Ventures',
  ];
  const domainExtensions = ['io', 'com', 'ai', 'net', 'tech', 'org', 'cloud', 'dev'];

  const customerRecords: EntityRecord[] = [];
  // Generate 250 Customer Account records
  for (let i = 1; i <= 250; i++) {
    const id = String(1000 + i);
    const prefix = companyPrefixes[i % companyPrefixes.length];
    const suffix = companySuffixes[(i * 3) % companySuffixes.length];
    const legalName = `${prefix} ${suffix} ${i > 40 ? `(${i})` : ''}`.trim();
    const domain = `${prefix.toLowerCase()}-${suffix.toLowerCase()}.${domainExtensions[i % domainExtensions.length]}`;
    const emailPrefix = ['ops', 'admin', 'infra', 'billing', 'support', 'engineering'][i % 6];
    const contactEmail = `${emailPrefix}@${domain}`;
    const tier = customerTiers[i % customerTiers.length];
    const vcpuQuota = [32, 64, 128, 256, 512, 1024, 2048][i % 7];
    const isMultiRegion = i % 2 === 0;
    const day = (i % 28) + 1;
    const month = (i % 12) + 1;
    const effectiveDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const tenantId = regions[i % regions.length];

    customerRecords.push({
      id,
      entityTypeId: '1',
      tenantId,
      version: 1,
      attributes: {
        legal_name: legalName,
        contact_email: contactEmail,
        subscription_tier: tier,
        max_vcpu_quota: vcpuQuota,
        is_multi_region_ha: isMultiRegion,
        contract_effective_date: effectiveDate,
        operational_notes:
          i % 4 === 0
            ? `Dedicated SLA tier-1 interconnect. Region failover primary: ${tenantId}.`
            : i % 2 === 0
            ? `Standard enterprise support plan. Automated backup verified.`
            : `Active billing cycle renewal on quarterly schedule.`,
        status: ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'SUSPENDED'][i % 5],
      },
      createdDate: new Date(2026, 0, (i % 60) + 1, 10, i % 60).toISOString(),
      updatedDate: new Date(2026, 2, (i % 25) + 1, 14, i % 60).toISOString(),
    });
  }

  // Generate 200 Cloud Resource Specification records
  const architectures = ['arm64', 'x86_64', 'riscv64'];
  const resourceFamilies = ['c3-compute', 'm4-general', 'r5-highmem', 'g4-gpu', 'i3-storage', 't4-nano'];
  const resourceRecords: EntityRecord[] = [];
  for (let i = 1; i <= 200; i++) {
    const id = String(2000 + i);
    const family = resourceFamilies[i % resourceFamilies.length];
    const vcpu = [2, 4, 8, 16, 32, 48, 64, 96, 128][i % 9];
    const ram = vcpu * (family.includes('highmem') ? 8 : family.includes('gpu') ? 6 : 4);
    const isGpu = family.includes('gpu');
    const arch = isGpu ? 'x86_64' : architectures[i % architectures.length];
    const code = `${family}-${vcpu}c-${ram}g-${arch}${i > 20 ? `-v${Math.floor(i / 10)}` : ''}`;

    resourceRecords.push({
      id,
      entityTypeId: '2',
      tenantId: regions[i % regions.length],
      version: 1,
      attributes: {
        resource_code: code,
        vcpu_cores: vcpu,
        ram_gib: ram,
        gpu_enabled: isGpu,
        architecture: arch,
      },
      createdDate: new Date(2026, 0, (i % 30) + 1).toISOString(),
      updatedDate: new Date(2026, 1, (i % 28) + 1).toISOString(),
    });
  }

  // Generate 200 Deployment Policy records
  const rolloutStrategies = ['Canary', 'Rolling', 'Blue-Green', 'Recreate'];
  const policyRecords: EntityRecord[] = [];
  for (let i = 1; i <= 200; i++) {
    const id = String(3000 + i);
    const strategy = rolloutStrategies[i % rolloutStrategies.length];
    const strictZeroDowntime = strategy !== 'Recreate';
    const policyId = `POL-${strategy.toUpperCase().slice(0, 4)}-${String(i).padStart(3, '0')}`;

    policyRecords.push({
      id,
      entityTypeId: '3',
      tenantId: regions[i % regions.length],
      version: 1,
      attributes: {
        policy_id: policyId,
        rollout_strategy: strategy,
        strict_zero_downtime: strictZeroDowntime,
      },
      createdDate: new Date(2026, 1, (i % 25) + 1).toISOString(),
      updatedDate: new Date(2026, 2, (i % 20) + 1).toISOString(),
    });
  }

  return {
    ...generateAdditionalRecords(),
    '1': customerRecords,
    '2': resourceRecords,
    '3': policyRecords,
  };
};

export const initialMockRecords: Record<string, EntityRecord[]> = generateInitialRecords();

export const initialMockRelationshipTypes: RelationshipType[] = [
  {
    id: '1',
    name: 'Customer Deployment Policy',
    systemName: 'rel_cust_policy',
    sourceEntityTypeId: '1',
    targetEntityTypeId: '3',
    cardinality: 'ONE_TO_MANY',
    description: 'Binds enterprise customer to active deployment policies',
    version: 1,
    createdDate: new Date('2026-01-15').toISOString(),
  },
  {
    id: '2',
    name: 'Customer Compute Spec',
    systemName: 'rel_cust_compute',
    sourceEntityTypeId: '1',
    targetEntityTypeId: '2',
    cardinality: 'MANY_TO_MANY',
    description: 'Associates compute allocations to accounts',
    version: 1,
    createdDate: new Date('2026-01-18').toISOString(),
  },
];

export const initialMockEntityRelationships: EntityRelationship[] = [
  {
    id: '1',
    relationshipTypeId: '1',
    sourceRecordId: '1001',
    targetRecordId: '3001',
    version: 1,
    createdDate: new Date('2026-02-06').toISOString(),
  },
  {
    id: '2',
    relationshipTypeId: '2',
    sourceRecordId: '1001',
    targetRecordId: '2001',
    version: 1,
    createdDate: new Date('2026-02-08').toISOString(),
  },
];

export class MockMetadataService implements MetadataDataSource {
  private entityTypes: EntityType[] = [...initialMockEntityTypes];
  private attributes: Record<string, AttributeDefinition[]> = JSON.parse(
    JSON.stringify(initialMockAttributes)
  );
  private records: Record<string, EntityRecord[]> = JSON.parse(
    JSON.stringify(initialMockRecords)
  );
  private relationshipTypes: RelationshipType[] = [...initialMockRelationshipTypes];
  private relationships: EntityRelationship[] = [...initialMockEntityRelationships];
  private auditLogs: RecordAuditLog[] = [];

  // Two-Tier Simulated Cache Hierarchy (L1 In-Memory + L2 Hazelcast simulation)
  private l1SchemaCache: Map<string, CompiledSchema> = new Map();
  private l2DistributedCache: Map<string, string> = new Map();

  resetToInitialState(): void {
    this.entityTypes = JSON.parse(JSON.stringify(initialMockEntityTypes));
    this.attributes = JSON.parse(JSON.stringify(initialMockAttributes));
    this.records = JSON.parse(JSON.stringify(initialMockRecords));
    this.relationshipTypes = JSON.parse(JSON.stringify(initialMockRelationshipTypes));
    this.relationships = JSON.parse(JSON.stringify(initialMockEntityRelationships));
    this.auditLogs = [];
    this.l1SchemaCache.clear();
    this.l2DistributedCache.clear();
  }

  // ==========================================
  // 1. Entity Types
  // ==========================================
  async getEntityTypes(params?: PageRequestParams): Promise<PageResponse<EntityType>> {
    const page = params?.number && params.number > 0 ? params.number : 1;
    const size = params?.size && params.size > 0 ? params.size : 10;
    let list = [...this.entityTypes];

    const search = typeof params?.search === 'string'
      ? params.search.trim().toLowerCase()
      : typeof params?.filters?.search === 'string'
      ? (params.filters.search as string).trim().toLowerCase()
      : '';

    if (search) {
      list = list.filter(
        (et) =>
          et.name.toLowerCase().includes(search) ||
          et.systemName.toLowerCase().includes(search) ||
          (et.description && et.description.toLowerCase().includes(search))
      );
    }

    const totalElements = list.length;
    const totalPages = Math.ceil(totalElements / size) || 1;
    const start = (page - 1) * size;
    const end = start + size;
    const content = list.slice(start, end);

    return {
      content,
      totalElements,
      totalPages,
      number: page,
      size,
    };
  }

  async getEntityTypeById(id: string | number): Promise<EntityType | null> {
    const found = this.entityTypes.find((e) => String(e.id) === String(id));
    return found || null;
  }

  async createEntityType(dto: CreateEntityTypeDto): Promise<EntityType> {
    const newId = String(Date.now());
    const entityType: EntityType = {
      id: newId,
      name: dto.name || 'New Entity Type',
      systemName: dto.systemName || `entity_${newId}`,
      description: dto.description || '',
      schemaVersion: 1,
      version: 1,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    this.entityTypes.push(entityType);
    this.attributes[newId] = [];
    this.records[newId] = [];
    return entityType;
  }

  async updateEntityType(id: string | number, dto: UpdateEntityTypeDto): Promise<EntityType> {
    const index = this.entityTypes.findIndex((e) => String(e.id) === String(id));
    if (index === -1) {
      throw new Error(`EntityType with id ${id} not found`);
    }

    const current = this.entityTypes[index];
    if (dto.version !== undefined && current.version !== undefined && dto.version !== current.version) {
      const err = new Error(`Optimistic lock conflict: entity type was modified.`);
      (err as any).status = 409;
      throw err;
    }

    const updated: EntityType = {
      ...current,
      ...dto,
      version: (current.version || 1) + 1,
      updatedDate: new Date().toISOString(),
    };
    this.entityTypes[index] = updated;
    return updated;
  }

  async deleteEntityType(id: string | number): Promise<boolean> {
    const strId = String(id);
    const beforeCount = this.entityTypes.length;
    this.entityTypes = this.entityTypes.filter((e) => String(e.id) !== strId);
    delete this.attributes[strId];
    delete this.records[strId];
    return this.entityTypes.length < beforeCount;
  }

  async getCompiledSchema(id: string | number): Promise<CompiledSchema> {
    const strId = String(id);
    const entityType = await this.getEntityTypeById(strId);
    if (!entityType) {
      throw new Error(`EntityType ${id} not found`);
    }

    const version = entityType.schemaVersion || 1;
    const cacheKey = `schema:${strId}:v${version}`;

    // 1. Check L1 in-memory cache
    if (this.l1SchemaCache.has(cacheKey)) {
      return this.l1SchemaCache.get(cacheKey)!;
    }

    // 2. Check simulated L2 distributed cache
    if (this.l2DistributedCache.has(cacheKey)) {
      const parsed = JSON.parse(this.l2DistributedCache.get(cacheKey)!);
      this.l1SchemaCache.set(cacheKey, parsed);
      return parsed;
    }

    // 3. Lock-free single compilation simulation
    const attrs = this.attributes[strId] || [];
    const activeAttrs = attrs.filter((a) => !a.isArchived);

    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    activeAttrs.forEach((attr) => {
      let propSchema: Record<string, unknown> = {};
      switch (attr.dataType) {
        case 'INTEGER':
          propSchema = { type: 'integer' };
          break;
        case 'DECIMAL':
          propSchema = { type: 'number' };
          break;
        case 'BOOLEAN':
          propSchema = { type: 'boolean' };
          break;
        case 'JSON':
          propSchema = { type: 'object' };
          break;
        case 'DATE':
          propSchema = { type: 'string', format: 'date' };
          break;
        case 'DATETIME':
          propSchema = { type: 'string', format: 'date-time' };
          break;
        default:
          propSchema = { type: 'string' };
          break;
      }

      if (attr.options?.choices) {
        propSchema.enum = attr.options.choices;
      }
      if (attr.options?.min !== undefined) {
        propSchema.minimum = attr.options.min;
      }
      if (attr.options?.max !== undefined) {
        propSchema.maximum = attr.options.max;
      }
      if (attr.options?.pattern) {
        propSchema.pattern = attr.options.pattern;
      }

      properties[attr.systemName] = propSchema;
      if (attr.isRequired) {
        required.push(attr.systemName);
      }
    });

    const jsonSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    };

    const compiled: CompiledSchema = {
      entityTypeId: id,
      schemaVersion: version,
      jsonSchema,
      updatedDate: entityType.updatedDate,
    };

    // Populate L1 & L2 caches
    this.l1SchemaCache.set(cacheKey, compiled);
    this.l2DistributedCache.set(cacheKey, JSON.stringify(compiled));

    return compiled;
  }

  async getSchemaDriftAnalysis(id: string | number): Promise<SchemaDriftAnalysisResponse> {
    const strId = String(id);
    const entityType = this.entityTypes.find((e) => String(e.id) === strId);
    const currentVersion = entityType?.schemaVersion || 1;
    const records = this.records[strId] || [];
    const total = records.length;
    const outdated = records.filter(
      (r) => !r.version || (r.version < currentVersion)
    ).length;

    return {
      entityTypeId: id,
      currentSchemaVersion: currentVersion,
      totalRecords: total,
      outdatedRecords: outdated,
      compliantRecords: total - outdated,
    };
  }

  async executeSchemaBackfill(
    id: string | number,
    batchSize: number = 100
  ): Promise<SchemaBackfillExecutionResponse> {
    const strId = String(id);
    const entityType = this.entityTypes.find((e) => String(e.id) === strId);
    const targetVersion = entityType?.schemaVersion || 1;
    const records = this.records[strId] || [];
    const attrs = this.attributes[strId] || [];
    const outdatedRecords = records.filter(
      (r) => !r.version || (r.version < targetVersion)
    );
    const toProcess = outdatedRecords.slice(0, batchSize);

    let migrated = 0;
    toProcess.forEach((r) => {
      // Backfill default values
      attrs.forEach((attr) => {
        if (!attr.isArchived && attr.defaultValue !== undefined && attr.defaultValue !== '') {
          if (!r.attributes) r.attributes = {};
          if (r.attributes[attr.systemName] === undefined || r.attributes[attr.systemName] === null || r.attributes[attr.systemName] === '') {
            r.attributes[attr.systemName] = attr.defaultValue;
          }
        }
      });
      r.version = targetVersion;
      r.updatedDate = new Date().toISOString();
      migrated++;
    });

    return {
      entityTypeId: id,
      targetSchemaVersion: targetVersion,
      processedRecords: toProcess.length,
      migratedRecords: migrated,
      failedRecords: 0,
      failures: [],
    };
  }

  // ==========================================
  // 2. Attribute Definitions
  // ==========================================
  async getAttributeDefinitions(
    entityTypeId: string | number,
    params?: PageRequestParams
  ): Promise<PageResponse<AttributeDefinition>> {
    const strId = String(entityTypeId);
    let attrs = [...(this.attributes[strId] || [])];

    // Sort by displayOrder ascending
    attrs.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    const page = params?.number && params.number > 0 ? params.number : 1;
    const size = params?.size && params.size > 0 ? params.size : 50;
    const start = (page - 1) * size;
    const end = start + size;
    const content = attrs.slice(start, end);

    return {
      content,
      totalElements: attrs.length,
      totalPages: Math.ceil(attrs.length / size) || 1,
      number: page,
      size,
    };
  }

  async getAttributeDefinition(
    entityTypeId: string | number,
    attrId: string | number
  ): Promise<AttributeDefinition | null> {
    const strId = String(entityTypeId);
    const attrs = this.attributes[strId] || [];
    const found = attrs.find((a) => String(a.id) === String(attrId));
    return found || null;
  }

  async createAttributeDefinition(
    entityTypeId: string | number,
    dto: CreateAttributeDefinitionDto
  ): Promise<AttributeDefinition> {
    const strId = String(entityTypeId);
    if (!this.attributes[strId]) {
      this.attributes[strId] = [];
    }

    const currentAttrs = this.attributes[strId];
    const newId = String(Date.now());
    const newOrder = currentAttrs.length + 1;

    const newAttr: AttributeDefinition = {
      id: newId,
      entityTypeId: strId,
      name: dto.name || 'New Attribute',
      systemName: dto.systemName || `field_${newId}`,
      dataType: dto.dataType || 'STRING',
      uiComponent: dto.uiComponent || 'text',
      isRequired: Boolean(dto.isRequired),
      isArchived: Boolean(dto.isArchived),
      displayOrder: dto.displayOrder || newOrder,
      options: dto.options || {},
      defaultValue: dto.defaultValue || '',
      version: 1,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };

    this.attributes[strId].push(newAttr);
    this.bumpEntityTypeSchemaVersion(strId);
    return newAttr;
  }

  async updateAttributeDefinition(
    entityTypeId: string | number,
    attrId: string | number,
    dto: UpdateAttributeDefinitionDto
  ): Promise<AttributeDefinition> {
    const strId = String(entityTypeId);
    const list = this.attributes[strId] || [];
    const index = list.findIndex((a) => String(a.id) === String(attrId));
    if (index === -1) {
      throw new Error(`Attribute with id ${attrId} not found`);
    }

    const current = list[index];
    if (dto.version !== undefined && current.version !== undefined && dto.version !== current.version) {
      const err = new Error(`Optimistic lock conflict: attribute definition was modified.`);
      (err as any).status = 409;
      throw err;
    }

    const updated: AttributeDefinition = {
      ...current,
      ...dto,
      version: (current.version || 1) + 1,
      updatedDate: new Date().toISOString(),
    };
    list[index] = updated;
    this.bumpEntityTypeSchemaVersion(strId);
    return updated;
  }

  async deleteAttributeDefinition(
    entityTypeId: string | number,
    attrId: string | number,
    _force?: boolean
  ): Promise<boolean> {
    const strId = String(entityTypeId);
    const list = this.attributes[strId] || [];
    const beforeCount = list.length;
    this.attributes[strId] = list.filter((a) => String(a.id) !== String(attrId));
    this.bumpEntityTypeSchemaVersion(strId);
    return this.attributes[strId].length < beforeCount;
  }

  async archiveAttribute(
    entityTypeId: string | number,
    attrId: string | number
  ): Promise<AttributeDefinition> {
    return this.updateAttributeDefinition(entityTypeId, attrId, { isArchived: true });
  }

  async unarchiveAttribute(
    entityTypeId: string | number,
    attrId: string | number
  ): Promise<AttributeDefinition> {
    return this.updateAttributeDefinition(entityTypeId, attrId, { isArchived: false });
  }

  async reorderAttributes(
    entityTypeId: string | number,
    attributeIds: Array<string | number>
  ): Promise<boolean> {
    const strId = String(entityTypeId);
    const list = this.attributes[strId] || [];

    attributeIds.forEach((id, index) => {
      const attr = list.find((a) => String(a.id) === String(id));
      if (attr) {
        attr.displayOrder = index + 1;
        attr.updatedDate = new Date().toISOString();
      }
    });

    this.bumpEntityTypeSchemaVersion(strId);
    return true;
  }

  // ==========================================
  // 3. Entity Records
  // ==========================================
  async getEntityRecords(
    entityTypeId: string | number,
    params?: PageRequestParams
  ): Promise<PageResponse<EntityRecord>> {
    const strId = String(entityTypeId);
    let recs = [...(this.records[strId] || [])];

    // Filter by tenantId
    if (params?.tenantId) {
      recs = recs.filter((r) => r.tenantId === params.tenantId);
    }

    // Filter by attributes
    if (params?.filters) {
      Object.entries(params.filters).forEach(([field, filterVal]) => {
        if (typeof filterVal === 'object' && filterVal !== null) {
          Object.entries(filterVal).forEach(([op, val]) => {
            if (val !== undefined && val !== '') {
              recs = recs.filter((r) => {
                const attrVal = r.attributes?.[field];
                if (op === 'eq') return String(attrVal) === String(val);
                if (op === 'ne') return String(attrVal) !== String(val);
                if (op === 'like' || op === 'contains') return String(attrVal ?? '').toLowerCase().includes(String(val).toLowerCase());
                if (op === 'in') {
                  const parts = String(val).split(',').map((p) => p.trim().toLowerCase());
                  return parts.includes(String(attrVal ?? '').toLowerCase());
                }
                if (op === 'gt') return Number(attrVal) > Number(val);
                if (op === 'lt') return Number(attrVal) < Number(val);
                if (op === 'gte') return Number(attrVal) >= Number(val);
                if (op === 'lte') return Number(attrVal) <= Number(val);
                return true;
              });
            }
          });
        } else if (filterVal !== undefined && filterVal !== '') {
          recs = recs.filter((r) => {
            const attrVal = r.attributes?.[field];
            return String(attrVal || '').toLowerCase().includes(String(filterVal).toLowerCase());
          });
        }
      });
    }

    // Sort
    if (params?.sort) {
      const parts = params.sort.split(',');
      const sortField = parts[0].trim();
      const sortDirection = (parts[1] || 'asc').trim().toLowerCase();

      recs.sort((a, b) => {
        const valA = a.attributes?.[sortField] ?? a[sortField as keyof EntityRecord] ?? '';
        const valB = b.attributes?.[sortField] ?? b[sortField as keyof EntityRecord] ?? '';
        const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    const page = params?.number && params.number > 0 ? params.number : 1;
    const size = params?.size && params.size > 0 ? params.size : 10;
    const start = (page - 1) * size;
    const end = start + size;
    const content = recs.slice(start, end);

    return {
      content,
      totalElements: recs.length,
      totalPages: Math.ceil(recs.length / size) || 1,
      number: page,
      size,
    };
  }

  async getEntityRecord(
    entityTypeId: string | number,
    recordId: string | number
  ): Promise<EntityRecord | null> {
    const strId = String(entityTypeId);
    const recs = this.records[strId] || [];
    const found = recs.find((r) => String(r.id) === String(recordId));
    return found || null;
  }

  async createEntityRecord(
    entityTypeId: string | number,
    dto: CreateEntityRecordDto
  ): Promise<EntityRecord> {
    const strId = String(entityTypeId);
    const entityType = this.entityTypes.find((e) => String(e.id) === strId);
    if (entityType?.isComposite) {
      const err = new Error('Composite entity types are strictly virtual and read-only. Direct mutations are forbidden.');
      (err as any).status = 405;
      throw err;
    }

    if (!this.records[strId]) {
      this.records[strId] = [];
    }
    const newId = String(Date.now());
    const newRec: EntityRecord = {
      id: newId,
      entityTypeId: strId,
      tenantId: dto.tenantId || 'tenant-acme',
      attributes: dto.attributes || {},
      version: 1,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    this.records[strId].unshift(newRec);
    return newRec;
  }

  async updateEntityRecord(
    entityTypeId: string | number,
    recordId: string | number,
    dto: UpdateEntityRecordDto
  ): Promise<EntityRecord> {
    const strId = String(entityTypeId);
    const entityType = this.entityTypes.find((e) => String(e.id) === strId);
    if (entityType?.isComposite) {
      const err = new Error('Composite entity types are strictly virtual and read-only. Direct mutations are forbidden.');
      (err as any).status = 405;
      throw err;
    }

    const list = this.records[strId] || [];
    const index = list.findIndex((r) => String(r.id) === String(recordId));
    if (index === -1) {
      throw new Error(`Record with id ${recordId} not found`);
    }

    const current = list[index];
    if (dto.version !== undefined && current.version !== undefined && dto.version !== current.version) {
      const err = new Error(`Optimistic lock conflict: entity record was modified.`);
      (err as any).status = 409;
      throw err;
    }

    const updated: EntityRecord = {
      ...current,
      ...dto,
      attributes: {
        ...current.attributes,
        ...(dto.attributes || {}),
      },
      version: (current.version || 1) + 1,
      updatedDate: new Date().toISOString(),
    };
    list[index] = updated;
    return updated;
  }

  async patchEntityRecord(
    entityTypeId: string | number,
    recordId: string | number,
    dto: Partial<CreateEntityRecordDto>
  ): Promise<EntityRecord> {
    return this.updateEntityRecord(entityTypeId, recordId, dto);
  }

  async deleteEntityRecord(
    entityTypeId: string | number,
    recordId: string | number
  ): Promise<boolean> {
    const strId = String(entityTypeId);
    const entityType = this.entityTypes.find((e) => String(e.id) === strId);
    if (entityType?.isComposite) {
      const err = new Error('Composite entity types are strictly virtual and read-only. Direct mutations are forbidden.');
      (err as any).status = 405;
      throw err;
    }

    const list = this.records[strId] || [];
    const beforeCount = list.length;
    this.records[strId] = list.filter((r) => String(r.id) !== String(recordId));
    return this.records[strId].length < beforeCount;
  }

  async getEntityFacets(
    entityTypeId: string | number,
    _params?: PageRequestParams
  ): Promise<EntityFacetsResponse> {
    const strId = String(entityTypeId);
    const records: EntityRecord[] = this.records[strId] || [];
    const attrs: AttributeDefinition[] = (this.attributes[strId] || []).filter((a) => !a.isArchived);
    const facets: FacetGroupDto[] = [];

    // Special fields like tenantId are handled separately, so only dynamic schema attributes are faceted
    // Attributes facets
    attrs.forEach((attr) => {
      const counts: Record<string, number> = {};
      records.forEach((r) => {
        const val = r.attributes?.[attr.systemName];
        if (val !== undefined && val !== null && val !== '') {
          const s = String(val);
          counts[s] = (counts[s] || 0) + 1;
        }
      });
      if (Object.keys(counts).length > 0) {
        facets.push({
          field: attr.systemName,
          dataType: attr.dataType,
          buckets: Object.entries(counts).map(([value, count]) => ({ value, count })),
        });
      }
    });

    return {
      entityTypeId,
      totalRecords: records.length,
      facets,
    };
  }

  async validateEntityRecord(
    entityTypeId: string | number,
    dto: CreateEntityRecordDto
  ): Promise<ValidateRecordResponse> {
    const strId = String(entityTypeId);
    const attrs = this.attributes[strId] || [];
    const entityType = this.entityTypes.find((e) => String(e.id) === strId);
    const schemaVersion = entityType?.schemaVersion || 1;
    const errors: ValidationErrorDetail[] = [];

    const recordAttrs = dto.attributes || {};

    // Validate required & type rules
    attrs.forEach((attr) => {
      if (attr.isArchived) return;
      const val = recordAttrs[attr.systemName];

      if (attr.isRequired && (val === undefined || val === null || val === '')) {
        errors.push({
          field: attr.systemName,
          message: `${attr.name} is required.`,
          code: 'REQUIRED_FIELD',
        });
        return;
      }

      if (val !== undefined && val !== null && val !== '') {
        // Options enum choices validation
        if (attr.options?.choices && Array.isArray(attr.options.choices)) {
          if (!attr.options.choices.includes(String(val))) {
            errors.push({
              field: attr.systemName,
              message: `Value must be one of: ${attr.options.choices.join(', ')}`,
              code: 'ENUM_MISMATCH',
            });
          }
        }

        // Pattern regex validation
        if (attr.options?.pattern) {
          try {
            const regex = new RegExp(attr.options.pattern);
            if (!regex.test(String(val))) {
              errors.push({
                field: attr.systemName,
                message: `${attr.name} format is invalid.`,
                code: 'PATTERN_MISMATCH',
              });
            }
          } catch {
            // Ignore bad regex in mock
          }
        }

        // Numeric min/max validation
        if (attr.dataType === 'INTEGER' || attr.dataType === 'DECIMAL') {
          const numVal = Number(val);
          if (isNaN(numVal)) {
            errors.push({
              field: attr.systemName,
              message: `${attr.name} must be a valid number.`,
              code: 'TYPE_MISMATCH',
            });
          } else {
            if (attr.dataType === 'INTEGER' && !Number.isInteger(numVal)) {
              errors.push({
                field: attr.systemName,
                message: `${attr.name} must be an integer.`,
                code: 'TYPE_MISMATCH',
              });
            }
            if (attr.options?.min !== undefined && numVal < attr.options.min) {
              errors.push({
                field: attr.systemName,
                message: `${attr.name} must be at least ${attr.options.min}.`,
                code: 'MINIMUM_VIOLATION',
              });
            }
            if (attr.options?.max !== undefined && numVal > attr.options.max) {
              errors.push({
                field: attr.systemName,
                message: `${attr.name} must be at most ${attr.options.max}.`,
                code: 'MAXIMUM_VIOLATION',
              });
            }
          }
        }

        // Relation picker target check
        if (attr.uiComponent === 'relation_picker' && attr.options?.targetEntityTypeId) {
          const targetTypeId = String(attr.options.targetEntityTypeId);
          const targetRecords = this.records[targetTypeId] || [];
          const exists = targetRecords.some((r) => String(r.id) === String(val));
          if (!exists) {
            errors.push({
              field: attr.systemName,
              message: `Referenced target record #${val} does not exist for entity type ${targetTypeId}`,
              code: 'REFERENCED_RECORD_NOT_FOUND',
            });
          }
        }
      }
    });

    return {
      valid: errors.length === 0,
      entityTypeId,
      schemaVersion,
      errors,
    };
  }

  async transitionRecordState(
    entityTypeId: string | number,
    recordId: string | number,
    action: string,
    additionalAttributes?: Record<string, unknown>
  ): Promise<EntityRecord> {
    const strId = String(entityTypeId);
    const recId = String(recordId);
    const entityType = this.entityTypes.find((e) => String(e.id) === strId);
    if (!entityType) {
      throw new Error(`EntityType with id ${entityTypeId} not found`);
    }

    const list = this.records[strId] || [];
    const index = list.findIndex((r) => String(r.id) === recId);
    if (index === -1) {
      throw new Error(`EntityRecord #${recordId} not found for entity type #${entityTypeId}`);
    }

    const currentRecord = list[index];
    const lifecycle = entityType.lifecycleConfig;
    if (!lifecycle) {
      throw new Error(`No FSM lifecycle configuration defined for entity type #${entityTypeId}`);
    }

    const stateField = lifecycle.state_field || 'status';
    const currentState =
      (currentRecord.attributes?.[stateField] as string) ||
      lifecycle.initial_state ||
      'DRAFT';

    // Gate 2: State Graph Transition Validity Gate
    const transitions = lifecycle.transitions || [];
    const matchedTransition = transitions.find(
      (t) =>
        t.action.toUpperCase() === action.trim().toUpperCase() &&
        (t.from === '*' || t.from.toUpperCase() === currentState.toUpperCase())
    );

    if (!matchedTransition) {
      const err = new Error(
        `Invalid FSM transition action '${action}' for entity record #${recordId} in current state '${currentState}'`
      );
      (err as any).status = 409;
      throw err;
    }

    // Gate 3: Role-Based Authority Gate (Respect Sandbox active persona)
    if (matchedTransition.allowed_roles && matchedTransition.allowed_roles.length > 0) {
      const { activePersonaId } = (await import('../../../core/sandbox/store/sandbox-store')).useSandboxStore.getState();
      const { DEFAULT_SANDBOX_PERSONAS } = await import('../../../core/sandbox/store/sandbox-store');
      const currentPersona = DEFAULT_SANDBOX_PERSONAS[activePersonaId];
      const callerRoles = currentPersona?.roles || [];
      const isAuthorized = matchedTransition.allowed_roles.some((r) => callerRoles.includes(r));
      if (!isAuthorized) {
        const err = new Error(
          `Access Denied: Caller lacks required authority for FSM action '${action}'. Allowed roles: ${matchedTransition.allowed_roles.join(', ')}`
        );
        (err as any).status = 403;
        throw err;
      }
    }

    // Prepare updated attributes
    const mergedAttributes = {
      ...(currentRecord.attributes || {}),
      ...(additionalAttributes || {}),
    };

    // Gate 4: Required Attribute Presence Gate
    if (matchedTransition.required_attributes && matchedTransition.required_attributes.length > 0) {
      for (const reqAttr of matchedTransition.required_attributes) {
        const val = mergedAttributes[reqAttr];
        const isMissing =
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0);
        if (isMissing) {
          const err = new Error(
            `Transition Gate Violation: Attribute '${reqAttr}' is mandatory for action '${action}' to transition state to '${matchedTransition.to}'`
          );
          (err as any).status = 409;
          throw err;
        }
      }
    }

    // Gate 5: Dynamic Guard Expression Gate (Evaluates simple expressions if present)
    if (matchedTransition.guard_expression) {
      try {
        const expr = matchedTransition.guard_expression
          .replace(/#attributes\['([^']+)'\]/g, 'attributes["$1"]')
          .replace(/attributes\['([^']+)'\]/g, 'attributes["$1"]');
        const evalFn = new Function('attributes', `return Boolean(${expr});`);
        const passed = evalFn(mergedAttributes);
        if (!passed) {
          const err = new Error(
            `FSM Guard Gate Violation: Rule expression '${matchedTransition.guard_expression}' failed for action '${action}'`
          );
          (err as any).status = 409;
          throw err;
        }
      } catch (e: any) {
        if (e?.status === 409) throw e;
        // If complex expression syntax isn't pure JS, allow safe pass-through in simulation
      }
    }

    // Execute state mutation
    const targetState = matchedTransition.to;
    mergedAttributes[stateField] = targetState;

    const updatedRecord: EntityRecord = {
      ...currentRecord,
      attributes: mergedAttributes,
      version: (currentRecord.version || 1) + 1,
      schemaVersion: entityType.schemaVersion || 1,
      updatedDate: new Date().toISOString(),
    };

    list[index] = updatedRecord;
    return updatedRecord;
  }

  async getRecordAuditLogs(
    entityTypeId: string | number,
    recordId: string | number
  ): Promise<RecordAuditLog[]> {
    const strTypeId = String(entityTypeId);
    const strRecId = String(recordId);

    const matches = this.auditLogs.filter(
      (l) => String(l.entityTypeId) === strTypeId && String(l.recordId) === strRecId
    );

    if (matches.length > 0) {
      return [...matches].sort((a, b) => Number(b.version) - Number(a.version));
    }

    // Fabricate initial baseline history for this record so UI displays realistically in dev/offline
    const record = await this.getEntityRecord(entityTypeId, recordId);
    if (!record) return [];

    const initialLog: RecordAuditLog = {
      id: 1001,
      tenantId: record.tenantId || 'tenant-acme',
      entityTypeId: Number(entityTypeId) || 1,
      recordId: Number(recordId) || 1,
      version: record.version || 1,
      operation: 'CREATE',
      oldAttributes: null,
      newAttributes: record.attributes || {},
      delta: null,
      changedBy: 'admin@unipost.io',
      createdAt: record.createdDate || new Date().toISOString(),
    };
    this.auditLogs.push(initialLog);
    return [initialLog];
  }

  async previewRestoreRecord(
    entityTypeId: string | number,
    recordId: string | number,
    auditLogId: string | number
  ): Promise<RestorePreviewResponse> {
    const logs = await this.getRecordAuditLogs(entityTypeId, recordId);
    const targetLog = logs.find((l) => String(l.id) === String(auditLogId));
    if (!targetLog) {
      throw new Error(`Audit log entry #${auditLogId} not found for record #${recordId}`);
    }

    const currentRecord = await this.getEntityRecord(entityTypeId, recordId);
    if (!currentRecord) {
      throw new Error(`Entity record #${recordId} not found`);
    }

    const currentAttrs = currentRecord.attributes || {};
    const restoredAttrs = targetLog.newAttributes || targetLog.oldAttributes || {};

    const allKeys = new Set([...Object.keys(currentAttrs), ...Object.keys(restoredAttrs)]);
    const delta: Record<string, { old: unknown; new: unknown }> = {};

    allKeys.forEach((key) => {
      const oldVal = currentAttrs[key];
      const newVal = restoredAttrs[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        delta[key] = { old: oldVal, new: newVal };
      }
    });

    const currentVersion = Number(currentRecord.version || 1);
    return {
      recordId: Number(recordId),
      entityTypeId: Number(entityTypeId),
      targetAuditLogId: Number(auditLogId),
      targetVersion: Number(targetLog.version),
      currentVersion,
      nextVersion: currentVersion + 1,
      currentAttributes: currentAttrs,
      restoredAttributes: restoredAttrs,
      delta,
    };
  }

  async restoreRecordVersion(
    entityTypeId: string | number,
    recordId: string | number,
    auditLogId: string | number
  ): Promise<EntityRecord> {
    const { useSandboxStore, DEFAULT_SANDBOX_PERSONAS } = await import('../../../core/sandbox/store/sandbox-store');
    const { activePersonaId } = useSandboxStore.getState();
    const currentPersona = DEFAULT_SANDBOX_PERSONAS[activePersonaId];
    const roles = currentPersona?.roles || [];
    const isSovereign = roles.includes('ROLE_SYSTEM_CUSTODIAN') || roles.includes('ROLE_SOVEREIGN_ADMIN');

    if (!isSovereign) {
      const err = new Error('Access Denied: Sovereign Root Custodian authority required to restore entity record versions');
      (err as any).status = 403;
      throw err;
    }

    const preview = await this.previewRestoreRecord(entityTypeId, recordId, auditLogId);
    const currentRecord = await this.getEntityRecord(entityTypeId, recordId);
    if (!currentRecord) {
      throw new Error(`Record #${recordId} not found`);
    }

    const strId = String(entityTypeId);
    const list = this.records[strId] || [];
    const index = list.findIndex((r) => String(r.id) === String(recordId));

    const newVersion = (currentRecord.version || 1) + 1;
    const restoredRecord: EntityRecord = {
      ...currentRecord,
      attributes: { ...preview.restoredAttributes },
      version: newVersion,
      updatedDate: new Date().toISOString(),
    };

    list[index] = restoredRecord;

    const restoreAuditLog: RecordAuditLog = {
      id: Date.now(),
      tenantId: currentRecord.tenantId || 'tenant-acme',
      entityTypeId: Number(entityTypeId),
      recordId: Number(recordId),
      version: newVersion,
      operation: 'RESTORE',
      oldAttributes: currentRecord.attributes,
      newAttributes: preview.restoredAttributes,
      delta: preview.delta,
      changedBy: currentPersona?.name || 'Sovereign Root Custodian',
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(restoreAuditLog);

    return restoredRecord;
  }

  // ==========================================
  // 4. Relationship Types
  // ==========================================
  async getRelationshipTypes(params?: PageRequestParams): Promise<PageResponse<RelationshipType>> {
    const page = params?.number && params.number > 0 ? params.number : 1;
    const size = params?.size && params.size > 0 ? params.size : 50;
    const start = (page - 1) * size;
    const end = start + size;
    const content = this.relationshipTypes.slice(start, end);

    return {
      content,
      totalElements: this.relationshipTypes.length,
      totalPages: Math.ceil(this.relationshipTypes.length / size) || 1,
      number: page,
      size,
    };
  }

  async getRelationshipType(id: string | number): Promise<RelationshipType | null> {
    const found = this.relationshipTypes.find((r) => String(r.id) === String(id));
    return found || null;
  }

  async createRelationshipType(dto: CreateRelationshipTypeDto): Promise<RelationshipType> {
    const newId = String(Date.now());
    const relType: RelationshipType = {
      id: newId,
      name: dto.name,
      systemName: dto.systemName,
      sourceEntityTypeId: dto.sourceEntityTypeId,
      targetEntityTypeId: dto.targetEntityTypeId,
      cardinality: dto.cardinality || 'ONE_TO_MANY',
      description: dto.description || '',
      version: 1,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    this.relationshipTypes.push(relType);
    return relType;
  }

  async updateRelationshipType(
    id: string | number,
    dto: UpdateRelationshipTypeDto
  ): Promise<RelationshipType> {
    const index = this.relationshipTypes.findIndex((r) => String(r.id) === String(id));
    if (index === -1) {
      throw new Error(`RelationshipType with id ${id} not found`);
    }

    const current = this.relationshipTypes[index];
    if (dto.version !== undefined && current.version !== undefined && dto.version !== current.version) {
      const err = new Error(`Optimistic lock conflict: relationship type was modified.`);
      (err as any).status = 409;
      throw err;
    }

    const updated: RelationshipType = {
      ...current,
      ...dto,
      version: (current.version || 1) + 1,
      updatedDate: new Date().toISOString(),
    };
    this.relationshipTypes[index] = updated;
    return updated;
  }

  async deleteRelationshipType(id: string | number, _force?: boolean): Promise<boolean> {
    const strId = String(id);
    const beforeCount = this.relationshipTypes.length;
    this.relationshipTypes = this.relationshipTypes.filter((r) => String(r.id) !== strId);
    this.relationships = this.relationships.filter((rel) => String(rel.relationshipTypeId) !== strId);
    return this.relationshipTypes.length < beforeCount;
  }

  // ==========================================
  // 5. Entity Relationships
  // ==========================================
  async getRecordRelationships(
    recordId: string | number,
    params?: PageRequestParams
  ): Promise<PageResponse<EntityRelationship>> {
    const strRecId = String(recordId);
    const dir = params?.direction || 'both';

    let filtered = this.relationships.filter((r) => {
      if (dir === 'incoming') return String(r.targetRecordId) === strRecId;
      if (dir === 'outgoing') return String(r.sourceRecordId) === strRecId;
      return String(r.sourceRecordId) === strRecId || String(r.targetRecordId) === strRecId;
    });

    const page = params?.number && params.number > 0 ? params.number : 1;
    const size = params?.size && params.size > 0 ? params.size : 20;
    const start = (page - 1) * size;
    const end = start + size;
    const content = filtered.slice(start, end);

    return {
      content,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size) || 1,
      number: page,
      size,
    };
  }

  async createEntityRelationship(
    recordId: string | number,
    dto: CreateEntityRelationshipDto
  ): Promise<EntityRelationship> {
    const newId = String(Date.now());
    const rel: EntityRelationship = {
      id: newId,
      relationshipTypeId: dto.relationshipTypeId,
      sourceRecordId: dto.sourceRecordId || recordId,
      targetRecordId: dto.targetRecordId,
      attributes: dto.attributes || {},
      version: 1,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    this.relationships.push(rel);
    return rel;
  }

  async deleteEntityRelationship(
    _recordId: string | number,
    relationshipId: string | number
  ): Promise<boolean> {
    const strId = String(relationshipId);
    const beforeCount = this.relationships.length;
    this.relationships = this.relationships.filter((r) => String(r.id) !== strId);
    return this.relationships.length < beforeCount;
  }

  private bumpEntityTypeSchemaVersion(entityTypeId: string) {
    const entityType = this.entityTypes.find((e) => String(e.id) === String(entityTypeId));
    if (entityType) {
      entityType.schemaVersion = (entityType.schemaVersion || 1) + 1;
      entityType.updatedDate = new Date().toISOString();

      // Invalidate cluster L1 & L2 caches for this entity type
      const prefix = `schema:${entityTypeId}:`;
      Array.from(this.l1SchemaCache.keys())
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => this.l1SchemaCache.delete(k));
      Array.from(this.l2DistributedCache.keys())
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => this.l2DistributedCache.delete(k));
    }
  }
}

export const mockMetadataStore = new MockMetadataService();
