import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CompositeMasterDetailRow } from './composite-master-detail-row';
import type { CompositeSpec, CompositeRecordResponse } from '../../api/types';

describe('CompositeMasterDetailRow', () => {
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
        fields: [
          { source_attribute: 'resource_name', alias: 'name', data_type: 'string' },
          { source_attribute: 'region', alias: 'region', data_type: 'string' },
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
          { source_attribute: 'title', alias: 'title', data_type: 'string' },
        ],
      },
    ],
  };

  const mockRecord: CompositeRecordResponse = {
    id: 'rec-1',
    tenantId: 'tenant-acme',
    entityTypeId: '1',
    isComposite: true,
    schemaVersion: 1,
    attributes: {
      id: 'rec-1',
      name: 'Acme Global Corp',
      resources: [
        { id: 'res-101', name: 'US-East Production VPC', region: 'us-east-1' },
        { id: 'res-102', name: 'EU-West RDS Cluster', region: 'eu-west-1' },
      ],
      tickets: [
        { id: 't-501', title: 'High Latency Alert' },
      ],
    },
    childPagination: {
      resources: {
        totalElements: 5,
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

  it('renders child collections container and dynamic sql pushdown badge', () => {
    render(<CompositeMasterDetailRow record={mockRecord} compositeSpec={mockSpec} />);

    expect(screen.getByTestId('composite-master-detail-container')).toBeDefined();
    expect(screen.getByText('dynamic-sql-pushdown')).toBeDefined();
    expect(screen.getByText('Synthesized Child Sub-Collections')).toBeDefined();
  });

  it('renders child records and columns for active tab', () => {
    render(<CompositeMasterDetailRow record={mockRecord} compositeSpec={mockSpec} />);

    // Active tab defaults to 'resources'
    expect(screen.getByText('US-East Production VPC')).toBeDefined();
    expect(screen.getByText('EU-West RDS Cluster')).toBeDefined();
    expect(screen.getByText('us-east-1')).toBeDefined();
    expect(screen.getByText('eu-west-1')).toBeDefined();
  });

  it('switches tabs and displays items of selected child collection', () => {
    render(<CompositeMasterDetailRow record={mockRecord} compositeSpec={mockSpec} />);

    // Click 'tickets' tab button
    const ticketsTab = screen.getByRole('button', { name: /tickets/i });
    fireEvent.click(ticketsTab);

    expect(screen.getByText('High Latency Alert')).toBeDefined();
    expect(screen.getByText(/Pattern C/i)).toBeDefined();
  });

  it('handles micro-pagination Next and Previous callbacks', () => {
    const onChildPageChange = vi.fn();
    render(
      <CompositeMasterDetailRow
        record={mockRecord}
        compositeSpec={mockSpec}
        onChildPageChange={onChildPageChange}
      />
    );

    // Initial state: offset 0, limit 2, hasMore true
    expect(screen.getByText('1–2')).toBeDefined();
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);

    const nextBtn = screen.getByRole('button', { name: /Next child page/i });
    expect(nextBtn).toBeDefined();
    fireEvent.click(nextBtn);

    expect(onChildPageChange).toHaveBeenCalledWith('resources', 2, 2);
  });

  it('renders computed rollups as KPI Bento chips when defined', () => {
    const specWithRollups: CompositeSpec = {
      ...mockSpec,
      rollups: [
        {
          alias: 'total_spend',
          target_node_alias: 'resources',
          aggregate_function: 'SUM',
          target_field: 'cost',
        },
        {
          alias: 'resource_count',
          target_node_alias: 'resources',
          aggregate_function: 'COUNT',
        },
      ],
    };

    const recordWithRollups: CompositeRecordResponse = {
      ...mockRecord,
      attributes: {
        ...mockRecord.attributes,
        total_spend: 1420.5,
        resource_count: 5,
      },
    };

    render(
      <CompositeMasterDetailRow
        record={recordWithRollups}
        compositeSpec={specWithRollups}
      />
    );

    expect(screen.getByTestId('composite-rollups-bar')).toBeDefined();
    expect(screen.getByTestId('rollup-chip-total_spend')).toBeDefined();
    const countChip = screen.getByTestId('rollup-chip-resource_count');
    expect(within(countChip).getByText('5')).toBeDefined();
    expect(screen.getByText('1420.5')).toBeDefined();
    expect(screen.getByText('SUM')).toBeDefined();
    expect(screen.getByText('COUNT')).toBeDefined();
  });

  it('filters child collection items via search input', () => {
    render(<CompositeMasterDetailRow record={mockRecord} compositeSpec={mockSpec} />);

    // Both items visible initially
    expect(screen.getByText('US-East Production VPC')).toBeDefined();
    expect(screen.getByText('EU-West RDS Cluster')).toBeDefined();

    const searchInput = screen.getByLabelText(/Filter resources/i);
    fireEvent.change(searchInput, { target: { value: 'RDS' } });

    // Only RDS Cluster should be visible
    expect(screen.queryByText('US-East Production VPC')).toBeNull();
    expect(screen.getByText('EU-West RDS Cluster')).toBeDefined();
  });

  it('sorts child collection columns when headers are clicked', () => {
    render(<CompositeMasterDetailRow record={mockRecord} compositeSpec={mockSpec} />);

    // Click 'name' column header to sort
    const nameHeader = screen.getByText('name');
    fireEvent.click(nameHeader); // ASC
    fireEvent.click(nameHeader); // DESC

    // Both items should remain present after sorting
    expect(screen.getByText('US-East Production VPC')).toBeDefined();
    expect(screen.getByText('EU-West RDS Cluster')).toBeDefined();
  });
});
