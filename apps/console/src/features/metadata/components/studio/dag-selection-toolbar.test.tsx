import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DagSelectionToolbar } from './dag-selection-toolbar';
import type { Node } from '@xyflow/react';
import type { DagNodeData } from './dag-node';

describe('DagSelectionToolbar Component Unit Tests', () => {
  const dummyNodes: Node<DagNodeData>[] = [
    {
      id: 'n1',
      position: { x: 50, y: 100 },
      data: { taskReferenceName: 'task1', taskType: 'SIMPLE' },
    },
    {
      id: 'n2',
      position: { x: 150, y: 200 },
      data: { taskReferenceName: 'task2', taskType: 'SIMPLE' },
    },
  ];

  it('does not render when fewer than 2 nodes are selected', () => {
    const { container } = render(
      <DagSelectionToolbar
        selectedNodes={[dummyNodes[0]]}
        onAlignLeft={vi.fn()}
        onAlignCenterX={vi.fn()}
        onAlignTop={vi.fn()}
        onAlignMiddleY={vi.fn()}
        onDistributeHorizontal={vi.fn()}
        onDistributeVertical={vi.fn()}
        onDuplicate={vi.fn()}
        onBulkDelete={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders toolbar with alignment, clone, and delete actions for 2 selected nodes', () => {
    const onAlignLeft = vi.fn();
    const onDuplicate = vi.fn();
    const onBulkDelete = vi.fn();

    render(
      <DagSelectionToolbar
        selectedNodes={dummyNodes}
        onAlignLeft={onAlignLeft}
        onAlignCenterX={vi.fn()}
        onAlignTop={vi.fn()}
        onAlignMiddleY={vi.fn()}
        onDistributeHorizontal={vi.fn()}
        onDistributeVertical={vi.fn()}
        onDuplicate={onDuplicate}
        onBulkDelete={onBulkDelete}
      />
    );

    expect(screen.getByText('2 selected')).toBeDefined();

    const alignLeftBtn = screen.getByTestId('dag-align-left-btn');
    fireEvent.click(alignLeftBtn);
    expect(onAlignLeft).toHaveBeenCalledTimes(1);

    const duplicateBtn = screen.getByTestId('dag-duplicate-btn');
    fireEvent.click(duplicateBtn);
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    const deleteBtn = screen.getByTestId('dag-bulk-delete-btn');
    fireEvent.click(deleteBtn);
    expect(onBulkDelete).toHaveBeenCalledTimes(1);
  });

  it('enables distribution buttons when 3 or more nodes are selected', () => {
    const onDistributeH = vi.fn();
    const threeNodes = [
      ...dummyNodes,
      {
        id: 'n3',
        position: { x: 250, y: 300 },
        data: { taskReferenceName: 'task3', taskType: 'SIMPLE' },
      },
    ];

    render(
      <DagSelectionToolbar
        selectedNodes={threeNodes}
        onAlignLeft={vi.fn()}
        onAlignCenterX={vi.fn()}
        onAlignTop={vi.fn()}
        onAlignMiddleY={vi.fn()}
        onDistributeHorizontal={onDistributeH}
        onDistributeVertical={vi.fn()}
        onDuplicate={vi.fn()}
        onBulkDelete={vi.fn()}
      />
    );

    expect(screen.getByText('3 selected')).toBeDefined();

    const distributeBtn = screen.getByTestId('dag-distribute-h-btn');
    expect(distributeBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(distributeBtn);
    expect(onDistributeH).toHaveBeenCalledTimes(1);
  });
});
