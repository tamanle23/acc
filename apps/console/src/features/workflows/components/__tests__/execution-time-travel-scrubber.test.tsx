import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExecutionTimeTravelScrubber } from '../execution/execution-time-travel-scrubber';
import type { WorkflowStreamEvent } from '../../hooks/use-workflow-execution-stream';

describe('ExecutionTimeTravelScrubber Component', () => {
  const mockEvents: WorkflowStreamEvent[] = [
    {
      event: 'WORKFLOW_STARTED',
      data: { status: 'RUNNING', timestamp: 1700000000000 },
    },
    {
      event: 'TASK_IN_PROGRESS',
      data: { taskId: 'task-1', taskReferenceName: 'validateOrder', timestamp: 1700000001000 },
    },
    {
      event: 'TASK_COMPLETED',
      data: { taskId: 'task-1', status: 'COMPLETED', timestamp: 1700000002500 },
    },
  ];

  it('renders correctly with events and step progress', () => {
    const handleSeek = vi.fn();
    render(
      <ExecutionTimeTravelScrubber
        events={mockEvents}
        currentIndex={1}
        isLiveHead={true}
        onSeek={handleSeek}
      />
    );

    expect(screen.getByTestId('execution-time-travel-scrubber')).toBeDefined();
    expect(screen.getByText('Step 2/3')).toBeDefined();
    expect(screen.getByText('LIVE')).toBeDefined();
    expect(screen.getByText('TASK_IN_PROGRESS')).toBeDefined();
  });

  it('triggers onSeek when slider range input is changed', () => {
    const handleSeek = vi.fn();
    render(
      <ExecutionTimeTravelScrubber
        events={mockEvents}
        currentIndex={0}
        onSeek={handleSeek}
      />
    );

    const slider = screen.getByLabelText(/timeline scrubber slider/i);
    fireEvent.change(slider, { target: { value: '2' } });

    expect(handleSeek).toHaveBeenCalledWith(2);
  });

  it('handles playback navigation controls: step forward, backward, play/pause', () => {
    const handleStepForward = vi.fn();
    const handleStepBackward = vi.fn();
    const handleTogglePlay = vi.fn();

    const { rerender } = render(
      <ExecutionTimeTravelScrubber
        events={mockEvents}
        currentIndex={1}
        isPlaying={false}
        onSeek={vi.fn()}
        onStepForward={handleStepForward}
        onStepBackward={handleStepBackward}
        onTogglePlay={handleTogglePlay}
      />
    );

    fireEvent.click(screen.getByTitle('Step Forward'));
    expect(handleStepForward).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Step Backward'));
    expect(handleStepBackward).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Play Replay'));
    expect(handleTogglePlay).toHaveBeenCalledTimes(1);

    rerender(
      <ExecutionTimeTravelScrubber
        events={mockEvents}
        currentIndex={1}
        isPlaying={true}
        onSeek={vi.fn()}
        onTogglePlay={handleTogglePlay}
      />
    );

    fireEvent.click(screen.getByTitle('Pause Replay'));
    expect(handleTogglePlay).toHaveBeenCalledTimes(2);
  });

  it('displays buffered live events pill and triggers onResumeLive', () => {
    const handleResumeLive = vi.fn();
    render(
      <ExecutionTimeTravelScrubber
        events={mockEvents}
        currentIndex={0}
        isLiveHead={false}
        bufferedLiveEventsCount={4}
        onSeek={vi.fn()}
        onResumeLive={handleResumeLive}
      />
    );

    expect(screen.getByText(/4 new live events/i)).toBeDefined();
    fireEvent.click(screen.getByText(/4 new live events/i));
    expect(handleResumeLive).toHaveBeenCalledTimes(1);
  });
});
