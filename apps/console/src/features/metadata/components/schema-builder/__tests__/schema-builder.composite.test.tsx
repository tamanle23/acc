import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SchemaBuilder } from '../schema-builder';

const mocks = vi.hoisted(() => ({
  isComposite: false,
  attrs: { content: [] as unknown[] },
  ui: { openCreateAttributeDialog: () => undefined, openJsonSchemaPreview: () => undefined },
}));
const STABLE_ATTRS = mocks.attrs;
const STABLE_UI = mocks.ui;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fb?: string) => fb ?? _k }),
}));

vi.mock('../../../api/metadata-api', () => ({
  useAttributeDefinitions: () => ({ data: STABLE_ATTRS, isLoading: false }),
  useEntityType: () => ({
    data: { id: 1, name: 'Order Bundle', systemName: 'order_bundle', isComposite: mocks.isComposite },
  }),
}));
vi.mock('../../../api/use-billing', () => ({ useTenantBilling: () => ({ data: undefined }) }));
vi.mock('@/features/spring-auth', () => ({ usePermissions: () => ({ isSovereignCustodian: false }) }));
vi.mock('../../../store/use-metadata-ui-store', () => ({
  useMetadataUiStore: () => STABLE_UI,
}));
vi.mock('../../studio', () => ({ VisualSchemaStudio: () => <div data-testid="visual-studio" /> }));
vi.mock('../attribute-card', () => ({ AttributeCard: () => null }));
vi.mock('../attribute-dialog', () => ({ AttributeDialog: () => <div data-testid="attr-dialog" /> }));
vi.mock('../attribute-delete-dialog', () => ({ AttributeDeleteDialog: () => null }));
vi.mock('../schema-json-preview', () => ({ SchemaJsonPreview: () => null }));

describe('SchemaBuilder composite lock', () => {
  beforeEach(() => {
    mocks.isComposite = false;
  });

  it('composite: shows only the studio, no manual field controls', () => {
    mocks.isComposite = true;
    render(<SchemaBuilder entityTypeId={1} />);

    expect(screen.getByTestId('visual-studio')).toBeDefined();
    expect(screen.getByText(/Draft-07 JSON/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Add Field/i })).toBeNull();
    expect(screen.queryByPlaceholderText('Filter fields...')).toBeNull();
    expect(screen.queryByText('Standard List')).toBeNull();
    expect(screen.queryByText('Visual Studio')).toBeNull();
    expect(screen.queryByTestId('attr-dialog')).toBeNull();
  });

  it('non-composite: keeps Add Field and the mode toggle', () => {
    render(<SchemaBuilder entityTypeId={1} />);

    expect(screen.getByRole('button', { name: /Add Field/i })).toBeDefined();
    expect(screen.getByPlaceholderText('Filter fields...')).toBeDefined();
    expect(screen.getByText('Visual Studio')).toBeDefined();
  });
});

