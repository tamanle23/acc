import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkflowExecutionFlamegraph } from '../studio/timeline/workflow-execution-flamegraph';
import type { WorkflowStreamEvent } from '@/features/workflows/hooks/use-workflow-execution-stream';

describe('WorkflowExecutionFlamegraph Component - Time Travel & Concurrency', () => {
  const mockEvents: WorkflowStreamEvent[] = [
    {
      event: 'TASK_SCHEDULED',
      data: {
        taskReferenceName: 'validateOrder',
        taskType: 'SIMPLE',
        status: 'SCHEDULED',
        timestamp: 1700000000000,
      },
    },
    {
      event: 'TASK_IN_PROGRESS',
      data: {
        taskReferenceName: 'validateOrder',
        taskType: 'SIMPLE',
        status: 'IN_PROGRESS',
        timestamp: 1700000001000,
        workerId: 'worker-1',
      },
    },
    {
      event: 'TASK_COMPLETED',
      data: {
        taskReferenceName: 'validateOrder',
        taskType: 'SIMPLE',
        status: 'COMPLETED',
        durationMs: 200,
        timestamp: 1700000003000,
      },
    },
    {
      event: 'TASK_IN_PROGRESS',
      data: {
        taskReferenceName: 'processPayment',
        taskType: 'HTTP',
        status: 'IN_PROGRESS',
        timestamp: 1700000003500,
        workerId: 'worker-2',
      },
    },
    {
      event: 'TASK_COMPLETED',
      data: {
        taskReferenceName: 'processPayment',
        taskType: 'HTTP',
        status: 'COMPLETED',
        durationMs: 350,
        timestamp: 1700000005000,
      },
    },
  ];

  it('renders intervals and task reference items', () => {
    render(
      <WorkflowExecutionFlamegraph
        events={mockEvents}
      />
    );

    expect(screen.getByTestId('workflow-flamegraph')).toBeDefined();
    expect(screen.getByText('validateOrder')).toBeDefined();
    expect(screen.getByText('processPayment')).toBeDefined();
    expect(screen.getByText(/2 Tasks/)).toBeDefined();
  });

  it('renders playhead line when scrubbed historically', () => {
    render(
      <WorkflowExecutionFlamegraph
        events={mockEvents}
        currentStepIndex={2}
        isLiveHead={false}
      />
    );

    expect(screen.getByTestId('flamegraph-playhead-line')).toBeDefined();
    expect(screen.getByText(/Scrubbed: Step 3/)).toBeDefined();
  });

  it('triggers onSeekStep and onClickTask when a task interval row is clicked', () => {
    const handleSeekStep = vi.fn();
    const handleClickTask = vi.fn();

    render(
      <WorkflowExecutionFlamegraph
        events={mockEvents}
        onSeekStep={handleSeekStep}
        onClickTask={handleClickTask}
      />
    );

    const taskRow = screen.getByTestId('flamegraph-row-processPayment');
    fireEvent.click(taskRow);

    expect(handleClickTask).toHaveBeenCalledWith('processPayment');
    // Event index for processPayment terminal completion is 4
    expect(handleSeekStep).toHaveBeenCalledWith(4);
  });
});
