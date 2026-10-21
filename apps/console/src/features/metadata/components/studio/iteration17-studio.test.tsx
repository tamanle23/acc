import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisualDagStudio } from './visual-dag-studio';
import { ReactFlowProvider } from '@xyflow/react';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReactFlowProvider>{ui}</ReactFlowProvider>
    </QueryClientProvider>
  );
}

describe('Iteration 17 Studio Ergonomics & Canvas Enhancements', () => {
  it('toggles Snap-to-Grid mode when the toolbar snap button is clicked', () => {
    renderWithProviders(<VisualDagStudio mode="full" />);

    const snapBtn = screen.getByTestId('dag-snap-grid-btn');
    expect(snapBtn).toBeTruthy();
    expect(snapBtn.getAttribute('title')).toContain('Snap to Grid: ON');

    fireEvent.click(snapBtn);
    expect(snapBtn.getAttribute('title')).toContain('Snap to Grid: OFF');

    fireEvent.click(snapBtn);
    expect(snapBtn.getAttribute('title')).toContain('Snap to Grid: ON');
  });

  it('toggles Edge Routing mode between Curves (Bezier) and Orthogonal (Step)', () => {
    renderWithProviders(<VisualDagStudio mode="full" />);

    const routingBtn = screen.getByTestId('dag-edge-routing-btn');
    expect(routingBtn).toBeTruthy();
    expect(routingBtn.textContent).toContain('Curves');
    expect(routingBtn.getAttribute('title')).toContain('Curved (Bezier)');

    fireEvent.click(routingBtn);
    expect(routingBtn.textContent).toContain('Orthogonal');
    expect(routingBtn.getAttribute('title')).toContain('Orthogonal (Step)');

    fireEvent.click(routingBtn);
    expect(routingBtn.textContent).toContain('Curves');
  });

  it('renders floating selection toolbar when 2 or more nodes are selected', () => {
    const testNodes = [
      {
        id: 'node-1',
        type: 'dagNode',
        position: { x: 100, y: 100 },
        selected: true,
        data: {
          taskReferenceName: 'task_1',
          taskType: 'SIMPLE' as const,
          label: 'Task 1',
        },
      },
      {
        id: 'node-2',
        type: 'dagNode',
        position: { x: 300, y: 150 },
        selected: true,
        data: {
          taskReferenceName: 'task_2',
          taskType: 'HTTP' as const,
          label: 'Task 2',
        },
      },
    ];

    renderWithProviders(
      <VisualDagStudio
        mode="full"
        initialNodes={testNodes}
        initialEdges={[]}
      />
    );

    // Floating selection toolbar should be mounted
    expect(screen.getByTestId('dag-selection-toolbar')).toBeTruthy();
    expect(screen.getByText('2 selected')).toBeTruthy();

    // Verify alignment actions exist
    expect(screen.getByTestId('dag-align-left-btn')).toBeTruthy();
    expect(screen.getByTestId('dag-align-center-x-btn')).toBeTruthy();
    expect(screen.getByTestId('dag-align-top-btn')).toBeTruthy();
    expect(screen.getByTestId('dag-align-middle-y-btn')).toBeTruthy();
    expect(screen.getByTestId('dag-duplicate-btn')).toBeTruthy();
    expect(screen.getByTestId('dag-bulk-delete-btn')).toBeTruthy();
  });
});
