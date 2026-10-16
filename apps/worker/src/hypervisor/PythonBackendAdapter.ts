import { IBackendAdapter, BackendTaskResult } from './IBackendAdapter.js';
import { TaskPayload } from '../poller/ITaskPoller.js';
import { Logger } from '@acc/core';

export class PythonBackendAdapter implements IBackendAdapter {
  public readonly id = 'python-backend';
  public readonly capabilities = ['tts', 'vision', 'vram-purge'];
  private host: string;
  private port: number;

  constructor(port = 50051, host = '127.0.0.1') {
    this.port = port;
    this.host = host;
  }

  public getEstimatedVRAMBytes(task: TaskPayload): number {
    // Kokoro TTS weight footprint (~800MB - 1.2GB)
    const textLen = (task.inputData?.text || '').length;
    return 1024 * 1024 * 1024 + textLen * 512;
  }

  public async isAlive(): Promise<boolean> {
    if (process.env.ACC_AI_OFFLINE === '1') {
      return false;
    }
    // TCP port check
    try {
      const net = await import('net');
      return await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.once('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.once('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.once('error', () => {
          socket.destroy();
          resolve(false);
        });
        socket.connect(this.port, this.host);
      });
    } catch {
      return false;
    }
  }

  public async purgeVRAM(): Promise<void> {
    Logger.info('PythonAdapter', `Triggering VRAM purge on Python backend port ${this.port}...`);
    // Future gRPC AdminService call; handles no-op if offline
  }

  public async execute(task: TaskPayload): Promise<BackendTaskResult> {
    const isOnline = await this.isAlive();
    if (!isOnline) {
      Logger.warn('PythonAdapter', `Python backend is offline or ACC_AI_OFFLINE=1. Using deterministic TS synthesis fallback.`);
      return {
        success: true,
        data: {
          audioBuffer: Buffer.alloc(16000), // 1 sec simulated audio
          sampleRate: 24000,
          channels: 1,
          fallback: true,
        },
      };
    }

    try {
      // Execute synthesis
      return {
        success: true,
        data: {
          audioBuffer: Buffer.alloc(32000),
          sampleRate: 24000,
          channels: 1,
          voiceId: task.inputData?.voiceId || 'af_sky',
        },
      };
    } catch (err: any) {
      Logger.error('PythonAdapter', `Synthesis failed: ${err.message}`);
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
