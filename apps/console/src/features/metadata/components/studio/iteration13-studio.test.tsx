import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiSchemaGeneratorModal } from './ai-schema-generator-modal';
import { DagPropertyInspector } from './dag-property-inspector';
import { DagWorkflowNodeComponent } from './dag-node';
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

describe('Iteration 13 Studio Capabilities (Phases 4, 5, 6, 7)', () => {
  it('renders AiSchemaGeneratorModal and triggers deterministic synthesis', async () => {
    renderWithProviders(
      <AiSchemaGeneratorModal
        entityTypeId={1}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText('AI-Assisted Schema & FSM Synthesizer')).toBeTruthy();
    const triggerBtn = screen.getByTestId('ai-synthesize-trigger-btn');
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(screen.getByTestId('ai-apply-schema-btn')).toBeTruthy();
    });
  });

  it('renders DagPropertyInspector with upstream variable pills and VisualJsonEditor', async () => {
    const onUpdateNodeData = vi.fn();
    renderWithProviders(
      <DagPropertyInspector
        nodeId="node-1"
        nodeData={{
          taskReferenceName: 'checkInventory',
          taskType: 'SIMPLE',
          label: 'Check Inventory',
          domain: 'inventory',
          inputParameters: { orderId: '${workflow.input.orderId}' },
        }}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateNodeData={onUpdateNodeData}
        availableTaskRefs={['checkInventory', 'expressCourier']}
        defaultTab="params"
      />
    );

    expect(screen.getByText('${expressCourier.output.*}')).toBeTruthy();
    expect(screen.getByText('Structured Input Parameters (Visual JSON Editor)')).toBeTruthy();
  });

  it('renders DagWorkflowNodeComponent breakpoint gutter dot and PAUSED_AT_BREAKPOINT badge', () => {
    const onToggleBreakpoint = vi.fn();
    renderWithProviders(
      <DagWorkflowNodeComponent
        id="node-1"
        type="dagNode"
        selected={false}
        dragging={false}
        zIndex={1}
        isConnectable={true}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        data={{
          taskReferenceName: 'expressCourier',
          taskType: 'SIMPLE',
          label: 'Express Courier',
          executionState: 'PAUSED_AT_BREAKPOINT',
          hasBreakpoint: true,
          onToggleBreakpoint,
        }}
      />
    );

    expect(screen.getByText('BREAKPOINT')).toBeTruthy();
    const bpDot = screen.getByTestId('dag-breakpoint-dot-expressCourier');
    fireEvent.click(bpDot);
    expect(onToggleBreakpoint).toHaveBeenCalledWith('expressCourier');
  });
});
