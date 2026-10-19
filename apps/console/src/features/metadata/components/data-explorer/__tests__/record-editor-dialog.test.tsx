import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordEditorDialog } from '../record-editor-dialog';
import { useMetadataUiStore } from '../../../store/use-metadata-ui-store';
import * as metadataApi from '../../../api/metadata-api';
import type { AttributeDefinition, EntityType } from '../../../api/types';

vi.mock('../../../api/metadata-api', () => ({
  useAttributeDefinitions: vi.fn(),
  useEntityType: vi.fn(),
  useCreateEntityRecord: vi.fn(),
  useUpdateEntityRecord: vi.fn(),
  useValidateEntityRecord: vi.fn(),
}));

describe('RecordEditorDialog Integration Tests', () => {
  let queryClient: QueryClient;
  const mockCreateMutate = vi.fn();
  const mockUpdateMutate = vi.fn();
  const mockValidateMutateAsync = vi.fn();

  const mockEntityType: EntityType = {
    id: 1,
    name: 'Customer Account',
    code: 'CUSTOMER_ACCOUNT',
    schemaVersion: 2,
    createdDate: '2026-01-01',
  };

  const mockAttributes: AttributeDefinition[] = [
    {
      id: 101,
      entityTypeId: 1,
      name: 'Account Name',
      code: 'account_name',
      systemName: 'account_name',
      dataType: 'STRING',
      uiComponent: 'text',
      isRequired: true,
      displayOrder: 1,
    },
    {
      id: 102,
      entityTypeId: 1,
      name: 'Credit Limit',
      code: 'credit_limit',
      systemName: 'credit_limit',
      dataType: 'NUMBER',
      uiComponent: 'number',
      isRequired: false,
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

    vi.mocked(metadataApi.useCreateEntityRecord).mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
    } as any);

    vi.mocked(metadataApi.useUpdateEntityRecord).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    } as any);

    vi.mocked(metadataApi.useValidateEntityRecord).mockReturnValue({
      mutateAsync: mockValidateMutateAsync,
      isPending: false,
    } as any);

    const store = useMetadataUiStore.getState();
    store.closeRecordEditorDialog();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <RecordEditorDialog entityTypeId={1} />
      </QueryClientProvider>
    );
  };

  it('does not render dialog content when closed', () => {
    renderComponent();
    expect(screen.queryByText(/Create New Record/i)).toBeNull();
  });

  it('renders create modal with schema attributes and triggers client validation on empty submit', async () => {
    useMetadataUiStore.getState().openCreateRecordDialog();
    renderComponent();

    // Dialog title
    expect(screen.getByText(/Create Customer Account Record/i)).toBeTruthy();

    // Fields rendered
    expect(screen.getByText(/Account Name/i)).toBeTruthy();

    // Submit empty form (Account Name is required)
    const submitBtn = screen.getByRole('button', { name: /Save Record/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Please resolve validation errors before saving/i)).toBeTruthy();
    });
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it('runs pre-validation dry-run with schema compliance check', async () => {
    mockValidateMutateAsync.mockResolvedValueOnce({
      valid: true,
      schemaVersion: 2,
      errors: [],
    });

    useMetadataUiStore.getState().openCreateRecordDialog();
    renderComponent();

    const dryRunBtn = screen.getByRole('button', { name: /Test Validation/i });
    fireEvent.click(dryRunBtn);

    await waitFor(() => {
      expect(mockValidateMutateAsync).toHaveBeenCalled();
      expect(screen.getByText(/100% compliant with JSON Schema v2/i)).toBeTruthy();
    });
  });

  it('renders in edit mode and triggers update mutation with optimistic version', async () => {
    useMetadataUiStore.getState().openEditRecordDialog({
      id: 999,
      entityTypeId: 1,
      version: 5,
      attributes: {
        account_name: 'Acme High Tech',
        credit_limit: 50000,
      },
    });

    renderComponent();

    expect(screen.getByText(/Edit Entity Record/i)).toBeTruthy();

    const saveBtn = screen.getByRole('button', { name: /Update Record/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 999,
          dto: expect.objectContaining({
            version: 5,
          }),
        }),
        expect.any(Object)
      );
    });
  });
});
