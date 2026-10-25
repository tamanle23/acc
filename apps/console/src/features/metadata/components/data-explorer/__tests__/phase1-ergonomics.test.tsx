import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DynamicQueryBuilder, toLegacyClause } from '../query-builder/dynamic-query-builder';
import { TableViewsPopover } from '../table-views-popover';
import { MasterDetailRowInspector } from '../master-detail-row-inspector';
import { SearchProvider } from '@/context/search-provider';
import type { AttributeDefinition, EntityRecord, EntityType } from '../../../api/types';

const mockAttributes: AttributeDefinition[] = [
  {
    id: 1,
    name: 'Full Name',
    systemName: 'full_name',
    dataType: 'string',
    isRequired: true,
  },
  {
    id: 2,
    name: 'Total Revenue',
    systemName: 'total_revenue',
    dataType: 'number',
    isRequired: false,
  },
  {
    id: 3,
    name: 'Created Date',
    systemName: 'created_date',
    dataType: 'date',
    isRequired: false,
  },
];

const mockRecord: EntityRecord = {
  id: 42,
  entityTypeId: 1,
  tenantId: 'tenant-acme',
  version: 1,
  attributes: {
    full_name: 'Jane Doe',
    total_revenue: 50000,
    created_date: '2026-10-19',
  },
  createdDate: '2026-10-19T10:00:00Z',
  createdBy: 'admin@acc.com',
};

const mockEntityType: EntityType = {
  id: 1,
  name: 'Customer Account',
  systemName: 'customer_account',
};

describe('Phase 1 UI/UX Ergonomics', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    localStorage.clear();
  });

  describe('DynamicQueryBuilder', () => {
    it('renders query builder trigger button', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <DynamicQueryBuilder attributes={mockAttributes} />
        </QueryClientProvider>
      );
      expect(screen.getByText('Query Builder')).toBeDefined();
    });

    it('converts rule correctly to legacy clause format', () => {
      const clause = toLegacyClause({
        id: 'r-1',
        field: 'full_name',
        operator: 'contains',
        value: 'Acme',
      });
      expect(clause.field).toBe('full_name');
      expect(clause.operator).toBe('contains');
      expect(clause.value).toBe('Acme');
    });
  });

  describe('TableViewsPopover', () => {
    it('renders views and density trigger', () => {
      render(
        <TableViewsPopover
          entityTypeId={1}
          currentDensity="comfortable"
          onDensityChange={vi.fn()}
          currentVisibility={{}}
          onVisibilityChange={vi.fn()}
        />
      );
      expect(screen.getByText('Views & Density')).toBeDefined();
    });

    it('opens popover and triggers density change', () => {
      const onDensityChange = vi.fn();
      render(
        <TableViewsPopover
          entityTypeId={1}
          currentDensity="comfortable"
          onDensityChange={onDensityChange}
          currentVisibility={{}}
          onVisibilityChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('Views & Density'));
      const compactBtn = screen.getByText('Compact');
      fireEvent.click(compactBtn);
      expect(onDensityChange).toHaveBeenCalledWith('compact');
    });
  });

  describe('MasterDetailRowInspector', () => {
    it('renders record details and attributes', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MasterDetailRowInspector
            record={mockRecord}
            entityType={mockEntityType}
            attributes={mockAttributes}
            open={true}
            onOpenChange={vi.fn()}
          />
        </QueryClientProvider>
      );

      expect(screen.getByText('Record #42')).toBeDefined();
      expect(screen.getByText('Jane Doe')).toBeDefined();
      expect(screen.getByText('50000')).toBeDefined();
      expect(screen.getByText('Audit & Provenance')).toBeDefined();
      expect(screen.getByText('History & CDC')).toBeDefined();
      expect(screen.getByText('Raw JSON')).toBeDefined();
    });
  });

  describe('CommandPalette', () => {
    it('renders CommandPalette without crashing', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SearchProvider>
            <div>Test child</div>
          </SearchProvider>
        </QueryClientProvider>
      );
      expect(screen.getByText('Test child')).toBeDefined();
    });
  });
});
