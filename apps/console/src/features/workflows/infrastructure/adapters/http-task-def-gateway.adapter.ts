import { springApiClient } from '@/features/spring-auth/api-client';
import type { TaskDefinitionGatewayPort, RequestOptions } from '../../application/ports/task-definition-gateway.port';
import type { TaskDefinitionRecord, SaveTaskDefinitionInput } from '../../api/task-definition-api';
import { taskContractRegistry } from '../../components/studio/utils/contracts/task-contract-registry';

/**
 * Pure HTTP Gateway Adapter for Task Definitions.
 * Zero sandbox store imports. Zero mock leakage.
 * In development, Axios interceptors handle mock simulations transparently.
 * Conforms to WinterTC cancellation via AbortSignal.
 */
export class HttpTaskDefinitionGatewayAdapter implements TaskDefinitionGatewayPort {

  async listLatest(options?: RequestOptions): Promise<TaskDefinitionRecord[]> {
    try {
      const res = await springApiClient.get('/v1/workflow/task-definitions', {
        signal: options?.signal,
      });
      if (res.status === 200) {
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.body)
            ? res.data.body
            : res.data?.data || [];
        taskContractRegistry.preload(list);
        return list;
      }
      return [];
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'CanceledError') {
        throw err;
      }
      console.warn('Failed to fetch task definitions from backend:', err);
      return [];
    }
  }

  async getVersions(taskName: string, options?: RequestOptions): Promise<TaskDefinitionRecord[]> {
    if (!taskName) return [];
    try {
      const res = await springApiClient.get(`/v1/workflow/task-definitions/${encodeURIComponent(taskName)}/versions`, {
        signal: options?.signal,
      });
      if (res.status === 200) {
        return Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.body)
            ? res.data.body
            : res.data?.data || [];
      }
      return [];
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'CanceledError') {
        throw err;
      }
      console.warn(`Failed to fetch versions for task ${taskName}:`, err);
      return [];
    }
  }

  async saveDraft(input: SaveTaskDefinitionInput, options?: RequestOptions): Promise<TaskDefinitionRecord> {
    const res = await springApiClient.post('/v1/workflow/task-definitions', input, {
      signal: options?.signal,
    });
    return res.data;
  }

  async publishVersion(taskName: string, version: number, options?: RequestOptions): Promise<TaskDefinitionRecord> {
    const res = await springApiClient.post(
      `/v1/workflow/task-definitions/${encodeURIComponent(taskName)}/versions/${version}/publish`,
      {},
      { signal: options?.signal }
    );
    return res.data;
  }

  async deleteDraftVersion(taskName: string, version: number, options?: RequestOptions): Promise<boolean> {
    const res = await springApiClient.delete(
      `/v1/workflow/task-definitions/${encodeURIComponent(taskName)}/versions/${version}`,
      { signal: options?.signal }
    );
    return res.status === 204 || res.status === 200;
  }
}

export const httpTaskDefinitionGateway = new HttpTaskDefinitionGatewayAdapter();
