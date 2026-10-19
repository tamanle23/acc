import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SchemaBuilder } from '../schema-builder';
import { useMetadataUiStore } from '../../../store/use-metadata-ui-store';
import * as metadataApi from '../../../api/metadata-api';
import * as billingApi from '../../../api/use-billing';
import * as permissionsHook from '@/features/spring-auth';
import type { AttributeDefinition, EntityType } from '../../../api/types';

vi.mock('../../../api/metadata-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/metadata-api')>();
  return {
    ...actual,
    useAttributeDefinitions: vi.fn(),
    useEntityType: vi.fn(),
    useCreateAttributeDefinition: vi.fn(() => ({ mutate: vi.fn() })),
    useUpdateAttributeDefinition: vi.fn(() => ({ mutate: vi.fn() })),
    useDeleteAttributeDefinition: vi.fn(() => ({ mutate: vi.fn() })),
    useArchiveAttributeDefinition: vi.fn(() => ({ mutate: vi.fn() })),
    useUnarchiveAttributeDefinition: vi.fn(() => ({ mutate: vi.fn() })),
    useCompiledSchema: vi.fn(() => ({ data: null })),
  };
});

vi.mock('../../../api/use-billing', () => ({
  useTenantBilling: vi.fn(),
}));

vi.mock('@/features/spring-auth', () => ({
  usePermissions: vi.fn(),
  useSpringAuthStore: {
    getState: () => ({ isSandbox: true }),
  },
}));

vi.mock('../../studio', () => ({
  VisualSchemaStudio: () => <div data-testid="visual-schema-studio">Visual Schema Studio</div>,
}));

describe('SchemaBuilder Component Integration', () => {
  let queryClient: QueryClient;

  const mockEntityType: EntityType = {
    id: 1,
    name: 'Customer Account',
    code: 'CUSTOMER_ACCOUNT',
    schemaVersion: 3,
    createdDate: '2026-01-01',
  };

  const mockAttributes: AttributeDefinition[] = [
    {
      id: 1,
      entityTypeId: 1,
      name: 'Account Legal Name',
      code: 'legal_name',
      systemName: 'legal_name',
      dataType: 'STRING',
      uiComponent: 'text',
      isRequired: true,
      isSearchable: true,
      isFilterable: true,
      isSortable: true,
      displayOrder: 1,
    },
    {
      id: 2,
      entityTypeId: 1,
      name: 'Annual Revenue',
      code: 'annual_revenue',
      systemName: 'annual_revenue',
      dataType: 'NUMBER',
      uiComponent: 'number',
      isRequired: false,
      isSearchable: true,
      isFilterable: true,
      isSortable: true,
      displayOrder: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(metadataApi.useEntityType).mockReturnValue({
      data: mockEntityType,
      isLoading: false,
    } as any);

    vi.mocked(metadataApi.useAttributeDefinitions).mockReturnValue({
      data: { content: mockAttributes, totalElements: 2 },
      isLoading: false,
    } as any);

    vi.mocked(billingApi.useTenantBilling).mockReturnValue({
      data: { quotas: { maxSchemas: 10 } },
      isLoading: false,
    } as any);

    vi.mocked(permissionsHook.usePermissions).mockReturnValue({
      isSovereignCustodian: false,
    } as any);

    const store = useMetadataUiStore.getState();
    store.closeAttributeDialog();
    store.closeDeleteAttributeDialog();
    store.closeJsonSchemaPreview();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SchemaBuilder entityTypeId={1} />
      </QueryClientProvider>
    );
  };

  it('renders loading state when schema definitions are fetching', () => {
    vi.mocked(metadataApi.useAttributeDefinitions).mockReturnValue({
      data: null,
      isLoading: true,
    } as any);

    renderComponent();
    expect(screen.getByText(/Loading schema definitions/i)).toBeTruthy();
  });

  it('renders schema header, field counts, and attribute cards', () => {
    renderComponent();

    expect(screen.getByText(/Customer Account Schema/i)).toBeTruthy();
    expect(screen.getByText(/2\/100 Fields/i)).toBeTruthy();
    expect(screen.getByText(/Account Legal Name/i)).toBeTruthy();
    expect(screen.getByText(/Annual Revenue/i)).toBeTruthy();
  });

  it('filters attribute cards by keyword search', () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText(/Filter fields/i);
    fireEvent.change(searchInput, { target: { value: 'Revenue' } });

    expect(screen.getByText(/Annual Revenue/i)).toBeTruthy();
    expect(screen.queryByText(/Account Legal Name/i)).toBeNull();
  });

  it('toggles between standard list view and visual studio mode', () => {
    renderComponent();

    const studioToggleBtn = screen.getByRole('button', { name: /Visual Studio/i });
    fireEvent.click(studioToggleBtn);

    expect(screen.getByTestId('visual-schema-studio')).toBeTruthy();

    const listToggleBtn = screen.getByRole('button', { name: /Standard List/i });
    fireEvent.click(listToggleBtn);

    expect(screen.queryByTestId('visual-schema-studio')).toBeNull();
    expect(screen.getByText(/Account Legal Name/i)).toBeTruthy();
  });

  it('opens json schema preview on Draft-07 JSON click', () => {
    const store = useMetadataUiStore.getState();
    const openJsonSpy = vi.spyOn(store, 'openJsonSchemaPreview');

    renderComponent();

    const jsonPreviewBtn = screen.getByRole('button', { name: /Draft-07 JSON/i });
    fireEvent.click(jsonPreviewBtn);
    expect(openJsonSpy).toHaveBeenCalled();
  });

  it('opens create attribute dialog on Add Field click', () => {
    const store = useMetadataUiStore.getState();
    const openCreateSpy = vi.spyOn(store, 'openCreateAttributeDialog');

    renderComponent();

    const addFieldBtn = screen.getByRole('button', { name: /Add Field/i });
    fireEvent.click(addFieldBtn);
    expect(openCreateSpy).toHaveBeenCalled();
  });
});
