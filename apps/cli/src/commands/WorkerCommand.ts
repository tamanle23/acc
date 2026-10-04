import { ConductorWorkerPoller, registerAllConductorCommands, TaskWorkerFactory } from '@acc/core';

export async function runWorkerDaemon(options: { conductorUrl: string; tasks?: string[]; sandboxMode?: boolean }) {
  // Register all known Conductor commands in the factory
  registerAllConductorCommands();

  // Use only registered commands to avoid pulling unprocessable tasks
  const registeredTasks = TaskWorkerFactory.getAllRegisteredTaskNames();

  const taskList = options.tasks && options.tasks.length > 0 ? options.tasks : registeredTasks;

  if (options.sandboxMode) {
      console.log(`[ACC Conductor Worker] Starting in SANDBOX MODE for ${taskList.length} tasks...`);
  } else {
      console.log(`[ACC Conductor Worker] Starting worker polling daemon for ${taskList.length} tasks on ${options.conductorUrl}...`);
  }

  const poller = new ConductorWorkerPoller(options.conductorUrl, taskList, 'acc-worker', options.sandboxMode);
  await poller.start();

  process.on('SIGINT', () => {
    console.log('[ACC Conductor Worker] Shutting down poller gracefully...');
    poller.stop();
    process.exit(0);
  });
}
