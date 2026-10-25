#!/usr/bin/env bun
import { Logger, TaskWorkerFactory } from '@acc/core';
import { ITaskPoller, TaskPayload, TaskExecutionResult, SandboxTaskPoller } from './poller/index.js';
import { BackendHypervisor, OllamaBackendAdapter, PythonBackendAdapter } from './hypervisor/index.js';
import { StoryScriptTaskCommand, TtsSynthesizeTaskCommand, IrComposeTaskCommand } from './tasks/index.js';
import { WorkerTelemetryServer } from './telemetry/WorkerTelemetryServer.js';

export interface WorkerCliOptions {
  sandbox: boolean;
  pollIntervalMs: number;
  pythonPort: number;
  ollamaPort: number;
  telemetryPort: number;
}

export function parseWorkerArgs(args: string[]): WorkerCliOptions {
  const options: WorkerCliOptions = {
    sandbox: true,
    pollIntervalMs: 3000,
    pythonPort: parseInt(process.env.PYTHON_PORT || '50051', 10),
    ollamaPort: parseInt(process.env.OLLAMA_PORT || '11434', 10),
    telemetryPort: parseInt(process.env.WORKER_TELEMETRY_PORT || '4000', 10),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--sandbox' || arg === '-s') {
      options.sandbox = true;
    } else if (arg === '--interval' || arg === '-i') {
      options.pollIntervalMs = parseInt(args[++i] || '3000', 10);
    } else if (arg === '--python-port') {
      options.pythonPort = parseInt(args[++i] || '50051', 10);
    } else if (arg === '--ollama-port') {
      options.ollamaPort = parseInt(args[++i] || '11434', 10);
    } else if (arg === '--telemetry-port') {
      options.telemetryPort = parseInt(args[++i] || '4000', 10);
    }
  }

  return options;
}

export async function bootstrapWorker(options: WorkerCliOptions): Promise<{ poller: ITaskPoller; hypervisor: BackendHypervisor; telemetryServer: WorkerTelemetryServer }> {
  Logger.info('ACC-Worker', '==================================================');
  Logger.info('ACC-Worker', 'ACC Long-Running Task Worker Daemon v1.0.0');
  Logger.info('ACC-Worker', `Environment: AI_OFFLINE=${process.env.ACC_AI_OFFLINE || '0'}`);
  Logger.info('ACC-Worker', `Connecting: Python Port ${options.pythonPort}, Ollama Port ${options.ollamaPort}, Telemetry Port ${options.telemetryPort}`);
  Logger.info('ACC-Worker', '==================================================');

  // Start Worker SSE Telemetry Server
  const telemetryServer = new WorkerTelemetryServer(options.telemetryPort);
  try {
    telemetryServer.start();
  } catch (err: any) {
    Logger.warn('ACC-Worker', `Failed to start Worker SSE telemetry server on ${options.telemetryPort}: ${err.message}`);
  }

  // 1. Initialize Backend Hypervisor & register adapters
  const hypervisor = new BackendHypervisor();
  hypervisor.registerAdapter(new PythonBackendAdapter(options.pythonPort));

  // 2. Register production Task Commands
  TaskWorkerFactory.register(new StoryScriptTaskCommand(hypervisor));
  TaskWorkerFactory.register(new TtsSynthesizeTaskCommand(hypervisor));
  TaskWorkerFactory.register(new IrComposeTaskCommand());

  Logger.info('ACC-Worker', `Registered TaskWorkerFactory tasks: [${TaskWorkerFactory.getAllRegisteredTaskNames().join(', ')}]`);

  // 3. Initialize Pluggable Poller (defaulting to SandboxTaskPoller)
  const poller: ITaskPoller = new SandboxTaskPoller({
    intervalMs: options.pollIntervalMs,
    autoGenerate: true,
  });

  // 4. Start polling dispatcher
  await poller.start(async (task: TaskPayload): Promise<TaskExecutionResult> => {
    Logger.info('ACC-Worker', `Processing task: ${task.taskId} (${task.taskDefName})`);
    try {
      const command = TaskWorkerFactory.getCommand(task.taskDefName);
      command.validate({
        taskId: task.taskId,
        workflowInstanceId: task.workflowInstanceId || '',
        taskDefName: task.taskDefName,
        inputData: task.inputData,
      });

      telemetryServer.updateJobProgress({
        status: 'rendering',
        activeJobId: task.taskId,
        renderFps: 24,
      });

      const output = await command.execute({
        taskId: task.taskId,
        workflowInstanceId: task.workflowInstanceId || '',
        taskDefName: task.taskDefName,
        inputData: task.inputData,
      });

      Logger.info('ACC-Worker', `Task ${task.taskId} finished with status: ${output.status}`);
      telemetryServer.updateJobProgress({
        status: 'idle',
        activeJobId: undefined,
        renderFps: 0,
      });
      return {
        status: output.status === 'FAILED' ? 'FAILED' : 'COMPLETED',
        outputData: output.outputData,
        logs: output.logs,
        error: output.reasonForIncompletion,
      };
    } catch (err: any) {
      Logger.error('ACC-Worker', `Task ${task.taskId} failed execution: ${err.message}`);
      return {
        status: 'FAILED',
        outputData: {},
        error: err.message,
        logs: [err.stack || err.message],
      };
    }
  });

  return { poller, hypervisor, telemetryServer };
}

if (import.meta.main) {
  const options = parseWorkerArgs(process.argv.slice(2));
  bootstrapWorker(options).then(({ poller, telemetryServer }) => {
    const shutdown = async () => {
      Logger.info('ACC-Worker', 'Shutting down worker daemon gracefully...');
      telemetryServer.stop();
      await poller.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }).catch((err) => {
    Logger.error('ACC-Worker', `Fatal worker startup error: ${err.message}`);
    process.exit(1);
  });
}
