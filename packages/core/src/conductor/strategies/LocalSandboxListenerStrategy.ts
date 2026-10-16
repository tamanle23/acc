import { Logger } from '../../logger';
import { IConductorListenerStrategy } from '../interfaces/IConductorListenerStrategy';
import { ConductorTaskOutput } from '../interfaces/IConductorTaskCommand';
import { TaskWorkerFactory } from '../TaskWorkerFactory';

export class LocalSandboxListenerStrategy implements IConductorListenerStrategy {
    private sandboxServer: any = null;

    constructor(
        private readonly port: number = 8081,
        private readonly executeTaskCb: (taskDefName: string, task: any) => Promise<ConductorTaskOutput>
    ) {}

    public async start(): Promise<void> {
        Logger.info('LocalSandboxListenerStrategy', `Starting local sandbox server on port ${this.port}...`);
        const executeCb = this.executeTaskCb;

        this.sandboxServer = Bun.serve({
          port: this.port,
          async fetch(req) {
            const url = new URL(req.url);

            // Healthcheck endpoint
            if (req.method === 'GET' && url.pathname === '/health') {
                return new Response(JSON.stringify({ status: "UP", mode: "sandbox" }), {
                    headers: { "Content-Type": "application/json" }
                });
            }

            // List Registered Tasks
            if (req.method === 'GET' && url.pathname === '/tasks/registry') {
                return new Response(JSON.stringify({
                    tasks: TaskWorkerFactory.getAllRegisteredTaskNames()
                }), {
                    headers: { "Content-Type": "application/json" }
                });
            }

            // Simulate Workflow trigger
            if (req.method === 'POST' && url.pathname.startsWith('/sandbox/workflow/')) {
                const workflowName = url.pathname.replace('/sandbox/workflow/', '');
                return new Response(JSON.stringify({
                    workflowId: `mock-wf-${Date.now()}`,
                    workflowName,
                    status: 'RUNNING'
                }), {
                    headers: { "Content-Type": "application/json" }
                });
            }

            // Execute specific task
            if (req.method === 'POST' && url.pathname.startsWith('/sandbox/task/')) {
              const taskDefName = url.pathname.replace('/sandbox/task/', '');
              try {
                  const body = await req.json();
                  Logger.info('LocalSandboxListenerStrategy', `Executing task: ${taskDefName}`);
                  const result = await executeCb(taskDefName, body);
                  return new Response(JSON.stringify(result), {
                      headers: { "Content-Type": "application/json" }
                  });
              } catch(e: any) {
                  return new Response(JSON.stringify({ error: e.message }), { status: 400 });
              }
            }

            return new Response("Not found", { status: 404 });
          }
        });
        Logger.info('LocalSandboxListenerStrategy', `Listening at http://localhost:${this.port}`);
        Logger.info('LocalSandboxListenerStrategy', `Health: GET http://localhost:${this.port}/health`);
        Logger.info('LocalSandboxListenerStrategy', `Registry: GET http://localhost:${this.port}/tasks/registry`);
        Logger.info('LocalSandboxListenerStrategy', 'Execute: POST http://localhost:${this.port}/sandbox/task/<taskDefName>');
    }

    public stop(): void {
        if (this.sandboxServer) {
            Logger.info('LocalSandboxListenerStrategy', 'Stopping sandbox server...');
            this.sandboxServer.stop(true);
            this.sandboxServer = null;
        }
    }
}
