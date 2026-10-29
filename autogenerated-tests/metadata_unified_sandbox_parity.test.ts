import { describe, test, expect, beforeEach } from 'bun:test';
import {
  metadataSandboxHandler,
  metadataSandboxRepo,
  MetadataSandboxRepository,
} from '../packages/sandbox/src/handlers/metadata-sandbox-handler';
import { defaultSandboxStore } from '../packages/sandbox/src/store';

/**
 * Formal Verification Suite: Metadata Unified Sandbox Parity & Zero Ad-Hoc Mock Architecture
 * Target: packages/sandbox/src/handlers/metadata-sandbox-handler.ts
 * Standards: UNIFIED-SANDBOX-PLATFORM-MANDATE, Token-Derived Tenancy, Zero-Stub Prohibition
 */
describe('Phase 2: Metadata Unified Sandbox Platform Parity', () => {
  beforeEach(() => {
    metadataSandboxRepo.reset();
    defaultSandboxStore.getState().setActiveTenant('tenant-acme');
  });

  test('Route matcher handles /api/v1/metadata, /v1/metadata, and /api/metadata namespaces', () => {
    const validPaths = [
      '/api/v1/metadata/entity-types',
      '/v1/metadata/entity-types',
      '/api/metadata/entity-types',
      '/api/v1/metadata/entity-types/1/schema',
      '/v1/metadata/blueprints',
    ];

    for (const pathname of validPaths) {
      const matched = metadataSandboxHandler.matcher({ pathname, searchParams: new URLSearchParams() } as any);
      expect(matched).toBe(true);
    }

    const nonMetadataPaths = [
      '/api/v1/workflow/executions',
      '/api/v1/users',
      '/api/v1/billing',
    ];

    for (const pathname of nonMetadataPaths) {
      const matched = metadataSandboxHandler.matcher({ pathname, searchParams: new URLSearchParams() } as any);
      expect(matched).toBe(false);
    }
  });

  test('Tenant identity derivation eliminates arbitrary X-Tenant-Id reliance and resolves from Auth Token', () => {
    // 1. Synthetic JWT with tenantId: 'tenant-enterprise-99'
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-01',
        tenantId: 'tenant-enterprise-99',
        roles: ['ROLE_ADMIN'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64');
    const token = `${header}.${payload}.signature`;

    const requestWithToken: any = {
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': 'spoofed-tenant-ignored',
      },
      method: 'GET',
    };

    const resolvedTenant = metadataSandboxRepo.resolveTenantId(requestWithToken);
    expect(resolvedTenant).toBe('tenant-enterprise-99');
    expect(resolvedTenant).not.toBe('spoofed-tenant-ignored');
  });

  test('Entity Types: CRUD lifecycle and compiled JSON Schema Draft-07 generation', async () => {
    const tenantId = 'tenant-acme';

    // 1. List pre-seeded entity types
    const initialPage = await metadataSandboxRepo.getEntityTypes(tenantId);
    expect(initialPage.content.length).toBeGreaterThanOrEqual(3);
    expect(initialPage.content.some((et) => et.systemName === 'customer_account')).toBe(true);

    // 2. Create new entity type
    const created = await metadataSandboxRepo.createEntityType(tenantId, {
      name: 'Audit Log Trail',
      systemName: 'audit_log_trail',
      description: 'System audit and compliance trail',
    });
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Audit Log Trail');

    // 3. Add attribute definition
    const attr = await metadataSandboxRepo.createAttributeDefinition(tenantId, created.id, {
      name: 'Event Name',
      systemName: 'event_name',
      dataType: 'STRING',
      uiComponent: 'text',
      isRequired: true,
    });
    expect(attr.id).toBeDefined();
    expect(attr.systemName).toBe('event_name');

    // 4. Generate compiled Draft-07 schema
    const schema = await metadataSandboxRepo.getCompiledSchema(tenantId, created.id);
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema.title).toBe('Audit Log Trail');
    expect(schema.properties['event_name']).toBeDefined();
    expect(schema.required).toContain('event_name');

    // 5. Delete entity type
    const deleted = await metadataSandboxRepo.deleteEntityType(tenantId, created.id);
    expect(deleted).toBe(true);
    const postDelete = await metadataSandboxRepo.getEntityTypeById(tenantId, created.id);
    expect(postDelete).toBeNull();
  });

  test('Entity Records: multi-tenant partitioned CRUD and state reset', async () => {
    const tenantA = 'tenant-acme';
    const tenantB = 'tenant-us-east-1';

    // 1. Create record in Tenant A
    const recA = await metadataSandboxRepo.createEntityRecord(tenantA, '1', {
      data: { legal_name: 'Tenant A Dedicated Record' },
    });
    expect(recA.id).toBeDefined();

    // 2. Tenant B must NOT see Tenant A's created record
    const recordsB = await metadataSandboxRepo.getEntityRecords(tenantB, '1');
    expect(recordsB.content.some((r) => r.id === recA.id)).toBe(false);

    // 3. Reset repository
    metadataSandboxRepo.reset();

    // 4. Record from Tenant A is cleanly wiped after reset
    const recordsAfterReset = await metadataSandboxRepo.getEntityRecords(tenantA, '1');
    expect(recordsAfterReset.content.some((r) => r.id === recA.id)).toBe(false);
  });
});
