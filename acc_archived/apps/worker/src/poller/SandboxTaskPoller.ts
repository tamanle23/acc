import { ITaskPoller, TaskPayload, TaskExecutionResult } from './ITaskPoller.js';
import { Logger } from '@acc/core';

export interface SandboxPollerOptions {
  intervalMs?: number;
  maxTasks?: number;
  autoGenerate?: boolean;
}

export class SandboxTaskPoller implements ITaskPoller {
  public readonly id = 'sandbox-poller';
  private running = false;
  private timer: Timer | null = null;
  private queue: TaskPayload[] = [];
  private taskCounter = 0;
  private readonly intervalMs: number;
  private readonly maxTasks: number;
  private readonly autoGenerate: boolean;
  private onTaskCallback: ((task: TaskPayload) => Promise<TaskExecutionResult>) | null = null;

  constructor(options: SandboxPollerOptions = {}) {
    this.intervalMs = options.intervalMs ?? 3000;
    this.maxTasks = options.maxTasks ?? Infinity;
    this.autoGenerate = options.autoGenerate ?? true;
  }

  public enqueue(task: TaskPayload): void {
    this.queue.push(task);
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public isPolling(): boolean {
    return this.running;
  }

  public async start(onTask: (task: TaskPayload) => Promise<TaskExecutionResult>): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.onTaskCallback = onTask;
    Logger.info('SandboxTaskPoller', `Started simulated sandbox poller (interval: ${this.intervalMs}ms, autoGenerate: ${this.autoGenerate})`);

    const poll = async () => {
      if (!this.running) return;

      let nextTask: TaskPayload | undefined = this.queue.shift();

      if (!nextTask && this.autoGenerate && this.taskCounter < this.maxTasks) {
        nextTask = this.generateSampleTask();
      }

      if (nextTask && this.onTaskCallback) {
        try {
          Logger.info('SandboxTaskPoller', `Dispatching simulated task ${nextTask.taskId} (${nextTask.taskDefName})`);
          await this.onTaskCallback(nextTask);
        } catch (err: any) {
          Logger.error('SandboxTaskPoller', `Error executing simulated task ${nextTask.taskId}: ${err.message}`);
        }
      }

      if (this.running) {
        this.timer = setTimeout(poll, this.intervalMs);
      }
    };

    this.timer = setTimeout(poll, this.intervalMs);
  }

  public async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    Logger.info('SandboxTaskPoller', 'Sandbox poller stopped gracefully.');
  }

  private generateSampleTask(): TaskPayload {
    this.taskCounter++;
    const taskTypes = [
      'acc.story.generate_script',
      'acc.tts.synthesize_speech',
      'acc.ir.compose_video',
    ];
    const taskDefName = taskTypes[(this.taskCounter - 1) % taskTypes.length];
    const taskId = `sb-task-${Date.now()}-${this.taskCounter}`;

    let inputData: Record<string, any> = {};
    if (taskDefName === 'acc.story.generate_script') {
      inputData = {
        prompt: 'The Discovery of Deep Space Pulsars',
        targetDurationSec: 30,
      };
    } else if (taskDefName === 'acc.tts.synthesize_speech') {
      inputData = {
        text: 'In the deep quiet of space, ancient stars pulse rhythmically.',
        voiceId: 'af_sky',
      };
    } else {
      inputData = {
        title: 'Deep Space Chronicles',
        fps: 30,
        aspectRatio: '16:9',
      };
    }

    return {
      taskId,
      taskDefName,
      workflowInstanceId: `wf-sim-${this.taskCounter}`,
      inputData,
    };
  }
}
