import { describe, it, expect } from 'vitest';
import {
  telemetryWideEntityType,
  generateWideAttributes,
  generateWideRecords,
} from '../data/mock-wide-telemetry';
import { mockMetadataStore } from '../data/mock-metadata';

describe('100+ Columns Wide Telemetry Entity Sandbox Integration', () => {
  it('creates an entity type with 120 attributes in the sandbox catalog', () => {
    const attributes = generateWideAttributes();
    expect(telemetryWideEntityType.id).toBe('telemetry-wide-matrix');
    expect(telemetryWideEntityType.systemName).toBe('telemetry_wide_matrix');
    expect(attributes.length).toBe(120);

    // Verify attribute types across sensor domains
    const tempAttrs = attributes.filter((a) => a.systemName.startsWith('temp_core_'));
    const pwrAttrs = attributes.filter((a) => a.systemName.startsWith('pwr_rail_'));
    const rfAttrs = attributes.filter((a) => a.systemName.startsWith('rf_sig_'));
    const vibAttrs = attributes.filter((a) => a.systemName.startsWith('vib_freq_'));
    const diagAttrs = attributes.filter((a) => a.systemName.startsWith('diag_code_'));

    expect(tempAttrs.length).toBe(25);
    expect(pwrAttrs.length).toBe(25);
    expect(rfAttrs.length).toBe(25);
    expect(vibAttrs.length).toBe(25);
    expect(diagAttrs.length).toBe(10);
  });

  it('generates records with values populated across all 120 columns', () => {
    const records = generateWideRecords(10);
    expect(records.length).toBe(10);

    const firstRecord = records[0];
    expect(firstRecord.attributes.device_uuid).toMatch(/^URN-IOT-/);
    expect(firstRecord.attributes.temp_core_01).toBeDefined();
    expect(firstRecord.attributes.temp_core_25).toBeDefined();
    expect(firstRecord.attributes.pwr_rail_01).toBeDefined();
    expect(firstRecord.attributes.pwr_rail_25).toBeDefined();
    expect(firstRecord.attributes.rf_sig_01).toBeDefined();
    expect(firstRecord.attributes.rf_sig_25).toBeDefined();
    expect(firstRecord.attributes.vib_freq_01).toBeDefined();
    expect(firstRecord.attributes.vib_freq_25).toBeDefined();
    expect(firstRecord.attributes.diag_code_01).toBeDefined();

    const columnKeys = Object.keys(firstRecord.attributes);
    // At least 120 attribute values present
    expect(columnKeys.length).toBeGreaterThanOrEqual(120);
  });

  it('resolves wide entity attributes and records via mockMetadataStore', async () => {
    const entityType = await mockMetadataStore.getEntityTypeById('telemetry-wide-matrix');
    expect(entityType).toBeDefined();
    expect(entityType?.name).toContain('120 Columns');

    const attrResponse = await mockMetadataStore.getAttributeDefinitions('telemetry-wide-matrix');
    expect(attrResponse.content.length).toBe(120);

    const recordsResponse = await mockMetadataStore.getEntityRecords('telemetry-wide-matrix', {
      number: 1,
      size: 20,
    });
    expect(recordsResponse.content.length).toBeGreaterThanOrEqual(20);
    expect(recordsResponse.totalElements).toBeGreaterThanOrEqual(50);
  });
});
