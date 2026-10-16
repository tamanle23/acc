import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompositeCatalogRail } from './composite-catalog-rail';
import { CompositeProjectionCanvas } from './composite-projection-canvas';
import { CompositePreviewHub } from './composite-preview-hub';
import type { CompositeSpec, EntityType } from '../../../api/types';

// Mock TanStack query hooks used in the studio
vi.mock('../../../api/metadata-api', () => ({
  useEntityTypes: () => ({
    data: {
      content: [
        { id: '1', name: 'Customer Account', systemName: 'customer_account', isComposite: false },
        { id: '2', name: 'Cloud Resource', systemName: 'cloud_resource', isComposite: false },
        { id: '3', name: 'Billing Invoice', systemName: 'billing_invoice', isComposite: false },
      ],
    },
    isLoading: false,
  }),
  useAttributeDefinitions: (_entityTypeId: string | number) => ({
    data: {
      content: [
        { id: '101', systemName: 'legal_name', name: 'Legal Name', dataType: 'STRING' },
        { id: '102', systemName: 'contact_email', name: 'Contact Email', dataType: 'STRING' },
      ],
    },
    isLoading: false,
  }),
  useEntityType: () => ({
    data: { id: '1', name: 'Customer Account', systemName: 'customer_account', isComposite: false },
    isLoading: false,
  }),
  useUpdateEntityType: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe('Phase 41: Composite Entity Type Registry & Specification DSL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSpec: CompositeSpec = {
    root_entity_type_id: '1',
    root_entity_system_name: 'customer_account',
    root_alias: 'customer',
    fields: [
      { source_attribute: 'legal_name', alias: 'name', data_type: 'string', required: true },
    ],
    children: [
      {
        target_entity_type_id: '2',
        target_entity_system_name: 'cloud_resource',
        alias: 'resources',
        join_pattern: 'PATTERN_B_FOREIGN_KEY',
        foreign_key_attribute: 'account_id',
        cardinality: 'ONE_TO_MANY',
        fields: [{ source_attribute: 'resource_name', alias: 'name', data_type: 'string' }],
        children: [],
      },
    ],
  };

  const mockRootEntity: EntityType = {
    id: '1',
    name: 'Customer Account',
    systemName: 'customer_account',
    isComposite: false,
  };

  describe('1. CompositeCatalogRail', () => {
    it('renders base entity catalog with Pattern B and Pattern C actions', () => {
      const handleAdd = vi.fn();
      render(<CompositeCatalogRail rootEntityTypeId="1" onAddChildNode={handleAdd} />);

      expect(screen.getByText(/Base Entity Catalog/i)).toBeDefined();
      expect(screen.getByText('Cloud Resource')).toBeDefined();
      expect(screen.getByText('Billing Invoice')).toBeDefined();

      const fkButtons = screen.getAllByText(/FK Join/i);
      expect(fkButtons.length).toBeGreaterThan(0);
      fireEvent.click(fkButtons[0]);

      expect(handleAdd).toHaveBeenCalledTimes(1);
      expect(handleAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Cloud Resource' }),
        'PATTERN_B_FOREIGN_KEY'
      );
    });
  });

  describe('2. CompositeProjectionCanvas', () => {
    it('renders root entity level 1 and child join node level 2', () => {
      const handleUpdate = vi.fn();
      render(
        <CompositeProjectionCanvas
          spec={mockSpec}
          rootEntity={mockRootEntity}
          onUpdateSpec={handleUpdate}
        />
      );

      expect(screen.getByText(/Tree Projection Canvas/i)).toBeDefined();
      expect(screen.getByText(/Level 1 • Base Root/i)).toBeDefined();
      expect(screen.getByText(/Join: cloud_resource/i)).toBeDefined();
      expect(screen.getByText(/Level 2/i)).toBeDefined();
      expect(screen.getByText(/Pattern B 🔗/i)).toBeDefined();
    });
  });

  describe('3. CompositePreviewHub', () => {
    it('renders Live JSON, Pushdown SQL, and JSON Schema tabs', () => {
      render(<CompositePreviewHub spec={mockSpec} />);

      expect(screen.getByText('Live Preview Hub')).toBeDefined();
      expect(screen.getByText('Live JSON')).toBeDefined();
      expect(screen.getByText('Pushdown SQL')).toBeDefined();
      expect(screen.getByText('JSON Schema')).toBeDefined();

      // Default active tab is Live JSON with standard envelope
      expect(screen.getByText(/"is_composite": true/i)).toBeDefined();
    });
  });
});
