import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { WorkflowSimulationModal } from '../components/studio/modals/workflow-simulation-modal';
import { workflowSimulationEngine } from '../sandbox/workflow-simulation-engine';

describe('WorkflowSimulationModal', () => {
  beforeEach(() => {
    workflowSimulationEngine.reset();
  });

  afterEach(() => {
    workflowSimulationEngine.reset();
  });

  it('renders scenarios and speeds correctly when open', () => {
    const onStartSimulation = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <WorkflowSimulationModal
        open={true}
        onOpenChange={onOpenChange}
        onStartSimulation={onStartSimulation}
      />
    );

    expect(
      screen.getByText('Multi-Branch Live Execution Simulator')
    ).toBeDefined();
    expect(
      screen.getByText('Happy Path: Complete Fulfillment')
    ).toBeDefined();
    expect(
      screen.getByText('Fault: AI Fraud Check Rejected')
    ).toBeDefined();
    expect(
      screen.getByText('Fault: Payment Gateway Timeout')
    ).toBeDefined();
    expect(
      screen.getByText('State: Human Approval Escalation')
    ).toBeDefined();
  });

  it('allows selecting a scenario and triggers onStartSimulation upon launch', () => {
    const onStartSimulation = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <WorkflowSimulationModal
        open={true}
        onOpenChange={onOpenChange}
        onStartSimulation={onStartSimulation}
      />
    );

    // Select Fraud scenario
    const fraudOption = screen.getByTestId('scenario-option-FRAUD_REJECTED');
    fireEvent.click(fraudOption);

    // Click launch
    const launchBtn = screen.getByTestId('launch-simulation-btn');
    fireEvent.click(launchBtn);

    expect(onStartSimulation).toHaveBeenCalledTimes(1);
    expect(onStartSimulation).toHaveBeenCalledWith(
      expect.stringMatching(/^sim_order_pipeline_/)
    );
  });

  it('allows manual stepping when in step mode', () => {
    const onStartSimulation = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <WorkflowSimulationModal
        open={true}
        onOpenChange={onOpenChange}
        onStartSimulation={onStartSimulation}
      />
    );

    // Select step cadence
    const stepBtn = screen.getByTestId('speed-option-step');
    fireEvent.click(stepBtn);

    // Start simulation
    const launchBtn = screen.getByTestId('launch-simulation-btn');
    fireEvent.click(launchBtn);

    // Step Next button should be visible
    const stepNextBtn = screen.getByTestId('sim-step-next-btn');
    expect(stepNextBtn).toBeDefined();

    fireEvent.click(stepNextBtn);
    expect(workflowSimulationEngine.getStatus().currentEventIndex).toBe(1);
  });
});
