import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompositeRollupBuilder } from '../composite-rollup-builder';
import type { CompositeSpec } from '../../../../api/types';

describe('CompositeRollupBuilder Component Integration', () => {
  const baseSpecWithoutChildren: CompositeSpec = {
    root_entity_type_id: '1',
    root_entity_system_name: 'customer',
    root_alias: 'customer',
    fields: [{ source_attribute: 'name', alias: 'name', data_type: 'STRING' }],
    children: [],
    rollups: [],
  };

  const specWithChildren: CompositeSpec = {
    ...baseSpecWithoutChildren,
    children: [
      {
        target_entity_type_id: '2',
        target_entity_system_name: 'orders',
        alias: 'orders',
        join_pattern: 'PATTERN_B_FOREIGN_KEY',
        cardinality: 'ONE_TO_MANY',
        fields: [{ source_attribute: 'amount', alias: 'amount', data_type: 'DECIMAL' }],
      },
      {
        target_entity_type_id: '3',
        target_entity_system_name: 'tickets',
        alias: 'tickets',
        join_pattern: 'PATTERN_C_ASSOCIATION',
        cardinality: 'ONE_TO_MANY',
        fields: [{ source_attribute: 'title', alias: 'title', data_type: 'STRING' }],
      },
    ],
    rollups: [
      {
        alias: 'total_orders_spend',
        target_node_alias: 'orders',
        aggregate_function: 'SUM',
        target_field: 'amount',
      },
    ],
  };

  it('renders prompt and disables Add Rollup when no child collections exist', () => {
    const onUpdateSpec = vi.fn();
    render(<CompositeRollupBuilder spec={baseSpecWithoutChildren} onUpdateSpec={onUpdateSpec} />);

    expect(
      screen.getByText(/Join at least one child collection \(Pattern B or C\) to configure aggregate rollups/i)
    ).toBeTruthy();

    const addBtn = screen.getByRole('button', { name: /Add Rollup/i }) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  it('renders empty message when children exist but rollups array is empty', () => {
    const onUpdateSpec = vi.fn();
    const emptyRollupsSpec: CompositeSpec = {
      ...specWithChildren,
      rollups: [],
    };

    render(<CompositeRollupBuilder spec={emptyRollupsSpec} onUpdateSpec={onUpdateSpec} />);

    expect(screen.getByText(/No computed rollups defined/i)).toBeTruthy();

    const addBtn = screen.getByRole('button', { name: /Add Rollup/i }) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(false);

    fireEvent.click(addBtn);
    expect(onUpdateSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        rollups: [
          expect.objectContaining({
            alias: 'rollup_1',
            target_node_alias: 'orders',
            aggregate_function: 'COUNT',
          }),
        ],
      })
    );
  });

  it('renders configured rollups, allows updating fields and functions, and supports removal', () => {
    const onUpdateSpec = vi.fn();
    render(<CompositeRollupBuilder spec={specWithChildren} onUpdateSpec={onUpdateSpec} />);

    // Verify rendered rollup input
    const aliasInput = screen.getByDisplayValue('total_orders_spend');
    expect(aliasInput).toBeTruthy();

    // Update alias
    fireEvent.change(aliasInput, { target: { value: 'grand_total' } });
    expect(onUpdateSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        rollups: [
          expect.objectContaining({
            alias: 'grand_total',
          }),
        ],
      })
    );

    // Update function to AVG
    const functionSelect = screen.getByDisplayValue('SUM(...)');
    fireEvent.change(functionSelect, { target: { value: 'AVG' } });
    expect(onUpdateSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        rollups: [
          expect.objectContaining({
            aggregate_function: 'AVG',
          }),
        ],
      })
    );

    // Remove rollup
    const removeBtn = screen.getByTitle('Remove Rollup');
    fireEvent.click(removeBtn);
    expect(onUpdateSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        rollups: [],
      })
    );
  });
});
