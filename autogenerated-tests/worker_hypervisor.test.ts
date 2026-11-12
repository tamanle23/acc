import { describe, it, expect } from 'bun:test';
import { BackendHypervisor } from '../apps/worker/src/hypervisor/BackendHypervisor.js';
import { IBackendAdapter, BackendTaskResult } from '../apps/worker/src/hypervisor/IBackendAdapter.js';
import { TaskPayload } from '../apps/worker/src/poller/ITaskPoller.js';

class MockBackendAdapter implements IBackendAdapter {
  public purgedCount = 0;
  public executedCount = 0;

  constructor(
    public readonly id: string,
    public readonly capabilities: string[],
    private alive = true,
  ) {}

  public getEstimatedVRAMBytes(_task: TaskPayload): number {
    return 1024 * 1024;
  }

  public async isAlive(): Promise<boolean> {
    return this.alive;
  }

  public async purgeVRAM(): Promise<void> {
    this.purgedCount++;
  }

  public async execute(task: TaskPayload): Promise<BackendTaskResult> {
    this.executedCount++;
    return {
      success: true,
      data: { handledBy: this.id, input: task.inputData },
    };
  }
}

describe('BackendHypervisor Unit Tests', () => {
  it('should register and retrieve adapters by capability', () => {
    const hypervisor = new BackendHypervisor();
    const ollama = new MockBackendAdapter('ollama', ['llm', 'json']);
    const aiControlPlane = new MockBackendAdapter('ai-control-plane', ['tts', 'vision']);

    hypervisor.registerAdapter(ollama);
    hypervisor.registerAdapter(aiControlPlane);

    expect(hypervisor.getAdapter('ollama')).toBe(ollama);
    expect(hypervisor.getAdapterForCapability('llm')).toBe(ollama);
    expect(hypervisor.getAdapterForCapability('tts')).toBe(aiControlPlane);
    expect(hypervisor.getAdapterForCapability('non-existent')).toBeUndefined();
  });

  it('should trigger preflight eviction on peer backends before executing tasks', async () => {
    const hypervisor = new BackendHypervisor();
    const ollama = new MockBackendAdapter('ollama', ['llm']);
    const aiControlPlane = new MockBackendAdapter('ai-control-plane', ['tts']);

    hypervisor.registerAdapter(ollama);
    hypervisor.registerAdapter(aiControlPlane);

    const task: TaskPayload = {
      taskId: 'task-dispatch-1',
      taskDefName: 'acc.tts.synthesize_speech',
      inputData: { text: 'Hello galaxy' },
    };

    const result = await hypervisor.dispatch('tts', task);

    expect(result.success).toBe(true);
    expect(result.data?.handledBy).toBe('ai-control-plane');
    expect(aiControlPlane.executedCount).toBe(1);
    // Peer ollama should have received a VRAM purge request
    expect(ollama.purgedCount).toBe(1);
    expect(aiControlPlane.purgedCount).toBe(0);
  });

  it('should throw an error when no adapter supports the requested capability', async () => {
    const hypervisor = new BackendHypervisor();
    const task: TaskPayload = {
      taskId: 'task-unknown',
      taskDefName: 'unknown',
      inputData: {},
    };

    expect(hypervisor.dispatch('unsupported-cap', task)).rejects.toThrow(
      'No adapter found for capability: unsupported-cap'
    );
  });
});
