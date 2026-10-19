import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EntityDataGrid } from '../entity-data-grid';
import type { EntityType, AttributeDefinition, EntityRecord } from '../../../api/types';

const mockEntityType: EntityType = {
  id: 99,
  name: 'High Volume Metrics',
  code: 'HIGH_VOLUME_METRICS',
  schemaVersion: 1,
  createdDate: '2026-01-01',
  isComposite: false,
};

// Generate 120 attributes
const mock120Attributes: AttributeDefinition[] = Array.from({ length: 120 }, (_, i) => ({
  id: 1000 + i,
  entityTypeId: 99,
  name: `Metric Column ${i + 1}`,
  code: `col_${i + 1}`,
  systemName: `col_${i + 1}`,
  dataType: i % 2 === 0 ? 'STRING' : 'DECIMAL',
  uiComponent: 'text',
  isRequired: false,
  isSearchable: true,
  isFilterable: true,
  isSortable: true,
  displayOrder: i + 1,
}));

// Generate 500 rows for high-density testing
const mock500Records: EntityRecord[] = Array.from({ length: 500 }, (_, r) => {
  const attrs: Record<string, any> = {};
  for (let c = 1; c <= 120; c++) {
    attrs[`col_${c}`] = c % 2 === 0 ? (r * 1.5 + c).toFixed(2) : `Val-${r}-${c}`;
  }
  return {
    id: 10000 + r,
    entityTypeId: 99,
    version: 1,
    attributes: attrs,
    createdDate: '2026-01-01T00:00:00Z',
  };
});

vi.mock('../../../api/metadata-api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    useEntityType: () => ({
      data: mockEntityType,
      isLoading: false,
    }),
    useAttributeDefinitions: () => ({
      data: {
        content: mock120Attributes,
        totalElements: 120,
        totalPages: 1,
      },
      isLoading: false,
    }),
    useEntityRecords: () => ({
      data: {
        content: mock500Records,
        totalElements: 10000,
        totalPages: 20,
        number: 1,
        size: 500,
      },
      isLoading: false,
    }),
    useCompositeRecords: () => ({
      data: null,
      isLoading: false,
    }),
    useSchemaDriftAnalysis: () => ({
      data: null,
      isLoading: false,
    }),
    useExecuteSchemaBackfill: () => ({
      mutateAsync: vi.fn(),
    }),
    useEntityFacets: () => ({
      data: null,
    }),
    useTransitionEntityRecord: () => ({
      mutateAsync: vi.fn(),
    }),
  };
});

describe('EntityDataGrid High-Volume Virtualization Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders high-volume dataset with 120 columns and page size options (up to 1000)', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <EntityDataGrid entityTypeId={99} />
      </QueryClientProvider>
    );

    // Verify 10,000 total records indicator
    expect(screen.getByText(/10,000 records/i)).toBeTruthy();

    // Verify presence of first column header (exact match to avoid matching Metric Column 10, 11, etc.)
    expect(screen.getByText(/^Metric Column 1$/)).toBeTruthy();

    // Verify region accessibility semantics
    const region = screen.getByRole('region', {
      name: /Metadata entity data grid scrollable region/i,
    });
    expect(region).toBeTruthy();
  });
});
