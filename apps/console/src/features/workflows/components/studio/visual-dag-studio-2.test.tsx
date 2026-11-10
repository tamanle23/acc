import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisualDagStudio } from './visual-dag-studio';
import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData } from './canvas/dag-node';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Visual DAG Studio 2.0 Integration Suite', () => {
  const initialNodes: Node<DagNodeData>[] = [
    {
      id: 'node-start',
      type: 'dagNode',
      position: { x: 0, y: 0 },
      data: {
        taskReferenceName: 'start',
        taskType: 'START_WORKFLOW',
        isStartNode: true,
        inputParameters: { orderId: 'ORD-1001' },
      },
    },
    {
      id: 'node-user',
      type: 'dagNode',
      position: { x: 250, y: 0 },
      data: {
        taskReferenceName: 'fetchUser',
        label: 'Fetch User',
        taskType: 'HTTP',
        inputParameters: {
          url: 'https://api.test/users/${workflow.input.orderId}',
          method: 'GET',
        },
        mockOutputPayload: {
          email: 'alice@example.com',
          tier: 'GOLD',
        },
      },
    },
    {
      id: 'node-end',
      type: 'dagNode',
      position: { x: 500, y: 0 },
      data: {
        taskReferenceName: 'workflow_end',
        taskType: 'END_WORKFLOW',
        isEndNode: true,
        inputParameters: {
          userEmail: '${fetchUser.output.email}',
        },
      },
    },
  ];

  const initialEdges: Edge[] = [
    { id: 'e1', source: 'node-start', target: 'node-user' },
    { id: 'e2', source: 'node-user', target: 'node-end' },
  ];

  it('renders studio with data lineage toggle and view density controls', () => {
    renderWithClient(
      <VisualDagStudio
        mode="full"
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    );

    // Lineage button present
    const lineageBtn = screen.getByTestId('dag-data-lineage-btn');
    expect(lineageBtn).toBeDefined();

    // Toggle lineage
    fireEvent.click(lineageBtn);
    expect(lineageBtn.className).toContain('bg-purple-600');

    // View density button present
    const densityBtn = screen.getByTestId('dag-view-density-btn');
    expect(densityBtn).toBeDefined();
  });

  it('opens and closes pre-flight semantic diagnostics drawer', () => {
    renderWithClient(
      <VisualDagStudio
        mode="full"
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    );

    const diagBtn = screen.getByTestId('dag-diagnostics-pill-btn');
    expect(diagBtn).toBeDefined();

    // Click to open diagnostics drawer
    fireEvent.click(diagBtn);

    expect(screen.getByTestId('dag-diagnostic-drawer')).toBeDefined();

    // Close drawer
    fireEvent.click(screen.getByTestId('dag-diagnostic-close-btn'));
    expect(screen.queryByTestId('dag-diagnostic-drawer')).toBeNull();
  });

  it('opens canvas search dialog and filters nodes', () => {
    renderWithClient(
      <VisualDagStudio
        mode="full"
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    );

    const findBtn = screen.getByTestId('dag-find-nodes-btn');
    expect(findBtn).toBeDefined();

    // Open search
    fireEvent.click(findBtn);

    const searchDialog = screen.getByTestId('dag-canvas-search-dialog');
    expect(searchDialog).toBeDefined();

    const searchInput = screen.getByTestId('dag-canvas-search-input');
    fireEvent.change(searchInput, { target: { value: 'fetchUser' } });

    expect(screen.getByTestId('dag-search-result-fetchUser')).toBeDefined();
  });
});
