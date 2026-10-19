import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { EntityDataGrid } from './entity-data-grid';
import type { EntityType, AttributeDefinition, CompositeRecordResponse } from '../../api/types';

const mockCompositeEntityType: EntityType = {
  id: 'customer-360-composite',
  name: 'Customer 360 View',
  systemName: 'customer_360_composite',
  description: 'Synthesized composite entity uniting customer account with cloud resources and support tickets',
  isComposite: true,
  compositeSpec: {
    root_entity_type_id: '1',
    root_entity_system_name: 'customer_account',
    root_alias: 'customer',
    fields: [
      { source_attribute: 'company_name', alias: 'company_name', data_type: 'STRING', required: true },
      { source_attribute: 'tier', alias: 'tier', data_type: 'STRING', required: false },
    ],
    children: [
      {
        target_entity_type_id: '2',
        target_entity_system_name: 'cloud_resource',
        alias: 'resources',
        join_pattern: 'PATTERN_B_FOREIGN_KEY',
        foreign_key_attribute: 'account_id',
        cardinality: 'ONE_TO_MANY',
        fields: [
          { source_attribute: 'resource_name', alias: 'name', data_type: 'STRING' },
          { source_attribute: 'region', alias: 'region', data_type: 'STRING' },
          { source_attribute: 'cost', alias: 'cost', data_type: 'DECIMAL' },
        ],
      },
      {
        target_entity_type_id: '3',
        target_entity_system_name: 'support_ticket',
        alias: 'tickets',
        join_pattern: 'PATTERN_C_ASSOCIATION',
        relationship_type_id: 300,
        cardinality: 'ONE_TO_MANY',
        fields: [
          { source_attribute: 'ticket_title', alias: 'title', data_type: 'STRING' },
          { source_attribute: 'severity', alias: 'severity', data_type: 'STRING' },
        ],
      },
    ],
    rollups: [
      {
        alias: 'total_spend',
        child_alias: 'resources',
        aggregate_function: 'SUM',
        target_field: 'cost',
      },
      {
        alias: 'resource_count',
        child_alias: 'resources',
        aggregate_function: 'COUNT',
      },
    ],
  },
};

const mockAttributes: AttributeDefinition[] = [
  {
    id: 'attr-1',
    entityTypeId: 'customer-360-composite',
    name: 'Company Name',
    systemName: 'company_name',
    dataType: 'STRING',
    uiComponent: 'text',
    isRequired: true,
    isSearchable: true,
    isFilterable: true,
    isSortable: true,
    isArchived: false,
    displayOrder: 1,
  },
  {
    id: 'attr-2',
    entityTypeId: 'customer-360-composite',
    name: 'Tier',
    systemName: 'tier',
    dataType: 'STRING',
    uiComponent: 'text',
    isRequired: false,
    isSearchable: true,
    isFilterable: true,
    isSortable: true,
    isArchived: false,
    displayOrder: 2,
  },
];

const mockCompositeRecord: CompositeRecordResponse = {
  id: '1001',
  tenantId: 'tenant-acme',
  entityTypeId: 'customer-360-composite',
  isComposite: true,
  schemaVersion: 1,
  attributes: {
    id: '1001',
    company_name: 'Acme Mega Corp',
    tier: 'ENTERPRISE',
    total_spend: 14250.75,
    resource_count: 8,
    resources: [
      { id: 'res-1', name: 'US-East Kubernetes Cluster', region: 'us-east-1', cost: 8500.0 },
      { id: 'res-2', name: 'EU-West RDS Postgres', region: 'eu-west-1', cost: 5750.75 },
    ],
    tickets: [
      { id: 't-101', title: 'Network Outage in VPC', severity: 'CRITICAL' },
    ],
  },
  childPagination: {
    resources: {
      totalElements: 8,
      limit: 2,
      offset: 0,
      hasMore: true,
    },
    tickets: {
      totalElements: 1,
      limit: 10,
      offset: 0,
      hasMore: false,
    },
  },
  engineUsed: 'dynamic-sql-pushdown',
};

// Global Store State mock
let gridStateMock = {
  page: 1,
  pageSize: 20,
  sortField: null as string | null,
  sortDirection: 'asc' as 'asc' | 'desc',
  searchFilter: '',
  attributeFilters: [] as any[],
  isFacetOpen: false,
  selectedRecordIds: new Set<string | number>(),
};

vi.mock('../../api/metadata-api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    useEntityType: (id: string) => ({
      data: id === 'customer-360-composite' ? mockCompositeEntityType : null,
      isLoading: false,
    }),
    useAttributeDefinitions: () => ({
      data: {
        content: mockAttributes,
        totalElements: mockAttributes.length,
        totalPages: 1,
      },
      isLoading: false,
    }),
    useEntityRecords: () => ({
      data: { content: [], totalElements: 0, totalPages: 0 },
      isLoading: false,
    }),
    useCompositeRecords: (id: string | null) => ({
      data: id === 'customer-360-composite'
        ? {
            content: [mockCompositeRecord],
            totalElements: 1,
            totalPages: 1,
          }
        : null,
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
    useCreateEntityRecord: () => ({
      mutateAsync: vi.fn(),
    }),
    useUpdateEntityRecord: () => ({
      mutateAsync: vi.fn(),
    }),
    useValidateEntityRecord: () => ({
      mutateAsync: vi.fn(),
    }),
    useDeleteEntityRecord: () => ({
      mutateAsync: vi.fn(),
    }),
  };
});

