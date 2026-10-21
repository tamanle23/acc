import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowVariableWatchDrawer } from './workflow-variable-watch-drawer';

describe('WorkflowVariableWatchDrawer Component Unit Tests', () => {
  it('renders execution variable watch drawer with tabs and controls', () => {
    const handleStepOver = vi.fn();
    const handleResume = vi.fn();
    const handleRemoveBreakpoint = vi.fn();

    render(
      <WorkflowVariableWatchDrawer
        open={true}
        onOpenChange={() => {}}
        executionId="wf_exec_123456"
        workflowStatus="PAUSED_AT_BREAKPOINT"
        pausedAtNode="expressCourier"
        breakpoints={['expressCourier', 'groundPostal']}
        onRemoveBreakpoint={handleRemoveBreakpoint}
        variablesSnapshot={{ orderId: 'ORD-999', speed: 'EXPRESS' }}
        taskOutputs={{ checkInventory: { inStock: true } }}
        onStepOver={handleStepOver}
        onResume={handleResume}
      />
    );

    expect(screen.getByText('Execution Variable Watch')).toBeDefined();
    expect(screen.getByText('wf_exec_123456')).toBeDefined();
    expect(screen.getByText(/Paused at: expressCourier/)).toBeDefined();
    expect(screen.getByText('PAUSED_AT_BREAKPOINT')).toBeDefined();

    // Trigger step over button
    const stepBtn = screen.getByTestId('watch-drawer-step-btn');
    fireEvent.click(stepBtn);
    expect(handleStepOver).toHaveBeenCalled();

    // Trigger resume button
    const resumeBtn = screen.getByTestId('watch-drawer-resume-btn');
    fireEvent.click(resumeBtn);
    expect(handleResume).toHaveBeenCalled();
  });
});
