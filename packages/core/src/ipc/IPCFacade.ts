import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { getTTSServiceClient, getVisionServiceClient, getLLMServiceClient } from '@acc/proto';

export interface IAIClientStrategy {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  ping(message: string): Promise<string>;
}

export class GRPCAIStrategy implements IAIClientStrategy {
  public readonly name = 'grpc';
  private endpoint: string;
  private ttsClient: any = null;
  private visionClient: any = null;
  private llmClient: any = null;
  private static daemonProcess: ChildProcess | null = null;

  constructor(endpoint = process.env.ACC_GRPC_ENDPOINT || '127.0.0.1:50051') {
    this.endpoint = endpoint;
  }

  private initClients() {
    if (!this.ttsClient) {
      this.ttsClient = getTTSServiceClient(this.endpoint);
      this.visionClient = getVisionServiceClient(this.endpoint);
      this.llmClient = getLLMServiceClient(this.endpoint);
    }
  }

  public async isAvailable(): Promise<boolean> {
    try {
      this.initClients();
      const res = await this.ping('health_check');
      return !!res;
    } catch {
      return false;
    }
  }

  public async ping(message: string): Promise<string> {
    this.initClients();
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + 2000);
      this.ttsClient.Ping({ message }, { deadline }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response.message);
      });
    });
  }

  public async pingVision(message: string): Promise<string> {
    this.initClients();
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + 2000);
      this.visionClient.Ping({ message }, { deadline }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response.message);
      });
    });
  }

  public async pingLLM(message: string): Promise<string> {
    this.initClients();
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + 2000);
      this.llmClient.Ping({ message }, { deadline }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response.message);
      });
    });
  }

  /**
   * Auto-bootstraps the Python gRPC daemon if it is not currently running.
   */
  public async ensureDaemonRunning(maxRetries = 10): Promise<boolean> {
    const isUp = await this.isAvailable();
    if (isUp) return true;

    if (!GRPCAIStrategy.daemonProcess) {
      const pythonBackendDir = path.resolve(__dirname, '../../../../apps/python-backend');
      console.log(`[IPCFacade] Auto-bootstrapping Python AI Daemon via uv in ${pythonBackendDir}...`);

      const port = process.env.ACC_GRPC_PORT || '50051';
      GRPCAIStrategy.daemonProcess = spawn('bun', ['x', 'uv', 'run', 'python', 'src/server.py', port], {
        cwd: pythonBackendDir,
        stdio: ['ignore', 'inherit', 'inherit'],
        shell: process.platform === 'win32',
      });

      GRPCAIStrategy.daemonProcess.unref();

      // Gracefully kill daemon on parent process exit
      process.on('exit', () => {
        if (GRPCAIStrategy.daemonProcess) {
          try {
            GRPCAIStrategy.daemonProcess.kill();
          } catch {}
        }
      });
    }

    // Poll until healthy
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const healthy = await this.isAvailable();
      if (healthy) {
        console.log(`[IPCFacade] Python AI Daemon is ONLINE at ${this.endpoint}`);
        return true;
      }
    }

    console.warn(`[IPCFacade] Daemon failed to respond within timeout. Switching to fallback.`);
    return false;
  }
}

export class FallbackAIStrategy implements IAIClientStrategy {
  public readonly name = 'fallback';
  public async isAvailable(): Promise<boolean> {
    return true;
  }
  public async ping(message: string): Promise<string> {
    return `Fallback in-process pong: ${message}`;
  }
}

export class IPCFacade {
  private strategy: IAIClientStrategy;

  constructor(strategy?: IAIClientStrategy) {
    this.strategy = strategy || new GRPCAIStrategy();
  }

  public setStrategy(strategy: IAIClientStrategy) {
    this.strategy = strategy;
  }

  public getStrategyName(): string {
    return this.strategy.name;
  }

  public async ping(message = 'hello'): Promise<string> {
    if (this.strategy instanceof GRPCAIStrategy) {
      await this.strategy.ensureDaemonRunning();
    }
    try {
      return await this.strategy.ping(message);
    } catch (err: any) {
      console.warn(`[IPCFacade] Strategy '${this.strategy.name}' error: ${err.message}. Engaging Fallback.`);
      this.strategy = new FallbackAIStrategy();
      return this.strategy.ping(message);
    }
  }

  public async pingAllServices(message = 'test'): Promise<{ tts: string; vision: string; llm: string }> {
    if (this.strategy instanceof GRPCAIStrategy) {
      await this.strategy.ensureDaemonRunning();
      const tts = await this.strategy.ping(message);
      const vision = await this.strategy.pingVision(message);
      const llm = await this.strategy.pingLLM(message);
      return { tts, vision, llm };
    }
    const pong = await this.strategy.ping(message);
    return { tts: pong, vision: pong, llm: pong };
  }
}

export const defaultIPCFacade = new IPCFacade();
