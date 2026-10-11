import { describe, it, expect } from 'vitest';
import type {
  EntityType,
  AttributeDefinition,
  EntityRecord,
  ProblemDetail,
  CompiledSchema,
} from '../types';

describe('L3 Contract Tests: @unipost/client and Spring Jackson Model Compatibility', () => {
  it('deserializes Spring Jackson EntityRecordResponse into client EntityRecord contract', () => {
    // Exact JSON serialization from Spring Jackson EntityRecordResponse
    const springRecordJson = {
      id: 101,
      uid: 'rec_999_uuid',
      entityTypeId: 12,
      tenantId: 'tenant-acme',
      schemaVersion: 1,
      attributes: {
        title: 'Modern Architecture in Distributed Systems',
        slug: 'modern-arch',
        published: true,
        wordCount: 1450,
      },
      version: 3,
      createdDate: '2026-10-11T20:30:00',
      lastUpdatedDate: '2026-10-11T21:00:00',
    };

    const record: EntityRecord = springRecordJson;

    expect(record.id).toBe(101);
    expect(record.entityTypeId).toBe(12);
    expect(record.tenantId).toBe('tenant-acme');
    expect(record.attributes.title).toBe('Modern Architecture in Distributed Systems');
    expect(record.attributes.published).toBe(true);
    expect(record.version).toBe(3);
  });

  it('deserializes Spring Jackson EntityTypeResponse into client EntityType contract', () => {
    const springTypeJson = {
      id: 12,
      name: 'Article',
      systemName: 'article',
      description: 'Main publication article entity',
      tenantId: 'tenant-acme',
      schemaVersion: 2,
      version: 5,
      createdDate: '2026-10-11T10:00:00',
      updatedDate: '2026-10-11T12:00:00',
    };

    const entityType: EntityType = springTypeJson;

    expect(entityType.id).toBe(12);
    expect(entityType.systemName).toBe('article');
    expect(entityType.tenantId).toBe('tenant-acme');
    expect(entityType.schemaVersion).toBe(2);
  });

  it('deserializes Spring Jackson AttributeDefinitionResponse into client AttributeDefinition contract', () => {
    const springAttrJson = {
      id: 55,
      entityTypeId: 12,
      name: 'Content Slug',
      systemName: 'slug',
      dataType: 'STRING' as const,
      uiComponent: 'text' as const,
      isRequired: true,
      options: { min: 3, max: 100 },
      optionsJson: '{"min":3,"max":100}',
      version: 1,
      createdDate: '2026-10-11T10:00:00',
      updatedDate: '2026-10-11T10:00:00',
    };

    const attr: AttributeDefinition = springAttrJson;

    expect(attr.id).toBe(55);
    expect(attr.systemName).toBe('slug');
    expect(attr.dataType).toBe('STRING');
    expect(attr.uiComponent).toBe('text');
    expect(attr.isRequired).toBe(true);
  });

  it('deserializes Spring RFC 7807 ProblemDetail into client ProblemDetail contract', () => {
    const springProblemDetail = {
      type: 'urn:problem-type:optimistic-concurrency-conflict',
      title: 'Optimistic Concurrency Conflict',
      status: 409,
      detail: 'Record was modified concurrently by another transaction',
      instance: '/api/v1/metadata/records/101',
      properties: {
        serverVersion: 3,
        clientVersion: 2,
      },
    };

    const problem: ProblemDetail = springProblemDetail;

    expect(problem.status).toBe(409);
    expect(problem.title).toBe('Optimistic Concurrency Conflict');
    expect(problem.detail).toContain('modified concurrently');
    expect(problem.properties?.serverVersion).toBe(3);
  });
});
