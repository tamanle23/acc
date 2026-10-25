import { describe, it, expect } from 'bun:test';
import { SandboxTaskPoller } from '../apps/worker/src/poller/SandboxTaskPoller.js';
import { TaskPayload, TaskExecutionResult } from '../apps/worker/src/poller/ITaskPoller.js';

describe('SandboxTaskPoller Unit Tests', () => {
  it('should initialize in stopped state', () => {
    const poller = new SandboxTaskPoller({ intervalMs: 50, autoGenerate: false });
    expect(poller.isPolling()).toBe(false);
    expect(poller.getQueueLength()).toBe(0);
    expect(poller.id).toBe('sandbox-poller');
  });

  it('should accept enqueued tasks and dispatch them to callback', async () => {
    const poller = new SandboxTaskPoller({ intervalMs: 20, autoGenerate: false });
    const receivedTasks: TaskPayload[] = [];

    const customTask: TaskPayload = {
      taskId: 'test-task-1',
      taskDefName: 'acc.test.echo',
      workflowInstanceId: 'wf-1',
      inputData: { message: 'hello-sandbox' },
    };

    poller.enqueue(customTask);
    expect(poller.getQueueLength()).toBe(1);

    await poller.start(async (task: TaskPayload): Promise<TaskExecutionResult> => {
      receivedTasks.push(task);
      return { status: 'COMPLETED', outputData: { echo: task.inputData } };
    });

    expect(poller.isPolling()).toBe(true);

    // Wait for the task to be processed
    await new Promise((resolve) => setTimeout(resolve, 60));
    await poller.stop();

    expect(poller.isPolling()).toBe(false);
    expect(receivedTasks.length).toBe(1);
    expect(receivedTasks[0].taskId).toBe('test-task-1');
    expect(receivedTasks[0].inputData.message).toBe('hello-sandbox');
  });

  it('should auto-generate canonical tasks when queue is empty and autoGenerate is true', async () => {
    const poller = new SandboxTaskPoller({ intervalMs: 20, maxTasks: 3, autoGenerate: true });
    const receivedTasks: TaskPayload[] = [];

    await poller.start(async (task: TaskPayload): Promise<TaskExecutionResult> => {
      receivedTasks.push(task);
      return { status: 'COMPLETED', outputData: {} };
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await poller.stop();

    expect(receivedTasks.length).toBeGreaterThanOrEqual(2);
    expect(receivedTasks[0].taskDefName).toBe('acc.story.generate_script');
    expect(receivedTasks[1].taskDefName).toBe('acc.tts.synthesize_speech');
  });
});
