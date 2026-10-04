import { IConductorListenerStrategy } from '../interfaces/IConductorListenerStrategy';
import { ConductorTaskOutput } from '../interfaces/IConductorTaskCommand';

export class LocalSandboxListenerStrategy implements IConductorListenerStrategy {
    private sandboxServer: any = null;

    constructor(
        private readonly port: number = 8081,
        private readonly executeTaskCb: (taskDefName: string, task: any) => Promise<ConductorTaskOutput>
    ) {}

    public async start(): Promise<void> {
        console.log(`[ConductorPoller Sandbox] Starting local sandbox server on port ${this.port}...`);
        const executeCb = this.executeTaskCb;

        this.sandboxServer = Bun.serve({
          port: this.port,
          async fetch(req) {
            const url = new URL(req.url);

            // POST /sandbox/task/:taskDefName
            if (req.method === 'POST' && url.pathname.startsWith('/sandbox/task/')) {
              const taskDefName = url.pathname.replace('/sandbox/task/', '');
              try {
                  const body = await req.json();
                  console.log(`[Sandbox] Executing task: ${taskDefName}`);
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
        console.log(`[ConductorPoller Sandbox] Listening at http://localhost:${this.port}`);
        console.log(`[ConductorPoller Sandbox] Test via: curl -X POST http://localhost:${this.port}/sandbox/task/acc.p4_story.compose_video -d '{"inputData":{"storyConfig":{"scene":1}}}'`);
    }

    public stop(): void {
        if (this.sandboxServer) {
            console.log(`[ConductorPoller Sandbox] Stopping sandbox server...`);
            this.sandboxServer.stop(true);
            this.sandboxServer = null;
        }
    }
}
