import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DagCanvasSearch } from './dag-canvas-search';
import { type Node } from '@xyflow/react';
import { type DagNodeData } from '../canvas/dag-node';

describe('DagCanvasSearch', () => {
  const sampleNodes: Node<DagNodeData>[] = [
    {
      id: 'node-start',
      type: 'dagNode',
      position: { x: 0, y: 0 },
      data: {
        taskReferenceName: 'start',
        taskType: 'START_WORKFLOW',
        isStartNode: true,
      },
    },
    {
      id: 'node-fetch',
      type: 'dagNode',
      position: { x: 200, y: 0 },
      data: {
        taskReferenceName: 'fetchUser',
        label: 'Fetch User Data',
        taskType: 'HTTP',
        inputParameters: {
          userId: '${workflow.input.userId}',
        },
      },
    },
    {
      id: 'node-order',
      type: 'dagNode',
      position: { x: 400, y: 0 },
      data: {
        taskReferenceName: 'createOrder',
        label: 'Create Order In Postgres',
        taskType: 'JDBC',
        inputParameters: {},
      },
    },
  ];

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <DagCanvasSearch
        isOpen={false}
        onClose={vi.fn()}
        nodes={sampleNodes}
        onFocusNode={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('filters nodes dynamically by name and parameter', () => {
    render(
      <DagCanvasSearch
        isOpen={true}
        onClose={vi.fn()}
        nodes={sampleNodes}
        onFocusNode={vi.fn()}
      />
    );

    const input = screen.getByTestId('dag-canvas-search-input');
    fireEvent.change(input, { target: { value: 'fetch' } });

    expect(screen.getByTestId('dag-search-result-fetchUser')).toBeDefined();
    expect(screen.queryByTestId('dag-search-result-createOrder')).toBeNull();
  });

  it('invokes onFocusNode and closes when result is clicked or submitted via Enter', () => {
    const handleFocusNode = vi.fn();
    const handleClose = vi.fn();

    render(
      <DagCanvasSearch
        isOpen={true}
        onClose={handleClose}
        nodes={sampleNodes}
        onFocusNode={handleFocusNode}
      />
    );

    const input = screen.getByTestId('dag-canvas-search-input');
    fireEvent.change(input, { target: { value: 'createOrder' } });

    const result = screen.getByTestId('dag-search-result-createOrder');
    fireEvent.click(result);

    expect(handleFocusNode).toHaveBeenCalledWith(sampleNodes[2]);
    expect(handleClose).toHaveBeenCalled();
  });
});
