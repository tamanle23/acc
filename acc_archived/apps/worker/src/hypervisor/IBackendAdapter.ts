import { TaskPayload } from '../poller/ITaskPoller.js';

export interface BackendTaskResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  bytesProcessed?: number;
}

export interface IBackendAdapter {
  readonly id: string; // 'python-backend' | 'ollama'
  readonly capabilities: string[]; // ['tts', 'vision', 'llm', 'image-gen']

  getEstimatedVRAMBytes(task: TaskPayload): number;
  isAlive(): Promise<boolean>;
  purgeVRAM(): Promise<void>;
  execute(task: TaskPayload): Promise<BackendTaskResult>;
}
