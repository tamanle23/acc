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

  public async estimateDepth(imageBufferOrPath: string | Buffer, modelSize = 'small'): Promise<{ depthMapBuffer: Buffer; minDepth: number; maxDepth: number }> {
    this.initClients();
    const fs = await import('fs');
    const image_data = typeof imageBufferOrPath === 'string' ? fs.readFileSync(imageBufferOrPath) : imageBufferOrPath;
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + 8000);
      this.visionClient.EstimateDepth({ image_data, model_size: modelSize }, { deadline }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve({
          depthMapBuffer: Buffer.from(response.depth_map_png),
          minDepth: response.min_depth,
          maxDepth: response.max_depth,
        });
      });
    });
  }

  public async segmentSubject(imageBufferOrPath: string | Buffer, mode = 'foreground'): Promise<{ maskBuffer: Buffer; boundingBox: any; confidence: number }> {
    this.initClients();
    const fs = await import('fs');
    const image_data = typeof imageBufferOrPath === 'string' ? fs.readFileSync(imageBufferOrPath) : imageBufferOrPath;
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + 8000);
      this.visionClient.SegmentSubject({ image_data, mode }, { deadline }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve({
          maskBuffer: Buffer.from(response.mask_png),
          boundingBox: response.bounding_box,
          confidence: response.confidence,
        });
      });
    });
  }

  public async generateStructuredJson(
    prompt: string,
    jsonSchema = '',
    systemInstruction = '',
    temperature = 0.2
  ): Promise<{ jsonOutput: string; tokensUsed: number; latencyMs: number }> {
    this.initClients();
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + 10000);
      this.llmClient.GenerateStructuredJson(
        { prompt, json_schema: jsonSchema, system_instruction: systemInstruction, temperature },
        { deadline },
        (err: any, response: any) => {
          if (err) return reject(err);
          resolve({
            jsonOutput: response.json_output,
            tokensUsed: response.tokens_used,
            latencyMs: Number(response.latency_ms),
          });
        }
      );
    });
  }

  public async synthesizeSpeech(
    text: string,
    voiceId = 'af_heart',
    speed = 1.0,
    modelStrategy = 'kokoro'
  ): Promise<{ audioBuffer: Buffer; sampleRate: number; channels: number; durationMs: number }> {
    this.initClients();
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + 10000);
      this.ttsClient.Synthesize(
        { text, voice_id: voiceId, speed, model_strategy: modelStrategy },
        { deadline },
        (err: any, response: any) => {
          if (err) return reject(err);
          resolve({
            audioBuffer: Buffer.from(response.audio_data),
            sampleRate: response.sample_rate,
            channels: response.channels,
            durationMs: Number(response.duration_ms),
          });
        }
      );
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
  public async estimateDepth(): Promise<{ depthMapBuffer: Buffer; minDepth: number; maxDepth: number }> {
    return { depthMapBuffer: Buffer.alloc(0), minDepth: 0, maxDepth: 1 };
  }
  public async segmentSubject(): Promise<{ maskBuffer: Buffer; boundingBox: any; confidence: number }> {
    return { maskBuffer: Buffer.alloc(0), boundingBox: { x: 0, y: 0, width: 1, height: 1, confidence: 1 }, confidence: 1 };
  }
  public async generateStructuredJson(
    prompt: string
  ): Promise<{ jsonOutput: string; tokensUsed: number; latencyMs: number }> {
    const payload = {
      title: prompt.split('\n')[0].slice(0, 80) || 'Breaking Event Alert',
      key_points: [prompt.slice(0, 100) || 'Alert details incoming', 'Automated data stream processing active'],
      urgency_level: 'medium',
      voiceover_script: `Breaking alert: ${prompt.slice(0, 120)}`,
      category: 'tech'
    };
    return { jsonOutput: JSON.stringify(payload, null, 2), tokensUsed: 35, latencyMs: 5 };
  }
  public async synthesizeSpeech(
    text: string
  ): Promise<{ audioBuffer: Buffer; sampleRate: number; channels: number; durationMs: number }> {
    return { audioBuffer: Buffer.alloc(0), sampleRate: 24000, channels: 1, durationMs: 2500 };
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

  public async estimateDepth(imageBufferOrPath: string | Buffer, modelSize = 'small'): Promise<{ depthMapBuffer: Buffer; minDepth: number; maxDepth: number }> {
    if (this.strategy instanceof GRPCAIStrategy) {
      await this.strategy.ensureDaemonRunning();
      return this.strategy.estimateDepth(imageBufferOrPath, modelSize);
    }
    return (this.strategy as FallbackAIStrategy).estimateDepth();
  }

  public async segmentSubject(imageBufferOrPath: string | Buffer, mode = 'foreground'): Promise<{ maskBuffer: Buffer; boundingBox: any; confidence: number }> {
    if (this.strategy instanceof GRPCAIStrategy) {
      await this.strategy.ensureDaemonRunning();
      return this.strategy.segmentSubject(imageBufferOrPath, mode);
    }
    return (this.strategy as FallbackAIStrategy).segmentSubject();
  }

  public async generateStructuredJson(
    prompt: string,
    jsonSchema = '',
    systemInstruction = '',
    temperature = 0.2
  ): Promise<{ jsonOutput: string; tokensUsed: number; latencyMs: number }> {
    if (this.strategy instanceof GRPCAIStrategy) {
      await this.strategy.ensureDaemonRunning();
      return (this.strategy as GRPCAIStrategy).generateStructuredJson(prompt, jsonSchema, systemInstruction, temperature);
    }
    return (this.strategy as FallbackAIStrategy).generateStructuredJson(prompt);
  }

  public async synthesizeSpeech(
    text: string,
    voiceId = 'af_heart',
    speed = 1.0,
    modelStrategy = 'kokoro'
  ): Promise<{ audioBuffer: Buffer; sampleRate: number; channels: number; durationMs: number }> {
    if (this.strategy instanceof GRPCAIStrategy) {
      await this.strategy.ensureDaemonRunning();
      return (this.strategy as GRPCAIStrategy).synthesizeSpeech(text, voiceId, speed, modelStrategy);
    }
    return (this.strategy as FallbackAIStrategy).synthesizeSpeech(text);
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
