import { IBackendAdapter, BackendTaskResult } from './IBackendAdapter.js';
import { TaskPayload } from '../poller/ITaskPoller.js';
import { AIInferenceClient } from '@acc/ai-control-plane-sdk';

/**
 * AIControlPlaneAdapter:
 * Dispatches heavy AI inference tasks (TTS, LLM, Vision, Diffusion)
 * to the unified apps/ai-control-plane FastAPI server via @acc/ai-control-plane-sdk.
 */
export class AIControlPlaneAdapter implements IBackendAdapter {
  public readonly id = 'ai-control-plane' as const;
  public readonly capabilities = ['tts', 'llm', 'vram-purge', 'vision', 'diffusion'] as const;

  private client: AIInferenceClient;

  constructor(private readonly port: number = 50051) {
    this.client = new AIInferenceClient({
      baseUrls: [`http://127.0.0.1:${this.port}`, `http://localhost:${this.port}`],
    });
  }

  public getEstimatedVRAMBytes(task: TaskPayload): number {
    switch (task.type) {
      case 'tts':
        return 1.5 * 1024 * 1024 * 1024; // ~1.5 GB for Kokoro / VieNeu
      case 'llm':
        return 4.0 * 1024 * 1024 * 1024; // ~4 GB for Qwen/Llama
      case 'vision':
      case 'diffusion':
        return 6.0 * 1024 * 1024 * 1024; // ~6 GB for FLUX / SD
      default:
        return 512 * 1024 * 1024;
    }
  }

  public async isAlive(): Promise<boolean> {
    try {
      const health = await this.client.fetchHealth();
      return health?.status === 'ok';
    } catch {
      return false;
    }
  }

  public async purgeVRAM(): Promise<void> {
    try {
      await this.client.purgeModelWeightsCache();
    } catch (err: unknown) {
      console.warn(`[AIControlPlaneAdapter] purgeVRAM warning: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public async execute(task: TaskPayload): Promise<BackendTaskResult> {
    const isReady = await this.isAlive();
    if (!isReady) {
      return {
        success: false,
        error: `AI Control Plane backend is not reachable on port ${this.port}`,
      };
    }

    try {
      if (task.type === 'tts') {
        const text = (task.payload?.text as string) || '';
        const voice = (task.payload?.voice as string) || 'default';
        const model = (task.payload?.model as string) || 'kokoro';
        const speed = (task.payload?.speed as number) || 1.0;

        const audioBuffer = await this.client.openAiSpeech({
          input: text,
          voice,
          model,
          speed,
          response_format: 'wav',
        });

        return {
          success: true,
          data: {
            handledBy: this.id,
            audioBytesLength: audioBuffer.byteLength,
          },
          bytesProcessed: audioBuffer.byteLength,
        };
      }

      if (task.type === 'llm') {
        const prompt = (task.payload?.prompt as string) || '';
        const model = (task.payload?.model as string) || 'qwen2.5-coder-7b';

        const completion = await this.client.openAiChatCompletion({
          model,
          messages: [{ role: 'user', content: prompt }],
        });

        return {
          success: true,
          data: {
            handledBy: this.id,
            content: completion.choices?.[0]?.message?.content ?? '',
          },
        };
      }

      if (task.type === 'vram-purge') {
        await this.purgeVRAM();
        return {
          success: true,
          data: { handledBy: this.id, purged: true },
        };
      }

      return {
        success: false,
        error: `Action or task type '${task.type}' not supported by AIControlPlaneAdapter`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
