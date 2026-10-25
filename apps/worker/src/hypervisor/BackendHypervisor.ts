import { IBackendAdapter, BackendTaskResult } from './IBackendAdapter.js';
import { TaskPayload } from '../poller/ITaskPoller.js';
import { Logger } from '@acc/core';

export class BackendHypervisor {
  private adapters = new Map<string, IBackendAdapter>();
  private activeLocks = new Set<string>();

  public registerAdapter(adapter: IBackendAdapter): void {
    this.adapters.set(adapter.id, adapter);
    Logger.info('BackendHypervisor', `Registered backend adapter '${adapter.id}' with capabilities: [${adapter.capabilities.join(', ')}]`);
  }

  public getAdapter(id: string): IBackendAdapter | undefined {
    return this.adapters.get(id);
  }

  public getAdapters(): IBackendAdapter[] {
    return Array.from(this.adapters.values());
  }

  public getAdapterForCapability(capability: string): IBackendAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.capabilities.includes(capability)) {
        return adapter;
      }
    }
    return undefined;
  }

  public async preflightEviction(targetAdapterId: string): Promise<void> {
    // Before heavy jobs, check if peer backends need VRAM eviction
    for (const [id, adapter] of this.adapters.entries()) {
      if (id !== targetAdapterId) {
        try {
          if (await adapter.isAlive()) {
            Logger.info('BackendHypervisor', `Pre-flight eviction: requesting VRAM purge from peer '${id}'`);
            await adapter.purgeVRAM();
          }
        } catch (err: any) {
          Logger.warn('BackendHypervisor', `Eviction check failed for '${id}': ${err.message}`);
        }
      }
    }
  }

  public async dispatch(capability: string, task: TaskPayload): Promise<BackendTaskResult> {
    const adapter = this.getAdapterForCapability(capability);
    if (!adapter) {
      throw new Error(`[BackendHypervisor] No adapter found for capability: ${capability}`);
    }

    // Handshake pre-flight eviction if needed
    await this.preflightEviction(adapter.id);

    return await adapter.execute(task);
  }
}