vi.mock('../../store/use-metadata-ui-store', () => ({
  useMetadataUiStore: () => ({
    gridStateByModel: {
      'customer-360-composite': gridStateMock,
    },
    setGridState: (_id: string, updates: any) => {
      gridStateMock = { ...gridStateMock, ...updates };
    },
    toggleRecordSelection: vi.fn(),
    selectAllRecords: vi.fn(),
    clearSelection: vi.fn(),
    openCreateRecordDialog: vi.fn(),
    openEditRecordDialog: vi.fn(),
    openDeleteRecordDialog: vi.fn(),
    openRecordRelationshipsInspector: vi.fn(),
    openRawJsonDialog: vi.fn(),
    canManageRecords: () => true,
    selectedRecordForAudit: null,
    openRecordAuditHistory: vi.fn(),
    closeRecordAuditHistory: vi.fn(),
  }),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('Composite Data Explorer Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gridStateMock = {
      page: 1,
      pageSize: 20,
      sortField: null,
      sortDirection: 'asc',
      searchFilter: '',
      attributeFilters: [],
      isFacetOpen: false,
      selectedRecordIds: new Set(),
    };
  });

  it('renders composite data grid and auto-expands master-detail row', async () => {
    renderWithClient(<EntityDataGrid entityTypeId="customer-360-composite" />);

    // 1. Root entity data is rendered
    expect(screen.getByText('Acme Mega Corp')).toBeDefined();
    expect(screen.getByText('ENTERPRISE')).toBeDefined();
    expect(screen.getByText('#1001')).toBeDefined();

    // 2. Master-detail container auto-expands for composite entities
    await waitFor(() => {
      expect(screen.getByTestId('composite-master-detail-container')).toBeDefined();
    });

    // 3. Engine badge displays dynamic-sql-pushdown
    expect(screen.getByText('dynamic-sql-pushdown')).toBeDefined();
  });

  it('displays computed rollup bento chips with correct values and aggregation types', async () => {
    renderWithClient(<EntityDataGrid entityTypeId="customer-360-composite" />);

    await waitFor(() => {
      expect(screen.getByTestId('composite-rollups-bar')).toBeDefined();
    });

    // Total Spend rollup chip
    const totalSpendChip = screen.getByTestId('rollup-chip-total_spend');
    expect(totalSpendChip).toBeDefined();
    expect(within(totalSpendChip).getByText('14250.75')).toBeDefined();
    expect(within(totalSpendChip).getByText('SUM')).toBeDefined();

    // Resource Count rollup chip
    const resourceCountChip = screen.getByTestId('rollup-chip-resource_count');
    expect(resourceCountChip).toBeDefined();
    expect(within(resourceCountChip).getByText('8')).toBeDefined();
    expect(within(resourceCountChip).getByText('COUNT')).toBeDefined();
  });

  it('displays active child collection records and switches sub-tabs seamlessly', async () => {
    renderWithClient(<EntityDataGrid entityTypeId="customer-360-composite" />);

    await waitFor(() => {
      expect(screen.getByText('US-East Kubernetes Cluster')).toBeDefined();
    });

    // Sub-tab 1: Cloud Resources
    expect(screen.getByText('EU-West RDS Postgres')).toBeDefined();
    expect(screen.getByText('us-east-1')).toBeDefined();
    expect(screen.getByText('eu-west-1')).toBeDefined();

    // Switch to Sub-tab 2: Support Tickets
    const ticketsTabBtn = screen.getByRole('button', { name: /tickets/i });
    fireEvent.click(ticketsTabBtn);

    // Tickets data is now rendered
    await waitFor(() => {
      expect(screen.getByText('Network Outage in VPC')).toBeDefined();
    });
    expect(screen.getByText('CRITICAL')).toBeDefined();
  });

  it('filters child collection records using the in-row child search input', async () => {
    renderWithClient(<EntityDataGrid entityTypeId="customer-360-composite" />);

    await waitFor(() => {
      expect(screen.getByText('US-East Kubernetes Cluster')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(/filter resources/i);
    expect(searchInput).toBeDefined();

    // Type query matching only the EU cluster
    fireEvent.change(searchInput, { target: { value: 'RDS' } });

    // Filtered results: EU-West is visible, US-East is hidden
    await waitFor(() => {
      expect(screen.getByText('EU-West RDS Postgres')).toBeDefined();
      expect(screen.queryByText('US-East Kubernetes Cluster')).toBeNull();
    });
  });

  it('collapses and re-expands master detail row via expander chevron', async () => {
    renderWithClient(<EntityDataGrid entityTypeId="customer-360-composite" />);

    // Initially expanded
    await waitFor(() => {
      expect(screen.getByTestId('composite-master-detail-container')).toBeDefined();
    });

    // Click chevron button to collapse
    const collapseBtn = screen.getByLabelText(/collapse composite sub-collections/i);
    fireEvent.click(collapseBtn);

    // Detail container is removed
    await waitFor(() => {
      expect(screen.queryByTestId('composite-master-detail-container')).toBeNull();
    });

    // Click chevron button again to expand
    const expandBtn = screen.getByLabelText(/expand composite sub-collections/i);
    fireEvent.click(expandBtn);

    // Detail container is restored
    await waitFor(() => {
      expect(screen.getByTestId('composite-master-detail-container')).toBeDefined();
    });
  });
});
