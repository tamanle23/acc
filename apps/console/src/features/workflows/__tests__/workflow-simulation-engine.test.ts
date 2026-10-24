import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WorkflowSimulationEngine,
  workflowSimulationEngine,
} from '../sandbox/workflow-simulation-engine';
import { SIMULATION_SCENARIOS } from '../sandbox/simulation-scenarios';
import { MULTI_BRANCH_ORDER_NODES, MULTI_BRANCH_ORDER_EDGES } from '../sandbox/simulation-blueprints';
import { validateGraphTopology } from '../components/studio/utils/workflow-ir-converter';

describe('WorkflowSimulationEngine & Multi-Branch Blueprints', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    workflowSimulationEngine.reset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('validates multi-branch order pipeline topology without errors or cycles', () => {
    const errors = validateGraphTopology(
      MULTI_BRANCH_ORDER_NODES,
      MULTI_BRANCH_ORDER_EDGES
    );
    expect(errors).toHaveLength(0);
  });

  it('enforces single input and single output on all non-logic task nodes', () => {
    const inDegrees: Record<string, number> = {};
    const outDegrees: Record<string, number> = {};

    MULTI_BRANCH_ORDER_NODES.forEach((n) => {
      inDegrees[n.id] = 0;
      outDegrees[n.id] = 0;
    });

    MULTI_BRANCH_ORDER_EDGES.forEach((e) => {
      inDegrees[e.target] = (inDegrees[e.target] || 0) + 1;
      outDegrees[e.source] = (outDegrees[e.source] || 0) + 1;
    });

    MULTI_BRANCH_ORDER_NODES.forEach((node) => {
      const type = node.data.taskType;
      const isStart = node.data.isStartNode;
      const isEnd = node.data.isEndNode;

      if (isStart) {
        expect(inDegrees[node.id]).toBe(0);
        expect(outDegrees[node.id]).toBe(1);
      } else if (isEnd) {
        expect(inDegrees[node.id]).toBe(1);
        expect(outDegrees[node.id]).toBe(0);
      } else if (type === 'FORK_JOIN') {
        // Fork node accepts 1 input and outputs to multiple parallel branches
        expect(inDegrees[node.id]).toBe(1);
        expect(outDegrees[node.id]).toBeGreaterThanOrEqual(2);
      } else if (type === 'JOIN') {
        // Join node accepts multiple parallel inputs and outputs to 1 downstream task
        expect(inDegrees[node.id]).toBeGreaterThanOrEqual(2);
        expect(outDegrees[node.id]).toBe(1);
      } else {
        // All normal task nodes must have exactly 1 input and 1 output
        expect(inDegrees[node.id]).toBe(1);
        expect(outDegrees[node.id]).toBe(1);
      }
    });
  });

  it('correctly dispatches simulated SSE events in HAPPY_PATH scenario', () => {
    const receivedEvents: Array<{ type: string; data: any }> = [];

    const execId = workflowSimulationEngine.start('HAPPY_PATH', 'step');
    expect(execId).toMatch(/^sim_order_pipeline_/);

    const unsubscribe = workflowSimulationEngine.subscribeToExecution(
      execId,
      (evt) => {
        receivedEvents.push({ type: evt.type, data: JSON.parse(evt.data) });
      }
    );

    // Initial state
    const status = workflowSimulationEngine.getStatus();
    expect(status.isRunning).toBe(true);
    expect(status.activeScenarioId).toBe('HAPPY_PATH');
    expect(status.totalEvents).toBe(SIMULATION_SCENARIOS.HAPPY_PATH.events.length);

    // Step through each event manually
    let hasMore = true;
    let stepCount = 0;
    while (hasMore && stepCount < 50) {
      hasMore = workflowSimulationEngine.stepNext();
      stepCount++;
    }

    expect(receivedEvents.length).toBe(SIMULATION_SCENARIOS.HAPPY_PATH.events.length);
    expect(receivedEvents[0].type).toBe('CONNECTED');
    expect(receivedEvents[1].type).toBe('WORKFLOW_STARTED');
    expect(receivedEvents[receivedEvents.length - 1].type).toBe('WORKFLOW_COMPLETED');

    unsubscribe();
  });

  it('handles pause and resume in timed simulation playback', () => {
    const execId = workflowSimulationEngine.start('FRAUD_REJECTED', '2x');
    expect(workflowSimulationEngine.getStatus().isRunning).toBe(true);
    expect(workflowSimulationEngine.getStatus().isPaused).toBe(false);

    // Fast-forward 1 event (450ms)
    vi.advanceTimersByTime(460);
    expect(workflowSimulationEngine.getStatus().currentEventIndex).toBe(1);

    // Pause
    workflowSimulationEngine.pause();
    expect(workflowSimulationEngine.getStatus().isPaused).toBe(true);

    // Advance time while paused — no events should fire
    vi.advanceTimersByTime(1000);
    expect(workflowSimulationEngine.getStatus().currentEventIndex).toBe(1);

    // Resume
    workflowSimulationEngine.resume();
    expect(workflowSimulationEngine.getStatus().isPaused).toBe(false);

    vi.advanceTimersByTime(460);
    expect(workflowSimulationEngine.getStatus().currentEventIndex).toBe(2);

    workflowSimulationEngine.stop();
  });

  it('resets state on reset()', () => {
    workflowSimulationEngine.start('PAYMENT_TIMEOUT', '1x');
    workflowSimulationEngine.stepNext();
    expect(workflowSimulationEngine.getStatus().currentEventIndex).toBeGreaterThan(0);

    workflowSimulationEngine.reset();
    const status = workflowSimulationEngine.getStatus();
    expect(status.isRunning).toBe(false);
    expect(status.isPaused).toBe(false);
    expect(status.currentEventIndex).toBe(0);
    expect(status.currentExecutionId).toBeNull();
  });
});
