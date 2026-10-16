import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityTypeSidebar } from './entity-type-sidebar';
import type { EntityType } from '../../api/types';

const mockEntityTypes: EntityType[] = [
  {
    id: '1',
    name: 'Customer Account',
    systemName: 'customer_account',
    isComposite: false,
  },
  {
    id: '2',
    name: 'Cloud Resource',
    systemName: 'cloud_resource_spec',
    isComposite: false,
  },
  {
    id: 'customer-360-composite',
    name: 'Customer 360 View',
    systemName: 'customer_360_composite',
    isComposite: true,
  },
];

let selectedId = '1';

vi.mock('../../api/metadata-api', () => ({
  useEntityTypes: () => ({
    data: {
      content: mockEntityTypes,
      totalElements: mockEntityTypes.length,
      totalPages: 1,
    },
    isLoading: false,
  }),
}));

vi.mock('../../store/use-metadata-ui-store', () => ({
  useMetadataUiStore: () => ({
    selectedEntityTypeId: selectedId,
    setSelectedEntityTypeId: (id: string) => {
      selectedId = id;
    },
    canManageSchema: () => true,
    openCreateEntityTypeDialog: vi.fn(),
    openEditEntityTypeDialog: vi.fn(),
    openDeleteEntityTypeDialog: vi.fn(),
    openBlueprintGallery: vi.fn(),
  }),
}));

vi.mock('../../api/use-billing', () => ({
  useTenantBilling: () => ({
    data: {
      quotas: { maxSchemas: 50 },
    },
    isLoading: false,
  }),
}));

vi.mock('@/features/spring-auth', () => ({
  usePermissions: () => ({
    isSovereignCustodian: true,
  }),
}));

describe('EntityTypeSidebar Composite Filter', () => {
  beforeEach(() => {
    selectedId = '1';
    vi.clearAllMocks();
  });

  it('renders all entity models and shows the Composite Entities toggle with count', () => {
    render(<EntityTypeSidebar />);

    expect(screen.getByText('Customer Account')).toBeDefined();
    expect(screen.getByText('Cloud Resource')).toBeDefined();
    expect(screen.getByText('Customer 360 View')).toBeDefined();
    expect(screen.getByText('Composite Entities')).toBeDefined();

    // The composite count badge should show 1
    const countBadges = screen.getAllByText('1');
    expect(countBadges.length).toBeGreaterThan(0);
  });

  it('renders a Composite badge for composite entities in the list', () => {
    render(<EntityTypeSidebar />);

    const compBadges = screen.getAllByText(/Composite/i);
    expect(compBadges.length).toBeGreaterThan(0);
  });

  it('filters out non-composite entities and selects first composite entity when toggle is activated', () => {
    render(<EntityTypeSidebar />);

    const switchBtn = screen.getByRole('switch', { name: /Filter Composite Entities Only/i });
    expect(switchBtn).toBeDefined();

    fireEvent.click(switchBtn);

    // After filtering for composite only:
    expect(screen.getByText('Customer 360 View')).toBeDefined();
    expect(screen.queryByText('Customer Account')).toBeNull();
    expect(screen.queryByText('Cloud Resource')).toBeNull();
    expect(selectedId).toBe('customer-360-composite');
  });
});
