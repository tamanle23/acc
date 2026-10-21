import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DagConditionEdge } from './dag-condition-edge';

vi.mock('@xyflow/react', () => ({
  BaseEdge: ({ id, path }: any) => <path data-testid={`base-edge-${id}`} d={path} />,
  EdgeLabelRenderer: ({ children }: any) => <div data-testid="edge-label-renderer">{children}</div>,
  getBezierPath: () => ['M0,0 C50,0 50,100 100,100', 50, 50],
  getSmoothStepPath: () => ['M0,0 L50,0 L50,100 L100,100', 50, 50],
}));

describe('DagConditionEdge Component Unit Tests', () => {
  it('renders base edge, condition label, and quick-split button with position coordinates', () => {
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
    fireEvent.click(splitBtn, { clientX: 250, clientY: 180 });
    expect(handleSplit).toHaveBeenCalledWith('e-test', { x: 250, y: 180 });

    const labelBtn = screen.getByTestId('dag-edge-label-e-test');
    expect(labelBtn).toBeDefined();
    fireEvent.click(labelBtn);
    expect(handleEdit).toHaveBeenCalledWith('e-test');
  });

  it('computes smoothstep orthogonal path when routingMode is smoothstep', () => {
    render(
      <svg>
        <DagConditionEdge
          id="e-step"
          source="node-a"
          target="node-b"
          sourceX={0}
          sourceY={0}
          targetX={100}
          targetY={100}
          sourcePosition={'right' as any}
          targetPosition={'left' as any}
          data={{
            routingMode: 'smoothstep',
            condition: 'x > 0',
          }}
        />
      </svg>
    );

    const edgePath = screen.getByTestId('base-edge-e-step');
    expect(edgePath.getAttribute('d')).toBe('M0,0 L50,0 L50,100 L100,100');
  });
});
