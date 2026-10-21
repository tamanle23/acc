import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DagConditionEdge } from './dag-condition-edge';

vi.mock('@xyflow/react', () => ({
  BaseEdge: ({ id }: any) => <path data-testid={`base-edge-${id}`} />,
  EdgeLabelRenderer: ({ children }: any) => <div data-testid="edge-label-renderer">{children}</div>,
  getBezierPath: () => ['M0,0 L100,100', 50, 50],
}));

describe('DagConditionEdge Component Unit Tests', () => {
  it('renders base edge, condition label, and quick-split button', () => {
    const handleSplit = vi.fn();
    const handleEdit = vi.fn();

    render(
      <svg>
        <DagConditionEdge
          id="e-test"
          source="node-start"
          target="node-end"
          sourceX={0}
          sourceY={0}
          targetX={100}
          targetY={100}
          sourcePosition={'right' as any}
          targetPosition={'left' as any}
          data={{
            onSplitEdge: handleSplit,
            onEditEdge: handleEdit,
            condition: 'status == true',
          }}
        />
      </svg>
    );

    const splitBtn = screen.getByTestId('dag-edge-split-e-test');
    expect(splitBtn).toBeDefined();
    fireEvent.click(splitBtn);
    expect(handleSplit).toHaveBeenCalledWith('e-test');

    const labelBtn = screen.getByTestId('dag-edge-label-e-test');
    expect(labelBtn).toBeDefined();
    fireEvent.click(labelBtn);
    expect(handleEdit).toHaveBeenCalledWith('e-test');
  });
});
