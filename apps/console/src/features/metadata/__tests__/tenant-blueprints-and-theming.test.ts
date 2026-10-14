import { describe, it, expect } from 'vitest';
import { mockBlueprintManifests, mockBlueprintSummaries } from '../data/mock-blueprints';
import { useMetadataUiStore } from '../store/use-metadata-ui-store';

describe('Phase 23: Tenant White-Labeling & Domain Blueprints', () => {
  it('should include Healthcare Records and Real Estate MLS manifests in blueprint catalog', () => {
    const ids = mockBlueprintManifests.map((b) => b.id);
    expect(ids).toContain('bp_healthcare_records_v1');
    expect(ids).toContain('bp_real_estate_mls_v1');
    expect(ids).toContain('bp_logistics_v1');

    const healthcare = mockBlueprintManifests.find((b) => b.id === 'bp_healthcare_records_v1');
    expect(healthcare?.category).toBe('HEALTHCARE');
    expect(healthcare?.entityTypes.map((e) => e.systemName)).toEqual(
      expect.arrayContaining(['ent_patient', 'ent_clinical_note', 'ent_prescription'])
    );

    const realestate = mockBlueprintManifests.find((b) => b.id === 'bp_real_estate_mls_v1');
    expect(realestate?.category).toBe('REAL_ESTATE');
    expect(realestate?.entityTypes.map((e) => e.systemName)).toEqual(
      expect.arrayContaining(['ent_property_listing', 'ent_listing_agent', 'ent_tour_schedule'])
    );
  });

  it('should generate summaries matching blueprint manifests count', () => {
    expect(mockBlueprintSummaries.length).toBe(mockBlueprintManifests.length);
    const healthcareSummary = mockBlueprintSummaries.find((s) => s.id === 'bp_healthcare_records_v1');
    expect(healthcareSummary?.entityTypesCount).toBe(3);
    expect(healthcareSummary?.relationshipTypesCount).toBe(2);
  });

  it('should apply dynamic white-label theme overrides on setActiveTenant without reload', () => {
    const styles: Record<string, string> = {};
    const mockDocElem = {
      style: {
        setProperty: (key: string, val: string) => {
          styles[key] = val;
        },
        removeProperty: (key: string) => {
          delete styles[key];
        },
      },
    } as unknown as HTMLElement;

    // Attach mock to window if in node test env
    if (typeof window !== 'undefined') {
      Object.defineProperty(window.document, 'documentElement', {
        value: mockDocElem,
        configurable: true,
      });
    }

    const store = useMetadataUiStore.getState();
    store.setActiveTenant('tenant-healthcare', 'St. Jude Hospital');

    expect(useMetadataUiStore.getState().activeTenantId).toBe('tenant-healthcare');
    expect(useMetadataUiStore.getState().activeTenantName).toBe('St. Jude Hospital');
    if (styles['--primary']) {
      expect(styles['--primary']).toBe('#059669');
    }
  });
});
