import { IConductorListenerStrategy } from '../interfaces/IConductorListenerStrategy';
import { TaskManager, orkesConductorClient } from '@io-orkes/conductor-javascript';
import { ConductorTaskOutput } from '../interfaces/IConductorTaskCommand';

export class OrkesConductorListenerStrategy implements IConductorListenerStrategy {
    private taskManager: TaskManager | null = null;

    constructor(
        private readonly conductorServerUrl: string,
        private readonly taskDefNames: string[],
        private readonly workerId: string,
        private readonly executeTaskCb: (taskDefName: string, task: any) => Promise<ConductorTaskOutput>
    ) {}

    public async start(): Promise<void> {
        const client = await orkesConductorClient({
            serverUrl: this.conductorServerUrl
        });

        const workers = this.taskDefNames.map(taskDefName => ({
            taskDefName,
            execute: async (task: any) => {
              return await this.executeTaskCb(taskDefName, task);
            }
        }));

        this.taskManager = new TaskManager(client, workers, {
            logger: console,
            options: {
                workerID: this.workerId,
                pollInterval: 1000,
                concurrency: 5
            }
        });

        console.log(`[ConductorPoller] Starting polling on ${this.conductorServerUrl} with ${workers.length} task definitions...`);
        this.taskManager.startPolling();
    }

    public stop(): void {
        if (this.taskManager) {
            console.log(`[ConductorPoller] Stopping polling...`);
            this.taskManager.stopPolling();
            this.taskManager = null;
        }
    }
}
