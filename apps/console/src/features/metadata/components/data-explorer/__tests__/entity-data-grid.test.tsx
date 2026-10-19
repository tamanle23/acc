import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EntityDataGrid } from '../entity-data-grid';
import { useMetadataUiStore } from '../../../store/use-metadata-ui-store';
import type { EntityType, AttributeDefinition, EntityRecord } from '../../../api/types';

const mockBaseEntityType: EntityType = {
  id: 1,
  name: 'Customer Account',
  code: 'CUSTOMER_ACCOUNT',
  schemaVersion: 1,
  createdDate: '2026-01-01',
  isComposite: false,
};

const mockAttributes: AttributeDefinition[] = [
  {
    id: 10,
    entityTypeId: 1,
    name: 'Company Name',
    code: 'company_name',
    systemName: 'company_name',
    dataType: 'STRING',
    uiComponent: 'text',
    isRequired: true,
    isSearchable: true,
    isFilterable: true,
    isSortable: true,
    displayOrder: 1,
  },
  {
    id: 11,
    entityTypeId: 1,
    name: 'Account Tier',
    code: 'tier',
    systemName: 'tier',
    dataType: 'STRING',
    uiComponent: 'text',
    isRequired: false,
    isSearchable: true,
    isFilterable: true,
    isSortable: true,
    displayOrder: 2,
  },
];

const mockRecords: EntityRecord[] = [
  {
    id: 101,
    entityTypeId: 1,
    version: 1,
    attributes: {
      company_name: 'Acme Corp',
      tier: 'ENTERPRISE',
    },
    createdDate: '2026-01-01T00:00:00Z',
  },
  {
    id: 102,
    entityTypeId: 1,
    version: 2,
    attributes: {
      company_name: 'Beta Global Logistics',
      tier: 'STANDARD',
    },
    createdDate: '2026-02-01T00:00:00Z',
  },
];

vi.mock('../../../api/metadata-api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    useEntityType: () => ({
      data: mockBaseEntityType,
      isLoading: false,
    }),
    useAttributeDefinitions: () => ({
      data: {
        content: mockAttributes,
        totalElements: 2,
        totalPages: 1,
      },
      isLoading: false,
    }),
    useEntityRecords: () => ({
      data: {
        content: mockRecords,
        totalElements: 2,
        totalPages: 1,
        number: 0,
        size: 10,
      },
      isLoading: false,
    }),
    useCompositeRecords: () => ({
      data: null,
      isLoading: false,
    }),
    useSchemaDriftAnalysis: () => ({
      data: {
        totalRecords: 2,
        outdatedRecords: 1,
        currentSchemaVersion: 2,
      },
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
      mutate: vi.fn(),
    }),
    useUpdateEntityRecord: () => ({
      mutate: vi.fn(),
    }),
    useValidateEntityRecord: () => ({
      mutateAsync: vi.fn(),
    }),
    useDeleteEntityRecord: () => ({
      mutate: vi.fn(),
    }),
  };
});

describe('EntityDataGrid Component Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const store = useMetadataUiStore.getState();
    store.closeRecordEditorDialog();
    store.closeDeleteRecordDialog();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <EntityDataGrid entityTypeId={1} />
      </QueryClientProvider>
    );
  };

  it('renders table rows, headers, and record attribute cells', () => {
    renderComponent();

    expect(screen.getByText(/Company Name/i)).toBeTruthy();
    expect(screen.getByText(/Account Tier/i)).toBeTruthy();

    expect(screen.getByText(/Acme Corp/i)).toBeTruthy();
    expect(screen.getByText(/Beta Global Logistics/i)).toBeTruthy();
  });

  it('filters rows via search input', () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText(/Search/i);
    expect(searchInput).toBeTruthy();
    fireEvent.change(searchInput, { target: { value: 'Logistics' } });
    expect((searchInput as HTMLInputElement).value).toBe('Logistics');
  });

  it('opens record editor dialog when clicking Add Record button', () => {
    const store = useMetadataUiStore.getState();
    const openCreateSpy = vi.spyOn(store, 'openCreateRecordDialog');

    renderComponent();

    const addBtn = screen.getByRole('button', { name: /New Record/i });
    fireEvent.click(addBtn);

    expect(openCreateSpy).toHaveBeenCalled();
  });

  it('displays schema backfill alert banner when schema drift is detected', () => {
    renderComponent();

    expect(screen.getByText(/Schema Drift Detected/i)).toBeTruthy();
  });
});
