import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  workflowSimulationEngine,
  SIMULATION_SCENARIOS,
  MULTI_BRANCH_ORDER_NODES,
  MULTI_BRANCH_ORDER_EDGES,
} from '../../index';

describe('WorkflowSimulationEngine in @acc/sandbox', () => {
  beforeEach(() => {
    workflowSimulationEngine.reset();
  });

  afterEach(() => {
    workflowSimulationEngine.reset();
  });

  it('exports valid simulation scenarios with events', () => {
    expect(SIMULATION_SCENARIOS.HAPPY_PATH).toBeDefined();
    expect(SIMULATION_SCENARIOS.FRAUD_REJECTED).toBeDefined();
    expect(SIMULATION_SCENARIOS.PAYMENT_TIMEOUT).toBeDefined();
    expect(SIMULATION_SCENARIOS.APPROVAL_ESCALATION).toBeDefined();

    expect(SIMULATION_SCENARIOS.HAPPY_PATH.events.length).toBeGreaterThan(5);
  });

  it('exports valid MULTI_BRANCH_ORDER_NODES and edges', () => {
    expect(MULTI_BRANCH_ORDER_NODES.length).toBeGreaterThan(0);
    expect(MULTI_BRANCH_ORDER_EDGES.length).toBeGreaterThan(0);

    const startNode = MULTI_BRANCH_ORDER_NODES.find((n) => n.data.isStartNode);
    expect(startNode).toBeDefined();
  });

  it('allows starting, stepping, pausing, and subscribing to status', () => {
    const statuses: any[] = [];
    const unsubscribe = workflowSimulationEngine.subscribeStatus((st) => {
      statuses.push(st);
    });

    const execId = workflowSimulationEngine.start('HAPPY_PATH', 'step');
    expect(execId).toContain('sim_order_pipeline_');

    expect(workflowSimulationEngine.getStatus().isRunning).toBe(true);
    expect(workflowSimulationEngine.getStatus().speed).toBe('step');

    const stepResult = workflowSimulationEngine.stepNext();
    expect(stepResult).toBe(true);

    workflowSimulationEngine.pause();
    expect(workflowSimulationEngine.getStatus().isPaused).toBe(true);

    workflowSimulationEngine.resume();
    expect(workflowSimulationEngine.getStatus().isPaused).toBe(false);

    workflowSimulationEngine.stop();
    expect(workflowSimulationEngine.getStatus().isRunning).toBe(false);

    unsubscribe();
  });
});
