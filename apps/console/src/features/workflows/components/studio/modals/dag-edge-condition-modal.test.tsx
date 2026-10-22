import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DagEdgeConditionModal } from './dag-edge-condition-modal';

describe('DagEdgeConditionModal Component Unit Tests', () => {
  it('renders modal with edge source/target info and inputs', () => {
    const handleSave = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <DagEdgeConditionModal
        open={true}
        onOpenChange={handleOpenChange}
        edgeData={{
          edgeId: 'e-1',
          sourceTaskRef: 'routeShipping',
          targetTaskRef: 'expressCourier',
          sourceTaskType: 'SWITCH',
          label: 'EXPRESS',
          decisionCase: 'EXPRESS',
          condition: '${workflow.input.speed}',
          isDefaultCase: false,
        }}
        availableTaskRefs={['checkInventory', 'routeShipping', 'expressCourier']}
        onSaveEdgeCondition={handleSave}
      />
    );

    expect(screen.getByText('Configure Branch Condition')).toBeDefined();
    expect(screen.getByText('routeShipping')).toBeDefined();
    expect(screen.getByText('expressCourier')).toBeDefined();
    expect(screen.getAllByDisplayValue('EXPRESS').length).toBeGreaterThan(0);
  });

  it('updates condition and calls onSaveEdgeCondition on submit', () => {
    const handleSave = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <DagEdgeConditionModal
        open={true}
        onOpenChange={handleOpenChange}
        edgeData={{
          edgeId: 'e-2',
          sourceTaskRef: 'routeShipping',
          targetTaskRef: 'groundPostal',
          sourceTaskType: 'SWITCH',
          label: 'STANDARD',
          decisionCase: 'STANDARD',
        }}
        availableTaskRefs={['checkInventory', 'routeShipping']}
        onSaveEdgeCondition={handleSave}
      />
    );

    const labelInput = screen.getByTestId('dag-edge-label-input');
    fireEvent.change(labelInput, { target: { value: 'ECONOMY' } });

    const saveBtn = screen.getByTestId('dag-edge-save-btn');
    fireEvent.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith('e-2', {
      label: 'ECONOMY',
      decisionCase: 'STANDARD',
      condition: undefined,
      isDefaultCase: false,
    });
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
